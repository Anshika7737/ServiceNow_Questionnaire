"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Play, Loader2 } from "lucide-react";
import { card, sectionIcon } from "./styles";
import { useExamCategories } from "@/hooks/use-exam-categories";

type Attempt = {
  id: string;
  examType: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
};

export function UserDashboard() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const { categories, loading, getLabel } = useExamCategories();

  useEffect(() => {
    fetch("/api/user/attempts")
      .then((res) => res.json())
      .then((data) => setAttempts(data.attempts ?? []));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">My Practice</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Practice any certification exam track available on the platform.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((exam) => (
            <div
              key={exam.slug}
              className={`${card} flex flex-col transition-all duration-150 hover:border-[var(--accent)]/35 hover:shadow-[var(--shadow-md)]`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className={sectionIcon}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="font-semibold text-[var(--text)]">{exam.label}</h2>
              </div>
              <p className="mb-4 flex-1 text-sm text-[var(--text-muted)]">{exam.description}</p>
              <Link
                href={`/dashboard/user/practice/${exam.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <Play className="h-4 w-4" />
                Start practice
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <h2 className="mb-4 font-semibold text-[var(--text)]">Recent scores</h2>
        {!attempts.length ? (
          <div className="rounded-xl bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-muted)]">
            No exams completed yet. Pick any exam above to get started.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    {getLabel(a.examType)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {a.correctAnswers}/{a.totalQuestions} correct
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--accent)]">
                  {Math.round(a.score)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
