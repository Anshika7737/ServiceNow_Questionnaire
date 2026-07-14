"use client";

import { useEffect, useState } from "react";
import {
  Upload,
  UserPlus,
  Database,
  Copy,
  Users,
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EXAM_TYPES } from "@/lib/constants";
import { btn, card, input, sectionIcon, tabButton, tabButtonActive, tabTrack } from "./styles";
import { UploadSection } from "./upload-section";

type Tab = "upload" | "bank" | "team";

type ExamStat = {
  value: string;
  label: string;
  description: string;
  count: number;
};

type TeamRow = {
  kind: "user" | "invite";
  id: string;
  email: string;
  name: string | null;
  status: "active" | "disabled" | "pending";
  inviteUrl: string | null;
  createdAt: string;
};

type TeamPage = {
  items: TeamRow[];
  total: number;
  page: number;
  totalPages: number;
  activeCount: number;
  pendingCount: number;
};

type Stats = {
  totalQuestions: number;
  managerCount: number;
  adminCount: number;
  pendingManagerInvites: number;
  pendingAdminInvites: number;
  examStats: ExamStat[];
};

const TEAM_PAGE_SIZE = 5;

export function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [tab, setTab] = useState<Tab>("team");
  const [stats, setStats] = useState<Stats | null>(null);
  const [managerEmail, setManagerEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [managerPage, setManagerPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1);
  const [managerTeam, setManagerTeam] = useState<TeamPage | null>(null);
  const [adminTeam, setAdminTeam] = useState<TeamPage | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState("");

  async function loadTeam(role: "MANAGER" | "ADMIN", page: number) {
    const res = await fetch(
      `/api/admin/team?role=${role}&page=${page}&limit=${TEAM_PAGE_SIZE}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result: TeamPage = {
      items: data.items,
      total: data.total,
      page: data.page,
      totalPages: data.totalPages,
      activeCount: data.activeCount ?? 0,
      pendingCount: data.pendingCount ?? 0,
    };
    if (role === "MANAGER") setManagerTeam(result);
    else setAdminTeam(result);
    return result;
  }

  async function loadStats() {
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadTeam("MANAGER", managerPage);
  }, [managerPage]);

  useEffect(() => {
    loadTeam("ADMIN", adminPage);
  }, [adminPage]);

  async function toggleUserDisabled(
    userId: string,
    disabled: boolean,
    role: "MANAGER" | "ADMIN"
  ) {
    setUserActionError("");
    setTogglingUserId(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserActionError(data.error);
        return;
      }
      const page = role === "MANAGER" ? managerPage : adminPage;
      await loadTeam(role, page);
      await loadStats();
    } catch {
      setUserActionError("Failed to update user.");
    } finally {
      setTogglingUserId(null);
    }
  }

  async function revokeInvite(inviteId: string, role: "MANAGER" | "ADMIN") {
    setUserActionError("");
    setRevokingInviteId(inviteId);

    try {
      const res = await fetch(`/api/admin/invites/${inviteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setUserActionError(data.error);
        return;
      }
      const page = role === "MANAGER" ? managerPage : adminPage;
      await loadTeam(role, page);
      await loadStats();
    } catch {
      setUserActionError("Failed to revoke invite.");
    } finally {
      setRevokingInviteId(null);
    }
  }

  async function handleInvite(
    e: React.FormEvent,
    role: "MANAGER" | "ADMIN",
    email: string,
    clear: () => void
  ) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      clear();
      if (role === "MANAGER") {
        setManagerPage(1);
        await loadTeam("MANAGER", 1);
      } else {
        setAdminPage(1);
        await loadTeam("ADMIN", 1);
      }
      await loadStats();
    } catch {
      setError("Failed to create invite.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "team", label: "Team", icon: <Users className="h-4 w-4" /> },
    { id: "bank", label: "Question bank", icon: <Database className="h-4 w-4" /> },
    { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage managers, question banks, and PDF uploads.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Managers"
          value={stats?.managerCount ?? "—"}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Admins"
          value={stats?.adminCount ?? "—"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending managers"
          value={stats?.pendingManagerInvites ?? "—"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending admins"
          value={stats?.pendingAdminInvites ?? "—"}
        />
      </div>

      <div className={tabTrack}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? tabButtonActive : tabButton}
            aria-selected={tab === t.id}
            role="tab"
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "team" && (
        <div className="space-y-6">
          <div className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className={sectionIcon}>
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text)]">Invite a manager</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Managers invite users and view scores across all exam tracks.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => handleInvite(e, "MANAGER", managerEmail, () => setManagerEmail(""))}
              className="space-y-4"
            >
              <div>
                <label htmlFor="manager-email" className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                  Manager email
                </label>
                <input
                  id="manager-email"
                  type="email"
                  required
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder="manager@company.com"
                  className={`w-full ${input}`}
                />
              </div>

              <button type="submit" disabled={loading} className={btn}>
                {loading ? "Creating invite..." : "Create manager invite"}
              </button>
            </form>

            {error && <p className="mt-3 text-sm text-[var(--error-text)]">{error}</p>}
          </div>

          <div className={card}>
            <div className="mb-5 flex items-center gap-3">
              <div className={sectionIcon}>
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text)]">Invite another admin</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Give someone full admin access to upload PDFs and manage managers.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => handleInvite(e, "ADMIN", adminEmail, () => setAdminEmail(""))}
              className="space-y-4"
            >
              <div>
                <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-[var(--text)]">
                  Admin email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin2@company.com"
                  className={`w-full ${input}`}
                />
              </div>

              <button type="submit" disabled={loading} className={btn}>
                {loading ? "Creating invite..." : "Create admin invite"}
              </button>
            </form>
          </div>

          {userActionError && (
            <p className="text-sm text-[var(--error-text)]">{userActionError}</p>
          )}

          <TeamListCard
            title="Managers"
            subtitle="All exam tracks"
            emptyMessage="No managers yet. Invite one above to get started."
            data={managerTeam}
            page={managerPage}
            currentUserId={currentUserId}
            togglingUserId={togglingUserId}
            revokingInviteId={revokingInviteId}
            onPageChange={setManagerPage}
            onCopy={copyLink}
            onToggle={(userId, disabled) =>
              toggleUserDisabled(userId, disabled, "MANAGER")
            }
            onRevokeInvite={(inviteId) => revokeInvite(inviteId, "MANAGER")}
          />

          <TeamListCard
            title="Admins"
            subtitle="Full platform access"
            emptyMessage="No admins yet. Invite one above to get started."
            data={adminTeam}
            page={adminPage}
            currentUserId={currentUserId}
            togglingUserId={togglingUserId}
            revokingInviteId={revokingInviteId}
            onPageChange={setAdminPage}
            onCopy={copyLink}
            onToggle={(userId, disabled) =>
              toggleUserDisabled(userId, disabled, "ADMIN")
            }
            onRevokeInvite={(inviteId) => revokeInvite(inviteId, "ADMIN")}
          />
        </div>
      )}

      {tab === "bank" && (
        <div className={card}>
          <div className="mb-5 flex items-center gap-3">
            <div className={sectionIcon}>
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text)]">Question bank</h2>
              <p className="text-sm text-[var(--text-muted)]">
                Questions organized by certification exam track.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(stats?.examStats ?? EXAM_TYPES.map((e) => ({ ...e, count: 0 }))).map((exam) => (
              <div
                key={exam.value}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 transition-colors hover:border-[var(--accent)]/30 hover:bg-[var(--accent-subtle)]/40"
              >
                <div>
                  <p className="font-medium text-[var(--text)]">{exam.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{exam.description}</p>
                </div>
                <span className="rounded-full border border-[var(--accent)]/25 bg-[var(--accent-subtle)] px-2.5 py-1 text-sm font-semibold text-[var(--accent-text)]">
                  {exam.count}
                </span>
              </div>
            ))}
          </div>

          {stats?.totalQuestions === 0 && (
            <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
              Upload PDF dumps to populate the question bank.
            </p>
          )}
        </div>
      )}

      {tab === "upload" && (
        <UploadSection onUploaded={loadStats} />
      )}
    </div>
  );
}

