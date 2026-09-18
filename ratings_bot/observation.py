"""Normalized rating observation — raw values preserved; never invent missing fields."""
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class RatingObservation:
    source: str
    family: str
    sourcePlayerId: str
    name: str
    overallRaw: float
    ratingType: str
    collectedAt: str
    birthDate: str | None = None
    age: int | None = None
    club: str | None = None
    nationality: str | None = None
    position: str | None = None
    potentialRaw: float | None = None
    attributes: dict[str, float] = field(default_factory=dict)
    game: str | None = None
    version: str | None = None
    sourceUrl: str | None = None
    sourceUpdatedAt: str | None = None
    confidence: float | None = None
    overallNormalized: float | None = None
    matchLevel: str | None = None
    vizttoPlayerId: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
