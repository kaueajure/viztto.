"""Safe dry-run collector for external game ratings.

Never publishes snapshots. Default is fixture/dry-run. Live network enrichment
is blocked while providers remain DISABLED_BY_POLICY / REVIEW_REQUIRED.
"""
from __future__ import annotations
import argparse
import json
import time
from dataclasses import asdict
from pathlib import Path

from .cache import write_json
from .cli import safe_output
from .consensus import compare_families, consensus_from_observations
from .matcher import choose
from .models import CanonicalPlayer, parse_input
from .observation import RatingObservation, now_iso
from .providers import DISABLED_PROVIDERS, PROVIDER_ALIASES
from .providers.ea_official import EAOfficialProvider, parse_ratings_html, ParserError as EAParserError
from .providers.pesmaster import PesMasterProvider, parse_player_html, ParserError as PesParserError
from .providers.sofifa import SofifaProvider, SofifaPolicyError, parse_api_player
from .providers.status import FAMILY_EA_FC, FAMILY_KONAMI, CALIBRATION_TYPES


ROOT = Path(__file__).resolve().parent
DEFAULT_FIXTURES = ROOT / "fixtures"


def _canonical_from_input(path: Path | None, limit: int | None, player: str | None,
                          league: str | None) -> list[CanonicalPlayer]:
    if path and path.exists():
        data = json.loads(path.read_text())
        players = parse_input(data)
        if league:
            players = [p for p in players if p.league == league]
        if player:
            needle = player.lower()
            players = [p for p in players if needle in p.name.lower()]
        if limit is not None:
            players = players[:limit]
        return players
    # Tiny demo universe for fixture dry-runs without Transfermarkt extract.
    demo = [
        CanonicalPlayer("tm-mbappe", "231747", "Kylian Mbappé", "laliga", "Real Madrid",
                        "ST", "1998-12-20", "France", 178, 180_000_000, 27, "1", 90, 91),
        CanonicalPlayer("tm-haaland", "133543", "Erling Haaland", "premier-league",
                        "Manchester City", "ST", "2000-07-21", "Norway", 195, 180_000_000, 25, "1", 92, 90),
        CanonicalPlayer("tm-vini", "238794", "Vinícius Júnior", "laliga", "Real Madrid",
                        "LW", "2000-07-12", "Brazil", 176, 150_000_000, 25, "1", 88, 89),
        CanonicalPlayer("tm-isak", "10587", "Alexander Isak", "premier-league", "Liverpool",
                        "ST", "1999-09-21", "Sweden", 192, 120_000_000, 26, "1", 86, 85),
        CanonicalPlayer("tm-messi", "158023", "Lionel Messi", "mls", "Inter Miami",
                        "RW", "1987-06-24", "Argentina", 170, 30_000_000, 37, "1", 88, 88),
    ]
    if player:
        needle = player.lower()
        demo = [p for p in demo if needle in p.name.lower()]
    if limit is not None:
        demo = demo[:limit]
    return demo


def _load_fixture_provider(source: str, fixtures: Path):
    source = PROVIDER_ALIASES.get(source, source)
    if source == "ea-official":
        html = fixtures / "ea-official" / "ratings-page.html"
        return EAOfficialProvider(html_path=html), "ea-official"
    if source == "sofifa":
        sample = fixtures / "sofifa" / "player-sample.json"
        return SofifaProvider(fixture_path=sample), "sofifa"
    if source == "pesmaster":
        paths = [
            fixtures / "pesmaster" / "player-standard.html",
            fixtures / "pesmaster" / "player-featured.html",
        ]
        return PesMasterProvider(html_paths=[p for p in paths if p.exists()]), "pesmaster"
    raise ValueError(f"Unknown source: {source}")


