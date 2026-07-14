import fitz
import numpy as np
import easyocr
from pathlib import Path
from preprocess import preprocess_page, ocr_results_to_text
from corrections import normalize_ocr_text, apply_dictionary_fixes
from parse_questions import parse_questions_from_page_text

pdf = "/Users/shivambhardwaj/Downloads/CIS - cmdb data foundation 2_174ea43c-d6ba-4942-841f-315016937668 1.pdf"
reader = easyocr.Reader(["en"], gpu=False, verbose=False)
doc = fitz.open(pdf)

for page_idx in [0, 2, 21, 43 // 2]:  # pages 1, 3, 22, ~22
    page = doc.load_page(page_idx)
    pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        arr = arr[:, :, :3]
    bgr = arr[:, :, ::-1].copy()
    processed = preprocess_page(bgr)
    results = reader.readtext(processed, detail=1, paragraph=False)
    text = apply_dictionary_fixes(normalize_ocr_text(ocr_results_to_text(results)))
    qs = parse_questions_from_page_text(text)
    print(f"\n=== PAGE {page_idx + 1} — {len(qs)} questions ===")
    print(text[:900])
    if qs:
        print("Q:", qs[0].text[:120])
        print("Opts:", qs[0].options)

doc.close()
