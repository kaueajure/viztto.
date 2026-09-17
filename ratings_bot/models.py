"""Strict JSON boundary; no implicit coercion of identities or ratings."""
from dataclasses import dataclass, field
from datetime import date
from math import isfinite
from typing import Any


def number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        raise ValueError("Expected finite number")
    return value


def identity(value: Any) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 200:
        raise ValueError("Invalid identity")
    return value


@dataclass(frozen=True)
class CanonicalPlayer:
    id: str
    transfermarktId: str
    name: str
    league: str
    club: str
    position: str
    dateOfBirth: str | None = None
    country: str | None = None
    height: float | None = None
    marketValue: float | None = None
    age: int | None = None
    division: str | None = None
    clubStrength: float | None = None
    engineOverall: float | None = None

    def __post_init__(self) -> None:
        for key in ("id", "transfermarktId", "name", "league", "club", "position"):
            identity(getattr(self, key))
        for key in ("height", "marketValue", "age", "clubStrength", "engineOverall"):
            if getattr(self, key) is not None:
                number(getattr(self, key))
        if self.dateOfBirth:
            date.fromisoformat(self.dateOfBirth)
        for key in ("country", "division"):
            if getattr(self, key) is not None:
                identity(getattr(self, key))


@dataclass(frozen=True)
class ExternalPlayer:
    externalPlayerId: str
    name: str
    overall: float
    dateOfBirth: str | None = None
    club: str | None = None
    position: str | None = None
    country: str | None = None
    height: float | None = None
    potential: float | None = None
    attributes: dict[str, float] = field(default_factory=dict)
    sourceUpdatedAt: str | None = None

    def __post_init__(self) -> None:
        identity(self.externalPlayerId)
        identity(self.name)
        number(self.overall)
        for key in ("height", "potential"):
            if getattr(self, key) is not None:
                number(getattr(self, key))
        if self.dateOfBirth:
            date.fromisoformat(self.dateOfBirth)
        for key in ("club", "position", "country", "sourceUpdatedAt"):
            if getattr(self, key) is not None:
                identity(getattr(self, key))
        if not isinstance(self.attributes, dict):
            raise ValueError("Invalid attributes")
        for key, value in self.attributes.items():
            identity(key)
            number(value)


def parse_input(data: dict) -> list[CanonicalPlayer]:
    if set(data) != {"version", "batchId", "players"} or data["version"] != 1:
        raise ValueError("Invalid canonical contract")
    identity(data["batchId"])
    players = [CanonicalPlayer(**p) for p in data["players"]]
    for key in ("id", "transfermarktId"):
        if len({getattr(p, key) for p in players}) != len(players):
            raise ValueError("Duplicate canonical identity")
    return players
