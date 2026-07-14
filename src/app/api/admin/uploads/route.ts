import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";
import { extractQuestionsFromPdf } from "@/lib/pdf-extract";
import { isDuplicateOfAny } from "@/lib/question-dedup";

export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "5", 10)));
  const skip = (page - 1) * limit;

  const [uploads, total] = await Promise.all([
    db.pdfUpload.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        filename: true,
        examType: true,
        status: true,
        questionCount: true,
        createdAt: true,
      },
    }),
    db.pdfUpload.count(),
  ]);

  return NextResponse.json({
    uploads,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const examType = (formData.get("examType") as string)?.trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (!examType) {
      return NextResponse.json({ error: "Select a question bank category." }, { status: 400 });
    }

    const category = await db.examCategory.findUnique({ where: { slug: examType } });
    if (!category) {
      return NextResponse.json({ error: "Invalid question bank category." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be under 15 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await mkdir(UPLOAD_DIR, { recursive: true });

    const upload = await db.pdfUpload.create({
      data: {
        filename: file.name,
        filepath: "",
        examType,
        status: "processing",
        uploadedById: session.userId,
      },
    });

    const filepath = path.join(UPLOAD_DIR, `${upload.id}.pdf`);
    await writeFile(filepath, buffer);

    let status = "pending_review";
    let questionCount = 0;
    let parseError: string | null = null;
    let extractionMethod: string | null = null;
    let duplicateCount = 0;

    try {
      const { questions, method, text } = await extractQuestionsFromPdf(buffer);
      extractionMethod = method;

      if (questions.length === 0) {
        status = "no_questions";
        parseError =
          method === "none"
            ? "Could not read text from this PDF. If it is scanned, try a clearer scan or fewer pages."
            : "No questions detected. Check format: numbered questions, A–D options, and an Answer line.";
        if (text.length > 0 && method === "ocr") {
          parseError +=
            " OCR ran but could not match question patterns — you can still add questions manually after review.";
        }
      } else {
        const existingApproved = await db.question.findMany({
          where: { examType, reviewStatus: "approved" },
          select: { text: true },
        });
        const bankTexts = existingApproved.map((q) => q.text);

        const toInsert = questions.filter((q) => {
          if (isDuplicateOfAny(q.text, bankTexts)) {
            duplicateCount++;
            return false;
          }
          bankTexts.push(q.text);
          return true;
        });

        if (toInsert.length === 0) {
          status = "no_questions";
          parseError =
            duplicateCount > 0
              ? `All ${duplicateCount} extracted question(s) already exist in the question bank.`
              : "No new questions to add.";
        } else {
          await db.question.createMany({
            data: toInsert.map((q) => ({
              text: q.text,
              options: JSON.stringify(q.options),
              correctAnswer: q.correctAnswer,
              explanation: q.explanation ?? null,
              examType,
              pdfUploadId: upload.id,
              reviewStatus: "pending",
            })),
          });
          questionCount = toInsert.length;
        }
      }
    } catch (err) {
      status = "failed";
      parseError =
        err instanceof Error
          ? err.message
          : "Could not process this PDF. Try again or use a clearer file.";
    }

    const updated = await db.pdfUpload.update({
      where: { id: upload.id },
      data: {
        filepath,
        status,
        questionCount,
      },
    });

    return NextResponse.json({
      upload: {
        id: updated.id,
        filename: updated.filename,
        examType: updated.examType,
        status: updated.status,
        questionCount: updated.questionCount,
      },
      category: {
        slug: category.slug,
        label: category.label,
      },
      extractionMethod,
      error: parseError,
      duplicateCount,
      needsReview: status === "pending_review" && questionCount > 0,
    });
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
