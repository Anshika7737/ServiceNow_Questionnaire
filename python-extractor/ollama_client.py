"""Ollama client for structuring OCR text into exam questions."""

from __future__ import annotations

import base64
import json
import os
import re
import threading
import urllib.error
import urllib.request
from typing import Any

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
TEXT_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "llava")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "120"))
USE_OLLAMA = os.environ.get("CERTPREP_USE_OLLAMA", "1") != "0"

_ollama_lock = threading.Lock()

SYSTEM_PROMPT = """You extract multiple-choice questions from ServiceNow certification exam pages (CMDB, CSDM, Data Foundation, ITSM).

Rules:
- Input is noisy OCR from exam screenshots. Fix spelling using correct ServiceNow terms.
- Common terms: CMDB, CSDM, CI, CIs, Discovery, Service Mapping, ServiceNow, Workspace, attributes, Reconciliation, Certification, Health Dashboard, Unified Map, Graph Connector, Application Service, Business Service, Technical Service Offering.
- Each question has a stem ending with "?" and exactly four options labeled A, B, C, D.
- The option selected in the exam (radio button filled) is the correct answer — put its full text in correctAnswer.
- A page may have 0, 1, or 2 questions (format "Question X of 75"). Many pages have TWO questions — return BOTH in the questions array.
- Count "Question N of 75" headers in the text; extract that many questions when possible.
- Ignore UI text: timers, university name, Flag for Review, Prev/Next, Recording.
- Do NOT invent questions. Only extract what is present.
- Return ONLY JSON matching: {"questions":[{"text":"...","options":["opt A","opt B","opt C","opt D"],"correctAnswer":"exact correct option text"}]}"""


def is_enabled() -> bool:
    return USE_OLLAMA


def is_available() -> bool:
    if not is_enabled():
        return False
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _post_json(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_HOST}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with _ollama_lock:
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))


def _parse_questions_payload(raw: str) -> list[dict[str, Any]]:
    raw = raw.strip()
    if not raw:
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            return []
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []

    items = parsed.get("questions", parsed) if isinstance(parsed, dict) else parsed
    if not isinstance(items, list):
        return []

    results: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        options = item.get("options", [])
        if not text or not isinstance(options, list) or len(options) < 2:
            continue
        opts = [str(o).strip() for o in options if str(o).strip()][:4]
        if len(opts) < 2:
            continue
        correct = str(item.get("correctAnswer", "")).strip()
        if not correct or correct not in opts:
            correct = opts[0]
        results.append({"text": text, "options": opts, "correctAnswer": correct})
    return results


def extract_questions_from_text(page_text: str) -> list[dict[str, Any]]:
    if not page_text.strip() or not is_available():
        return []

    prompt = f"""OCR text from one ServiceNow exam PDF page:

---
{page_text[:6000]}
---

Extract every multiple-choice question on this page. Many pages contain TWO questions — return both. Fix OCR errors in question and options."""

    try:
        resp = _post_json(
            "/api/generate",
            {
                "model": TEXT_MODEL,
                "system": SYSTEM_PROMPT,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "num_predict": 2048},
            },
        )
        return _parse_questions_payload(resp.get("response", ""))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return []


def extract_questions_from_image(png_bytes: bytes, ocr_hint: str = "") -> list[dict[str, Any]]:
    if not is_available():
        return []

    b64 = base64.b64encode(png_bytes).decode("ascii")
    hint = f"\nOCR hint (may help):\n{ocr_hint[:2000]}" if ocr_hint else ""

    try:
        resp = _post_json(
            "/api/chat",
            {
                "model": VISION_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"This is a ServiceNow certification exam screenshot. Extract all multiple-choice questions with options A-D and the selected correct answer.{hint}",
                        "images": [b64],
                    },
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "num_predict": 2048},
            },
        )
        content = resp.get("message", {}).get("content", "")
        return _parse_questions_payload(content)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return []


def dicts_to_parsed(items: list[dict[str, Any]]):
    from parse_questions import ParsedQuestion

    return [
        ParsedQuestion(
            text=item["text"],
            options=item["options"],
            correctAnswer=item["correctAnswer"],
        )
        for item in items
    ]