def observation_from_match(source: str, family: str, player: CanonicalPlayer, match) -> RatingObservation | None:
    if not match.player:
        return None
    ext = match.player
    return RatingObservation(
        source=source,
        family=ext.family or family,
        sourcePlayerId=ext.externalPlayerId,
        name=ext.name,
        overallRaw=ext.overall,
        ratingType=ext.ratingType or "unknown",
        collectedAt=now_iso(),
        birthDate=ext.dateOfBirth,
        age=ext.age,
        club=ext.club,
        nationality=ext.country,
        position=ext.position,
        potentialRaw=ext.potential,
        attributes=dict(ext.attributes),
        game=ext.game,
        version=ext.version,
        sourceUrl=ext.sourceUrl,
        sourceUpdatedAt=ext.sourceUpdatedAt,
        matchLevel=match.confidence,
        vizttoPlayerId=player.id,
    )


def run_fontes(args: argparse.Namespace) -> dict:
    started = time.monotonic()
    sources = args.source or ["ea-official", "pesmaster", "sofifa"]
    sources = [PROVIDER_ALIASES.get(s, s) for s in sources]
    fixtures = Path(args.fixtures)
    players = _canonical_from_input(args.input, args.limit, args.player, args.league)

    report = {
        "dryRun": True,
        "published": False,
        "sources": {},
        "observations": [],
        "matching": {"exact": 0, "high": 0, "medium": 0, "ambiguous": 0, "unmatched": 0, "low": 0},
        "players": [],
        "policy": {name: DISABLED_PROVIDERS.get(name, "n/a") for name in sources},
    }

    all_obs: list[dict] = []

    for source in sources:
        src_stats = {
            "requests": 0, "cacheHits": 0, "playersCollected": 0,
            "baseRatings": 0, "specialIgnored": 0, "unknownIgnored": 0,
            "matchedExact": 0, "matchedHigh": 0, "ambiguous": 0, "unmatched": 0,
            "errors": 0, "status": None, "reason": DISABLED_PROVIDERS.get(source),
        }
        try:
            if args.live:
                raise ValueError(
                    f"Live collection refused for {source}: {DISABLED_PROVIDERS.get(source, 'policy')}"
                )
            provider, canonical_name = _load_fixture_provider(source, fixtures)
            src_stats["status"] = provider.availability
            src_stats["family"] = provider.family
            # Collect from fixture index
            collected = list(getattr(provider, "_index", {}).values()) or list(
                getattr(provider, "players", {}).values()
            )
            src_stats["requests"] = 1
            src_stats["playersCollected"] = len(collected)
            if not collected:
                raise ValueError(f"{source}: empty collection (parser/fixture failure)")

            for p in collected:
                if (p.ratingType or "unknown") in CALIBRATION_TYPES:
                    src_stats["baseRatings"] += 1
                elif (p.ratingType or "") in ("special", "featured", "event"):
                    src_stats["specialIgnored"] += 1
                else:
                    src_stats["unknownIgnored"] += 1

            for player in players:
                match = choose(player, collected, provider.position_aliases)
                level = match.confidence
                report["matching"][level] = report["matching"].get(level, 0) + 1
                if level == "exact":
                    src_stats["matchedExact"] += 1
                elif level == "high":
                    src_stats["matchedHigh"] += 1
                elif level == "ambiguous":
                    src_stats["ambiguous"] += 1
                elif level in ("unmatched", "low", "medium"):
                    if level == "unmatched":
                        src_stats["unmatched"] += 1

                obs = observation_from_match(canonical_name, provider.family, player, match)
                if obs:
                    row = obs.to_dict()
                    all_obs.append(row)
                    report["observations"].append(row)
        except (ValueError, EAParserError, PesParserError, SofifaPolicyError, OSError, KeyError, TypeError) as err:
            src_stats["errors"] += 1
            src_stats["error"] = f"{type(err).__name__}: {err}"
        report["sources"][source] = src_stats

    consensus = consensus_from_observations(
        [o for o in all_obs if o.get("matchLevel") in ("exact", "high")
         and (o.get("ratingType") or "unknown") in CALIBRATION_TYPES]
    )
    report["consensus"] = consensus
    report["familyComparison"] = compare_families(
        [o for o in all_obs if o.get("matchLevel") in ("exact", "high")],
        FAMILY_EA_FC,
        FAMILY_KONAMI,
    )
    report["elapsedSeconds"] = round(time.monotonic() - started, 3)
    report["canonicalPlayers"] = len(players)

    # Per-player sample cards
    by_viztto: dict[str, list[dict]] = {}
    for obs in all_obs:
        by_viztto.setdefault(obs.get("vizttoPlayerId") or obs["name"], []).append(obs)
    for player in players:
        rows = by_viztto.get(player.id, [])
        report["players"].append({
            "vizttoPlayerId": player.id,
            "transfermarktId": player.transfermarktId,
            "name": player.name,
            "club": player.club,
            "dateOfBirth": player.dateOfBirth,
            "observations": rows,
            "familyConsensus": consensus_from_observations([
                o for o in rows
                if o.get("matchLevel") in ("exact", "high")
                and (o.get("ratingType") or "unknown") in CALIBRATION_TYPES
            ]),
        })

    return report


