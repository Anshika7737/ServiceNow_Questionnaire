#!/usr/bin/env python3
"""Extract exam questions from a scanned PDF using EasyOCR + OpenCV."""

from __future__ import annotations

import json
import os
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

os.environ.setdefault("PYTHONWARNINGS", "ignore")
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("MKL_NUM_THREADS", "4")
warnings.filterwarnings("ignore")

import fitz  # pymupdf
import numpy as np

from corrections import normalize_ocr_text, apply_dictionary_fixes
from extract_pipeline import extract_questions_from_page
from parse_questions import dedupe_questions
from preprocess import preprocess_page, ocr_results_to_text

RENDER_SCALE = float(os.environ.get("CERTPREP_RENDER_SCALE", "2.25"))
WORKERS = max(1, min(4, int(os.environ.get("CERTPREP_OCR_WORKERS", "2"))))
PROGRESS_PREFIX = "PROGRESS:"

_readers: list = []


def emit_progress(page: int, total: int) -> None:
    print(f"{PROGRESS_PREFIX}{json.dumps({'page': page, 'total': total})}", file=sys.stderr, flush=True)


def load_readers() -> None:
    global _readers
    import easyocr

    _readers = [
        easyocr.Reader(["en"], gpu=False, verbose=False) for _ in range(WORKERS)
    ]


def page_to_bgr(doc: fitz.Document, page_index: int) -> np.ndarray:
    page = doc.load_page(page_index)
    matrix = fitz.Matrix(RENDER_SCALE, RENDER_SCALE)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        arr = arr[:, :, :3]
    return arr[:, :, ::-1].copy()


def ocr_page_raw(reader, image_bgr: np.ndarray) -> str:
    """Raw OCR text before spelling corrections (safe to cache for dev iteration)."""
    processed = preprocess_page(image_bgr)
    results = reader.readtext(processed, detail=1, paragraph=False)
    return ocr_results_to_text(results)


def ocr_page(reader, image_bgr: np.ndarray) -> str:
    return apply_dictionary_fixes(normalize_ocr_text(ocr_page_raw(reader, image_bgr)))


def process_page(args: tuple[int, np.ndarray]) -> tuple[int, str, list]:
    page_index, bgr = args
    reader = _readers[page_index % len(_readers)]

    def ocr_half(half_bgr: np.ndarray) -> str:
        return ocr_page(reader, half_bgr)

    text = ocr_page(reader, bgr)
    questions = extract_questions_from_page(
        text, bgr, page_num=page_index + 1, ocr_half_page=ocr_half
    )
    return page_index, text, questions


def extract_pdf(pdf_path: str) -> dict:
    path = Path(pdf_path)
    if not path.exists():
        return {"method": "none", "pageCount": 0, "questions": [], "error": "PDF not found"}

    load_readers()

    doc = fitz.open(str(path))
    total_pages = doc.page_count
    all_questions = []
    done = 0

    try:
        pages = [(i, page_to_bgr(doc, i)) for i in range(total_pages)]
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for _page_index, text, questions in pool.map(process_page, pages):
                all_questions.extend(questions)
                done += 1
                emit_progress(done, total_pages)
    finally:
        doc.close()

    questions = dedupe_questions(all_questions)
    from ollama_client import is_available as ollama_up

    return {
        "method": "easyocr+ollama" if ollama_up() else "easyocr",
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


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: extract_pdf.py <path-to-pdf>"}))
        sys.exit(1)

    try:
        result = extract_pdf(sys.argv[1])
        print(json.dumps(result))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"method": "none", "pageCount": 0, "questions": [], "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
