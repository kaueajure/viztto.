"""Broken / edge fixtures for parser regression tests."""
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def write_broken_fixtures() -> None:
    (FIXTURES / "ea-official" / "broken.html").write_text(
        "<html><body><h1>no next data</h1></body></html>", encoding="utf-8",
    )
    (FIXTURES / "pesmaster" / "broken.html").write_text(
        "<html><body><p>unexpected layout</p></body></html>", encoding="utf-8",
    )


if __name__ == "__main__":
    write_broken_fixtures()
