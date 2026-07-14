import { dedupeParsedQuestions } from "./question-dedup";
import { normalizeOcrText } from "./ocr-corrections";

export type ParsedQuestion = {
  text: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
};

const OPTION_LINE = /^([A-Da-d])[.)]\s*(.+)$/;
const LENIENT_OPTION =
  /(?:^|[°o©)\s@®|]{0,8})([A-DG])[.)]\s*(.+)|^G\s*[Dd]\.\s*(.+)|^C\d+\s+(.+)/;
const PAREN_OPTION = /^\)\s*([A-Da-d])[.)]\s*(.+)$/;
const OJ_OPTION = /^\[OJ\s*([A-Da-d])[.)]\s*(.+)$/i;
const DIGIT_PREFIX_OPTION = /^[\d\s]*([A-Da-d])[.)]\s*(.+)$/;
const COPYRIGHT_OPTION = /^©\s*(.+)$/;
const AT_OPTION = /^@\s*[|©]?\s*(?:sence\s*)?(.+)$/i;
const ANSWER_LINE = /^(?:answer|correct(?:\s*answer)?)\s*[:.\-]?\s*([A-Da-d])\b/i;
const QUESTION_START = /^(?:question\s*)?(\d+)[.)]\s*(.*)$/i;
const EXAM_QUESTION_HEADER = /(?:Question|Ouestion)/i;
const EXAM_HEADER_SPLIT = /(?=(?:Question|Ouestion)[^\n]{0,65})/gi;
const SKIP_LINE =
  /Time Remaining|Flag for Review|Choose 2 options|Choose option|University|Gh?iversity|ossas|Zsiey|frcin|Priv|Reon ack|evn ack|Croce topton|Leon \d|Prev|Next|Tie Remini|sossis|sosssv|sossin|e po—|e ec \d|yp—|ET—|CHB|CE\b|Cl\b|CI\b|gd Qe|universit/i;
