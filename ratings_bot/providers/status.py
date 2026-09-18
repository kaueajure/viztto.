"""Provider availability — never silently scrape when policy blocks."""

AVAILABLE = "AVAILABLE"
DISABLED_BY_POLICY = "DISABLED_BY_POLICY"
UNAVAILABLE = "UNAVAILABLE"
REVIEW_REQUIRED = "REVIEW_REQUIRED"

# Rating kinds. Only base/standard enter automatic calibration consensus.
RATING_BASE = "base"
RATING_STANDARD = "standard"
RATING_SPECIAL = "special"
RATING_FEATURED = "featured"
RATING_EVENT = "event"
RATING_UNKNOWN = "unknown"

CALIBRATION_TYPES = frozenset({RATING_BASE, RATING_STANDARD})

# Correlated sources share a family so EA Official + SoFIFA are one vote.
FAMILY_EA_FC = "ea_fc"
FAMILY_KONAMI = "konami"
FAMILY_SYNTHETIC = "synthetic"
