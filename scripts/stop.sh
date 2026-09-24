#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

stop_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_pid_file .pc-autopost.pid
stop_pid_file .pc-autopost-rembg.pid

# Couvre aussi les lancements manuels `npm run dev` et `npm run start`.
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 7000/tcp 2>/dev/null || true

echo "PC AutoPost et le moteur rembg sont arrêtés."