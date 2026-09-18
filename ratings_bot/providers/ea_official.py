"""EA SPORTS FC official ratings — HTML/__NEXT_DATA__ parser.

Live enrichment is DISABLED_BY_POLICY (EA User Agreement restricts automated
extraction). Fixture/dry-run parsing is supported for architecture validation.
"""
from __future__ import annotations
import json
import re
from datetime import datetime
from pathlib import Path
from ..models import CanonicalPlayer, ExternalPlayer
from ..matcher import normalize
from .base import RatingsProvider
from .status import (
    DISABLED_BY_POLICY,
    FAMILY_EA_FC,
    RATING_BASE,
    RATING_UNKNOWN,
)


class ParserError(ValueError):
    """Site/layout changed or fixture invalid — never silent empty success."""


def _parse_birth(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    # "12/20/1998 0:00" or ISO
    raw = raw.strip()
    for fmt in ("%m/%d/%Y %H:%M", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.split(".")[0], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _player_name(item: dict) -> str:
    common = item.get("commonName")
    if isinstance(common, str) and common.strip():
        return common.strip()
    parts = [item.get("firstName") or "", item.get("lastName") or ""]
    name = " ".join(p for p in parts if p).strip()
    if not name:
        raise ParserError("EA item missing player name")
    return name


def _stat(stats: dict, key: str) -> float | None:
    node = stats.get(key)
    if isinstance(node, dict) and "value" in node:
        return float(node["value"])
    if isinstance(node, (int, float)):
        return float(node)
    return None


def item_to_external(item: dict, *, game: str | None = None,
                     source_url: str | None = None,
                     version: str | None = None) -> ExternalPlayer:
    if not isinstance(item, dict) or item.get("overallRating") is None:
        raise ParserError("EA item missing overallRating")
    pid = item.get("id")
    if pid is None:
        raise ParserError("EA item missing id")
    stats = item.get("stats") or {}
    attrs = {}
    for src, dst in (("pac", "pace"), ("sho", "shooting"), ("pas", "passing"),
                     ("dri", "dribbling"), ("def", "defending"), ("phy", "physical")):
        val = _stat(stats, src)
        if val is not None:
            attrs[dst] = val
    team = item.get("team") or {}
    nation = item.get("nationality") or {}
    pos = item.get("position") or {}
    return ExternalPlayer(
        externalPlayerId=str(pid),
        name=_player_name(item),
        overall=float(item["overallRating"]),
        dateOfBirth=_parse_birth(item.get("birthdate")),
        club=team.get("label") if isinstance(team, dict) else None,
        position=(pos.get("shortLabel") or pos.get("label")) if isinstance(pos, dict) else None,
        country=nation.get("label") if isinstance(nation, dict) else None,
        attributes=attrs,
        family=FAMILY_EA_FC,
        ratingType=RATING_BASE,  # page documents Gold/Silver/Bronze base items
        sourceUrl=source_url,
        game=game or "EA SPORTS FC",
        version=version,
    )


def parse_next_data(payload: dict | str, *, source_url: str | None = None) -> list[ExternalPlayer]:
    data = json.loads(payload) if isinstance(payload, str) else payload
    try:
        page_props = data["props"]["pageProps"]
        items = page_props["ratingDetails"]["items"]
    except (KeyError, TypeError) as exc:
        raise ParserError("EA __NEXT_DATA__ missing ratingDetails.items") from exc
    if not isinstance(items, list):
        raise ParserError("EA ratingDetails.items is not a list")
    if len(items) == 0:
        raise ParserError("EA parser returned 0 players — layout/API may have changed")
    game = None
    try:
        game = page_props.get("gameDetails", {}).get("title")
    except Exception:
        pass
    players = [item_to_external(it, game=game, source_url=source_url) for it in items]
    # Sanity: every player must have name + overall
    if any(not p.name or p.overall <= 0 for p in players):
        raise ParserError("EA sanity check failed (name/overall)")
    return players


def parse_ratings_html(html: str, *, source_url: str | None = None) -> list[ExternalPlayer]:
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*type="application/json"[^>]*>(.*?)</script>',
        html,
        re.S,
    )
    if not match:
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ParserError("EA HTML missing __NEXT_DATA__ script")
    return parse_next_data(match.group(1), source_url=source_url)


class EAOfficialProvider(RatingsProvider):
    name = "ea-official"
    family = FAMILY_EA_FC
    authorized = False
    synthetic = False
    availability = DISABLED_BY_POLICY
    availability_reason = (
        "EA User Agreement restricts robots/automated data extraction; "
        "verified 2026-09-17. Adapter exists for fixtures/probe only."
    )
    position_aliases = {
        "st": "ATA", "cf": "ATA", "lw": "ATA", "rw": "ATA",
        "cam": "MEI", "cm": "MEI", "cdm": "MEI", "lm": "MEI", "rm": "MEI",
        "cb": "DEF", "lb": "DEF", "rb": "DEF", "lwb": "DEF", "rwb": "DEF",
        "gk": "GOL",
    }

    def __init__(self, players: list[ExternalPlayer] | None = None,
                 html: str | None = None, html_path: Path | None = None):
        self._index: dict[str, ExternalPlayer] = {}
        loaded: list[ExternalPlayer] = list(players or [])
        if html_path is not None:
            loaded.extend(parse_ratings_html(html_path.read_text(encoding="utf-8")))
        elif html is not None:
            loaded.extend(parse_ratings_html(html))
        for p in loaded:
            self._index[p.externalPlayerId] = p
        if loaded and len(self._index) != len(loaded):
            # Allow intentional duplicates from search+detail; last wins.
            pass

    async def find_player(self, player: CanonicalPlayer) -> list[ExternalPlayer]:
        if not self._index:
            raise ParserError(
                "EA provider has no fixture data and is not authorized for live fetch"
            )
        return [
            p for p in self._index.values()
            if normalize(p.name) == normalize(player.name)
            or (player.dateOfBirth and p.dateOfBirth == player.dateOfBirth)
        ]

    async def fetch_player(self, external_id: str) -> ExternalPlayer | None:
        return self._index.get(external_id)

    async def health_check(self) -> bool:
        return bool(self._index) or self.availability != DISABLED_BY_POLICY
