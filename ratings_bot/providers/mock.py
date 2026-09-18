"""Fixture-only provider. Never generates a rating from a canonical name."""
import hashlib
import json
from ..matcher import normalize
from ..models import CanonicalPlayer, ExternalPlayer
from .base import RatingsProvider
from .status import AVAILABLE, FAMILY_SYNTHETIC, RATING_BASE


class MockRatingsProvider(RatingsProvider):
    authorized = True
    synthetic = True
    availability = AVAILABLE
    availability_reason = "Synthetic fixture provider for tests only."
    family = FAMILY_SYNTHETIC

    def __init__(self, players: list[dict] | None = None, name: str = "mock"):
        self.name = name
        # Distinct family per mock instance so multi-source tests stay independent.
        self.family = f"{FAMILY_SYNTHETIC}:{name}"
        records = []
        for p in players or []:
            row = dict(p)
            if not row.get("family"):
                row["family"] = self.family
            row.setdefault("ratingType", RATING_BASE)
            records.append(ExternalPlayer(**row))
        self.players = {p.externalPlayerId: p for p in records}
        if len(self.players) != len(records):
            raise ValueError("Duplicate external identity in fixture")
        self.cache_namespace = hashlib.sha256(json.dumps(players or [], sort_keys=True).encode()).hexdigest()

    async def find_player(self, player: CanonicalPlayer) -> list[ExternalPlayer]:
        return [p for p in self.players.values()
                if normalize(p.name) == normalize(player.name)
                or (player.dateOfBirth and p.dateOfBirth == player.dateOfBirth)]

    async def fetch_player(self, external_id: str) -> ExternalPlayer | None:
        return self.players.get(external_id)

    async def health_check(self) -> bool:
        return True
