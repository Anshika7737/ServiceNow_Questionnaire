import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { isDuplicateOfAny } from "@/lib/question-dedup";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const upload = await db.pdfUpload.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      examType: true,
      status: true,
      questionCount: true,
      createdAt: true,
    },
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  const [questions, approvedInBank] = await Promise.all([
    db.question.findMany({
      where: { pdfUploadId: id, reviewStatus: "pending" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        text: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        reviewStatus: true,
      },
    }),
    db.question.findMany({
      where: { examType: upload.examType, reviewStatus: "approved" },
      select: { text: true },
    }),
  ]);

  const bankTexts = approvedInBank.map((q) => q.text);
  const duplicateIds: string[] = [];

  const formatted = questions
    .map((q) => {
      const options = JSON.parse(q.options) as string[];
      const isDuplicate = isDuplicateOfAny(q.text, bankTexts);
      if (isDuplicate) duplicateIds.push(q.id);
      return {
        id: q.id,
        text: q.text,
        options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        reviewStatus: q.reviewStatus,
        isDuplicate,
      };
    })
    .filter((q) => !q.isDuplicate);

  if (duplicateIds.length > 0) {
    await db.question.deleteMany({ where: { id: { in: duplicateIds } } });
    const remaining = formatted.length;
    await db.pdfUpload.update({
      where: { id },
      data: {
        questionCount: remaining,
        status: remaining > 0 ? "pending_review" : "no_questions",
      },
    });
  }

  return NextResponse.json({
    upload: {
      ...upload,
      questionCount: formatted.length,
    },
    questions: formatted,
    duplicatesSkipped: duplicateIds.length,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  const upload = await db.pdfUpload.findUnique({ where: { id } });
  if (!upload) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  if (action === "approve_all") {
    const pending = await db.question.findMany({
      where: { pdfUploadId: id, reviewStatus: "pending" },
      select: { id: true, text: true },
    });

    const approvedInBank = await db.question.findMany({
      where: { examType: upload.examType, reviewStatus: "approved" },
      select: { text: true },
    });
    const bankTexts = approvedInBank.map((q) => q.text);

    const toApprove: string[] = [];
    const duplicateIds: string[] = [];

    for (const q of pending) {
      if (isDuplicateOfAny(q.text, bankTexts)) {
        duplicateIds.push(q.id);
      } else {
        toApprove.push(q.id);
        bankTexts.push(q.text);
      }
    }

    if (duplicateIds.length > 0) {
      await db.question.deleteMany({ where: { id: { in: duplicateIds } } });
    }

    if (toApprove.length > 0) {
      await db.question.updateMany({
        where: { id: { in: toApprove } },
        data: { reviewStatus: "approved" },
      });
    }

    const remaining = await db.question.count({
      where: { pdfUploadId: id, reviewStatus: "pending" },
    });

    await db.pdfUpload.update({
      where: { id },
      data: { status: remaining === 0 ? "approved" : "pending_review" },
    });

    return NextResponse.json({
      approved: toApprove.length,
      duplicatesSkipped: duplicateIds.length,
    });
  }

  if (action === "reject_all") {
    await db.question.deleteMany({
      where: { pdfUploadId: id, reviewStatus: "pending" },
    });

    await db.pdfUpload.update({
      where: { id },
      data: { status: "rejected", questionCount: 0 },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
