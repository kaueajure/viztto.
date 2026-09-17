#!/usr/bin/env bash
set -euo pipefail
VIZTTO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$VIZTTO_ROOT"

# Node carrega o .env sem interpretá-lo como código shell.
API_URL="$(node --env-file-if-exists=.env -e 'const u = new URL(process.env.TRANSFERMARKT_API_URL?.trim() || "http://127.0.0.1:8000"); if (!["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol !== "http:" || u.port !== "8000" || u.pathname !== "/" || u.username || u.password || u.search || u.hash) { console.error("Use TRANSFERMARKT_API_URL=http://127.0.0.1:8000 ou http://localhost:8000."); process.exit(1); } u.hostname = "127.0.0.1"; process.stdout.write(u.origin);')"
export TRANSFERMARKT_API_URL="$API_URL"
mkdir -p .cache
# A trava evita dois atualizadores concorrentes, inclusive durante a publicação.
exec 9>.cache/futebol-update.lock
if ! flock -n 9; then
  echo "Já existe uma atualização da base em andamento." >&2
  exit 1
fi
API_PID=""
ATUALIZADOR_PID=""
encerrar_grupo() {
  local pid="$1"
  [[ -n "$pid" ]] || return 0
  kill -TERM -- "-$pid" 2>/dev/null || true
  for _ in {1..20}; do
    kill -0 -- "-$pid" 2>/dev/null || break
    sleep 0.1
  done
  kill -KILL -- "-$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}
cleanup() {
  local codigo=$?
  trap - EXIT INT TERM
  encerrar_grupo "$ATUALIZADOR_PID"
  encerrar_grupo "$API_PID"
  exit "$codigo"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
api_pronta() {
  curl --silent --fail --max-time 2 "$API_URL/openapi.json" >/dev/null 2>&1
}
if api_pronta; then
  echo "Reutilizando Transfermarkt API em $API_URL (não será encerrada)."
else
  echo "Iniciando Transfermarkt API em $API_URL… Log: .cache/futebol-api.log"
  setsid bash "$VIZTTO_ROOT/API/iniciar.sh" >.cache/futebol-api.log 2>&1 &
  API_PID=$!
  for _ in {1..180}; do
    if api_pronta; then break; fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      echo "A API falhou ao iniciar. Consulte .cache/futebol-api.log." >&2
      exit 1
    fi
    sleep 0.5
  done
  if ! api_pronta; then
    echo "Tempo esgotado aguardando a API. Consulte .cache/futebol-api.log." >&2
    exit 1
  fi
fi
# Um processo Python por lote; o interpretador é resolvido antes da importação.
RATINGS_PYTHON="$(bash scripts/ratings-python.sh -c 'import sys; print(sys.executable)')"
export RATINGS_PYTHON
# react-server mantém as proteções server-only da infraestrutura, sem subir Next.
setsid node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/atualizar-dados-futebol.ts "$@" &
ATUALIZADOR_PID=$!
wait "$ATUALIZADOR_PID"
