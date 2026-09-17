import argparse
import asyncio
import json
from pathlib import Path
from .bot import run
from .cache import write_json
from .config import Config
from .models import parse_input
from .providers import MockRatingsProvider, DISABLED_PROVIDERS
from .report import print_report


def safe_output(path: Path) -> Path:
    resolved = path.resolve()
    official = Path("src/dados/futebol").resolve()
    if resolved == official or official in resolved.parents:
        raise ValueError("Bot outputs cannot target official snapshots")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline ratings; never publishes releases")
    parser.add_argument("--input", type=Path, default=Path(".cache/ratings/players-to-enrich.json"))
    parser.add_argument("--output", type=Path, default=Path(".cache/ratings/ratings-results.json"))
    parser.add_argument("--report", type=Path, default=Path("relatorios/ratings-import.json"))
    parser.add_argument("--calibration", type=Path, default=Path("config/ratings-calibration.json"))
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/ratings"))
    parser.add_argument("--provider", action="append", default=[])
    parser.add_argument("--fixture", type=Path, help="Synthetic provider records keyed by provider name")
    parser.add_argument("--league")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    parser.add_argument("--ttl", type=float, default=86400)
    parser.add_argument("--concurrency", type=int, default=1)
    args = parser.parse_args()
    try:
        if args.report_only:
            print_report(json.loads(args.report.read_text()))
            return
        for path in (args.output, args.report, args.cache_dir):
            safe_output(path)
        if args.output.resolve() in {args.input.resolve(), args.report.resolve()}:
            raise ValueError("Input, output and report must differ")
        data = json.loads(args.input.read_text())
        parse_input(data)
        if args.league:
            data["players"] = [p for p in data["players"] if p["league"] == args.league]
            if not data["players"]:
                raise ValueError("League has no canonical players")
        fixtures = json.loads(args.fixture.read_text()) if args.fixture else {}
        providers = []
        for name in args.provider:
            if name in DISABLED_PROVIDERS:
                raise ValueError(DISABLED_PROVIDERS[name])
            if name not in ("mock", "mock-b"):
                raise ValueError("Unknown or unauthorized provider")
            providers.append(MockRatingsProvider(fixtures.get(name, []), name))
        result, report = asyncio.run(run(data, providers, json.loads(args.calibration.read_text()),
            Config(args.cache_dir, args.ttl, args.refresh, args.concurrency)))
        report["dryRun"] = args.dry_run
        write_json(args.output, result)
        write_json(args.report, report)
        print_report(report)
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(1, f"Ratings import failed ({type(error).__name__}); validate input/configuration.\n")