const SKIP_LINE_TEST = (line: string) =>
  SKIP_LINE.test(line) ||
  /\d{2}:\d{2}:\d{2}/.test(line) ||
  /^[\s|#®°@8§\[\]()\\\-=]+$/.test(line) ||
  /^—+$/.test(line);
const QUESTION_WORD =
  /\b(which|what|how|when|where|who|why|should|would|could|can|must|is|are|does|do|needs|wants|view|create|manage|explore|locate|display|minimize|retain|remove|meet|slow|allow)\b/i;
const SELECTED_MARKER = /(?:®|\\®|@(?!\s*[|©])|✓|◉|●|\[\s*x\s*\]|\[OJ)/i;

function prepText(raw: string) {
  return normalizeOcrText(raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
}

export function parseQuestionsFromText(raw: string): ParsedQuestion[] {
  const text = prepText(raw);

  const exam = parseExamScreenshotDump(text);
  if (exam.length > 0) return dedupeParsedQuestions(exam);

  const standard = parseStandardDump(text);
  if (standard.length > 0) return dedupeParsedQuestions(standard);

  return dedupeParsedQuestions(parseFallbackBlocks(text));
}

export function parseQuestionsFromPageText(pageText: string): ParsedQuestion[] {
  const text = prepText(pageText);
  const matches = [...text.matchAll(EXAM_HEADER_SPLIT)];

  if (matches.length === 0) {
    const byTimer = text.split(/(?=Time Remaining:\s*\d{2}:\d{2})/i).filter((p) => p.length > 80);
    if (byTimer.length > 1) {
      const fromTimer = byTimer
        .map((part) => parseExamBlock(part))
        .filter((q): q is ParsedQuestion => q !== null);
      if (fromTimer.length > 0) return fromTimer;
    }

    const parsed = parseExamBlock(text);
    return parsed ? [parsed] : [];
  }

  const questions: ParsedQuestion[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const parsed = parseExamBlock(text.slice(start, end));
    if (parsed) questions.push(parsed);
  }
  return questions;
}

function parseStandardDump(text: string): ParsedQuestion[] {
  const blocks = text.split(/\n(?=(?:Question\s*)?\d+[.)]\s)/i).filter(Boolean);
  const questions: ParsedQuestion[] = [];

  for (const block of blocks) {
    const parsed = parseQuestionBlock(block);
    if (parsed) questions.push(parsed);
  }

  return questions;
}

function parseExamScreenshotDump(text: string): ParsedQuestion[] {
  const matches = [...text.matchAll(EXAM_HEADER_SPLIT)];
  if (matches.length === 0) return [];

  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const parsed = parseExamBlock(text.slice(start, end));
    if (parsed) questions.push(parsed);
  }

  return questions;
}

function pickQuestionText(lines: string[]): string {
  const meaningful = lines.filter(
    (l) => l.length >= 15 && !/^(?:To|ca|§|A Service|A CMDB|A Configuration)\b/i.test(l)
  );

  const withQuestionWord = meaningful.filter((l) => QUESTION_WORD.test(l));
  if (withQuestionWord.length > 0) {
    return withQuestionWord.join(" ").replace(/\s+/g, " ").trim();
  }

  const withQuestionMark = meaningful.filter((l) => l.includes("?"));
  if (withQuestionMark.length > 0) {
    return withQuestionMark.join(" ").replace(/\s+/g, " ").trim();
  }

  const joined = meaningful.join(" ").replace(/\s+/g, " ").trim();
  if (joined.length >= 20) return joined;

  return meaningful.sort((a, b) => b.length - a.length)[0] ?? "";
}

function cleanOptionText(text: string): string {
  return text
    .replace(/^[\s|#®°@8§\[\]()\\\-]+/, "")
    .replace(/[^\w\s.,;:'()/-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tryParseOptionLine(
  line: string,
  optionMap: Map<string, string>
): { letter: string; selected: boolean } | null {
  const patterns: Array<{ re: RegExp; selected?: boolean }> = [
    { re: OJ_OPTION },
    { re: PAREN_OPTION },
    { re: OPTION_LINE },
    { re: DIGIT_PREFIX_OPTION },
    { re: LENIENT_OPTION },
  ];

  for (const { re } of patterns) {
    const m = line.match(re);
    if (!m) continue;

    let letter = (m[1] ?? "").toUpperCase();
    const optText = cleanOptionText(m[2] ?? m[3] ?? m[4] ?? "");
    if (letter === "G" && optionMap.has("A") && optionMap.has("B") && !optionMap.has("C")) {
      letter = "C";
    }
    if (!/^[A-D]$/.test(letter) || optText.length < 2) continue;
    if (optionMap.has(letter)) continue;

    optionMap.set(letter, optText);
    return { letter, selected: SELECTED_MARKER.test(line) };
  }

  const atMatch = line.match(AT_OPTION);
  if (atMatch) {
    const optText = cleanOptionText(atMatch[1]);
    if (optText.length >= 3) {
      const letter = nextOptionLetter(optionMap);
      if (letter) {
        optionMap.set(letter, optText);
        return { letter, selected: true };
      }
    }
  }

  const copyMatch = line.match(COPYRIGHT_OPTION);
  if (copyMatch) {
    const optText = cleanOptionText(copyMatch[1]);
    if (optText.length >= 3 && !optionMap.has("C")) {
      optionMap.set("C", optText);
      return { letter: "C", selected: SELECTED_MARKER.test(line) };
    }
  }

  return null;
}

function nextOptionLetter(optionMap: Map<string, string>): string | null {
  for (const l of ["A", "B", "C", "D"]) {
    if (!optionMap.has(l)) return l;
  }
  return null;
}

function extractPositionalOptions(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const letters = ["A", "B", "C", "D"];
  let idx = 0;
  let afterChoose = false;

  for (const line of lines) {
    if (/Choose option/i.test(line)) {
      afterChoose = true;
      continue;
    }
    if (!afterChoose) continue;
    if (idx >= 4) break;
    if (SKIP_LINE_TEST(line) || EXAM_QUESTION_HEADER.test(line)) continue;

    const cleaned = cleanOptionText(line);
    if (cleaned.length < 4 || cleaned.length > 220) continue;
    if (/^(?:Question|Time|Flag|Prev|Next)\b/i.test(cleaned)) continue;
    if (/^[A-D][.)]\s/.test(cleaned)) continue;

    const looksLikeOption =
      /[@°©]/.test(line) ||
      /^\d+[\.)]\s/.test(cleaned) ||
      /^(?:CMDB|Discovery|Service|Graph|Archive|Delete|Retire|Toolbox|Unique|Gaps|Duplicate|Important|Completeness|Correctness)/i.test(
        cleaned
      ) ||
      (/^[A-Z]/.test(cleaned) && cleaned.length < 120 && !QUESTION_WORD.test(cleaned));

    if (looksLikeOption) {
      map.set(letters[idx], cleaned);
      idx++;
    }
  }

  return map;
}

function extractFallbackOptions(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const letters = ["A", "B", "C", "D"];
  let idx = 0;

  for (const line of lines) {
    if (idx >= 4) break;
    if (SKIP_LINE_TEST(line) || EXAM_QUESTION_HEADER.test(line)) continue;

    const cleaned = cleanOptionText(line);
    if (cleaned.length < 6 || cleaned.length > 220) continue;
    if (/^(?:Question|Time|Flag|Choose|Prev|Next)\b/i.test(cleaned)) continue;
    if (/^[A-DG][.)]\s/.test(cleaned)) continue;
    if (QUESTION_WORD.test(cleaned) && cleaned.length > 40) continue;

    const looksLikeOption =
      /[@°©]/.test(line) ||
      /^\d+[\.)]\s/.test(cleaned) ||
      (/^[A-Z]/.test(cleaned) && cleaned.length < 100 && !QUESTION_WORD.test(cleaned));

    if (looksLikeOption) {
      map.set(letters[idx], cleaned);
      idx++;
    }
  }

  return map;
}

function parseExamBlock(block: string): ParsedQuestion | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const optionMap = new Map<string, string>();
  let selectedLetter = "";
  const questionLines: string[] = [];

  for (const line of lines) {
    if (EXAM_QUESTION_HEADER.test(line) && line.length < 80) continue;
    if (SKIP_LINE_TEST(line)) continue;
    if (line.length < 3) continue;

    const answerMatch = line.match(ANSWER_LINE);
    if (answerMatch) {
      selectedLetter = answerMatch[1].toUpperCase();
      continue;
    }

    const parsedOpt = tryParseOptionLine(line, optionMap);
    if (parsedOpt) {
      if (parsedOpt.selected) selectedLetter = parsedOpt.letter;
      continue;
    }

    const cleaned = cleanOptionText(line);
    if (cleaned.length >= 10 && !/^(?:Croce|Choose|To|ca|§|Flag|Prev|Next|A Service Owner needs)\b/i.test(cleaned)) {
      if (!/^[°o©)\s]+$/.test(cleaned)) {
        questionLines.push(cleaned);
      }
    }
  }

  if (optionMap.size < 2) {
    for (const [letter, text] of extractPositionalOptions(lines)) {
      if (!optionMap.has(letter)) optionMap.set(letter, text);
    }
  }

  if (optionMap.size < 2) {
    for (const [letter, text] of extractFallbackOptions(lines)) {
      if (!optionMap.has(letter)) optionMap.set(letter, text);
    }
  }

  const questionText = pickQuestionText(questionLines).replace(/\s+/g, " ").trim();
  const letters = ["A", "B", "C", "D", "E"].filter((l) => optionMap.has(l));

  if (!questionText || questionText.length < 10 || letters.length < 2) return null;

  const options = letters.map((l) => optionMap.get(l)!);
  const index = selectedLetter ? letters.indexOf(selectedLetter) : -1;
  const correctAnswer = index >= 0 ? options[index] : options[0];

  return {
    text: questionText.trim(),
    options,
    correctAnswer,
  };
}

