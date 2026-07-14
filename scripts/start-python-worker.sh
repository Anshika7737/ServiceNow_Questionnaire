#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${CERTPREP_PYTHON:-$ROOT/.python-venv/bin/python}"
PID_FILE="$ROOT/.python-venv/ocr-worker.pid"
LOG_FILE="$ROOT/.python-venv/ocr-worker.log"

if [ ! -x "$PYTHON" ]; then
  PYTHON="$(command -v python3)"
fi

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "OCR worker already running (pid $OLD_PID)"
    exit 0
  fi
fi

mkdir -p "$(dirname "$PID_FILE")"
nohup "$PYTHON" "$ROOT/python-extractor/ocr_worker.py" >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "Started OCR worker (pid $(cat "$PID_FILE")). Models load in ~30-60s."
echo "Log: $LOG_FILE"
