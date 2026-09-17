"""One batch, isolated provider failures, revalidated mappings and global 1:1."""
import asyncio
import json
import re
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from .cache import Cache, write_json
from .config import Config
from .matcher import ACCEPTED, Match, choose, enforce_one_to_one
from .models import CanonicalPlayer, ExternalPlayer, parse_input
from .normalizer import RatingNormalizer
from .providers.base import RatingsProvider
from .report import build_report


async def run(data: dict, providers: list[RatingsProvider], calibrations: dict, config: Config) -> tuple[dict, dict]:
    players = parse_input(data)
    if len({p.name for p in providers}) != len(providers):
        raise ValueError("Duplicate providers")
    rows = {p.id: {"id": p.id, "transfermarktId": p.transfermarktId, "sources": []} for p in players}
    diagnostics, metrics = {}, {}
    for provider in sorted(providers, key=lambda p: p.name):
        name = provider.name
        if not re.fullmatch(r"[a-z0-9-]{1,80}", name) or not provider.authorized:
            raise ValueError("Provider is not authorized")
        normalizer = RatingNormalizer(calibrations[name])
        cache = Cache(config.cache_dir / name, config.ttl)
        mapping_path = config.cache_dir / "mappings" / f"{name}.json"
        try:
            mappings = json.loads(mapping_path.read_text())
            if not isinstance(mappings, dict):
                raise ValueError("Invalid mappings")
        except (OSError, ValueError):
            mappings = {}
        counts = {"requests": 0, "cacheHits": 0, "errors": 0, "staleMappings": 0, "providerCandidates": 0}
        metrics[name] = counts
        matches: dict[str, Match] = {}
        semaphore = asyncio.Semaphore(config.concurrency)

        async def call(category: str, key: str, fn, force: bool = False):
            cache_key = provider.cache_namespace + ":" + key
            if not config.refresh and not force:
                hit, value = cache.get(category, cache_key)
                if hit:
                    counts["cacheHits"] += 1
                    return value
            counts["requests"] += 1
            value = await asyncio.wait_for(fn(), config.timeout)
            serialized = [asdict(p) for p in value] if isinstance(value, list) else asdict(value) if value else None
            cache.put(category, cache_key, serialized)
            return serialized

        aliases = provider.position_aliases

        async def resolve(player: CanonicalPlayer):
            async with semaphore:
                mapping = mappings.get(player.transfermarktId)
                try:
                    candidates = []
                    if isinstance(mapping, dict) and isinstance(mapping.get("externalId"), str):
                        # Every mapping is revalidated against fresh provider data, even manual.
                        raw = await call("players", mapping["externalId"], lambda: provider.fetch_player(mapping["externalId"]), force=True)
                        mapped = ExternalPlayer(**raw) if raw else None
                        if mapped and mapped.externalPlayerId != mapping["externalId"]:
                            raise ValueError("Provider returned another identity")
                        if not mapped or choose(player, [mapped], aliases).confidence not in ACCEPTED:
                            mapping["status"] = "stale"
                            counts["staleMappings"] += 1
                        else:
                            candidates.append(mapped)
                    raw_candidates = await call("search", json.dumps(asdict(player), sort_keys=True), lambda: provider.find_player(player))
                    candidates.extend(ExternalPlayer(**p) for p in raw_candidates)
                    encontrados = len({p.externalPlayerId for p in candidates})
                    counts["providerCandidates"] += encontrados
                    match = choose(player, candidates, aliases)
                    # Search results are identity candidates; fetch full, current rating record.
                    if match.confidence in ACCEPTED and match.player:
                        external_id = match.player.externalPlayerId
                        raw = await call("players", external_id, lambda: provider.fetch_player(external_id))
                        fetched = ExternalPlayer(**raw) if raw else None
                        if not fetched or fetched.externalPlayerId != external_id:
                            match = Match()
                        else:
                            match = choose(player, [fetched], aliases)
                    match.candidate_count = encontrados
                    matches[player.id] = match
                except (Exception,):
                    # Untrusted provider exception text can contain credentials.
                    counts["errors"] += 1
                    matches[player.id] = Match(error=True)
                    if isinstance(mapping, dict):
                        mapping["status"] = "stale"

        try:
            healthy = await asyncio.wait_for(provider.health_check(), config.timeout)
        except Exception:
            healthy = False
        if healthy:
            await asyncio.gather(*(resolve(p) for p in players))
        else:
            # Provider offline atinge todos os jogadores; a falha é de todas as ligas.
            counts["errors"] += 1
            matches = {p.id: Match(error=True) for p in players}
        enforce_one_to_one(matches)
        for player in players:
            match = matches[player.id]
            if match.confidence in ACCEPTED and match.player:
                try:
                    source = normalizer.normalize(name, match.player, match.confidence, match.matched_by)
                    rows[player.id]["sources"].append(source)
                    mappings[player.transfermarktId] = {
                        "externalId": match.player.externalPlayerId, "confidence": match.confidence,
                        "lastValidatedAt": datetime.now(timezone.utc).isoformat(), "status": "active"}
                except ValueError:
                    counts["errors"] += 1
                    match.confidence = "low"
                    match.error = True
            elif player.transfermarktId in mappings:
                mappings[player.transfermarktId]["status"] = "stale"
        write_json(mapping_path, mappings)
        diagnostics[name] = {key: {"confidence": m.confidence, "collision": m.collision,
                                  "matchedBy": m.matched_by, "candidateCount": m.candidate_count,
                                  "error": m.error} for key, m in matches.items()}
        counts["synthetic"] = provider.synthetic
        # Status global do provider; o Node deriva o status de cada liga por jogador.
        falhas = sum(m.error for m in matches.values())
        counts["status"] = "failed" if not healthy or falhas == len(players) else "degraded" if falhas else "healthy"
    result = {"version": 1, "batchId": data["batchId"], "players": list(rows.values()),
              "providers": metrics, "diagnostics": diagnostics}
    return result, build_report(players, result)
