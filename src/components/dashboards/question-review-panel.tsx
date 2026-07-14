"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { btn, card, input } from "./styles";

type ReviewQuestion = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  reviewStatus: string;
};

type ReviewUpload = {
  id: string;
  filename: string;
  examType: string;
  status: string;
  questionCount: number;
};

export function QuestionReviewPanel({
  uploadId,
  categoryLabel,
  onClose,
  onComplete,
}: {
  uploadId: string;
  categoryLabel: (slug: string) => string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [upload, setUpload] = useState<ReviewUpload | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState(false);
  const [error, setError] = useState("");
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/uploads/${uploadId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load review.");
        return;
      }
      setUpload(data.upload);
      setQuestions(data.questions);
      setDuplicatesSkipped(data.duplicatesSkipped ?? 0);
    } catch {
      setError("Failed to load review.");
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  async function saveQuestion(
    q: ReviewQuestion,
    reviewStatus?: "approved" | "rejected"
  ) {
    setSavingId(q.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/questions/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          reviewStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed.");
        return;
      }

      if (data.duplicate) {
        setDuplicatesSkipped((n) => n + 1);
      }

      if (data.deleted || reviewStatus === "approved" || reviewStatus === "rejected") {
        setQuestions((prev) => {
          const next = prev.filter((item) => item.id !== q.id);
          if (next.length === 0) {
            queueMicrotask(() => onComplete());
          }
          return next;
        });
      } else {
        setQuestions((prev) =>
          prev.map((item) => (item.id === q.id ? data.question : item))
        );
      }
    } catch {
      setError("Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function approveAll() {
    setBulkAction(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/uploads/${uploadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_all" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Approve failed.");
        return;
      }
      if (data.duplicatesSkipped > 0) {
        setDuplicatesSkipped((n) => n + data.duplicatesSkipped);
      }
      onComplete();
      onClose();
    } catch {
      setError("Approve failed.");
    } finally {
      setBulkAction(false);
    }
  }

  async function rejectAll() {
    if (!confirm("Reject all pending questions from this upload?")) return;
    setBulkAction(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/uploads/${uploadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_all" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Reject failed.");
        return;
      }
      onComplete();
      onClose();
    } catch {
      setError("Reject failed.");
    } finally {
      setBulkAction(false);
    }
  }

  function updateQuestion(id: string, patch: Partial<ReviewQuestion>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  }

  function updateOption(qId: string, index: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const options = [...q.options];
        const old = options[index];
        options[index] = value;
        const correctAnswer = q.correctAnswer === old ? value : q.correctAnswer;
        return { ...q, options, correctAnswer };
      })
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
      <div className={`${card} relative w-full max-w-3xl`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="mb-1 pr-8 text-lg font-semibold text-[var(--text)]">
          Review extracted questions
        </h3>
        {upload && (
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            {upload.filename} · {categoryLabel(upload.examType)} · {questions.length}{" "}
            pending
          </p>
        )}

        {duplicatesSkipped > 0 && (
          <p className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {duplicatesSkipped} duplicate question{duplicatesSkipped !== 1 ? "s" : ""}{" "}
            skipped — already in the question bank.
          </p>
        )}

        <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
          Edit each question if needed, then approve to add it to the question bank. Only
          approved questions appear in practice exams.
        </p>

        {error && (
          <p className="mb-3 text-sm text-[var(--error-text)]">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          </div>
        ) : questions.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            {duplicatesSkipped > 0
              ? "All extracted questions were duplicates of the existing bank."
              : "No questions pending review."}
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4"
              >
                <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                  Question {idx + 1}
                </p>
                <textarea
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  rows={3}
                  className={`${input} mb-3 w-full resize-y`}
                />
                <div className="mb-3 space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isCorrect = q.correctAnswer === opt;
                    return (
                      <div key={optIdx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(q.id, { correctAnswer: opt })
                          }
                          aria-label={`Mark option ${letter} as correct`}
                          aria-pressed={isCorrect}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                            isCorrect
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-emerald-400 hover:text-emerald-600"
                          }`}
                        >
                          <Check className="h-4 w-4" strokeWidth={isCorrect ? 2.5 : 2} />
                        </button>
                        <span className="w-5 shrink-0 text-sm font-medium text-[var(--text-muted)]">
                          {letter}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                          className={`${input} min-w-0 flex-1`}
                        />
                      </div>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={q.explanation ?? ""}
                  onChange={(e) =>
                    updateQuestion(q.id, { explanation: e.target.value || null })
                  }
                  placeholder="Explanation (optional)"
                  className={`${input} mb-3 w-full`}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingId === q.id || bulkAction}
                    onClick={() => saveQuestion(q, "approved")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {savingId === q.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={savingId === q.id || bulkAction}
                    onClick={() => saveQuestion(q, "rejected")}
                    className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--error-text)] hover:bg-[var(--surface-muted)] disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {questions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={bulkAction}
              onClick={approveAll}
              className={`${btn} flex items-center gap-1.5`}
            >
              {bulkAction ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve all ({questions.length})
            </button>
            <button
              type="button"
              disabled={bulkAction}
              onClick={rejectAll}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            >
              Reject all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
