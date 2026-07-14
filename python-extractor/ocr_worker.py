#!/usr/bin/env python3
"""Persistent EasyOCR worker — keeps models loaded between uploads."""

from __future__ import annotations

import json
import os
import socket
import struct
import sys
import threading
import warnings
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

os.environ.setdefault("PYTHONWARNINGS", "ignore")
warnings.filterwarnings("ignore")

# Must set before torch import
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")

import fitz  # noqa: E402
import numpy as np  # noqa: E402

from corrections import apply_dictionary_fixes, normalize_ocr_text  # noqa: E402
from extract_pipeline import extract_questions_from_page  # noqa: E402
from parse_questions import dedupe_questions  # noqa: E402
from preprocess import ocr_results_to_text, preprocess_page  # noqa: E402

HOST = os.environ.get("CERTPREP_OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("CERTPREP_OCR_PORT", "38471"))
RENDER_SCALE = float(os.environ.get("CERTPREP_RENDER_SCALE", "2.25"))
WORKERS = max(1, min(4, int(os.environ.get("CERTPREP_OCR_WORKERS", "2"))))

_readers: list = []


def log(msg: str) -> None:
    print(f"[ocr-worker] {msg}", file=sys.stderr, flush=True)


def load_readers() -> None:
    global _readers
    import easyocr

    log(f"Loading {WORKERS} EasyOCR reader(s)…")
    _readers = [
        easyocr.Reader(["en"], gpu=False, verbose=False) for _ in range(WORKERS)
    ]
    log("Ready.")


def page_to_bgr(doc: fitz.Document, page_index: int) -> np.ndarray:
    page = doc.load_page(page_index)
    matrix = fitz.Matrix(RENDER_SCALE, RENDER_SCALE)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        arr = arr[:, :, :3]
    return arr[:, :, ::-1].copy()


def ocr_image(reader, image_bgr: np.ndarray) -> str:
    processed = preprocess_page(image_bgr)
    results = reader.readtext(processed, detail=1, paragraph=False)
    text = ocr_results_to_text(results)
    return apply_dictionary_fixes(normalize_ocr_text(text))


def process_page(args: tuple[int, np.ndarray]) -> tuple[int, str, list]:
    page_index, bgr = args
    reader = _readers[page_index % len(_readers)]
    text = ocr_image(reader, bgr)
    questions = extract_questions_from_page(text, bgr, page_num=page_index + 1)
    return page_index, text, questions


def extract_pdf(pdf_path: str) -> dict:
    path = Path(pdf_path)
    if not path.exists():
        return {"method": "none", "pageCount": 0, "questions": [], "error": "PDF not found"}

    if not _readers:
        load_readers()

    doc = fitz.open(str(path))
    total_pages = doc.page_count
    try:
        pages: list[tuple[int, np.ndarray]] = []
        for i in range(total_pages):
            pages.append((i, page_to_bgr(doc, i)))

        all_questions = []
        page_texts: list[str | None] = [None] * total_pages
        done = 0

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for page_index, text, questions in pool.map(process_page, pages):
                page_texts[page_index] = text
                all_questions.extend(questions)
                done += 1
                log(f"PROGRESS:{json.dumps({'page': done, 'total': total_pages})}")
    finally:
        doc.close()

    questions = dedupe_questions(all_questions)
    from ollama_client import is_available as ollama_up

    method = "easyocr+ollama" if ollama_up() else "easyocr"
    return {
        "method": method,
        "pageCount": total_pages,
        "questions": [
            {
                "text": q.text,
                "options": q.options,
                "correctAnswer": q.correctAnswer,
                "explanation": q.explanation,
            }
            for q in questions
        ],
        "error": None,
    }


def handle_client(conn: socket.socket) -> None:
    try:
        raw_len = conn.recv(4)
        if len(raw_len) < 4:
            return
        (msg_len,) = struct.unpack(">I", raw_len)
        payload = b""
        while len(payload) < msg_len:
            chunk = conn.recv(msg_len - len(payload))
            if not chunk:
                break
            payload += chunk

        req = json.loads(payload.decode("utf-8"))
        if req.get("cmd") == "ping":
            resp = {"ok": True, "readers": len(_readers)}
        elif req.get("cmd") == "extract":
            resp = extract_pdf(req["path"])
        else:
            resp = {"error": "Unknown command"}

        data = json.dumps(resp).encode("utf-8")
        conn.sendall(struct.pack(">I", len(data)) + data)
    except Exception as exc:  # noqa: BLE001
        data = json.dumps({"error": str(exc), "questions": []}).encode("utf-8")
        conn.sendall(struct.pack(">I", len(data)) + data)
    finally:
        conn.close()


def serve() -> None:
    load_readers()
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(4)
    log(f"Listening on {HOST}:{PORT}")
    while True:
        conn, _addr = server.accept()
        threading.Thread(target=handle_client, args=(conn,), daemon=True).start()


if __name__ == "__main__":
    serve()
