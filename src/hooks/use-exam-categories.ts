"use client";

import { useEffect, useState } from "react";

export type ExamCategory = {
  slug: string;
  label: string;
  description: string;
  isBuiltIn: boolean;
};

export function useExamCategories() {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exam-categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .finally(() => setLoading(false));
  }, []);

  function getLabel(slug: string) {
    return categories.find((c) => c.slug === slug)?.label ?? slug;
  }

  return { categories, loading, getLabel };
}