function TeamListCard({
  title,
  subtitle,
  emptyMessage,
  data,
  page,
  currentUserId,
  togglingUserId,
  revokingInviteId,
  onPageChange,
  onCopy,
  onToggle,
  onRevokeInvite,
}: {
  title: string;
  subtitle: string;
  emptyMessage: string;
  data: TeamPage | null;
  page: number;
  currentUserId: string;
  togglingUserId: string | null;
  revokingInviteId: string | null;
  onPageChange: (page: number) => void;
  onCopy: (url: string) => void;
  onToggle: (userId: string, disabled: boolean) => void;
  onRevokeInvite: (inviteId: string) => void;
}) {
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const activeCount = data?.activeCount ?? 0;
  const pendingCount = data?.pendingCount ?? 0;

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[var(--text)]">{title}</h2>
        {total > 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            {activeCount} active
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </span>
        )}
      </div>

      {!data ? (
        <EmptyState message="Loading..." />
      ) : items.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => {
              const isSelf = item.kind === "user" && item.id === currentUserId;
              const isToggling = item.kind === "user" && togglingUserId === item.id;
              const isRevoking = item.kind === "invite" && revokingInviteId === item.id;
              const isPending = item.status === "pending";

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {isPending ? item.email : (item.name ?? item.email)}
                      {isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {isPending ? `Invite pending · ${subtitle}` : item.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={item.status} />
                    {isPending && item.inviteUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => onCopy(item.inviteUrl!)}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                          title="Copy invite link"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isRevoking}
                          onClick={() => onRevokeInvite(item.id)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                        >
                          {isRevoking ? "Revoking..." : "Revoke"}
                        </button>
                      </>
                    )}
                    {item.kind === "user" && !isSelf && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => onToggle(item.id, item.status !== "disabled")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          item.status === "disabled"
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                            : "border border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                        }`}
                      >
                        {isToggling
                          ? "Saving..."
                          : item.status === "disabled"
                            ? "Enable"
                            : "Disable"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
      <p className="text-xs text-[var(--text-muted)]">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
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
    <div className={`${card} flex items-center gap-3 !p-4 transition-colors hover:border-[var(--border-strong)]`}>
      <div className="rounded-xl bg-[var(--accent-subtle)] p-2.5 text-[var(--accent)]">{icon}</div>
      <div>
        <p className="text-xl font-semibold text-[var(--text)]">{value}</p>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    disabled: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}
    >
      {status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
      {message}
    </div>
  );
}
