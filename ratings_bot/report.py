from collections import Counter
from datetime import datetime, timezone
from .models import CanonicalPlayer


def build_report(players: list[CanonicalPlayer], result: dict) -> dict:
    rows = {p["id"]: p for p in result["players"]}
    levels = Counter(d["confidence"] for matches in result["diagnostics"].values() for d in matches.values())
    matched = sum(bool(p["sources"]) for p in rows.values())
    by_league = {}
    for player in players:
        league = by_league.setdefault(player.league, {"total": 0, "externalRatings": 0, "fallbackEngine": 0})
        league["total"] += 1
        league["externalRatings"] += bool(rows[player.id]["sources"])
        league["fallbackEngine"] += not bool(rows[player.id]["sources"])
    return {"generatedAt": datetime.now(timezone.utc).isoformat(), "batchId": result["batchId"],
            "providers": result["providers"], "players": {
                "totalTransfermarkt": len(players), "matchedExternal": matched,
                "multiSource": sum(len(p["sources"]) > 1 for p in rows.values()),
                "fallbackEngine": len(players) - matched},
            "matching": {k: levels[k] for k in ("exact", "high", "medium", "low", "ambiguous", "unmatched")},
            "collision": sum(d["collision"] for matches in result["diagnostics"].values() for d in matches.values()),
            "coverage": matched / len(players) if players else 0, "byLeague": by_league}


def print_report(report: dict) -> None:
    print("══════════════════════════════\nVIZTTO — RATINGS\n══════════════════════════════")
    print(f"Transfermarkt: {report['players']['totalTransfermarkt']} jogadores")
    for name, counts in report["providers"].items():
        print(f"Provider {name}: {counts['requests']} consultas, {counts['cacheHits']} cache hits, {counts['errors']} erros")
    print(f"Com rating externo: {report['players']['matchedExternal']}")
    print(f"Somente Rating Engine: {report['players']['fallbackEngine']}")
    print(f"Matching: {report['matching']}")
    print(f"Cobertura externa: {report['coverage']:.1%}")
