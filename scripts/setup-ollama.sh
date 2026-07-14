#!/usr/bin/env bash
set -euo pipefail

echo "Pulling recommended Ollama models for CertPrep extraction..."
echo "Text model (required): qwen2.5:3b — fast, good at JSON + spelling fixes"
ollama pull qwen2.5:3b

echo ""
echo "Vision model (optional fallback for hard pages): llava"
ollama pull llava

echo ""
echo "Done. Start Ollama with: ollama serve"
echo "Then restart the OCR worker: npm run python:worker"
