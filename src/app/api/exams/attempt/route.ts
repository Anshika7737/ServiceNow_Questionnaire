import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { isValidExamType } from "@/lib/exams";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.USER) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { examType, answers } = body as {
      examType: string;
      answers: Record<string, string>;
    };

    if (!(await isValidExamType(examType))) {
      return NextResponse.json({ error: "Invalid exam type." }, { status: 400 });
    }

    const questionIds = Object.keys(answers);
    if (!questionIds.length) {
      return NextResponse.json({ error: "No answers submitted." }, { status: 400 });
    }

    const questions = await db.question.findMany({
      where: { id: { in: questionIds }, examType, reviewStatus: "approved" },
    });

    let correctAnswers = 0;
    const results = questions.map((q) => {
      const selected = answers[q.id];
      const correct = selected === q.correctAnswer;
      if (correct) correctAnswers++;
      return {
        id: q.id,
        correct,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      };
    });

    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    const attempt = await db.examAttempt.create({
      data: {
        userId: session.userId,
        examType,
        score,
        totalQuestions,
        correctAnswers,
      },
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        examType: attempt.examType,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
      },
      results,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