function parseQuestionBlock(block: string): ParsedQuestion | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;

  let questionText = "";
  const options: string[] = [];
  let correctAnswer = "";
  let explanation = "";
  let phase: "question" | "options" | "after" = "question";

  for (const line of lines) {
    const answerMatch = line.match(ANSWER_LINE);
    if (answerMatch) {
      correctAnswer = answerMatch[1].toUpperCase();
      phase = "after";
      continue;
    }

    const optionMatch = line.match(OPTION_LINE);
    if (optionMatch) {
      phase = "options";
      options.push(optionMatch[2].trim());
      continue;
    }

    if (phase === "after" && !explanation) {
      explanation = line;
      continue;
    }

    if (phase === "question") {
      const qStart = line.match(QUESTION_START);
      if (qStart) {
        questionText = qStart[2]?.trim() || "";
      } else if (!questionText) {
        questionText = line;
      } else {
        questionText += ` ${line}`;
      }
    }
  }

  if (!questionText || options.length < 2 || !correctAnswer) return null;

  const index = correctAnswer.charCodeAt(0) - 65;
  if (index < 0 || index >= options.length) return null;

  return {
    text: questionText.trim(),
    options,
    correctAnswer: options[index],
    explanation: explanation || undefined,
  };
}

function parseFallbackBlocks(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const chunks = text.split(/\n{2,}/);

  for (const chunk of chunks) {
    const parsed = parseQuestionBlock(chunk) ?? parseExamBlock(chunk);
    if (parsed) questions.push(parsed);
  }

  return questions;
}
