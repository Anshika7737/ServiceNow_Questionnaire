#!/usr/bin/env python3
"""Fast developer harness for iterating on extraction WITHOUT re-running OCR/Ollama.

The slow parts of the pipeline are EasyOCR (~250s for a 38-page PDF) and Ollama
(4-8 min). Neither changes when you only edit the parser or spelling corrections,
so this tool caches the RAW OCR text per page to disk. After the first run:

    - Editing parse_questions.py / corrections.py -> re-run instantly (<1s)
    - No EasyOCR, no torch load, no Ollama unless you ask for it

Usage:
    python dev_extract.py <pdf>                 # parser only, uses OCR cache (fast)
    python dev_extract.py <pdf> --refresh-ocr   # force re-run OCR, rebuild cache
    python dev_extract.py <pdf> --ollama        # also run Ollama (slow)
    python dev_extract.py <pdf> --vision        # also allow LLaVA vision fallback
    python dev_extract.py <pdf> --dump          # print every extracted question
    python dev_extract.py <pdf> --answers key.json  # score correctness vs answer key

Answer key format (optional), maps question number -> correct option letter:
    { "1": "B", "2": "A", "3": "D", ... }
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import warnings
from pathlib import Path

os.environ.setdefault("PYTHONWARNINGS", "ignore")
warnings.filterwarnings("ignore")

CACHE_DIR = Path(__file__).parent / ".ocr-cache"
GREEN, YELLOW, RED, DIM, BOLD, RESET = (
    "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[1m", "\033[0m"
)


def _cache_key(pdf_path: Path, render_scale: str) -> str:
    h = hashlib.sha1()
    h.update(pdf_path.read_bytes())
    h.update(render_scale.encode())
    return h.hexdigest()[:16]


def build_ocr_cache(pdf_path: Path, cache_file: Path) -> list[str]:
    """Run EasyOCR once and persist raw per-page text. Slow (one time per PDF)."""
    import fitz
    import extract_pdf

    print(f"{YELLOW}Running OCR (one-time, ~4-5 min)...{RESET}", file=sys.stderr)
    extract_pdf.load_readers()
    readers = extract_pdf._readers
    doc = fitz.open(str(pdf_path))
    pages: list[str] = []
    t0 = time.time()
    for i in range(doc.page_count):
        bgr = extract_pdf.page_to_bgr(doc, i)
        pages.append(extract_pdf.ocr_page_raw(readers[i % len(readers)], bgr))
        print(f"  OCR page {i + 1}/{doc.page_count}", file=sys.stderr)
    doc.close()
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps({"pages": pages}))
    print(
        f"{GREEN}OCR cached in {time.time() - t0:.0f}s -> {cache_file.name}{RESET}",
        file=sys.stderr,
    )
    return pages


def load_pages(pdf_path: Path, refresh: bool, render_scale: str) -> list[str]:
    cache_file = CACHE_DIR / f"{_cache_key(pdf_path, render_scale)}.json"
    if cache_file.exists() and not refresh:
        return json.loads(cache_file.read_text())["pages"]
    return build_ocr_cache(pdf_path, cache_file)


def _quality(q) -> tuple[bool, list[str]]:
    """Heuristic 'well-formed' check. Returns (ok, list_of_warnings)."""
    warns = []
    if len(q.options) < 4:
        warns.append(f"{len(q.options)} options")
    if "?" not in q.text:
        warns.append("no '?'")
    if len(q.text) < 25:
        warns.append("short stem")
    if len(set(q.options)) < len(q.options):
        warns.append("dup options")
    if any(len(o) < 4 for o in q.options):
        warns.append("tiny option")
    return (not warns, warns)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--refresh-ocr", action="store_true", help="force re-run OCR")
    ap.add_argument("--ollama", action="store_true", help="also run Ollama text model")
    ap.add_argument("--vision", action="store_true", help="allow LLaVA vision fallback")
    ap.add_argument("--dump", action="store_true", help="print every question")
    ap.add_argument("--answers", help="answer-key JSON to score correctness")
    args = ap.parse_args()

    pdf_path = Path(args.pdf).expanduser()
    if not pdf_path.exists():
        print(f"{RED}PDF not found: {pdf_path}{RESET}", file=sys.stderr)
        sys.exit(1)

    # Ollama/vision only run through the full page pipeline; keep them off by default.
    os.environ["CERTPREP_USE_OLLAMA"] = "1" if (args.ollama or args.vision) else "0"

    render_scale = os.environ.get("CERTPREP_RENDER_SCALE", "2.25")
    raw_pages = load_pages(pdf_path, args.refresh_ocr, render_scale)

    from corrections import normalize_ocr_text, apply_dictionary_fixes
    from parse_questions import (
        parse_questions_from_page_text,
        count_question_headers,
        dedupe_questions,
    )

    def prep(raw: str) -> str:
        return apply_dictionary_fixes(normalize_ocr_text(raw))

    t0 = time.time()
    per_page = []
    all_questions = []
    total_expected = 0

    for i, raw in enumerate(raw_pages):
        text = prep(raw)
        expected = count_question_headers(text)
        qs = parse_questions_from_page_text(text)
        total_expected += expected
        per_page.append((i + 1, expected, len(qs)))
        all_questions.extend(qs)

    deduped = dedupe_questions(all_questions)
    elapsed = time.time() - t0

    # Per-page table
    print(f"\n{BOLD}Per-page (parser only){RESET}")
    print(f"{DIM}page  expected  parsed{RESET}")
    for page, exp, got in per_page:
        mark = f"{GREEN}OK{RESET}" if got >= exp else f"{RED}MISS{RESET}"
        if exp == 0 and got == 0:
            continue
        print(f"{page:>4}  {exp:>8}  {got:>6}  {mark}")

    well_formed = sum(1 for q in deduped if _quality(q)[0])

    print(f"\n{BOLD}Summary{RESET}")
    print(f"  pages            {len(raw_pages)}")
    print(f"  expected (hdrs)  {total_expected}")
    print(f"  parsed (raw)     {len(all_questions)}")
    print(f"  after dedupe     {BOLD}{len(deduped)}{RESET}")
    print(f"  well-formed      {well_formed}/{len(deduped)} "
          f"({100 * well_formed // max(1, len(deduped))}%)")
    print(f"  parse time       {GREEN}{elapsed:.2f}s{RESET} "
          f"{DIM}(OCR was cached){RESET}")

    # Quality warnings
    flagged = [(q, w) for q in deduped if (w := _quality(q)[1])]
    if flagged:
        print(f"\n{BOLD}Quality flags ({len(flagged)}){RESET}")
        for q, warns in flagged[:20]:
            print(f"  {YELLOW}!{RESET} {q.text[:70]!r} {DIM}{', '.join(warns)}{RESET}")
        if len(flagged) > 20:
            print(f"  {DIM}...and {len(flagged) - 20} more{RESET}")

    # Correctness vs answer key
    if args.answers:
        key_path = Path(args.answers).expanduser()
        if key_path.exists():
            key = json.loads(key_path.read_text())
            print(f"\n{BOLD}Correctness vs answer key{RESET} {DIM}(by order){RESET}")
            correct = 0
            for idx, q in enumerate(deduped, 1):
                want = key.get(str(idx))
                if not want:
                    continue
                got_letter = chr(65 + q.options.index(q.correctAnswer))
                ok = got_letter.upper() == want.upper()
                correct += ok
                if not ok:
                    print(f"  Q{idx}: got {got_letter} want {want} "
                          f"{DIM}{q.text[:50]!r}{RESET}")
            print(f"  {BOLD}{correct}/{len(key)} correct{RESET}")
        else:
            print(f"{RED}answer key not found: {key_path}{RESET}")

    if args.dump:
        print(f"\n{BOLD}All questions{RESET}")
        for idx, q in enumerate(deduped, 1):
            print(f"\n{BOLD}Q{idx}.{RESET} {q.text}")
            for j, opt in enumerate(q.options):
                letter = chr(65 + j)
                star = f" {GREEN}<= answer{RESET}" if opt == q.correctAnswer else ""
                print(f"    {letter}. {opt}{star}")


if __name__ == "__main__":
    main()
