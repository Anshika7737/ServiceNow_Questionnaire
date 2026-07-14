import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-[var(--text)] transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">CertPrep</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-[var(--text-muted)]">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function AuthField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--text)]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function AuthInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:shadow-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  );
}

export function AuthButton({
  children,
  loading,
  loadingText,
  disabled,
}: {
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
    >
      {loading ? loadingText : children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-3.5 py-2.5 text-sm text-[var(--error-text)]">
      {message}
    </div>
  );
}

export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--accent)] hover:underline">
      {children}
    </Link>
  );
}
