#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PID=""
iniciamos_api=0

cleanup() {
  if [[ "$iniciamos_api" -eq 1 && -n "${API_PID}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

api_pronta() {
  curl -sf "http://127.0.0.1:8000/docs" >/dev/null 2>&1
}

if api_pronta; then
  echo "Transfermarkt API já em execução em http://localhost:8000"
else
  echo "Iniciando Transfermarkt API…"
  bash "$ROOT/API/iniciar.sh" &
  API_PID=$!
  iniciamos_api=1
  for _ in $(seq 1 90); do
    if api_pronta; then
      echo "Transfermarkt API pronta em http://localhost:8000"
      break
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      echo "A Transfermarkt API falhou ao iniciar." >&2
      exit 1
    fi
    sleep 0.5
  done
  if ! api_pronta; then
    echo "Timeout aguardando a Transfermarkt API em :8000" >&2
    exit 1
  fi
fi

exec npx next dev --hostname 0.0.0.0
