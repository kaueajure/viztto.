"""No network provider is enabled for production enrichment pending license."""
from .base import RatingsProvider
from .mock import MockRatingsProvider
from .status import (
    AVAILABLE,
    DISABLED_BY_POLICY,
    UNAVAILABLE,
    REVIEW_REQUIRED,
    FAMILY_EA_FC,
    FAMILY_KONAMI,
)

DISABLED_PROVIDERS = {
    "sofifa": (
        "DISABLED_BY_POLICY: SoFIFA API requires NON-COMMERCIAL projects "
        "(docs 2026-09-07). HTML scraping is not used as a bypass."
    ),
    "ea-official": (
        "DISABLED_BY_POLICY: EA User Agreement restricts robots/automated "
        "extraction (verified 2026-09-17)."
    ),
    "ea": (
        "DISABLED_BY_POLICY: alias of ea-official — EA terms restrict robots."
    ),
    "pesmaster": (
        "REVIEW_REQUIRED: robots allow crawl but commercial reuse license "
        "not confirmed (2026-09-17)."
    ),
    "efootball": (
        "REVIEW_REQUIRED: alias of pesmaster — prior written consent / license pending."
    ),
    "licensed-dataset": "Pending verified license, provenance and rating scale.",
}

PROVIDER_ALIASES = {
    "ea": "ea-official",
    "efootball": "pesmaster",
}

__all__ = [
    "RatingsProvider",
    "MockRatingsProvider",
    "DISABLED_PROVIDERS",
    "PROVIDER_ALIASES",
    "AVAILABLE",
    "DISABLED_BY_POLICY",
    "UNAVAILABLE",
    "REVIEW_REQUIRED",
    "FAMILY_EA_FC",
    "FAMILY_KONAMI",
]
