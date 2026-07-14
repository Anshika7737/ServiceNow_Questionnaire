import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.ADMIN) redirect("/");

  return (
    <DashboardShell session={session}>
      <AdminDashboard currentUserId={session.userId} />
    </DashboardShell>
  );
}
