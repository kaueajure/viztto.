"""Explicit, versioned provider curves. No implicit identity conversion."""
from .models import ExternalPlayer, number


class RatingNormalizer:
    def __init__(self, config: dict):
        self.config = config
        if not isinstance(config.get("version"), str) or not config["version"]:
            raise ValueError("Calibration version required")
        self._validate(config["overall"])
        if "potential" in config:
            self._validate(config["potential"])
        for spec in config.get("attributes", {}).values():
            self._validate(spec["curve"])

    @staticmethod
    def _validate(points: list) -> None:
        if len(points) < 2:
            raise ValueError("Curve requires at least two points")
        for x, y in points:
            number(x)
            if not 1 <= number(y) <= 99:
                raise ValueError("Invalid normalized scale")
        if any(a[0] >= b[0] or a[1] > b[1] for a, b in zip(points, points[1:])):
            raise ValueError("Curve must be monotonic")

    @staticmethod
    def curve(value: float, points: list) -> float:
        number(value)
        if value < points[0][0] or value > points[-1][0]:
            raise ValueError("Rating outside declared provider scale")
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            if value <= x2:
                return round(y1 + (value - x1) * (y2 - y1) / (x2 - x1), 4)
        return points[-1][1]

    def normalize(self, provider: str, player: ExternalPlayer, confidence: str, matched_by: list[str]) -> dict:
        attrs = {}
        for external, spec in self.config.get("attributes", {}).items():
            if external in player.attributes:
                attrs[spec["target"]] = self.curve(player.attributes[external], spec["curve"])
        result = {"provider": provider, "externalPlayerId": player.externalPlayerId,
                  "ratingOriginal": player.overall,
                  "ratingNormalizado": self.curve(player.overall, self.config["overall"]),
                  "confidence": confidence, "matchedBy": matched_by,
                  "calibrationVersion": self.config["version"], "attributes": attrs}
        if player.family:
            result["family"] = player.family
        if player.ratingType:
            result["ratingType"] = player.ratingType
        if player.potential is not None:
            result["externalPotential"] = player.potential
            result["potentialNormalizado"] = self.curve(player.potential, self.config.get("potential", self.config["overall"]))
        if player.sourceUpdatedAt:
            result["sourceUpdatedAt"] = player.sourceUpdatedAt
        if player.sourceUrl:
            result["sourceUrl"] = player.sourceUrl
        if player.game:
            result["game"] = player.game
        if player.version:
            result["version"] = player.version
        return result
