#!/usr/bin/env bash
set -euo pipefail
VIZTTO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$VIZTTO_ROOT"
# A aplicação web consome somente snapshots. Atualização é uma operação explícita.
exec npx next dev --hostname 0.0.0.0
