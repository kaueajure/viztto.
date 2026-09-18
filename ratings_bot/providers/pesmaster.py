"""PES Master / eFootball public HTML parser.

robots.txt (2026-09-17): User-agent: * Allow: /
Privacy policy does not grant a clear automated-extraction license for
commercial products → REVIEW_REQUIRED / not authorized for live enrichment.
Featured/Epic cards are tagged special and excluded from consensus.
"""
from __future__ import annotations
import re
from pathlib import Path
from ..models import CanonicalPlayer, ExternalPlayer
from ..matcher import normalize
from .base import RatingsProvider
from .status import (
    FAMILY_KONAMI,
    RATING_BASE,
    RATING_FEATURED,
    RATING_SPECIAL,
    RATING_UNKNOWN,
    REVIEW_REQUIRED,
)


class ParserError(ValueError):
    pass


_INFO_ROW = re.compile(
    r"<tr[^>]*>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>(.*?)</td>",
    re.I | re.S,
)
_OVR = re.compile(
    r'(?:player-card-ovr[^>]*>|<span class="ovr[^"]*"[^>]*>)\s*(\d+)',
    re.I,
)
_H1_NAME = re.compile(r"<h1[^>]*>.*?<span>([^<]+)</span>", re.I | re.S)
_CANONICAL = re.compile(r'rel="canonical"[^>]*href="([^"]+)"', re.I)
_MAX_LEVEL = re.compile(r"Max level:\s*</td>\s*<td[^>]*>\s*(\d+)", re.I | re.S)
_PLAYER_ID = re.compile(r"ID:\s*</td>\s*<td[^>]*>\s*(\d+)", re.I | re.S)


def _clean_html(fragment: str) -> str:
    text = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", text).strip()


def classify_pes_card(*, external_id: str, max_level: int | None,
                      canonical: str | None, html: str) -> str:
    """Heuristic: featured listing / huge event IDs / max-level 0 → special."""
    blob = (canonical or "") + " " + html[:8000]
    if re.search(r"/player/featured/|FEATURED_MARKER", blob, re.I):
        return RATING_FEATURED
    if re.search(r"\b(Epic|Legendary|POTW|Highlight)\b", blob, re.I):
        return RATING_SPECIAL
    try:
        # Featured/event cards on PES Master often use very large numeric IDs.
        if int(external_id) >= 10_000_000_000:
            return RATING_FEATURED
    except ValueError:
        return RATING_UNKNOWN
    if max_level == 0:
        return RATING_FEATURED
    if "STANDARD_MARKER" in html or max_level is not None:
        return RATING_BASE
    return RATING_UNKNOWN


def parse_player_html(html: str, *, source_url: str | None = None,
                      force_type: str | None = None) -> ExternalPlayer:
    if not html or "<html" not in html.lower():
        raise ParserError("PES Master HTML empty or invalid")
    info = {k.strip(): _clean_html(v) for k, v in _INFO_ROW.findall(html)}
    ovr_m = _OVR.search(html)
    if not ovr_m:
        raise ParserError("PES Master HTML missing overall")
    overall = float(ovr_m.group(1))
    name = info.get("Full Name")
    if not name:
        h1 = _H1_NAME.search(html)
        name = h1.group(1).strip() if h1 else None
    if not name:
        raise ParserError("PES Master HTML missing player name")
    pid = info.get("ID")
    if not pid:
        m = _PLAYER_ID.search(html)
        pid = m.group(1) if m else None
    if not pid:
        raise ParserError("PES Master HTML missing player id")
    max_level = None
    if "Max level" in info:
        try:
            max_level = int(re.match(r"\d+", info["Max level"]).group(0))  # type: ignore[union-attr]
        except Exception:
            max_level = None
    else:
        m = _MAX_LEVEL.search(html)
        if m:
            max_level = int(m.group(1))
    canon = None
    cm = _CANONICAL.search(html)
    if cm:
        canon = cm.group(1)
    rating_type = force_type or classify_pes_card(
        external_id=pid, max_level=max_level, canonical=canon, html=html,
    )
    age = None
    if info.get("Age") and info["Age"].isdigit():
        age = int(info["Age"])
    height = None
    if info.get("Height (cm)"):
        try:
            height = float(info["Height (cm)"].split()[0])
        except ValueError:
            pass
    position = info.get("Position")
    if position:
        position = position.split()[0]
    return ExternalPlayer(
        externalPlayerId=str(pid),
        name=name,
        overall=overall,
        club=info.get("Team"),
        position=position,
        height=height,
        age=age,
        family=FAMILY_KONAMI,
        ratingType=rating_type,
        sourceUrl=source_url or (f"https://www.pesmaster.com{canon}" if canon else None),
        game="eFootball",
        version="efootball-2022",
    )


def parse_player_file(path: Path, **kwargs) -> ExternalPlayer:
    return parse_player_html(path.read_text(encoding="utf-8"), **kwargs)


class PesMasterProvider(RatingsProvider):
    name = "pesmaster"
    family = FAMILY_KONAMI
    authorized = False
    synthetic = False
    availability = REVIEW_REQUIRED
    availability_reason = (
        "robots.txt allows crawling (Allow: /) but no explicit license for "
        "automated commercial reuse was confirmed in privacy/terms "
        "(2026-09-17). Adapter parses fixtures; live enrichment disabled."
    )
    position_aliases = {
        "cf": "ATA", "ss": "ATA", "lwf": "ATA", "rwf": "ATA",
        "amf": "MEI", "cmf": "MEI", "dmf": "MEI", "rmf": "MEI", "lmf": "MEI",
        "cb": "DEF", "lb": "DEF", "rb": "DEF",
        "gk": "GOL",
    }

    def __init__(self, players: list[ExternalPlayer] | None = None,
                 html_paths: list[Path] | None = None):
        self._index: dict[str, ExternalPlayer] = {}
        loaded = list(players or [])
        for path in html_paths or []:
            loaded.append(parse_player_file(path))
        for p in loaded:
            self._index[p.externalPlayerId] = p

    async def find_player(self, player: CanonicalPlayer) -> list[ExternalPlayer]:
        if not self._index:
            raise ParserError("PES Master provider empty and not authorized for live fetch")
        # Only return base/standard for automatic matching candidates.
        return [
            p for p in self._index.values()
            if p.ratingType in (RATING_BASE, "standard")
            and (
                normalize(p.name) == normalize(player.name)
                or (player.dateOfBirth and p.dateOfBirth == player.dateOfBirth)
            )
        ]

    async def fetch_player(self, external_id: str) -> ExternalPlayer | None:
        return self._index.get(external_id)

    async def health_check(self) -> bool:
        return bool(self._index)
