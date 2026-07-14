import Link from "next/link";
import {
  BookOpen,
  Shield,
  Users,
  GraduationCap,
  Upload,
  BarChart3,
  UserPlus,
} from "lucide-react";
import { displayTrackName, formatTrackList } from "@/lib/categories";
import { listExamCategories } from "@/lib/exams";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const categories = await listExamCategories();
  const trackNames = categories.map((c) => displayTrackName(c.label));
  const trackList = formatTrackList(trackNames);

  return (
    <div className="flex min-h-full flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">CertPrep</span>
        </div>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Log in
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <section className="mx-auto mb-20 max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
            ServiceNow Certification Platform
          </p>
          <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Master your certification exams with structured practice
          </h1>
          <p className="mb-8 text-lg text-[var(--text-muted)]">
            Invite-only platform for ServiceNow certification practice. Admins invite
            managers, managers invite learners - across {trackList} tracks.
          </p>
          <div className="flex justify-center">
            <Link
              href="/login"
              className="rounded-xl bg-[var(--accent)] px-8 py-3 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Log in
            </Link>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">Exam tracks</h2>
          {categories.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)]">
              Exam tracks will appear here once an admin adds them.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((exam) => (
                <div
                  key={exam.slug}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)]/40"
                >
                  <h3 className="mb-1 text-lg font-semibold text-[var(--accent)]">{exam.label}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{exam.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-20">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
            Three roles, one platform
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <RoleCard
              icon={<Shield className="h-7 w-7 text-[var(--accent)]" />}
              title="Admin"
              features={[
                "Upload PDF question dumps",
                "Build the shared question bank",
                "Invite managers for each exam track",
              ]}
            />
            <RoleCard
              icon={<Users className="h-7 w-7 text-[var(--accent)]" />}
              title="Manager"
              features={[
                "Oversee users on your team",
                "View exam scores and progress",
                "Invite learners to your track",
              ]}
            />
            <RoleCard
              icon={<GraduationCap className="h-7 w-7 text-[var(--accent)]" />}
              title="User"
              features={[
                "Practice certification questions",
                "Take timed mock exams",
                "Track your own scores",
              ]}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <Step
              icon={<Upload className="h-6 w-6" />}
              step="1"
              title="Admin uploads dumps"
              description="PDF dumps are parsed and added to the question bank by exam type."
            />
            <Step
              icon={<UserPlus className="h-6 w-6" />}
              step="2"
              title="Managers invite teams"
              description="Each manager owns a track and invites users to practice under them."
            />
            <Step
              icon={<BarChart3 className="h-6 w-6" />}
              step="3"
              title="Track performance"
              description="Managers see scores; users practice and improve before the real exam."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-8 text-center text-sm text-[var(--text-muted)]">
        CertPrep - ServiceNow certification practice platform
      </footer>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  features,
}: {
  icon: React.ReactNode;
  title: string;
  features: string[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4">{icon}</div>
      <h3 className="mb-4 text-xl font-semibold">{title}</h3>
      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
            <span className="mt-0.5 text-[var(--accent)]">·</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({
  icon,
  step,
  title,
  description,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--accent)]">
        {icon}
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
        Step {step}
      </p>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}
