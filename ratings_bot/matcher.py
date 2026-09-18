"""Conservative matching: names alone never authorize enrichment."""
import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from .models import CanonicalPlayer, ExternalPlayer

ACCEPTED = {"exact", "high"}
# Grupos amplos: comparar "Centre-Forward" com "ST" textualmente nunca funciona.
POSITION_GROUPS = {
    "GOL": ("goalkeeper", "goleiro", "goleiro", "gk", "gol"),
    "DEF": ("back", "defender", "zagueiro", "lateral", "cb", "rb", "lb", "sweeper", "df", "def"),
    "MEI": ("midfield", "meia", "volante", "mc", "cm", "dm", "am", "cdm", "cam", "mf", "mei"),
    "ATA": ("forward", "winger", "striker", "atacante", "ponta", "st", "cf", "lw", "rw", "fw", "ata"),
}
JR_TOKENS = frozenset({"jr", "jnr", "junior"})


def normalize(text: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in decomposed if not unicodedata.combining(c)).lower()).strip()


def name_tokens(text: str | None) -> list[str]:
    tokens = normalize(text).split()
    return ["junior" if t in JR_TOKENS else t for t in tokens]


def name_similarity(a: str | None, b: str | None) -> float:
    """Accent-insensitive; Jr≈Junior; abbreviated given name only with shared surname."""
    ta, tb = name_tokens(a), name_tokens(b)
    if not ta or not tb:
        return 0.0
    if ta == tb:
        return 1.0
    base = SequenceMatcher(None, " ".join(ta), " ".join(tb)).ratio()
    if len(ta) >= 2 and len(tb) >= 2 and ta[-1] == tb[-1]:
        fa, fb = ta[0], tb[0]
        if fa == fb:
            return max(base, 0.95)
        if (len(fa) >= 3 and fb.startswith(fa)) or (len(fb) >= 3 and fa.startswith(fb)):
            return max(base, 0.9)
    return base


def position_group(text: str | None, aliases: dict[str, str] | None = None) -> str:
    """Grupo posicional comparável. Aliases do provider têm precedência."""
    key = normalize(text)
    if not key:
        return ""
    mapped = (aliases or {}).get(key)
    if mapped:
        return mapped
    tokens = key.split()
    for group, termos in POSITION_GROUPS.items():
        if any(t == termo or t.endswith(termo) for t in tokens for termo in termos):
            return group
    return ""


@dataclass
class Match:
    confidence: str = "unmatched"
    player: ExternalPlayer | None = None
    score: float = 0
    matched_by: list[str] = field(default_factory=list)
    collision: bool = False
    candidate_count: int = 0
    error: bool = False


def score(player: CanonicalPlayer, candidate: ExternalPlayer,
          position_aliases: dict[str, str] | None = None) -> Match:
    name = name_similarity(player.name, candidate.name)
    evidence = []
    if player.dateOfBirth and candidate.dateOfBirth:
        if player.dateOfBirth != candidate.dateOfBirth:
            return Match("low", candidate, 0, ["birth-date-conflict"])
        evidence.append("dateOfBirth")
    for key in ("club", "country"):
        if normalize(getattr(player, key)) and normalize(getattr(player, key)) == normalize(getattr(candidate, key)):
            evidence.append(key)
    grupo = position_group(player.position, position_aliases)
    if grupo and grupo == position_group(candidate.position, position_aliases):
        evidence.append("position")
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
    elif name >= .9 and "dateOfBirth" in evidence:
        confidence = "high"
    elif name >= .75 and len(evidence) >= 1:
        confidence = "medium"
    elif name >= .5:
        confidence = "low"
    return Match(confidence, candidate, points, ["name", *evidence])


def choose(player: CanonicalPlayer, candidates: list[ExternalPlayer],
           position_aliases: dict[str, str] | None = None) -> Match:
    unique = {p.externalPlayerId: p for p in candidates}
    ranked = sorted((score(player, p, position_aliases) for p in unique.values()),
                    key=lambda m: (-m.score, m.player.externalPlayerId))
    if not ranked:
        return Match()
    best = ranked[0]
    best.candidate_count = len(unique)
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
