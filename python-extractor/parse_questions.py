import re
from dataclasses import dataclass
from corrections import normalize_ocr_text, apply_dictionary_fixes


@dataclass
class ParsedQuestion:
    text: str
    options: list[str]
    correctAnswer: str
    explanation: str | None = None


OPTION_LINE = re.compile(r"^([A-Da-d])[.)]\s*(.+)$")
LENIENT_OPTION = re.compile(
    r"(?:^|[°o©)\s@®|]{0,8})([A-DG])[.)]\s*(.+)|^G\s*[Dd]\.\s*(.+)|^C\d+\s+(.+)"
)
PAREN_OPTION = re.compile(r"^\)\s*([A-Da-d])[.)]\s*(.+)$")
COMMA_OPTION = re.compile(r"^([A-Da-d]),\s*(.+)$")
ZERO_PREFIX_OPTION = re.compile(r"^[0O]\s+([A-Da-d])\s*[.)]?\s*(.+)$", re.I)
OJ_OPTION = re.compile(r"^\[OJ\s*([A-Da-d])[.)]\s*(.+)$", re.I)
DIGIT_PREFIX_OPTION = re.compile(r"^[\d\s]*([A-Da-d])[.)]\s*(.+)$")
COPYRIGHT_OPTION = re.compile(r"^©\s*(.+)$")
AT_OPTION = re.compile(r"^@\s*[|©]?\s*(?:sence\s*)?(.+)$", re.I)
ANSWER_LINE = re.compile(r"^(?:answer|correct(?:\s*answer)?)\s*[:.\-]?\s*([A-Da-d])\b", re.I)
EXAM_QUESTION_HEADER = re.compile(r"(?:Question|Ouestion)", re.I)
EXAM_HEADER_STRICT = re.compile(
    r"(?=(?:Question|Ouestion)\s*\d+\s*(?:of|0f)\s*\d+)",
    re.I,
)
EXAM_HEADER_LOOSE = re.compile(r"(?=(?:Question|Ouestion)[^\n]{0,60})", re.I)
TIMER_SPLIT = re.compile(r"(?=Time Remaining:\s*\d{2}:\d{2})", re.I)
CHOOSE_LINE = re.compile(r"Choose\s*[\"']?\s*\d*\s*opt", re.I)
QUESTION_NUM_HEADER = re.compile(
    r"(?:Question|Ouestion)\s*(\d+)\s*(?:of|0f)\s*(\d+)",
    re.I,
)
DOT_OPTION = re.compile(r"^([A-D])\.\s*(.+)$")
LOOSE_OPTION = re.compile(r"^([A-D])[.)]\s*(.+)$", re.I)
STOP_OPTION = re.compile(r"^(?:Review|Rovow|Rovlow|Back|Next|Recording)\b", re.I)
SKIP_LINE = re.compile(
    r"Time Remaining|Flag for Review|Choose 2 options|Choose option|University|"
    r"Gh?iversity|ossas|Zsiey|frcin|Priv|Reon ack|evn ack|Croce topton|Leon \d|Prev|Next|"
    r"Tie Remini|sossis|sosssv|sossin|e po—|e ec \d|yp—|ET—|CHB|CE\b|Cl\b|CI\b|gd Qe|universit",
    re.I,
)
QUESTION_WORD = re.compile(
    r"\b(which|what|how|when|where|who|why|should|would|could|can|must|is|are|"
    r"does|do|needs|wants|view|create|manage|explore|locate|display|minimize|retain|"
    r"remove|meet|slow|allow|identify|used)\b",
    re.I,
)
SELECTED_MARKER = re.compile(r"(?:®|\\®|@(?!\s*[|©])|✓|◉|●|\[\s*x\s*\]|\[OJ)", re.I)


def prep_text(raw: str) -> str:
    return apply_dictionary_fixes(normalize_ocr_text(raw))


def skip_line(line: str) -> bool:
    return bool(
        SKIP_LINE.search(line)
        or re.search(r"\d{2}:\d{2}:\d{2}", line)
        or re.fullmatch(r"[\s|#®°@8§\[\]()\\\-=]+", line)
        or re.fullmatch(r"—+", line)
    )


