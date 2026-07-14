"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, UserPlus, BarChart3, Users, X } from "lucide-react";
import { btn, card, input, sectionIcon } from "./styles";
import { displayTrackName, formatTrackList } from "@/lib/categories";
import { useExamCategories } from "@/hooks/use-exam-categories";
import { Pagination } from "./pagination";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  attempts: {
    examType: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    completedAt: string;
  }[];
};

type Stats = {
  teamCount: number;
  examsTaken: number;
  avgScore: number | null;
  teamMembers: TeamMember[];
};

type TeamItem = {
  kind: "user" | "invite";
  id: string;
  email: string;
  name: string | null;
  status: "active" | "disabled" | "pending";
  inviteUrl: string | null;
};

type TeamPage = {
  items: TeamItem[];
  total: number;
  totalPages: number;
  activeCount: number;
  pendingCount: number;
};

const TEAM_PAGE_SIZE = 5;

export function ManagerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [team, setTeam] = useState<TeamPage | null>(null);
  const [teamPage, setTeamPage] = useState(1);
  const { categories, getLabel } = useExamCategories();
  const trackList = formatTrackList(categories.map((c) => displayTrackName(c.label)));
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/manager/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  const loadTeam = useCallback(async (page: number) => {
    const res = await fetch(`/api/manager/team?page=${page}&limit=${TEAM_PAGE_SIZE}`);
    if (res.ok) setTeam(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTeam(teamPage);
  }, [teamPage, loadTeam]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLastInviteUrl(null);
    setLoading(true);

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "USER" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setInviteEmail("");
      setLastInviteUrl(data.invite?.inviteUrl ?? null);
      setSuccess(`Invite created for ${data.invite?.email ?? "user"}.`);
      setTeamPage(1);
      await Promise.all([loadTeam(1), loadStats()]);
    } catch {
      setError("Failed to create invite.");
    } finally {
      setLoading(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    setRevokingInviteId(inviteId);
    setError("");
    try {
      const res = await fetch(`/api/manager/invites/${inviteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to revoke invite.");
        return;
      }
      await Promise.all([loadTeam(teamPage), loadStats()]);
    } catch {
      setError("Failed to revoke invite.");
    } finally {
      setRevokingInviteId(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allAttempts = (stats?.teamMembers ?? []).flatMap((m) =>
    m.attempts.map((a) => ({ ...a, userName: m.name }))
  );

  const teamItems = team?.items ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Manager Dashboard</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Manage your team. Users can practice any exam - {trackList}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Users className="h-5 w-5" />} label="Team members" value={stats?.teamCount ?? "—"} />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Avg. score"
          value={stats?.avgScore != null ? `${stats.avgScore}%` : "—"}
        />
        <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Exams taken" value={stats?.examsTaken ?? "—"} />
      </div>

      <div className={card}>
        <div className="mb-4 flex items-center gap-3">
          <div className={sectionIcon}>
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text)]">Invite user</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Invited users can practice all certification exams.
            </p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@company.com"
            className={`min-w-0 flex-1 ${input}`}
          />
          <button type="submit" disabled={loading} className={`shrink-0 ${btn}`}>
            {loading ? "Sending..." : "Create invite"}
          </button>
        </form>

        {success && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <p className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              {success}
            </p>
            {lastInviteUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="max-w-full truncate rounded-lg bg-white/60 px-2 py-1 text-xs dark:bg-black/20">
                  {lastInviteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyLink(lastInviteUrl)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium hover:bg-white/50 dark:border-emerald-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-[var(--error-text)]">{error}</p>}
      </div>

      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-[var(--text)]">Your team</h2>
          {team && team.total > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {team.activeCount} active
              {team.pendingCount > 0 && ` · ${team.pendingCount} pending`}
            </span>
          )}
        </div>

        {!team ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading team...</p>
        ) : teamItems.length === 0 ? (
          <p className="rounded-xl bg-[var(--surface-muted)] py-8 text-center text-sm text-[var(--text-muted)]">
            No users yet. Create an invite above to add team members.
          </p>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)]">
              {teamItems.map((item) => {
                const isPending = item.status === "pending";
                const isRevoking = item.kind === "invite" && revokingInviteId === item.id;

                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {isPending ? item.email : (item.name ?? item.email)}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {isPending ? "Invite pending" : item.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                        }`}
                      >
                        {item.status === "pending" ? "Pending" : item.status === "active" ? "Active" : "Disabled"}
                      </span>
                      {isPending && item.inviteUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyLink(item.inviteUrl!)}
                            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                            title="Copy invite link"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isRevoking}
                            onClick={() => revokeInvite(item.id)}
                            className="rounded-lg p-1.5 text-[var(--error-text)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                            title="Revoke invite"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              page={teamPage}
              totalPages={team.totalPages}
              onPageChange={setTeamPage}
            />
          </>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-4 font-semibold text-[var(--text)]">Team scores (all exams)</h2>
        {!allAttempts.length ? (
          <div className="rounded-xl bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-muted)]">
            No exam attempts yet. Invite users to get started.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {allAttempts.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{a.userName}</p>
                  <p className="text-xs text-[var(--text-muted)]">{getLabel(a.examType)}</p>
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className={card}>
      <div className="mb-2 flex items-center gap-2.5 text-[var(--accent)]">
        <div className="rounded-lg bg-[var(--accent-subtle)] p-2">{icon}</div>
      </div>
      <p className="text-2xl font-semibold text-[var(--text)]">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
