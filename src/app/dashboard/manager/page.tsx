import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { ManagerDashboard } from "@/components/dashboards/manager-dashboard";

export default async function ManagerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.MANAGER) redirect("/");

  return (
    <DashboardShell session={session}>
      <ManagerDashboard />
    </DashboardShell>
  );
}
