import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { isValidExamType } from "@/lib/exams";
import { DashboardShell } from "@/components/dashboard-shell";
import { PracticeExam } from "@/components/practice-exam";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ examType: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.USER) redirect("/");

  const { examType } = await params;
  if (!(await isValidExamType(examType))) redirect("/dashboard/user");

  return (
    <DashboardShell session={session}>
      <PracticeExam examType={examType} />
    </DashboardShell>
  );
}
