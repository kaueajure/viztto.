from abc import ABC, abstractmethod
from ..models import CanonicalPlayer, ExternalPlayer
from .status import AVAILABLE, DISABLED_BY_POLICY


class RatingsProvider(ABC):
    name: str
    family: str = "unknown"
    # Every concrete provider requires reviewed authorization before enabling.
    authorized: bool = False
    synthetic: bool = False
    # AVAILABLE | DISABLED_BY_POLICY | UNAVAILABLE | REVIEW_REQUIRED
    availability: str = DISABLED_BY_POLICY
    availability_reason: str = "Authorization not established."
    cache_namespace: str = "v1"
    # Normalized position label -> Viztto group (GOL/DEF/MEI/ATA), per provider.
    position_aliases: dict[str, str] = {}

    @abstractmethod
    async def find_player(self, player: CanonicalPlayer) -> list[ExternalPlayer]: ...

    @abstractmethod
    async def fetch_player(self, external_id: str) -> ExternalPlayer | None: ...

    @abstractmethod
    async def health_check(self) -> bool: ...

    def assert_collectable(self) -> None:
        """Live enrichment requires AVAILABLE + authorized."""
        if self.availability != AVAILABLE or not self.authorized:
            raise ValueError(
                f"Provider {getattr(self, 'name', '?')} not collectable: "
                f"{self.availability} — {self.availability_reason}"
            )
