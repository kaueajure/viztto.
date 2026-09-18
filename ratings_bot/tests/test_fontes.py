"""External game-rating providers: parsers, policy, matching, consensus."""
import json
import unittest
from dataclasses import asdict, replace
from pathlib import Path

from ratings_bot.consensus import consensus_from_observations, compare_families
from ratings_bot.matcher import choose, name_similarity
from ratings_bot.models import CanonicalPlayer, ExternalPlayer
from ratings_bot.providers.ea_official import parse_ratings_html, ParserError as EAParserError
from ratings_bot.providers.pesmaster import parse_player_html, ParserError as PesParserError
from ratings_bot.providers.sofifa import SofifaPolicyError, SofifaProvider, parse_api_player
from ratings_bot.providers.status import DISABLED_BY_POLICY, FAMILY_EA_FC, FAMILY_KONAMI
from ratings_bot.fontes import run_fontes
from argparse import Namespace

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
P = CanonicalPlayer(
    "tm-1", "1", "Vinícius Júnior", "laliga", "Real Madrid", "LW",
    "2000-07-12", "Brazil", 176, 150_000_000, 25, "1", 88, 89,
)


class EAParserTests(unittest.TestCase):
    def test_parses_fixture_html(self):
        html = (FIXTURES / "ea-official" / "ratings-page.html").read_text(encoding="utf-8")
        players = parse_ratings_html(html)
        self.assertGreaterEqual(len(players), 3)
        first = players[0]
        self.assertEqual(first.family, FAMILY_EA_FC)
        self.assertEqual(first.ratingType, "base")
        self.assertGreater(first.overall, 50)
        self.assertTrue(first.name)
        self.assertIn("pace", first.attributes)

    def test_broken_html_is_parser_error_not_empty_success(self):
        with self.assertRaises(EAParserError):
            parse_ratings_html("<html><body>no data</body></html>")


class PesParserTests(unittest.TestCase):
    def test_standard_is_base(self):
        html = (FIXTURES / "pesmaster" / "player-standard.html").read_text(encoding="utf-8")
        p = parse_player_html(html)
        self.assertEqual(p.family, FAMILY_KONAMI)
        self.assertEqual(p.ratingType, "base")
        self.assertEqual(p.name, "Erling Haaland")
        self.assertGreater(p.overall, 50)

    def test_featured_is_special(self):
        html = (FIXTURES / "pesmaster" / "player-featured.html").read_text(encoding="utf-8")
        p = parse_player_html(html)
        self.assertEqual(p.ratingType, "featured")
        self.assertNotEqual(p.ratingType, "base")

    def test_unexpected_layout_errors(self):
        with self.assertRaises(PesParserError):
            parse_player_html("<html><body>no ovr</body></html>")


class SofifaPolicyTests(unittest.TestCase):
    def test_fixture_parse(self):
        data = json.loads((FIXTURES / "sofifa" / "player-sample.json").read_text())
        p = parse_api_player(data)
        self.assertEqual(p.family, FAMILY_EA_FC)
        self.assertEqual(p.overall, 88)

    def test_live_blocked_by_policy(self):
        provider = SofifaProvider()
        with self.assertRaises(SofifaPolicyError):
            provider.assert_collectable()


class MatchingTests(unittest.TestCase):
    def test_name_dob_exact(self):
        e = ExternalPlayer("x", "Vinicius Junior", 89, "2000-07-12", "Real Madrid", "LW", "Brazil")
        self.assertEqual(choose(P, [e]).confidence, "exact")

    def test_name_same_dob_conflict(self):
        e = ExternalPlayer("x", "Vinicius Junior", 89, "1999-01-01", "Real Madrid", "LW", "Brazil")
        self.assertEqual(choose(P, [e]).confidence, "low")

    def test_abbreviation_with_dob(self):
        e = ExternalPlayer("x", "Vini Jr.", 89, "2000-07-12", "Real Madrid", "LW", "Brazil")
        self.assertGreaterEqual(name_similarity(P.name, e.name), 0.9)
        self.assertIn(choose(P, [e]).confidence, {"exact", "high"})

    def test_name_only_never_accepted(self):
        e = ExternalPlayer("x", P.name, 89)
        self.assertNotIn(choose(P, [e]).confidence, {"exact", "high"})

    def test_homonyms_ambiguous(self):
        e1 = ExternalPlayer("a", "Vinicius Junior", 89, "2000-07-12", "Real Madrid", "LW", "Brazil")
        e2 = ExternalPlayer("b", "Vinicius Junior", 88, "2000-07-12", "Real Madrid", "LW", "Brazil")
        self.assertEqual(choose(P, [e1, e2]).confidence, "ambiguous")

    def test_club_change_still_matches_via_dob(self):
        e = ExternalPlayer("x", "Vinicius Junior", 89, "2000-07-12", "Old Club", "LW", "Brazil")
        self.assertEqual(choose(P, [e]).confidence, "exact")


