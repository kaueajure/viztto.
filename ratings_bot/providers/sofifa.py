"""SoFIFA API adapter — DISABLED_BY_POLICY for commercial Viztto.

API docs (https://sofifa.com/document, updated 2026-09-07) require NON-COMMERCIAL
projects. Scraping HTML is not an acceptable bypass. Fixture/policy tests only.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import TYPE_CHECKING
from ..models import CanonicalPlayer, ExternalPlayer
from ..matcher import normalize
from .base import RatingsProvider
from .status import (
    DISABLED_BY_POLICY,
    FAMILY_EA_FC,
    RATING_BASE,
)

if TYPE_CHECKING:
    from ..http import RateLimitedHTTP


class SofifaPolicyError(ValueError):
    pass


def parse_api_player(payload: dict, *, source_url: str | None = None) -> ExternalPlayer:
    if not isinstance(payload, dict):
        raise ValueError("SoFIFA payload must be an object")
    data = payload.get("data", payload)
    if not isinstance(data, dict) or data.get("overall") is None:
        raise ValueError("SoFIFA player missing overall")
    pid = data.get("id")
    if pid is None:
        raise ValueError("SoFIFA player missing id")
    name = data.get("fullName") or data.get("name")
    if not name:
        raise ValueError("SoFIFA player missing name")
    club = data.get("club")
    nation = data.get("nation") or data.get("nationality")
    positions = data.get("positions") or []
    position = positions[0] if isinstance(positions, list) and positions else data.get("position")
    attrs = {}
    for key in ("pace", "shooting", "passing", "dribbling", "defending", "physic", "physical"):
        if key in data and isinstance(data[key], (int, float)):
            attrs["physical" if key == "physic" else key] = float(data[key])
    dob = data.get("dob") or data.get("dateOfBirth")
    return ExternalPlayer(
        externalPlayerId=str(pid),
        name=str(name),
        overall=float(data["overall"]),
        dateOfBirth=str(dob) if dob else None,
        club=club.get("name") if isinstance(club, dict) else (str(club) if club else None),
        country=nation.get("name") if isinstance(nation, dict) else (str(nation) if nation else None),
        position=str(position) if position else None,
        potential=float(data["potential"]) if data.get("potential") is not None else None,
        attributes=attrs,
        age=int(data["age"]) if data.get("age") is not None else None,
        family=FAMILY_EA_FC,
        ratingType=RATING_BASE,
        sourceUrl=source_url,
        game="EA SPORTS FC (SoFIFA)",
        version=str(data.get("roster") or data.get("version") or "") or None,
    )


class SofifaProvider(RatingsProvider):
    name = "sofifa"
    family = FAMILY_EA_FC
    authorized = False
    synthetic = False
    availability = DISABLED_BY_POLICY
    availability_reason = (
        "SoFIFA API terms require NON-COMMERCIAL projects (docs updated "
        "2026-09-07). Viztto may be commercialized; adapter kept disabled. "
        "HTML scraping is not used as a bypass."
    )
    rate_limit_per_minute = 30

    def __init__(self, players: list[ExternalPlayer] | None = None,
                 fixture_path: Path | None = None,
                 http: "RateLimitedHTTP | None" = None,
                 allow_live: bool = False):
        self._index: dict[str, ExternalPlayer] = {}
        self.http = http
        self.allow_live = allow_live
        loaded = list(players or [])
        if fixture_path is not None:
            loaded.append(parse_api_player(json.loads(fixture_path.read_text(encoding="utf-8"))))
        for p in loaded:
            self._index[p.externalPlayerId] = p

    def assert_collectable(self) -> None:
        if not self.allow_live:
            raise SofifaPolicyError(
                f"Provider sofifa DISABLED_BY_POLICY: {self.availability_reason}"
            )
        super().assert_collectable()

    async def find_player(self, player: CanonicalPlayer) -> list[ExternalPlayer]:
        if self._index:
            return [
                p for p in self._index.values()
                if normalize(p.name) == normalize(player.name)
                or (player.dateOfBirth and p.dateOfBirth == player.dateOfBirth)
            ]
        self.assert_collectable()
        raise SofifaPolicyError("Live SoFIFA search blocked by policy")

    async def fetch_player(self, external_id: str) -> ExternalPlayer | None:
        if external_id in self._index:
            return self._index[external_id]
        self.assert_collectable()
        raise SofifaPolicyError("Live SoFIFA fetch blocked by policy")

    async def health_check(self) -> bool:
        return bool(self._index)

    async def simulate_429(self) -> None:
        from ..http import ProviderError
        raise ProviderError("retry-exhausted")
