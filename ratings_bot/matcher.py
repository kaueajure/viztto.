"""Conservative matching: names alone never authorize enrichment."""
import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from .models import CanonicalPlayer, ExternalPlayer

ACCEPTED = {"exact", "high"}


def normalize(text: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in decomposed if not unicodedata.combining(c)).lower()).strip()


@dataclass
class Match:
    confidence: str = "unmatched"
    player: ExternalPlayer | None = None
    score: float = 0
    matched_by: list[str] = field(default_factory=list)
    collision: bool = False


def score(player: CanonicalPlayer, candidate: ExternalPlayer) -> Match:
    name = SequenceMatcher(None, normalize(player.name), normalize(candidate.name)).ratio()
    evidence = []
    if player.dateOfBirth and candidate.dateOfBirth:
        if player.dateOfBirth != candidate.dateOfBirth:
            return Match("low", candidate, 0, ["birth-date-conflict"])
        evidence.append("dateOfBirth")
    for key in ("club", "position", "country"):
        if normalize(getattr(player, key)) and normalize(getattr(player, key)) == normalize(getattr(candidate, key)):
            evidence.append(key)
    if player.height and candidate.height and abs(player.height - candidate.height) <= 3:
        evidence.append("height")
    points = name * 55 + (30 if "dateOfBirth" in evidence else 0) + 5 * len([e for e in evidence if e != "dateOfBirth"])
    confidence = "unmatched"
    if name == 1 and "dateOfBirth" in evidence:
        confidence = "exact"
    elif name >= .85 and "dateOfBirth" in evidence and len(evidence) >= 2:
        confidence = "high"
    elif name == 1 and {"club", "country", "position", "height"}.issubset(evidence):
        confidence = "high"
    elif name >= .75 and len(evidence) >= 1:
        confidence = "medium"
    elif name >= .5:
        confidence = "low"
    return Match(confidence, candidate, points, ["name", *evidence])


def choose(player: CanonicalPlayer, candidates: list[ExternalPlayer]) -> Match:
    unique = {p.externalPlayerId: p for p in candidates}
    ranked = sorted((score(player, p) for p in unique.values()), key=lambda m: (-m.score, m.player.externalPlayerId))
    if not ranked:
        return Match()
    best = ranked[0]
    if best.confidence in ACCEPTED and len(ranked) > 1 and best.score - ranked[1].score < 8:
        best.confidence = "ambiguous"
    return best


def enforce_one_to_one(matches: dict[str, Match]) -> None:
    used_external_ids: dict[str, list[Match]] = {}
    for match in matches.values():
        if match.confidence in ACCEPTED and match.player:
            used_external_ids.setdefault(match.player.externalPlayerId, []).append(match)
    for claims in used_external_ids.values():
        if len(claims) > 1:
            for match in claims:
                match.confidence = "ambiguous"
                match.collision = True
