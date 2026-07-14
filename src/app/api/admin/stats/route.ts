import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { listExamCategories } from "@/lib/exams";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [questionCounts, managerCount, adminCount, pendingManagerInvites, pendingAdminInvites, categories] =
    await Promise.all([
      db.question.groupBy({
        by: ["examType"],
        where: { pdfUploadId: { not: null }, reviewStatus: "approved" },
        _count: { id: true },
      }),
      db.user.count({ where: { role: Role.MANAGER, disabled: false } }),
      db.user.count({ where: { role: Role.ADMIN, disabled: false } }),
      db.invite.count({
        where: {
          role: Role.MANAGER,
          used: false,
          expiresAt: { gt: new Date() },
        },
      }),
      db.invite.count({
        where: {
          role: Role.ADMIN,
          used: false,
          expiresAt: { gt: new Date() },
        },
      }),
      listExamCategories(),
    ]);

  const countMap = Object.fromEntries(
    questionCounts.map((q) => [q.examType, q._count.id])
  );

  const examStats = categories.map((exam) => ({
    value: exam.slug,
    label: exam.label,
    description: exam.description,
    count: countMap[exam.slug] ?? 0,
  }));

  const totalQuestions = examStats.reduce((sum, e) => sum + e.count, 0);

  return NextResponse.json({
    totalQuestions,
    managerCount,
    adminCount,
    pendingManagerInvites,
    pendingAdminInvites,
    examStats,
  });
}
