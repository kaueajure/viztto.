"""No network provider is enabled pending an authorized ratings source."""
from .base import RatingsProvider
from .mock import MockRatingsProvider

DISABLED_PROVIDERS = {
    "sofifa": "Automated use and redistribution permission not established.",
    "efootball": "Prior written consent required for automated extraction.",
    "ea": "Terms restrict robots and automated data extraction.",
    "licensed-dataset": "Pending verified license, provenance and rating scale.",
}

__all__ = ["RatingsProvider", "MockRatingsProvider", "DISABLED_PROVIDERS"]
