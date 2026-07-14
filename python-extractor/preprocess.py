import cv2
import numpy as np


def preprocess_page(image_bgr: np.ndarray) -> np.ndarray:
    """Crop exam chrome; keep color — EasyOCR works poorly on binarized images."""
    h, w = image_bgr.shape[:2]
    crop_top = int(h * 0.1)
    crop_bottom = int(h * 0.07)
    cropped = image_bgr[crop_top : h - crop_bottom, :]

    lab = cv2.cvtColor(cropped, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def ocr_results_to_text(results: list) -> str:
    """Rebuild reading-order text from EasyOCR bounding boxes."""
    if not results:
        return ""

    items: list[tuple[float, float, str]] = []
    for entry in results:
        if len(entry) < 2:
            continue
        box, text = entry[0], str(entry[1]).strip()
        if not text:
            continue
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        items.append((min(ys), min(xs), text))

    items.sort(key=lambda t: (round(t[0] / 18), t[1]))

    lines: list[str] = []
    current_y = -9999.0
    current_parts: list[str] = []

    for y, _x, text in items:
        if current_parts and abs(y - current_y) > 22:
            lines.append(" ".join(current_parts))
            current_parts = []
        current_parts.append(text)
        current_y = y

    if current_parts:
        lines.append(" ".join(current_parts))

    return "\n".join(lines)
