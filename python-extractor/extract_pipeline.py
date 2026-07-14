"""Extraction pipeline: OCR → regex + Ollama + vision merge (max coverage, best spelling)."""

from collections.abc import Callable
import sys

import cv2
import numpy as np

from ollama_client import (
    dicts_to_parsed,
    extract_questions_from_image,
    extract_questions_from_text,
    is_available as ollama_available,
)
from parse_questions import ParsedQuestion, parse_questions_from_page_text, count_question_headers

STAGE_PREFIX = "STAGE:"


def log_stage(stage: str, detail: str = "") -> None:
    msg = f"{STAGE_PREFIX}{stage}"
    if detail:
        msg += f" {detail}"
    print(msg, file=sys.stderr, flush=True)


def _quality_score(q: ParsedQuestion) -> float:
    score = 1.0
    if len(q.options) < 4:
        score -= 0.2
    if "?" not in q.text:
        score -= 0.1
    if len(q.text) < 20:
        score -= 0.15
    for opt in q.options:
        low = opt.lower()
        if len(opt) < 4:
            score -= 0.1
        if "choose" in low and "option" in low:
            score -= 0.5
    return max(0.0, score)


def _similar_text(a: str, b: str) -> bool:
    ka = re.sub(r"\s+", " ", a.lower()).strip()[:120]
    kb = re.sub(r"\s+", " ", b.lower()).strip()[:120]
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    shorter, longer = (ka, kb) if len(ka) < len(kb) else (kb, ka)
    if len(shorter) >= 25 and shorter in longer:
        return True
    words_a = {w for w in ka.split() if len(w) > 3}
    words_b = {w for w in kb.split() if len(w) > 3}
    if not words_a or not words_b:
        return False
    overlap = len(words_a & words_b)
    return overlap / min(len(words_a), len(words_b)) >= 0.72


def _merge_pools(*pools: list[ParsedQuestion]) -> list[ParsedQuestion]:
    """Union all sources; when questions match, keep the higher-quality version."""
    result: list[ParsedQuestion] = []
    for pool in pools:
        for q in pool:
            if _quality_score(q) < 0.35:
                continue
            replaced = False
            for i, existing in enumerate(result):
                if _similar_text(q.text, existing.text):
                    if _quality_score(q) > _quality_score(existing):
                        result[i] = q
                    replaced = True
                    break
            if not replaced:
                result.append(q)
    return result


def _expected_question_count(page_text: str) -> int:
    return count_question_headers(page_text)


def _vision_fallback(page_text: str, page_bgr: np.ndarray) -> list[ParsedQuestion]:
    ok, buf = cv2.imencode(".png", page_bgr)
    if not ok:
        return []
    log_stage("vision", "LLaVA fallback")
    items = extract_questions_from_image(buf.tobytes(), page_text)
    return dicts_to_parsed(items)


def extract_questions_from_page(
    page_text: str,
    page_bgr: np.ndarray | None = None,
    page_num: int | None = None,
    ocr_half_page: Callable[[np.ndarray], str] | None = None,
) -> list[ParsedQuestion]:
    """
    Per page — always merge ALL sources (never discard regex when Ollama runs):
      1. Regex parser on OCR text (high recall, ~47 questions on full PDF)
      2. Ollama text model (better spelling; may miss some)
      3. LLaVA only if merged count < expected headers on page
    """
    if not page_text.strip():
        return []

    page_label = f"page {page_num}" if page_num is not None else "page"

    regex_qs = parse_questions_from_page_text(page_text)
    log_stage("regex", f"{page_label}: {len(regex_qs)} question(s)")

    ollama_qs: list[ParsedQuestion] = []
    if ollama_available():
        log_stage("ollama", f"structuring {page_label}")
        ollama_qs = dicts_to_parsed(extract_questions_from_text(page_text))
        log_stage("ollama", f"{page_label}: {len(ollama_qs)} question(s)")

    merged = _merge_pools(regex_qs, ollama_qs)

    expected = _expected_question_count(page_text)
    need_vision = page_bgr is not None and (
        (expected > 0 and len(merged) < expected)
        or (not merged and "?" in page_text)
        or (merged and sum(_quality_score(q) for q in merged) / len(merged) < 0.5)
    )

    if need_vision:
        vision_qs = _vision_fallback(page_text, page_bgr)
        if vision_qs:
            log_stage("vision", f"{page_label}: {len(vision_qs)} question(s)")
            merged = _merge_pools(merged, vision_qs)

    if ocr_half_page and page_bgr is not None and expected > len(merged):
        log_stage("half-page", f"{page_label}: retry ({len(merged)}/{expected})")
        h = page_bgr.shape[0]
        mid = h // 2
        overlap = int(h * 0.06)
        halves = [
            page_bgr[: mid + overlap],
            page_bgr[mid - overlap :],
        ]
        for half in halves:
            half_text = ocr_half_page(half)
            half_qs = parse_questions_from_page_text(half_text)
            if half_qs:
                merged = _merge_pools(merged, half_qs)
            if ollama_available() and len(half_qs) < 1:
                half_ollama = dicts_to_parsed(extract_questions_from_text(half_text))
                merged = _merge_pools(merged, half_ollama)

    log_stage("merged", f"{page_label}: {len(merged)} question(s) total")
    return merged
