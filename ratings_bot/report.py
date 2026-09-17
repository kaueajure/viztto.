from collections import Counter
from datetime import datetime, timezone
from .models import CanonicalPlayer

NIVEIS = ("exact", "high", "medium", "low", "ambiguous", "unmatched")


def build_report(players: list[CanonicalPlayer], result: dict) -> dict:
    rows = {p["id"]: p for p in result["players"]}
    levels = Counter(d["confidence"] for matches in result["diagnostics"].values() for d in matches.values())
    matched = sum(bool(p["sources"]) for p in rows.values())
    # Cada jogador pertence a uma liga; candidatos e falhas nunca são replicados.
    by_league: dict[str, dict] = {}
    for player in players:
        league = by_league.setdefault(player.league, {
            "total": 0, "externalRatings": 0, "multiSource": 0, "fallbackEngine": 0,
            "providerCandidates": 0, "requestFailures": 0, "collision": 0,
            **{nivel: 0 for nivel in NIVEIS},
        })
        league["total"] += 1
        externo = bool(rows[player.id]["sources"])
        league["externalRatings"] += externo
        league["multiSource"] += len(rows[player.id]["sources"]) > 1
        league["fallbackEngine"] += not externo
        for matches in result["diagnostics"].values():
            diagnostico = matches.get(player.id)
            if not diagnostico:
                continue
            league[diagnostico["confidence"]] += 1
            league["providerCandidates"] += diagnostico["candidateCount"]
            league["requestFailures"] += diagnostico["error"]
            league["collision"] += diagnostico["collision"]
    for league in by_league.values():
        league["coverage"] = league["externalRatings"] / league["total"] if league["total"] else 0
    return {"generatedAt": datetime.now(timezone.utc).isoformat(), "batchId": result["batchId"],
            "providers": result["providers"], "players": {
                "totalTransfermarkt": len(players), "matchedExternal": matched,
                "multiSource": sum(len(p["sources"]) > 1 for p in rows.values()),
                "fallbackEngine": len(players) - matched},
            "matching": {k: levels[k] for k in NIVEIS},
            "collision": sum(d["collision"] for matches in result["diagnostics"].values() for d in matches.values()),
            "coverage": matched / len(players) if players else 0, "byLeague": by_league}


def print_report(report: dict) -> None:
    print("══════════════════════════════\nVIZTTO — RATINGS\n══════════════════════════════")
    print(f"Transfermarkt: {report['players']['totalTransfermarkt']} jogadores")
    if not report["providers"]:
        print("Providers externos habilitados: nenhum")
        print("Todos os jogadores usarão o Rating Engine Viztto.")
    for name, counts in report["providers"].items():
        print(f"Provider {name} ({counts['status']}): {counts['requests']} consultas, "
              f"{counts['cacheHits']} cache hits, {counts['errors']} erros, "
              f"{counts['providerCandidates']} candidatos, {counts['staleMappings']} mappings stale")
    print(f"Com rating externo: {report['players']['matchedExternal']}")
    print(f"Multi-source: {report['players']['multiSource']}")
    print(f"Somente Rating Engine: {report['players']['fallbackEngine']}")
    print(f"Matching: {report['matching']}")
    print(f"Colisões: {report['collision']}")
    print(f"Cobertura externa: {report['coverage']:.1%}")
    if report["byLeague"]:
        print("Por liga:")
    for liga, m in sorted(report["byLeague"].items()):
        print(f"  {liga}: {m['total']} jogadores, {m['externalRatings']} externos, "
              f"{m['multiSource']} multi-source, {m['fallbackEngine']} engine, "
              f"exact {m['exact']}, high {m['high']}, medium {m['medium']}, "
              f"ambiguous {m['ambiguous']}, candidatos {m['providerCandidates']}, "
              f"falhas {m['requestFailures']}, cobertura {m['coverage']:.1%}")
