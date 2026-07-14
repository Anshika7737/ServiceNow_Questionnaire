import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== Role.USER) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const attempts = await db.examAttempt.findMany({
    where: { userId: session.userId },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: {
      id: true,
      examType: true,
      score: true,
      totalQuestions: true,
      correctAnswers: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ attempts });
}
