#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.python-venv"

echo "Setting up Python OCR extractor..."
python3 -m venv "$VENV"
source "$VENV/bin/activate"
pip install --upgrade pip
pip install -r "$ROOT/python-extractor/requirements.txt"
echo "Done. Python extractor ready at $VENV/bin/python"
