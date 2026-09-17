#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -n "${RATINGS_PYTHON:-}" ]]; then
  exec "$RATINGS_PYTHON" "$@"
fi
if [[ ! -d .venv-ratings ]]; then
  if ! command -v python3 >/dev/null; then
    echo "Robô de ratings exige Python 3.11+: instale python3 ou defina RATINGS_PYTHON." >&2
    exit 1
  fi
  # Ambiente isolado e reproduzível; nada é instalado globalmente.
  python3 -m venv .venv-ratings
  .venv-ratings/bin/pip install --upgrade pip
  .venv-ratings/bin/pip install -e ".[test]"
fi
exec .venv-ratings/bin/python "$@"
