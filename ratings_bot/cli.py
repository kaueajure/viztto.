import argparse
import asyncio
import json
from pathlib import Path
from .bot import run
from .cache import write_json
from .config import Config
from .models import parse_input
from .normalizer import RatingNormalizer
from .providers import MockRatingsProvider, DISABLED_PROVIDERS
from .report import print_report

KNOWN_PROVIDERS = ("mock", "mock-b")


OFFICIAL_SEGMENTS = ("src", "dados", "futebol")


def safe_output(path: Path) -> Path:
    """Bloqueia snapshots oficiais de qualquer cópia do projeto, não só desta."""
    parts = path.resolve().parts
    if any(parts[i:i + 3] == OFFICIAL_SEGMENTS for i in range(len(parts) - 2)):
        raise ValueError("Bot outputs cannot target official snapshots")
    return path


def build_providers(names: list[str], fixtures: dict) -> list[MockRatingsProvider]:
    """Rejeita provider desconhecido, desabilitado ou repetido antes do lote."""
    if len(set(names)) != len(names):
        raise ValueError("Duplicate provider requested")
    providers = []
    for name in names:
        if name in DISABLED_PROVIDERS:
            raise ValueError(f"Provider {name} disabled: {DISABLED_PROVIDERS[name]}")
        if name not in KNOWN_PROVIDERS:
            raise ValueError(f"Unknown or unauthorized provider: {name}")
        providers.append(MockRatingsProvider(fixtures.get(name, []), name))
    return providers


def preflight(providers: list[MockRatingsProvider], calibrations: dict, config: Config) -> list[str]:
    """Falha cedo: autorização e calibração validadas antes de milhares de jogadores."""
    linhas = ["PRE-FLIGHT RATINGS", f"Concurrency: {config.concurrency}  TTL: {config.ttl:g}s"]
    if not providers:
        linhas.append("Providers externos habilitados: nenhum")
    for provider in providers:
        if not provider.authorized:
            raise ValueError(f"Provider {provider.name} is not authorized")
        if provider.name not in calibrations:
            raise ValueError(f"Provider {provider.name} has no calibration entry")
        versao = RatingNormalizer(calibrations[provider.name]).config["version"]
        linhas.append(
            f"Provider: {provider.name}  Authorization: OK  "
            f"Calibration: {versao}  Synthetic: {'yes' if provider.synthetic else 'no'}"
        )
    return linhas


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
    parser.add_argument("--preflight", action="store_true", help="Validate providers and calibration only")
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
        config = Config(args.cache_dir, args.ttl, args.refresh, args.concurrency)
        fixtures = json.loads(args.fixture.read_text()) if args.fixture else {}
        providers = build_providers(args.provider, fixtures)
        calibrations = json.loads(args.calibration.read_text())
        for linha in preflight(providers, calibrations, config):
            print(linha)
        if args.preflight:
            return
        if not args.input.exists():
            raise ValueError(f"Canonical input not found: {args.input}")
        data = json.loads(args.input.read_text())
        parse_input(data)
        if args.league:
            data["players"] = [p for p in data["players"] if p["league"] == args.league]
            if not data["players"]:
                raise ValueError("League has no canonical players")
        result, report = asyncio.run(run(data, providers, calibrations, config))
        report["dryRun"] = args.dry_run
        write_json(args.output, result)
        write_json(args.report, report)
        print_report(report)
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(1, f"Ratings import failed ({type(error).__name__}): {error}\n")
