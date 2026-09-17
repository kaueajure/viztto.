import asyncio
import json
import tempfile
import unittest
from dataclasses import asdict, replace
from pathlib import Path
from unittest.mock import patch

from ratings_bot.bot import run
from ratings_bot.cache import Cache, write_json
from ratings_bot.config import Config
from ratings_bot.matcher import choose, enforce_one_to_one, score
from ratings_bot.models import CanonicalPlayer, ExternalPlayer, parse_input
from ratings_bot.normalizer import RatingNormalizer
from ratings_bot.providers.mock import MockRatingsProvider
from ratings_bot.calibrate import analyze

P = CanonicalPlayer("tm-1", "1", "João Silva", "brasileirao", "Clube A", "CA", "2000-01-01", "Brasil", 180, 1_000_000, 26, "1", 75, 70)
E = ExternalPlayer("x1", "Joao Silva", 78, "2000-01-01", "Clube A", "CA", "Brasil", 180, 85, {"pace": 82})
CAL = {"version": "test-v1", "overall": [[1, 1], [99, 99]],
       "attributes": {"pace": {"target": "velocidade", "curve": [[1, 1], [99, 99]]}}}


def batch(players=None):
    return {"version": 1, "batchId": "batch-1", "players": [asdict(p) for p in (players if players is not None else [P])]}


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = Config(self.root)

    def execute(self, providers, players=None, calibration=None):
        return asyncio.run(run(batch(players), providers, calibration or {p.name: CAL for p in providers}, self.config))

    def test_exact_normalizes_accents(self):
        self.assertEqual(choose(P, [E]).confidence, "exact")

    def test_high_uses_multiple_evidence(self):
        self.assertEqual(choose(replace(P, name="Joao Silve"), [E]).confidence, "high")

    def test_name_alone_is_never_accepted(self):
        candidate = ExternalPlayer("x", P.name, 80)
        self.assertEqual(choose(P, [candidate]).confidence, "low")

    def test_medium_is_reported_not_applied(self):
        candidate = replace(E, dateOfBirth=None, height=None, country=None, position=None)
        result, report = self.execute([MockRatingsProvider([asdict(candidate)])])
        self.assertEqual(result["players"][0]["sources"], [])
        self.assertEqual(report["matching"]["medium"], 1)

    def test_birth_conflict_rejected_even_if_other_fields_agree(self):
        self.assertEqual(choose(P, [replace(E, dateOfBirth="2001-01-01")]).confidence, "low")

    def test_ambiguous_homonyms(self):
        self.assertEqual(choose(P, [E, replace(E, externalPlayerId="x2")]).confidence, "ambiguous")

    def test_collision_revokes_both_and_is_order_independent(self):
        p2 = replace(P, id="tm-2", transfermarktId="2")
        for players in ([P, p2], [p2, P]):
            result, report = self.execute([MockRatingsProvider([asdict(E)])], players)
            self.assertTrue(all(not p["sources"] for p in result["players"]))
            self.assertEqual(report["collision"], 2)
            self.assertEqual(report["matching"]["ambiguous"], 2)

    def test_provider_cannot_add_stranger(self):
        result, _ = self.execute([MockRatingsProvider([asdict(E), asdict(replace(E, externalPlayerId="stranger", name="Other", dateOfBirth="1980-01-01"))])])
        self.assertEqual(len(result["players"]), 1)
        self.assertEqual(result["players"][0]["id"], P.id)

    def test_multisource_and_different_scales(self):
        result, report = self.execute([MockRatingsProvider([asdict(E)], "mock"), MockRatingsProvider([asdict(E)], "mock-b")], calibration={"mock": CAL, "mock-b": {**CAL, "overall": [[1, 10], [99, 90]]}})
        sources = result["players"][0]["sources"]
        self.assertEqual(len(sources), 2)
        self.assertNotEqual(sources[0]["ratingNormalizado"], sources[1]["ratingNormalizado"])
        self.assertEqual(report["players"]["multiSource"], 1)
        self.assertEqual(sources[0]["attributes"], {"velocidade": 82})

    def test_stale_mapping_revalidated_and_not_trusted(self):
        provider = MockRatingsProvider([asdict(E)])
        self.execute([provider])
        provider.players.clear()
        self.config = replace(self.config, refresh=True)
        result, report = self.execute([provider])
        self.assertEqual(result["players"][0]["sources"], [])
        self.assertEqual(report["providers"]["mock"]["staleMappings"], 1)
        mapping = json.loads((self.root / "mappings/mock.json").read_text())
        self.assertEqual(mapping["1"]["status"], "stale")

    def test_cache_reduces_search_requests_but_mapping_is_fresh(self):
        provider = MockRatingsProvider([asdict(E)])
        _, first = self.execute([provider])
        _, second = self.execute([provider])
        self.assertGreater(second["providers"]["mock"]["cacheHits"], 0)
        self.assertLess(second["providers"]["mock"]["requests"], first["providers"]["mock"]["requests"])
        self.assertGreater(second["providers"]["mock"]["requests"], 0)

    def test_cache_expiry_and_corruption(self):
        c = Cache(self.root, 10)
        c.put("search", "a", [1])
        self.assertEqual(c.get("search", "a"), (True, [1]))
        with patch("ratings_bot.cache.time.time", return_value=10**12):
            self.assertEqual(c.get("search", "a"), (False, None))
        c.path("search", "a").write_text("invalid")
        self.assertEqual(c.get("search", "a"), (False, None))

    def test_total_provider_failure_does_not_leak_secret(self):
        class Broken(MockRatingsProvider):
            async def health_check(self):
                raise RuntimeError("TOKEN-SECRET")
        result, report = self.execute([Broken()])
        self.assertEqual(report["providers"]["mock"]["errors"], 1)
        self.assertNotIn("TOKEN-SECRET", json.dumps(result))
        self.assertEqual(report["players"]["fallbackEngine"], 1)

    def test_invalid_inputs(self):
        for malformed in (batch([P, P]), {**batch(), "version": 2}, {**batch(), "extra": 1}):
            with self.assertRaises((ValueError, TypeError)):
                parse_input(malformed)
        with self.assertRaises(ValueError):
            replace(E, overall=float("nan"))
        with self.assertRaises(ValueError):
            replace(E, overall=True)

    def test_normalizer_rejects_unknown_scale_and_nonmonotonic_curve(self):
        normalizer = RatingNormalizer(CAL)
        with self.assertRaises(ValueError):
            normalizer.normalize("mock", replace(E, overall=1000), "exact", [])
        with self.assertRaises(ValueError):
            RatingNormalizer({**CAL, "overall": [[1, 80], [99, 20]]})

    def test_no_provider_is_valid_empty_enrichment(self):
        result, report = self.execute([])
        self.assertEqual(result["players"][0]["sources"], [])
        self.assertEqual(report["coverage"], 0)

    def test_calibration_reports_engine_dimensions(self):
        result, _ = self.execute([MockRatingsProvider([asdict(E)], "mock"), MockRatingsProvider([asdict(E)], "mock-b")])
        report = analyze(batch(), result)
        self.assertEqual(report["comparisons"]["mock:mock-b"]["normalizedDifference"]["mean"], 0)
        self.assertEqual(report["engineError"]["league"]["brasileirao"]["mean"], -8)
        self.assertEqual(set(report["engineError"]), {"league", "division", "age", "position", "club", "clubStrength", "marketValue"})

    def test_unauthorized_provider_is_rejected(self):
        provider = MockRatingsProvider()
        provider.authorized = False
        with self.assertRaises(ValueError):
            self.execute([provider])
