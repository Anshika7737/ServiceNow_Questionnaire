import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

import { isDuplicateOfAny } from "@/lib/question-dedup";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const question = await db.question.findUnique({
    where: { id },
    select: { id: true, pdfUploadId: true, reviewStatus: true, text: true, examType: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const text = body.text as string | undefined;
  const options = body.options as string[] | undefined;
  const correctAnswer = body.correctAnswer as string | undefined;
  const explanation = body.explanation as string | undefined;
  const reviewStatus = body.reviewStatus as string | undefined;

  if (reviewStatus && !["pending", "approved", "rejected"].includes(reviewStatus)) {
    return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  }

  if (reviewStatus === "rejected") {
    await db.question.delete({ where: { id } });
    await syncUploadStatus(question.pdfUploadId);
    return NextResponse.json({ deleted: true });
  }

  if (reviewStatus === "approved") {
    const approvedInBank = await db.question.findMany({
      where: {
        examType: question.examType,
        reviewStatus: "approved",
        id: { not: id },
      },
      select: { text: true },
    });
    const checkText = text?.trim() ?? question.text;
    if (isDuplicateOfAny(checkText, approvedInBank.map((q) => q.text))) {
      await db.question.delete({ where: { id } });
      await syncUploadStatus(question.pdfUploadId);
      return NextResponse.json({
        deleted: true,
        duplicate: true,
        error: "Duplicate question — already in the question bank.",
      });
    }
  }

  const updated = await db.question.update({
    where: { id },
    data: {
      ...(text !== undefined && { text: text.trim() }),
      ...(options !== undefined && { options: JSON.stringify(options) }),
      ...(correctAnswer !== undefined && { correctAnswer }),
      ...(explanation !== undefined && { explanation: explanation || null }),
      ...(reviewStatus !== undefined && { reviewStatus }),
    },
  });

  if (reviewStatus === "approved") {
    await syncUploadStatus(question.pdfUploadId);
  }

  return NextResponse.json({
    question: {
      ...updated,
      options: JSON.parse(updated.options) as string[],
    },
  });
}

async function syncUploadStatus(pdfUploadId: string | null) {
  if (!pdfUploadId) return;

  const pending = await db.question.count({
    where: { pdfUploadId, reviewStatus: "pending" },
  });

  const approved = await db.question.count({
    where: { pdfUploadId, reviewStatus: "approved" },
  });

  await db.pdfUpload.update({
    where: { id: pdfUploadId },
    data: {
      status: pending > 0 ? "pending_review" : approved > 0 ? "approved" : "no_questions",
      questionCount: pending + approved,
    },
  });
}
