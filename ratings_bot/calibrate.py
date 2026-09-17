"""Offline diagnostics; proposed curves require human review before activation."""
import argparse
import itertools
import json
import statistics
from pathlib import Path
from .cache import write_json
from .models import parse_input
from .cli import safe_output


def stats(values: list[float]) -> dict:
    return {"count": len(values), "mean": statistics.mean(values) if values else None,
            "median": statistics.median(values) if values else None,
            "stddev": statistics.pstdev(values) if values else None}


def analyze(canonical: dict, results: dict) -> dict:
    players = {p.id: p for p in parse_input(canonical)}
    if canonical["batchId"] != results["batchId"]:
        raise ValueError("Mismatched batches")
    pairs, errors = {}, {}
    seen = set()
    for row in results["players"]:
        if row["id"] not in players or row["id"] in seen:
            raise ValueError("Invalid result identity")
        seen.add(row["id"])
        player = players[row["id"]]
        if player.transfermarktId != row["transfermarktId"]:
            raise ValueError("Invalid canonical reference")
        sources = sorted((s for s in row["sources"] if s["confidence"] in ("exact", "high")), key=lambda s: s["provider"])
        for a, b in itertools.combinations(sources, 2):
            key = a["provider"] + ":" + b["provider"]
            pairs.setdefault(key, []).append((a["ratingOriginal"], b["ratingOriginal"], a["ratingNormalizado"], b["ratingNormalizado"]))
        if sources and player.engineOverall is not None:
            error = player.engineOverall - statistics.mean(s["ratingNormalizado"] for s in sources)
            groups = {"league": player.league, "division": player.division,
                      "age": str((player.age // 5) * 5) if player.age is not None else "unknown",
                      "position": player.position, "club": player.club,
                      "clubStrength": str(int((player.clubStrength or 0) // 10) * 10),
                      "marketValue": "unknown" if player.marketValue is None else "<1M" if player.marketValue < 1e6 else "1M-10M" if player.marketValue < 1e7 else ">=10M"}
            for dimension, group in groups.items():
                errors.setdefault(dimension, {}).setdefault(str(group), []).append(error)
    comparisons = {}
    proposals = {}
    for key, values in pairs.items():
        bands = {}
        for _, _, a, b in values:
            bands.setdefault(str(int(a // 10) * 10), []).append(a - b)
        comparisons[key] = {"originalA": stats([v[0] for v in values]), "originalB": stats([v[1] for v in values]),
                            "normalizedDifference": stats([v[2] - v[3] for v in values]),
                            "byBand": {k: stats(v) for k, v in bands.items()}}
        xs, ys = [v[0] for v in values], [v[3] for v in values]
        if len(xs) >= 3 and len(set(xs)) >= 2:
            slope, intercept = statistics.linear_regression(xs, ys)
            if slope > 0:
                proposals[key] = {"version": "offline-proposal-v1", "reviewRequired": True,
                                  "overall": [[x, max(1, min(99, slope * x + intercept))] for x in (min(xs), max(xs))]}
    return {"comparisons": comparisons, "engineError": {k: {g: stats(v) for g, v in groups.items()} for k, groups in errors.items()},
            "proposedCalibrations": proposals, "warning": "Sample-only curves: review endpoints, bias and licenses before activation."}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path(".cache/ratings/players-to-enrich.json"))
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("relatorios/ratings-calibration.json"))
    args = parser.parse_args()
    write_json(safe_output(args.output), analyze(json.loads(args.input.read_text()), json.loads(args.results.read_text())))


if __name__ == "__main__":
    main()
