from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    cache_dir: Path = Path(".cache/ratings")
    ttl: float = 86400
    refresh: bool = False
    concurrency: int = 1
    timeout: float = 30

    def __post_init__(self) -> None:
        if not 1 <= self.concurrency <= 8 or self.ttl < 0 or self.timeout <= 0:
            raise ValueError("Invalid bot limits")