def clean_option_text(text: str) -> str:
    text = re.sub(r"^[\s|#®°@8§\[\]()\\\-]+", "", text).strip()
    text = re.sub(r"^[A-D]\s+", "", text)
    return text.rstrip(".,;:").strip()


def next_option_letter(option_map: dict[str, str]) -> str | None:
    for letter in "ABCD":
        if letter not in option_map:
            return letter
    return None


def try_parse_option_line(line: str, option_map: dict[str, str]) -> tuple[str, bool] | None:
    for pattern in (
        OJ_OPTION,
        PAREN_OPTION,
        ZERO_PREFIX_OPTION,
        COMMA_OPTION,
        OPTION_LINE,
        DIGIT_PREFIX_OPTION,
        LENIENT_OPTION,
    ):
        m = pattern.match(line)
        if not m:
            continue
        letter = (m.group(1) or "").upper()
        opt_text = clean_option_text(m.group(2) or m.group(3) or m.group(4) or m.group(5) or "")
        if letter == "G" and "A" in option_map and "B" in option_map and "C" not in option_map:
            letter = "C"
        if letter not in "ABCD" or len(opt_text) < 2 or letter in option_map:
            continue
        option_map[letter] = apply_dictionary_fixes(opt_text)
        return letter, bool(SELECTED_MARKER.search(line))

    at_match = AT_OPTION.match(line)
    if at_match:
        opt_text = clean_option_text(at_match.group(1))
        letter = next_option_letter(option_map)
        if letter and len(opt_text) >= 3:
            option_map[letter] = apply_dictionary_fixes(opt_text)
            return letter, True

    copy_match = COPYRIGHT_OPTION.match(line)
    if copy_match:
        opt_text = clean_option_text(copy_match.group(1))
        if len(opt_text) >= 3 and "C" not in option_map:
            option_map["C"] = apply_dictionary_fixes(opt_text)
            return "C", bool(SELECTED_MARKER.search(line))

    return None


STEM_PREFIX = re.compile(
    r"^.*?(?:Choose\s*[\"'-]?\s*\d*\s*options?\s*[:.\-]?|Flag for Review)\s*",
    re.I,
)
STEM_HEADER = re.compile(
    r"(?:Question|Ouestion)\s*\d+\s*(?:of|0f)\s*\d+\s*(?:Flag for Review)?\s*",
    re.I,
)


def clean_question_stem(text: str) -> str:
    """Strip leading exam-chrome (Question N of 75 / Flag for Review / Choose 1 option:)."""
    text = STEM_HEADER.sub("", text)
    # If a 'Choose ... option:' marker exists, keep only what follows the LAST one.
    parts = re.split(r"Choose\s*[\"'-]?\s*\d*\s*options?\s*[:.\-]?", text, flags=re.I)
    if len(parts) > 1 and len(parts[-1].strip()) >= 15:
        text = parts[-1]
    return re.sub(r"\s+", " ", text).strip()


def pick_question_text(lines: list[str]) -> str:
    meaningful: list[str] = []
    for l in lines:
        if len(l) < 12:
            continue
        if re.match(r"^(?:To|ca|§|Flag|Drag and drop)\b", l, re.I):
            continue
        if re.match(r"^[A-D][.)]?\s", l) and not QUESTION_WORD.search(l):
            continue
        meaningful.append(l)

    with_word = [l for l in meaningful if QUESTION_WORD.search(l)]
    if with_word:
        return clean_question_stem(apply_dictionary_fixes(" ".join(with_word)))
    with_q = [l for l in meaningful if "?" in l]
    if with_q:
        return clean_question_stem(apply_dictionary_fixes(" ".join(with_q)))
    joined = " ".join(meaningful).strip()
    if len(joined) >= 20:
        return clean_question_stem(apply_dictionary_fixes(joined))
    return clean_question_stem(apply_dictionary_fixes(max(meaningful, key=len) if meaningful else ""))


