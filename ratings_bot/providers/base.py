from abc import ABC, abstractmethod
from ..models import CanonicalPlayer, ExternalPlayer


class RatingsProvider(ABC):
    name: str
    # Every concrete provider requires reviewed authorization before enabling.
    authorized: bool = False
    synthetic: bool = False
    cache_namespace: str = "v1"
    # Normalized position label -> Viztto group (GOL/DEF/MEI/ATA), per provider.
    position_aliases: dict[str, str] = {}

    @abstractmethod
    async def find_player(self, player: CanonicalPlayer) -> list[ExternalPlayer]: ...

    @abstractmethod
    async def fetch_player(self, external_id: str) -> ExternalPlayer | None: ...

    @abstractmethod
    async def health_check(self) -> bool: ...