class ConsensusTests(unittest.TestCase):
    def test_ea_sofifa_same_family_one_vote(self):
        obs = [
            {"source": "ea-official", "family": FAMILY_EA_FC, "overallRaw": 84, "ratingType": "base", "name": "A"},
            {"source": "sofifa", "family": FAMILY_EA_FC, "overallRaw": 84, "ratingType": "base", "name": "A"},
            {"source": "pesmaster", "family": FAMILY_KONAMI, "overallRaw": 82, "ratingType": "base", "name": "A"},
        ]
        result = consensus_from_observations(obs)
        self.assertEqual(result["evidenceCount"], 2)
        self.assertEqual(result["families"][FAMILY_EA_FC]["overallRaw"], 84)
        self.assertEqual(result["families"][FAMILY_EA_FC]["source"], "ea-official")
        self.assertEqual(result["families"][FAMILY_KONAMI]["overallRaw"], 82)

    def test_family_divergence_recorded(self):
        obs = [
            {"source": "ea-official", "family": FAMILY_EA_FC, "overallRaw": 84, "ratingType": "base"},
            {"source": "sofifa", "family": FAMILY_EA_FC, "overallRaw": 81, "ratingType": "base"},
        ]
        result = consensus_from_observations(obs)
        self.assertEqual(len(result["divergences"]), 1)
        self.assertEqual(result["families"][FAMILY_EA_FC]["overallRaw"], 84)

    def test_special_excluded(self):
        obs = [
            {"source": "pesmaster", "family": FAMILY_KONAMI, "overallRaw": 101, "ratingType": "featured", "name": "X"},
            {"source": "pesmaster", "family": FAMILY_KONAMI, "overallRaw": 83, "ratingType": "base", "name": "X"},
        ]
        result = consensus_from_observations(obs)
        self.assertEqual(result["ignoredSpecial"], 1)
        self.assertEqual(result["families"][FAMILY_KONAMI]["overallRaw"], 83)

    def test_family_comparison_report(self):
        obs = [
            {"source": "ea-official", "family": FAMILY_EA_FC, "overallRaw": 90, "ratingType": "base",
             "vizttoPlayerId": "1", "name": "A"},
            {"source": "pesmaster", "family": FAMILY_KONAMI, "overallRaw": 85, "ratingType": "base",
             "vizttoPlayerId": "1", "name": "A"},
        ]
        cmp_ = compare_families(obs, FAMILY_EA_FC, FAMILY_KONAMI)
        self.assertEqual(cmp_["commonPlayers"], 1)


class FontesDryRunTests(unittest.TestCase):
    def test_dry_run_fixtures_do_not_require_network(self):
        args = Namespace(
            input=None, fixtures=FIXTURES, source=["ea-official", "pesmaster", "sofifa"],
            league=None, limit=5, player=None, report=Path("/tmp/unused.json"),
            no_cache=True, dry_run=True, live=False, probe=False,
        )
        report = run_fontes(args)
        self.assertTrue(report["dryRun"])
        self.assertFalse(report["published"])
        self.assertIn("ea-official", report["sources"])
        self.assertGreaterEqual(report["sources"]["ea-official"]["playersCollected"], 1)
        self.assertEqual(report["sources"]["sofifa"]["status"], "DISABLED_BY_POLICY")


if __name__ == "__main__":
    unittest.main()
