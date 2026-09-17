#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Um processo Python por lote; o interpretador é resolvido uma única vez.
RATINGS_PYTHON="$(bash scripts/ratings-python.sh -c 'import sys; print(sys.executable)')"
export RATINGS_PYTHON
# react-server mantém as proteções server-only da infraestrutura, sem subir Next.
exec node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/atualizar-ratings.ts "$@"
