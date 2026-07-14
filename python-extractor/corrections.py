import re
from difflib import get_close_matches

QUESTION_HEADER_FIX = re.compile(
    r"Question\s+(\d+)\s*(?:of|0f)\s*(\d+)",
    re.I,
)

REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bOuestion\b", re.I), "Question"),
    (re.compile(r"\bApplicalion\b", re.I), "Application"),
    (re.compile(r"\bOllering\b", re.I), "Offering"),
    (re.compile(r"\bPlallorm\b", re.I), "Platform"),
    (re.compile(r"\bDila\b", re.I), "Data"),
    (re.compile(r"\bCraph\b", re.I), "Graph"),
    (re.compile(r"\bServiceNow\b", re.I), "ServiceNow"),
    (re.compile(r"\bServicenow\b", re.I), "ServiceNow"),
    (re.compile(r"\bshould the Configuration Manager Created\b", re.I), "should the Configuration Manager create?"),
    (re.compile(r"\bNewest Created\b", re.I), "Newest Created"),
    (re.compile(r"\bAdminisirsior\b", re.I), "Administrator"),
    (re.compile(r"\bAdminisirator\b", re.I), "Administrator"),
    (re.compile(r"\baluibutes\b", re.I), "attributes"),
    (re.compile(r"\battribu(?:te|tes)\b", re.I), "attributes"),
    (re.compile(r"\batribu(?:te|tes)\b", re.I), "attributes"),
    (re.compile(r"\bDala\b", re.I), "Data"),
    (re.compile(r"\b410f\b", re.I), "41 of"),
    (re.compile(r"\bDicovry\b", re.I), "Discovery"),
    (re.compile(r"\bContuaton\b", re.I), "Configuration"),
    (re.compile(r"\bCHD\b"), "CMDB"),
    (re.compile(r"\bCHDB\b"), "CMDB"),
    (re.compile(r"\bCis\b"), "CIs"),
    (re.compile(r"\blems\b", re.I), "items"),
    (re.compile(r"\bQuestion(\d+)of(\d+)", re.I), r"Question \1 of \2"),
    (re.compile(r"\bQuestion(\d+)o([lfIl1])(\d+)", re.I), r"Question \1 of \3"),
    (re.compile(r"\bQuestion\s+(\d+)of\s+(\d+)\b", re.I), r"Question \1 of \2"),
    (re.compile(r"\bQuestion\s+(\d{2})0f\s+(\d+)\b", re.I), r"Question \1 of \2"),
    (re.compile(r"\bQuestion\s+(\d+)0f\s+(\d+)\b", re.I), r"Question \1 of \2"),
    (re.compile(r'\bChoose\s*["\']?\s*optlon\b', re.I), "Choose option"),
    (re.compile(r"\bChoose 2cptons\b", re.I), "Choose 2 options"),
    (re.compile(r"\bTool box\b", re.I), "Toolbox"),
    (re.compile(r"\bRavar\b", re.I), "Review"),
    (re.compile(r"\bDrug and drop\b", re.I), "Drag and drop"),
    (re.compile(r"\bCrcatc\b", re.I), "Create"),
    (re.compile(r"\bUsc\b", re.I), "Use"),
    (re.compile(r"\bdomaln\b", re.I), "domain"),
    (re.compile(r"\barchltect\b", re.I), "architect"),
    (re.compile(r"\borganizalion\b", re.I), "organization"),
    (re.compile(r"\baltribules\b", re.I), "attributes"),
    (re.compile(r"\bConsumiplion\b", re.I), "Consumption"),
    (re.compile(r"\bFoundatlon\b", re.I), "Foundation"),
    (re.compile(r"\bconlirm\b", re.I), "confirm"),
    (re.compile(r"\bAttestalion\b", re.I), "Attestation"),
    (re.compile(r"\brecondlatlon\b", re.I), "reconciliation"),
    (re.compile(r"\bDlsk\b", re.I), "Disk"),
]

SERVICENOW_TERMS = [
    "attributes", "attribute", "Administrator", "Configuration", "Discovery",
    "ServiceNow", "CMDB", "Workspace", "Reconciliation", "Certification",
    "Discovery Admin", "Graph Connector", "Health Dashboard", "Unified Map",
    "Service Mapping", "Data Foundation", "Completeness", "Correctness",
    "Archive", "Delete", "Retire", "Toolbox", "End of Life", "CIs",
    "deduplication", "Service Owner", "Form Owner", "items", "related",
    "Application", "Offering", "Platform", "Capability", "Newest", "Created",
    "Main", "identify", "Manager", "policy", "records",
]


def _fix_overflow_question_number(match: re.Match[str]) -> str:
    num_s, total_s = match.group(1), match.group(2)
    num, total = int(num_s), int(total_s)
    if num > total and len(num_s) >= 2:
        for end in (2, 1):
            if end < len(num_s):
                candidate = int(num_s[:end])
                if 1 <= candidate <= total:
                    num = candidate
                    break
    return f"Question {num} of {total}"


def normalize_ocr_text(raw: str) -> str:
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    for pattern, replacement in REPLACEMENTS:
        text = pattern.sub(replacement, text)
    text = QUESTION_HEADER_FIX.sub(_fix_overflow_question_number, text)
    return text


def fix_token(token: str) -> str:
    cleaned = re.sub(r"[^\w'-]", "", token)
    if len(cleaned) < 5:
        return token
    lower = cleaned.lower()
    if lower in {t.lower() for t in SERVICENOW_TERMS}:
        for term in SERVICENOW_TERMS:
            if term.lower() == lower:
                return term
    matches = get_close_matches(lower, [t.lower() for t in SERVICENOW_TERMS], n=1, cutoff=0.82)
    if matches:
        for term in SERVICENOW_TERMS:
            if term.lower() == matches[0]:
                return term
    return token


def apply_dictionary_fixes(text: str) -> str:
    words = re.split(r"(\s+)", text)
    return "".join(fix_token(w) if w.strip() and not w.isspace() else w for w in words)
