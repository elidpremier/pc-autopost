#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv-rembg/bin/rembg ]]; then
  echo "rembg n'est pas installé. Exécutez : npm run install-rembg" >&2
  exit 1
fi
port="${BACKGROUND_REMOVAL_PORT:-7000}"
export BACKGROUND_REMOVAL_URL="${BACKGROUND_REMOVAL_URL:-http://127.0.0.1:${port}}"
export BACKGROUND_REMOVAL_MODEL="${BACKGROUND_REMOVAL_MODEL:-birefnet-general-lite}"
exec .venv-rembg/bin/rembg s --host 127.0.0.1 --port "$port" --no-ui --log_level info
