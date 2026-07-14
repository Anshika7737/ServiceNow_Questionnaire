"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, ChevronDown, FileText, Loader2, Plus, Upload } from "lucide-react";
import { btn, card, input, sectionIcon, select } from "./styles";
import { QuestionReviewPanel } from "./question-review-panel";
import { Pagination } from "./pagination";

const UPLOAD_PAGE_SIZE = 5;

type Category = {
  slug: string;
  label: string;
  description: string;
  isBuiltIn: boolean;
};

type UploadRow = {
  id: string;
  filename: string;
  examType: string;
  status: string;
  questionCount: number;
  createdAt: string;
};

const ADD_CATEGORY_VALUE = "__add_category__";

function formatCategoryOption(cat: Category) {
  return cat.description ? `${cat.label} - ${cat.description}` : cat.label;
}

function statusLabel(status: string, count: number) {
  switch (status) {
    case "pending_review":
      return `${count} awaiting review`;
    case "approved":
      return `${count} in question bank`;
    case "no_questions":
      return "No questions found";
    case "failed":
      return "Processing failed";
    case "rejected":
      return "Rejected";
    case "processing":
      return "Processing…";
    default:
      return status.replace(/_/g, " ");
  }
}

function buildUploadSuccessMessage(
  count: number,
  catLabel: string,
  duplicateCount: number
) {
  const lines = [
    `${count} question${count === 1 ? "" : "s"} extracted from ${catLabel}.`,
    "Review and approve each one before it goes live in practice exams.",
  ];
  if (duplicateCount > 0) {
    lines.push(
      `${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped — already in the question bank.`
    );
  }
  return lines.join(" ");
}

function formatUploadDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function UploadSection({ onUploaded }: { onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [reviewUploadId, setReviewUploadId] = useState<string | null>(null);
  const [uploadPage, setUploadPage] = useState(1);
  const [uploadTotalPages, setUploadTotalPages] = useState(1);
  const [uploadTotal, setUploadTotal] = useState(0);

  const loadData = useCallback(async (page: number) => {
    const [catRes, upRes] = await Promise.all([
      fetch("/api/admin/categories"),
      fetch(`/api/admin/uploads?page=${page}&limit=${UPLOAD_PAGE_SIZE}`),
    ]);
    if (catRes.ok) {
      const data = await catRes.json();
      setCategories(data.categories);
      setSelectedSlug((prev) => {
        if (prev === ADD_CATEGORY_VALUE) return prev;
        if (prev && data.categories.some((c: Category) => c.slug === prev)) return prev;
        return data.categories[0]?.slug || "";
      });
    }
    if (upRes.ok) {
      const data = await upRes.json();
      setUploads(data.uploads);
      setUploadTotalPages(data.totalPages);
      setUploadTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(uploadPage);
  }, [uploadPage, loadData]);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAddingCategory(true);

    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, description: newDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setNewLabel("");
      setNewDescription("");
      await loadData(uploadPage);
      setSelectedSlug(data.category.slug);
      setSuccess(`Category "${data.category.label}" added.`);
    } catch {
      setError("Failed to add category.");
    } finally {
      setAddingCategory(false);
    }
  }

  async function uploadFile(file: File) {
    if (!selectedSlug || selectedSlug === ADD_CATEGORY_VALUE) {
      setError("Select a question bank category first.");
      return;
    }

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("examType", selectedSlug);

      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }

      const catLabel = data.category?.label ?? selectedSlug;

      if (data.needsReview) {
        setSuccess(
          buildUploadSuccessMessage(
            data.upload.questionCount,
            catLabel,
            data.duplicateCount ?? 0
          )
        );
        setReviewUploadId(data.upload.id);
      } else if (data.error) {
        setError(data.error);
      } else if (data.upload.status === "no_questions" || data.upload.status === "failed") {
        setError(data.error || "Could not extract questions from this PDF.");
      }

      setUploadPage(1);
      await loadData(1);
      onUploaded?.();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  const categoryLabel = (slug: string) =>
    categories.find((c) => c.slug === slug)?.label ?? slug;

  const isAddingCategory = selectedSlug === ADD_CATEGORY_VALUE;
  const canUpload = selectedSlug && !isAddingCategory;

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="mb-5 flex items-center gap-3">
          <div className={sectionIcon}>
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text)]">Upload PDF dumps</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Choose a question bank, upload a PDF, then review extracted questions before
              they go live.
            </p>
          </div>
        </div>

        <label htmlFor="question-bank" className="mb-2 block text-sm font-medium text-[var(--text)]">
          Question bank
        </label>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading categories...</p>
        ) : (
          <div className="relative w-full max-w-md">
            <select
              id="question-bank"
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className={`${select} w-full`}
            >
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {formatCategoryOption(cat)}
                </option>
              ))}
              <option value={ADD_CATEGORY_VALUE}>+ Add a category</option>
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            />
          </div>
        )}

        {isAddingCategory && (
          <form onSubmit={handleAddCategory} className="mt-4 max-w-md">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text)]">
              <Plus className="h-4 w-4" />
              Add custom category
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Category name"
                className={input}
                required
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description (optional)"
                className={input}
              />
            </div>
            <button
              type="submit"
              disabled={addingCategory || !newLabel.trim()}
              className={`mt-3 ${btn}`}
            >
              {addingCategory ? "Adding..." : "Add category"}
            </button>
          </form>
        )}
      </div>

      <div className={card}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-150 ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
              : "border-[var(--border)] bg-[var(--surface-muted)]/60 hover:border-[var(--border-strong)]"
          }`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
            {uploading ? (
              <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
            ) : (
              <FileText className="h-7 w-7 text-[var(--text-muted)]" />
            )}
          </div>
          <p className="mb-1 font-medium text-[var(--text)]">
            {uploading
              ? "Extracting: OCR → Ollama cleanup → review (4–8 min with Ollama)..."
              : isAddingCategory
                ? "Add a category above to continue"
                : canUpload
                  ? `Upload to ${categoryLabel(selectedSlug)}`
                  : "Select a question bank above"}
          </p>
          <p className="mb-5 text-sm text-[var(--text-muted)]">
            Drag & drop a PDF here, or choose a file. Text and scanned/image PDFs are
            supported - you review every question before it enters the bank.
          </p>
          <button
            type="button"
            disabled={uploading || !canUpload}
            onClick={() => inputRef.current?.click()}
            className={`${btn} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Choose PDF file
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--error-text)]">{error}</p>}
        {success && (
          <p className="mt-3 text-sm text-[var(--success-text)]">{success}</p>
        )}
      </div>

      {uploadTotal > 0 && (
        <div className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[var(--text)]">Recent uploads</h3>
            <span className="text-xs text-[var(--text-muted)]">{uploadTotal} total</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text)]">{u.filename}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {categoryLabel(u.examType)} · {statusLabel(u.status, u.questionCount)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {formatUploadDate(u.createdAt)}
                  </p>
                </div>
                {u.status === "pending_review" && u.questionCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setReviewUploadId(u.id)}
                    className={`${btn} flex shrink-0 items-center gap-1.5 text-sm`}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Review
                  </button>
                )}
              </div>
            ))}
          </div>
          <Pagination
            page={uploadPage}
            totalPages={uploadTotalPages}
            onPageChange={setUploadPage}
          />
        </div>
      )}

      {reviewUploadId && (
        <QuestionReviewPanel
          uploadId={reviewUploadId}
          categoryLabel={categoryLabel}
          onClose={() => setReviewUploadId(null)}
          onComplete={() => {
            loadData(uploadPage);
            onUploaded?.();
            setSuccess("Approved questions are now in the question bank.");
          }}
        />
      )}
    </div>
  );
}
