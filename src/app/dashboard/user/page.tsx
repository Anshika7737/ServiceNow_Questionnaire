import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { UserDashboard } from "@/components/dashboards/user-dashboard";

export default async function UserPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.USER) redirect("/");

  return (
    <DashboardShell session={session}>
      <UserDashboard />
    </DashboardShell>
  );
}
