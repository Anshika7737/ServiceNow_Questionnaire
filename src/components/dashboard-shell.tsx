"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut } from "lucide-react";
import { SessionPayload } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { ThemeToggle } from "./theme-toggle";

export function DashboardShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="flex min-h-full flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 px-6 py-4 shadow-[var(--shadow-sm)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-[var(--text)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-semibold">CertPrep</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[var(--text)]">{session.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {ROLE_LABELS[session.role as keyof typeof ROLE_LABELS]}
              </p>
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