def extract_positional_options(lines: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    letters = ["A", "B", "C", "D"]
    idx = 0
    after_choose = False

    for line in lines:
        if CHOOSE_LINE.search(line):
            after_choose = True
            continue
        if not after_choose:
            continue
        if idx >= 4:
            break
        if skip_line(line) or EXAM_QUESTION_HEADER.search(line):
            continue
        cleaned = clean_option_text(line)
        if len(cleaned) < 4 or len(cleaned) > 220:
            continue
        if re.match(r"^(?:Question|Time|Flag|Prev|Next)\b", cleaned, re.I):
            continue
        if re.match(r"^[A-D][.)]\s", cleaned):
            continue
        looks_like = (
            re.search(r"[@°©]", line)
            or re.match(r"^\d+[\.)]\s", cleaned)
            or re.match(
                r"^(?:CMDB|Discovery|Service|Graph|Archive|Delete|Retire|Toolbox|Unique|Gaps|"
                r"Duplicate|Important|Completeness|Correctness|Newest|Most|Main)",
                cleaned,
                re.I,
            )
            or (re.match(r"^[A-Z]", cleaned) and len(cleaned) < 120 and not QUESTION_WORD.search(cleaned))
        )
        if looks_like:
            result[letters[idx]] = apply_dictionary_fixes(cleaned)
            idx += 1
    return result


def parse_exam_block(block: str) -> ParsedQuestion | None:
    lines = [l.strip() for l in block.split("\n") if l.strip()]
    option_map: dict[str, str] = {}
    selected_letter = ""
    question_lines: list[str] = []
    after_choose = False

    for line in lines:
        if EXAM_QUESTION_HEADER.search(line) and len(line) < 80:
            continue
        if skip_line(line) or len(line) < 3:
            continue
        if STOP_OPTION.search(line):
            after_choose = False
            continue
        if CHOOSE_LINE.search(line):
            after_choose = True
            continue

        answer_match = ANSWER_LINE.match(line)
        if answer_match:
            selected_letter = answer_match.group(1).upper()
            continue

        if after_choose:
            parsed_opt = try_parse_option_line(line, option_map)
            if parsed_opt:
                letter, selected = parsed_opt
                if selected:
                    selected_letter = letter
                continue
            # Single-letter option lines like "A CMDB Workspace" without punctuation
            m = re.match(r"^([A-D])\s*[.)]?\s+(.{4,})$", line)
            if m and m.group(1) not in option_map:
                option_map[m.group(1)] = apply_dictionary_fixes(clean_option_text(m.group(2)))
                if SELECTED_MARKER.search(line):
                    selected_letter = m.group(1)
                continue

        cleaned = clean_option_text(line)
        if not after_choose and len(cleaned) >= 10 and not re.match(
            r"^(?:Croce|Choose|To|ca|§|Flag|Prev|Next|A Service Owner needs|Drag and drop)\b", cleaned, re.I
        ):
            if not re.fullmatch(r"[°o©)\s]+", cleaned):
                question_lines.append(cleaned)

    if len(option_map) < 2:
        for letter, text in extract_positional_options(lines).items():
            option_map.setdefault(letter, text)

    if len(option_map) < 2 or len(pick_question_text(question_lines)) < 15:
        q_text, q_opts, q_sel = extract_options_after_question(lines)
        if len(q_opts) >= 2:
            if len(q_text) >= 10:
                question_lines = [q_text]
            for letter, opt in q_opts.items():
                option_map.setdefault(letter, opt)
            if q_sel:
                selected_letter = q_sel

    question_text = pick_question_text(question_lines)
    letters = [l for l in "ABCDE" if l in option_map]
    if len(question_text) < 10 or len(letters) < 2:
        return None

    options = [option_map[l] for l in letters]
    index = letters.index(selected_letter) if selected_letter in letters else 0
    return ParsedQuestion(text=question_text.strip(), options=options, correctAnswer=options[index])


def count_question_headers(text: str) -> int:
    text = prep_text(text)
    return len(QUESTION_NUM_HEADER.findall(text))


def _split_into_blocks(text: str) -> list[str]:
    for pattern in (EXAM_HEADER_STRICT, EXAM_HEADER_LOOSE, TIMER_SPLIT):
        matches = list(pattern.finditer(text))
        if len(matches) > 1:
            blocks = []
            for i, match in enumerate(matches):
                start = match.start()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                block = text[start:end].strip()
                if len(block) > 60:
                    blocks.append(block)
            if blocks:
                return blocks
    return [text]


def split_exam_blocks(text: str) -> list[str]:
    return _split_into_blocks(text)


def _is_option_candidate(line: str) -> bool:
    if skip_line(line) or len(line) < 4:
        return False
    if EXAM_QUESTION_HEADER.search(line) and len(line) < 80:
        return False
    if STOP_OPTION.search(line):
        return False
    if re.match(r"^(?:Review|Prev|Next|Flag|Drag and drop)\b", line, re.I):
        return False
    if CHOOSE_LINE.search(line):
        return False
    if LOOSE_OPTION.match(line) or DOT_OPTION.match(line):
        return True
    if re.match(
        r"^(?:Use|Create|Build|Service|CMDB|Application|Business|Archive|Delete|Retire|"
        r"Attest|Certif|Dynamic|Tag|Main|Most|Newest|Gaps|Duplicate|Important|"
        r"Completeness|Correctness)\b",
        line,
        re.I,
    ):
        return True
    if re.match(r"^[A-D]\s+[A-Z]", line):
        return True
    return False


def extract_options_after_question(lines: list[str]) -> tuple[str, dict[str, str], str]:
    full = "\n".join(lines)
    q_end = -1
    for m in re.finditer(r"\?", full):
        q_end = m.end()
    if q_end < 0:
        return pick_question_text(lines), {}, ""

    question_text = clean_question_stem(apply_dictionary_fixes(re.sub(r"\s+", " ", full[:q_end]).strip()))
    remainder = full[q_end:]
    remainder = re.split(
        r"(?:Review|Rav\w*)\s+Back|Time Remaining|Flag for Review",
        remainder,
        maxsplit=1,
        flags=re.I,
    )[0]
    option_lines = [l.strip() for l in remainder.split("\n") if l.strip()]

    option_map: dict[str, str] = {}
    selected_letter = ""

    for line in option_lines:
        if not _is_option_candidate(line):
            continue
        answer_match = ANSWER_LINE.match(line)
        if answer_match:
            selected_letter = answer_match.group(1).upper()
            continue
        parsed_opt = try_parse_option_line(line, option_map)
        if parsed_opt:
            letter, selected = parsed_opt
            if selected:
                selected_letter = letter
            continue
        m = re.match(r"^([A-D])\s+(.{4,})$", line)
        if m and m.group(1) not in option_map:
            option_map[m.group(1)] = apply_dictionary_fixes(clean_option_text(m.group(2)))
            if SELECTED_MARKER.search(line):
                selected_letter = m.group(1)
            continue

    if len(option_map) < 2:
        for line in option_lines:
            if not _is_option_candidate(line):
                continue
            cleaned = clean_option_text(line)
            if len(cleaned) < 4 or len(cleaned) > 220:
                continue
            letter = next_option_letter(option_map)
            if not letter:
                break
            option_map[letter] = apply_dictionary_fixes(cleaned)
            if SELECTED_MARKER.search(line):
                selected_letter = letter

    return question_text, option_map, selected_letter


def parse_questions_from_page_text(page_text: str) -> list[ParsedQuestion]:
    text = prep_text(page_text)
    blocks = split_exam_blocks(text)

    if len(blocks) == 1 and blocks[0] == text:
        by_timer = [
            p
            for p in re.split(r"(?=Time Remaining:\s*\d{2}:\d{2})", text, flags=re.I)
            if len(p) > 80
        ]
        if len(by_timer) > 1:
            parsed = [q for p in by_timer if (q := parse_exam_block(p))]
            if parsed:
                return parsed
        single = parse_exam_block(text)
        return [single] if single else []

    questions: list[ParsedQuestion] = []
    for block in blocks:
        parsed = parse_exam_block(block)
        if parsed:
            questions.append(parsed)
    return questions


def dedupe_questions(questions: list[ParsedQuestion]) -> list[ParsedQuestion]:
    seen: set[str] = set()
    result: list[ParsedQuestion] = []
    for q in questions:
        key = re.sub(r"\s+", " ", q.text.lower()).strip()[:120]
        if key in seen:
            continue
        seen.add(key)
        result.append(q)
    return result
