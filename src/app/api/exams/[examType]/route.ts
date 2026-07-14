import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isValidExamType } from "@/lib/exams";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ examType: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { examType } = await params;
  if (!(await isValidExamType(examType))) {
    return NextResponse.json({ error: "Invalid exam type." }, { status: 400 });
  }

  const questions = await db.question.findMany({
    where: { examType, pdfUploadId: { not: null }, reviewStatus: "approved" },
    take: 20,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      text: true,
      options: true,
    },
  });

  const formatted = questions.map((q) => ({
    id: q.id,
    text: q.text,
    options: JSON.parse(q.options) as string[],
  }));

  return NextResponse.json({ examType, questions: formatted });
}
