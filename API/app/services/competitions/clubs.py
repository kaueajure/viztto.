from dataclasses import dataclass

from fastapi import HTTPException

from app.services.base import TransfermarktBase
from app.utils.utils import extract_from_url
from app.utils.xpath import Competitions


@dataclass
class TransfermarktCompetitionClubs(TransfermarktBase):
    """
    A class for retrieving and parsing the list of football clubs in a specific competition on Transfermarkt.

    Args:
        competition_id (str): The unique identifier of the competition.
        season_id (str): The season identifier. If not provided, it will be extracted from the URL.
        URL (str): The URL template for the competition's page on Transfermarkt.
    """

    competition_id: str = None
    season_id: str = None
    URL: str = "https://www.transfermarkt.com/-/startseite/wettbewerb/{competition_id}/plus/?saison_id={season_id}"

    def __post_init__(self) -> None:
        """Initialize the TransfermarktCompetitionClubs class."""
        self.URL = self.URL.format(competition_id=self.competition_id, season_id=self.season_id)
        try:
            self.page = self.request_url_page()
            self.raise_exception_if_not_found(xpath=Competitions.Profile.NAME)
        except HTTPException as error:
            if error.status_code != 404:
                raise
            # Competições por fases (como a Série C) usam a página de participantes.
            self.URL = (
                f"https://www.transfermarkt.com/-/teilnehmer/pokalwettbewerb/{self.competition_id}"
                f"/saison_id/{self.season_id}" if self.season_id else
                f"https://www.transfermarkt.com/-/teilnehmer/pokalwettbewerb/{self.competition_id}"
            )
            self.page = self.request_url_page()
            self.raise_exception_if_not_found(xpath="//h1//text()")

    def __parse_competition_clubs(self) -> list:
        """
        Parse the competition's page and extract information about the football clubs participating
            in the competition.

        Returns:
            list: A list of dictionaries, where each dictionary contains information about a
                football club in the competition, including the club's unique identifier and name.
        """
        clubs = {}
        for link in self.page.xpath("//table[contains(@class, 'items')]//a[contains(@href, '/verein/')]"):
            club_id = extract_from_url(link.get("href"))
            name = "".join(link.itertext()).strip() or link.get("title")
            if club_id and name:
                clubs[club_id] = {"id": club_id, "name": name}
        return list(clubs.values())

    def get_competition_clubs(self) -> dict:
        """
        Retrieve and parse the list of football clubs participating in a specific competition.

        Returns:
            dict: A dictionary containing the competition's unique identifier, name, season identifier, list of clubs
                  participating in the competition, and the timestamp of when the data was last updated.
        """
        self.response["id"] = self.competition_id
        self.response["name"] = self.get_text_by_xpath("//h1//text()", join_str=" ")
        self.response["seasonId"] = self.get_text_by_xpath(
            "//select[@name='saison_id']/option[@selected]/@value"
        ) or extract_from_url(
            self.get_text_by_xpath(Competitions.Profile.URL),
            "season_id",
        )
        self.response["clubs"] = self.__parse_competition_clubs()

        return self.response
