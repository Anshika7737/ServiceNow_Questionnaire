import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== Role.MANAGER) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const teamMembers = await db.user.findMany({
    where: { invitedById: session.userId, role: Role.USER },
    select: {
      id: true,
      name: true,
      email: true,
      examAttempts: {
        orderBy: { completedAt: "desc" },
        select: {
          examType: true,
          score: true,
          totalQuestions: true,
          correctAnswers: true,
          completedAt: true,
        },
      },
    },
  });

  const allAttempts = teamMembers.flatMap((m) =>
    m.examAttempts.map((a) => ({ ...a, userName: m.name, userEmail: m.email }))
  );

  const avgScore =
    allAttempts.length > 0
      ? allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length
      : null;

  return NextResponse.json({
    teamCount: teamMembers.length,
    examsTaken: allAttempts.length,
    avgScore: avgScore !== null ? Math.round(avgScore) : null,
    teamMembers: teamMembers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      attempts: m.examAttempts,
    })),
  });
}
