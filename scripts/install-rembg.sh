#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv-rembg
. .venv-rembg/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-rembg.txt
printf '\nrembg installé. Lancez ensuite : npm run start-rembg\n'
