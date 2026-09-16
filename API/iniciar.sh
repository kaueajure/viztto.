#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements-viztto.txt
fi

export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
# shellcheck disable=SC1091
set -a
[[ -f .env ]] && source .env
set +a

echo "Transfermarkt API em http://localhost:8000 (docs em /docs)"
exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
