"""Fixture-only provider. Never generates a rating from a canonical name."""
import hashlib
import json
from ..matcher import normalize
from ..models import CanonicalPlayer, ExternalPlayer
from .base import RatingsProvider


class MockRatingsProvider(RatingsProvider):
    authorized = True
    synthetic = True

    def __init__(self, players: list[dict] | None = None, name: str = "mock"):
        self.name = name
        records = [ExternalPlayer(**p) for p in players or []]
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
