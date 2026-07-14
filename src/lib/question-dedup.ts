export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function questionsMatch(a: string, b: string): boolean {
  const na = normalizeQuestionText(a);
  const nb = normalizeQuestionText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (shorter.length >= 25 && longer.includes(shorter)) return true;

  const wordsA = new Set(na.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.75;
}

export function isDuplicateOfAny(text: string, existing: string[]): boolean {
  return existing.some((e) => questionsMatch(text, e));
}

export function dedupeParsedQuestions<T extends { text: string }>(questions: T[]): T[] {
  const result: T[] = [];
  const seen: string[] = [];

  for (const q of questions) {
    if (!isDuplicateOfAny(q.text, seen)) {
      seen.push(q.text);
      result.push(q);
    }
  }

  return result;
}
