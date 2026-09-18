"""Family-aware consensus: correlated sources do not cast independent votes."""
from __future__ import annotations
from collections import defaultdict
from statistics import mean, median
from .providers.status import CALIBRATION_TYPES, FAMILY_EA_FC


# Within ea_fc, prefer the official EA roster when versions align.
FAMILY_SOURCE_PREFERENCE = {
    FAMILY_EA_FC: ("ea-official", "sofifa"),
}


def _percentile(sorted_vals: list[float], p: float) -> float | None:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * p
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def summarize_distribution(values: list[float]) -> dict:
    vals = sorted(values)
    return {
        "count": len(vals),
        "mean": mean(vals) if vals else None,
        "median": median(vals) if vals else None,
        "p10": _percentile(vals, 0.10),
        "p25": _percentile(vals, 0.25),
        "p50": _percentile(vals, 0.50),
        "p75": _percentile(vals, 0.75),
        "p90": _percentile(vals, 0.90),
    }


def consensus_from_observations(observations: list[dict]) -> dict:
    """
    Each observation: {source, family, overallRaw, ratingType, ...}.
    Special/unknown never enter automatic calibration.
    Same family → one evidence (+ recorded divergence).
    """
    ignored_special = []
    unknown = []
    by_family: dict[str, list[dict]] = defaultdict(list)
    for obs in observations:
        rtype = obs.get("ratingType") or "unknown"
        if rtype not in CALIBRATION_TYPES:
            if rtype == "unknown":
                unknown.append(obs)
            else:
                ignored_special.append(obs)
            continue
        by_family[obs["family"]].append(obs)

    families = {}
    divergences = []
    for family, rows in sorted(by_family.items()):
        preference = FAMILY_SOURCE_PREFERENCE.get(family, ())
        ranked = sorted(
            rows,
            key=lambda r: (
                preference.index(r["source"]) if r["source"] in preference else 99,
                r["source"],
            ),
        )
        chosen = ranked[0]
        raws = [float(r["overallRaw"]) for r in rows]
        if max(raws) - min(raws) > 0:
            divergences.append({
                "family": family,
                "sources": [
                    {"source": r["source"], "overallRaw": r["overallRaw"],
                     "version": r.get("version")}
                    for r in ranked
                ],
                "spread": max(raws) - min(raws),
            })
        families[family] = {
            "overallRaw": chosen["overallRaw"],
            "source": chosen["source"],
            "contributors": len(rows),
            "sources": [r["source"] for r in ranked],
            "distribution": summarize_distribution(raws),
        }

    return {
        "families": families,
        "familyCount": len(families),
        "evidenceCount": len(families),  # not len(observations)
        "ignoredSpecial": len(ignored_special),
        "ignoredUnknown": len(unknown),
        "divergences": divergences,
        "specialSamples": [
            {"source": o["source"], "overallRaw": o.get("overallRaw"),
             "ratingType": o.get("ratingType"), "name": o.get("name")}
            for o in ignored_special[:20]
        ],
    }


def compare_families(observations: list[dict], family_a: str, family_b: str) -> dict:
    """Cross-family comparison for future calibration (raw scales differ)."""
    by_player: dict[str, dict[str, float]] = defaultdict(dict)
    for obs in observations:
        if obs.get("ratingType") not in CALIBRATION_TYPES:
            continue
        key = obs.get("vizttoPlayerId") or obs.get("name")
        if not key:
            continue
        by_player[key][obs["family"]] = float(obs["overallRaw"])
    pairs = [
        (vals[family_a], vals[family_b])
        for vals in by_player.values()
        if family_a in vals and family_b in vals
    ]
    if not pairs:
        return {"commonPlayers": 0, family_a: None, family_b: None}
    a_vals = [p[0] for p in pairs]
    b_vals = [p[1] for p in pairs]
    diffs = [a - b for a, b in pairs]
    # Pearson-ish without numpy
    ma, mb = mean(a_vals), mean(b_vals)
    num = sum((a - ma) * (b - mb) for a, b in pairs)
    den_a = sum((a - ma) ** 2 for a in a_vals) ** 0.5
    den_b = sum((b - mb) ** 2 for b in b_vals) ** 0.5
    corr = num / (den_a * den_b) if den_a and den_b else None
    return {
        "commonPlayers": len(pairs),
        "correlation": corr,
        "meanDifference": mean(diffs),
        family_a: summarize_distribution(a_vals),
        family_b: summarize_distribution(b_vals),
        "note": "Raw scales are not interchangeable; report only.",
    }
