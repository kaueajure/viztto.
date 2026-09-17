import json
import tempfile
import unittest
from pathlib import Path

from ratings_bot.cli import build_providers, preflight, safe_output
from ratings_bot.config import Config
from ratings_bot.matcher import position_group
from ratings_bot.providers.mock import MockRatingsProvider

CAL = {"version": "test-v1", "overall": [[1, 1], [99, 99]]}


class CLIValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_ttl_and_concurrency_bounds(self):
        for ttl, concurrency in ((0, 1), (-1, 1), (10, 0), (10, -3), (10, 99)):
            with self.assertRaises(ValueError):
                Config(self.root, ttl, concurrency=concurrency)
        self.assertEqual(Config(self.root, 1, concurrency=1).concurrency, 1)

    def test_duplicate_unknown_and_disabled_providers(self):
        with self.assertRaisesRegex(ValueError, "Duplicate provider"):
            build_providers(["mock", "mock"], {})
        with self.assertRaisesRegex(ValueError, "Unknown or unauthorized"):
            build_providers(["fonte-x"], {})
        self.assertEqual([p.name for p in build_providers(["mock", "mock-b"], {})],
                         ["mock", "mock-b"])

    def test_preflight_requires_authorization_and_calibration(self):
        provider = MockRatingsProvider()
        config = Config(self.root)
        with self.assertRaisesRegex(ValueError, "no calibration entry"):
            preflight([provider], {"outro": CAL}, config)
        provider.authorized = False
        with self.assertRaisesRegex(ValueError, "not authorized"):
            preflight([provider], {"mock": CAL}, config)
        provider.authorized = True
        with self.assertRaises(ValueError):
            preflight([provider], {"mock": {**CAL, "overall": [[1, 1]]}}, config)
        linhas = "\n".join(preflight([provider], {"mock": CAL}, config))
        self.assertIn("Provider: mock", linhas)
        self.assertIn("Calibration: test-v1", linhas)

    def test_preflight_without_provider_is_explicit(self):
        self.assertIn("Providers externos habilitados: nenhum",
                      "\n".join(preflight([], {}, Config(self.root))))

    def test_safe_output_blocks_official_snapshots_only(self):
        for blocked in ("src/dados/futebol", "src/dados/futebol/foo",
                        "src/dados/futebol/releases/r-1/brasileirao.json",
                        "../../src/dados/futebol", "./src/dados/../dados/futebol/x"):
            with self.assertRaises(ValueError):
                safe_output(Path(blocked))
        for allowed in (".cache/ratings", "relatorios/ratings.json",
                        "src/dados/futebol-teste", "src/dados", str(self.root / "out.json")):
            self.assertEqual(safe_output(Path(allowed)), Path(allowed))

    def test_calibration_file_of_the_repository_is_valid(self):
        calibrations = json.loads(Path("config/ratings-calibration.json").read_text())
        providers = build_providers(sorted(calibrations), {})
        self.assertTrue(preflight(providers, calibrations, Config(self.root)))


class NormalizerCurveTests(unittest.TestCase):
    def curva(self, **override):
        return {"version": "v1", "overall": [[1, 1], [99, 99]], **override}

    def test_rejects_unordered_nonmonotonic_and_out_of_scale_curves(self):
        from ratings_bot.normalizer import RatingNormalizer

        invalidos = [
            {"overall": [[99, 1], [1, 99]]},          # x não crescente
            {"overall": [[1, 1], [1, 50]]},           # x repetido
            {"overall": [[1, 80], [99, 20]]},         # y não monotônico
            {"overall": [[1, 0], [99, 99]]},          # y abaixo de 1
            {"overall": [[1, 1], [99, 100]]},         # y acima de 99
            {"overall": [[1, 1], [float("nan"), 99]]},
            {"overall": [[1, 1], [float("inf"), 99]]},
            {"overall": [[1, 1]]},                    # curva com um ponto
            {"version": ""},
        ]
        for override in invalidos:
            with self.assertRaises(ValueError, msg=override):
                RatingNormalizer(self.curva(**override))
        with self.assertRaises(ValueError):
            RatingNormalizer(self.curva(attributes={"pace": {"target": "velocidade",
                                                             "curve": [[1, 90], [99, 10]]}}))

    def test_distinct_provider_curves_produce_distinct_ratings(self):
        from ratings_bot.normalizer import RatingNormalizer

        a = RatingNormalizer(self.curva())
        b = RatingNormalizer(self.curva(overall=[[1, 10], [99, 90]]))
        self.assertNotEqual(a.curve(80, a.config["overall"]),
                            b.curve(80, b.config["overall"]))


class PositionTests(unittest.TestCase):
    def test_short_codes_and_long_labels_share_a_group(self):
        for transfermarkt, externo in (("Centre-Forward", "ST"), ("Centre-Forward", "CF"),
                                       ("Left Winger", "LW"), ("Centre-Back", "CB"),
                                       ("Goalkeeper", "GK"), ("Defensive Midfield", "CDM")):
            self.assertEqual(position_group(transfermarkt), position_group(externo),
                             f"{transfermarkt} vs {externo}")

    def test_distinct_groups_and_unknown_labels(self):
        self.assertNotEqual(position_group("Centre-Back"), position_group("ST"))
        self.assertEqual(position_group("posição inventada"), "")
        self.assertEqual(position_group(None), "")

    def test_provider_aliases_take_precedence(self):
        self.assertEqual(position_group("pivo", {"pivo": "ATA"}), "ATA")
