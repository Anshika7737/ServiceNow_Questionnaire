#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${CERTPREP_PYTHON:-$ROOT/.python-venv/bin/python}"

if [ ! -x "$PYTHON" ]; then
  PYTHON="$(command -v python3)"
fi

exec "$PYTHON" "$ROOT/python-extractor/extract_pdf.py" "$@"
