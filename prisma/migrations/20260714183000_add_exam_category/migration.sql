-- AlterTable
ALTER TABLE "User" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "PdfUpload" ADD COLUMN "questionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ExamCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamCategory_slug_key" ON "ExamCategory"("slug");