def print_fontes_report(report: dict) -> None:
    print("RATINGS FONTES — dry-run (não publica snapshots)")
    print(f"Canonical players: {report.get('canonicalPlayers')}  elapsed: {report.get('elapsedSeconds')}s")
    for name, s in report.get("sources", {}).items():
        print(
            f"\nSource: {name}\n"
            f"  status: {s.get('status')}  family: {s.get('family')}\n"
            f"  requests: {s.get('requests')}  collected: {s.get('playersCollected')}\n"
            f"  base: {s.get('baseRatings')}  specialIgnored: {s.get('specialIgnored')}  "
            f"unknownIgnored: {s.get('unknownIgnored')}\n"
            f"  exact: {s.get('matchedExact')}  high: {s.get('matchedHigh')}  "
            f"ambiguous: {s.get('ambiguous')}  unmatched: {s.get('unmatched')}\n"
            f"  errors: {s.get('errors')}"
            + (f"\n  error: {s['error']}" if s.get("error") else "")
            + (f"\n  policy: {s.get('reason')}" if s.get("reason") else "")
        )
    c = report.get("consensus", {})
    print(f"\nFamily evidence count: {c.get('evidenceCount')} (not raw observation count)")
    for fam, row in (c.get("families") or {}).items():
        print(f"  {fam}: overallRaw={row['overallRaw']} via {row['source']} "
              f"({row['contributors']} contributor(s))")
    if c.get("divergences"):
        print(f"  divergences: {len(c['divergences'])}")
    cmp_ = report.get("familyComparison") or {}
    if cmp_.get("commonPlayers"):
        print(
            f"\nEA vs Konami common players: {cmp_['commonPlayers']}  "
            f"corr={cmp_.get('correlation')}  meanDiff={cmp_.get('meanDifference')}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="External game ratings dry-run — never publishes official snapshots",
    )
    parser.add_argument("--input", type=Path, help="players-to-enrich.json (optional)")
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    parser.add_argument("--source", action="append", default=[],
                        help="ea-official | sofifa | pesmaster (repeatable)")
    parser.add_argument("--league")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--player")
    parser.add_argument("--report", type=Path, default=Path("relatorios/ratings-fontes.json"))
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--live", action="store_true",
                        help="Refused while providers are policy-disabled")
    parser.add_argument("--probe", action="store_true",
                        help="Print provider policy/availability only")
    args = parser.parse_args()
    try:
        safe_output(args.report)
        if args.probe:
            for name in (args.source or ["ea-official", "sofifa", "pesmaster"]):
                key = PROVIDER_ALIASES.get(name, name)
                print(f"{key}: {DISABLED_PROVIDERS.get(key, 'unknown')}")
            return
        report = run_fontes(args)
        write_json(args.report, report)
        print_fontes_report(report)
        print(f"\nReport written: {args.report}")
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(1, f"ratings:fontes failed ({type(error).__name__}): {error}\n")


if __name__ == "__main__":
    main()
