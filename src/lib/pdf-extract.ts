import { getData, CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import {
  parseQuestionsFromPageText,
  parseQuestionsFromText,
  type ParsedQuestion,
} from "./pdf-parser";
import { dedupeParsedQuestions } from "./question-dedup";
import { preprocessPageForOcr } from "./pdf-image-preprocess";
import { normalizeOcrText } from "./ocr-corrections";
import { ocrImageBuffers, terminateOcrPool } from "./ocr-worker-pool";
import { extractQuestionsWithPython } from "./pdf-extract-python";

const OCR_BATCH_SIZE = 6;
const RENDER_SCALE = 2.5;

let workerConfigured = false;

function meaningfulTextLength(text: string): number {
  return text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

function ensurePdfWorker() {
  if (workerConfigured) return;
  PDFParse.setWorker(getData());
  workerConfigured = true;
}

export type ExtractResult = {
  text: string;
  method: "text" | "ocr" | "none" | "easyocr" | "easyocr+ollama";
  pageCount?: number;
  questions: ParsedQuestion[];
};

export type ExtractProgress = {
  page: number;
  total: number;
};

type PdfParser = {
  getText: () => Promise<{ text?: string; total: number }>;
  getScreenshot: (params?: {
    imageBuffer?: boolean;
    scale?: number;
    partial?: number[];
  }) => Promise<{ pages: Array<{ data?: Uint8Array; pageNumber?: number }> }>;
  destroy: () => Promise<void>;
};

export async function extractTextFromPdf(
  buffer: Buffer,
  onProgress?: (progress: ExtractProgress) => void
): Promise<ExtractResult> {
  ensurePdfWorker();
  const parser = new PDFParse({ data: buffer, CanvasFactory }) as unknown as PdfParser;

  try {
    const textResult = await parser.getText();
    const text = textResult.text?.trim() ?? "";
    const meaningful = meaningfulTextLength(text);

    if (meaningful > 100) {
      const questions = parseQuestionsFromText(text);
      return { text, method: "text", questions };
    }

    const { ocrText, questions } = await ocrAndParsePages(
      parser,
      textResult.total,
      onProgress
    );
    if (ocrText.trim().length > 0) {
      return {
        text: ocrText,
        method: "ocr",
        pageCount: textResult.total,
        questions,
      };
    }

    return { text: text || ocrText, method: "none", questions: [] };
  } finally {
    await parser.destroy();
    await terminateOcrPool();
  }
}

async function renderPage(parser: PdfParser, pageNum: number): Promise<Buffer | null> {
  const screenshot = await parser.getScreenshot({
    imageBuffer: true,
    scale: RENDER_SCALE,
    partial: [pageNum],
  });
  const page = screenshot.pages[0];
  if (!page?.data?.length) return null;
  return Buffer.from(page.data);
}

async function ocrAndParsePages(
  parser: PdfParser,
  totalPages: number,
  onProgress?: (progress: ExtractProgress) => void
) {
  const allQuestions: ParsedQuestion[] = [];
  const pageTexts: string[] = new Array(totalPages);

  for (let batchStart = 1; batchStart <= totalPages; batchStart += OCR_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + OCR_BATCH_SIZE - 1, totalPages);
    const pageNums: number[] = [];
    const rawBuffers: Buffer[] = [];

    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
      const raw = await renderPage(parser, pageNum);
      if (raw) {
        pageNums.push(pageNum);
        rawBuffers.push(raw);
      }
      onProgress?.({ page: pageNum, total: totalPages });
    }

    const preprocessed = await Promise.all(rawBuffers.map((b) => preprocessPageForOcr(b)));
    const ocrResults = await ocrImageBuffers(preprocessed);

    for (let i = 0; i < pageNums.length; i++) {
      const pageNum = pageNums[i];
      const normalized = normalizeOcrText(ocrResults[i]);
      pageTexts[pageNum - 1] = normalized;

      const pageQuestions = parseQuestionsFromPageText(normalized);
      allQuestions.push(...pageQuestions);
    }
  }

  const combined = pageTexts.filter(Boolean).join("\n");
  const fromPages = dedupeParsedQuestions(allQuestions);

  if (fromPages.length > 0) {
    return { ocrText: combined, questions: fromPages };
  }

  return {
    ocrText: combined,
    questions: dedupeParsedQuestions(parseQuestionsFromText(combined)),
  };
}

export async function extractQuestionsFromPdf(
  buffer: Buffer,
  onProgress?: (progress: ExtractProgress) => void
) {
  const pythonResult = await extractQuestionsWithPython(buffer, onProgress);
  const pythonQs = pythonResult?.questions ?? [];

  if (pythonQs.length > 0) {
    const method = pythonResult?.method === "easyocr+ollama" ? "easyocr+ollama" : "easyocr";
    return {
      text: "",
      method: method as "easyocr" | "easyocr+ollama",
      pageCount: pythonResult?.pageCount,
      questions: dedupeParsedQuestions(pythonQs),
    };
  }

  const nodeExtracted = await extractTextFromPdf(buffer, onProgress);
  return {
    ...nodeExtracted,
    questions: dedupeParsedQuestions(nodeExtracted.questions),
  };
}
