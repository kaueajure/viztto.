"""Regressões do parser sem acesso ao Transfermarkt."""
import unittest
from unittest.mock import patch
from lxml import etree
from fastapi import HTTPException
from app.services.competitions.clubs import TransfermarktCompetitionClubs

PAGE = '''<html><h1>Campeonato Brasileiro Série C</h1>
<select name="saison_id"><option value="2025" selected="selected">2026</option></select>
<table class="items"><tr><td><a href="/clube/startseite/verein/10" title="Clube A"><img/></a>
<a href="/clube/startseite/verein/10">Clube A</a></td></tr>
<tr><td><a href="/clube-b/startseite/verein/20">Clube B</a></td></tr></table></html>'''

class CompetitionParserTest(unittest.TestCase):
    def test_participants_fallback_keeps_season_and_deduplicates_clubs(self):
        with patch.object(TransfermarktCompetitionClubs, "request_url_page", side_effect=[HTTPException(404), etree.HTML(PAGE)]) as request:
            service = TransfermarktCompetitionClubs(competition_id="BRA3", season_id="2025")
            result = service.get_competition_clubs()
        self.assertEqual(request.call_count, 2)
        self.assertIn("/teilnehmer/pokalwettbewerb/BRA3", service.URL)
        self.assertEqual(result["seasonId"], "2025")
        self.assertEqual(result["clubs"], [{"id": "10", "name": "Clube A"}, {"id": "20", "name": "Clube B"}])

    def test_does_not_hide_network_or_rate_limit_errors(self):
        for code in [429, 500, 403]:
            with patch.object(TransfermarktCompetitionClubs, "request_url_page", side_effect=HTTPException(code)) as request:
                with self.assertRaises(HTTPException):
                    TransfermarktCompetitionClubs(competition_id="BRA3", season_id="2025")
                self.assertEqual(request.call_count, 1)

if __name__ == "__main__":
    unittest.main()
