"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useExamCategories } from "@/hooks/use-exam-categories";
import { btn, card } from "@/components/dashboards/styles";

type Question = { id: string; text: string; options: string[] };

export function PracticeExam({ examType }: { examType: string }) {
  const router = useRouter();
  const { categories, getLabel } = useExamCategories();
  const exam = categories.find((e) => e.slug === examType);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    correctAnswers: number;
    totalQuestions: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/exams/${examType}`)
      .then((res) => res.json())
      .then((data) => setQuestions(data.questions ?? []))
      .finally(() => setLoading(false));
  }, [examType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/exams/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examType, answers }),
      });
      const data = await res.json();
      if (res.ok) setResult(data.attempt);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className={`${card} text-center py-12`}>
          <p className="font-medium text-[var(--text)]">No questions yet for {getLabel(examType)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Ask your admin to upload questions for this exam.
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className={`${card} text-center`}>
          <p className="text-sm text-[var(--text-muted)]">{getLabel(examType)} — Results</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--accent)]">
            {Math.round(result.score)}%
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {result.correctAnswers} of {result.totalQuestions} correct
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => router.refresh()} className={btn}>
              Try again
            </button>
            <Link
              href="/dashboard/user"
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--surface-muted)]"
            >
              All exams
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <div className="space-y-6">
      <div>
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold text-[var(--text)]">
          {exam?.label ?? getLabel(examType)} Practice
        </h1>
        <p className="text-sm text-[var(--text-muted)]">{exam?.description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className={card}>
            <p className="mb-4 text-sm font-medium text-[var(--text)]">
              {i + 1}. {q.text}
            </p>
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-150 ${
                    answers[q.id] === opt
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] ring-1 ring-[var(--accent)]/25"
                      : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className="accent-[var(--accent)]"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        ))}

        <button type="submit" disabled={!allAnswered || submitting} className={`${btn} w-full`}>
          {submitting ? "Submitting..." : "Submit exam"}
        </button>
      </form>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/user"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to all exams
    </Link>
  );
}
