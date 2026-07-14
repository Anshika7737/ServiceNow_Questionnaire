import { spawn, type ChildProcess } from "child_process";
import { access, constants, mkdtemp, unlink, writeFile } from "fs/promises";
import net from "net";
import { tmpdir } from "os";
import path from "path";
import type { ExtractProgress, ExtractResult } from "./pdf-extract";
import type { ParsedQuestion } from "./pdf-parser";
import { dedupeParsedQuestions } from "./question-dedup";

const WRAPPER_SCRIPT = path.join(process.cwd(), "scripts", "run-python-extract.sh");
const START_WORKER_SCRIPT = path.join(process.cwd(), "scripts", "start-python-worker.sh");
const PROGRESS_PREFIX = "PROGRESS:";
const EXTRACT_TIMEOUT_MS = 280_000;
const WORKER_HOST = process.env.CERTPREP_OCR_HOST ?? "127.0.0.1";
const WORKER_PORT = Number(process.env.CERTPREP_OCR_PORT ?? "38471");

type PythonExtractPayload = {
  method?: string;
  pageCount?: number;
  questions?: ParsedQuestion[];
  error?: string | null;
  ok?: boolean;
};

let workerStartAttempted = false;

function parseStdoutJson(stdout: string): PythonExtractPayload {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as PythonExtractPayload;
  } catch {
    const lines = trimmed.split("\n").filter((l) => l.trim().startsWith("{"));
    if (lines.length === 0) throw new Error("No JSON in stdout");
    return JSON.parse(lines[lines.length - 1]) as PythonExtractPayload;
  }
}

function sendWorkerRequest(payload: Record<string, unknown>): Promise<PythonExtractPayload> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: WORKER_HOST, port: WORKER_PORT });
    let buffer = Buffer.alloc(0);
    let expectedLen = -1;

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("OCR worker timed out"));
    }, EXTRACT_TIMEOUT_MS);

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        if (expectedLen < 0) {
          if (buffer.length < 4) return;
          expectedLen = buffer.readUInt32BE(0);
          buffer = buffer.subarray(4);
        }
        if (buffer.length < expectedLen) return;
        const body = buffer.subarray(0, expectedLen).toString("utf-8");
        clearTimeout(timeout);
        socket.end();
        resolve(JSON.parse(body) as PythonExtractPayload);
        return;
      }
    });

    socket.on("connect", () => {
      const data = Buffer.from(JSON.stringify(payload), "utf-8");
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      socket.write(Buffer.concat([len, data]));
    });
  });
}

async function pingWorker(): Promise<boolean> {
  try {
    const resp = await sendWorkerRequest({ cmd: "ping" });
    return Boolean(resp.ok);
  } catch {
    return false;
  }
}

async function waitForWorker(maxMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await pingWorker()) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function ensureWorkerStarted(): Promise<void> {
  if (await pingWorker()) return;
  if (workerStartAttempted) {
    await waitForWorker(45_000);
    return;
  }
  workerStartAttempted = true;
  try {
    await access(START_WORKER_SCRIPT, constants.X_OK);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("bash", [START_WORKER_SCRIPT], { stdio: "ignore" });
      child.on("error", reject);
      child.on("close", () => resolve());
    });
  } catch {
    // fall back to one-shot extract
  }
  await waitForWorker(60_000);
}

async function isWrapperAvailable(): Promise<boolean> {
  try {
    await access(WRAPPER_SCRIPT, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isPythonExtractorAvailable(): Promise<boolean> {
  if (await pingWorker()) return true;
  return isWrapperAvailable();
}

function runPythonExtract(
  pdfPath: string,
  onProgress?: (progress: ExtractProgress) => void
): Promise<PythonExtractPayload> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(WRAPPER_SCRIPT, [pdfPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Python extraction timed out"));
    }, EXTRACT_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      for (const line of textLines(chunk.toString())) {
        parseProgressLine(line, onProgress);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `Python extractor exited with code ${code}`));
        return;
      }
      try {
        resolve(parseStdoutJson(stdout));
      } catch {
        reject(new Error(stderr.trim() || "Invalid JSON from Python extractor"));
      }
    });
  });
}

function* textLines(text: string) {
  for (const line of text.split("\n")) yield line;
}

function parseProgressLine(line: string, onProgress?: (progress: ExtractProgress) => void) {
  const prefixes = [PROGRESS_PREFIX, "PROGRESS:"];
  for (const prefix of prefixes) {
    const idx = line.indexOf(prefix);
    if (idx < 0) continue;
    try {
      onProgress?.(JSON.parse(line.slice(idx + prefix.length)) as ExtractProgress);
    } catch {
      /* ignore */
    }
  }
}

function payloadToResult(payload: PythonExtractPayload): ExtractResult | null {
  if (payload.error && (!payload.questions || payload.questions.length === 0)) {
    console.warn("[python-extract]", payload.error);
    return null;
  }
  const questions = dedupeParsedQuestions(payload.questions ?? []);
  if (questions.length === 0) return null;
  return {
      text: "",
      method: (payload.method === "easyocr+ollama" ? "easyocr+ollama" : "easyocr") as ExtractResult["method"],
    pageCount: payload.pageCount,
    questions,
  };
}

export async function extractQuestionsWithPython(
  buffer: Buffer,
  onProgress?: (progress: ExtractProgress) => void
): Promise<ExtractResult | null> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "certprep-pdf-"));
  const pdfPath = path.join(tempDir, "upload.pdf");

  try {
    await writeFile(pdfPath, buffer);

    try {
      await ensureWorkerStarted();
      if (await pingWorker()) {
        const workerPayload = await sendWorkerRequest({ cmd: "extract", path: pdfPath });
        const result = payloadToResult(workerPayload);
        if (result) return result;
      }
    } catch (err) {
      console.warn("[python-extract] worker:", err instanceof Error ? err.message : err);
    }

    if (!(await isWrapperAvailable())) return null;
    const payload = await runPythonExtract(pdfPath, onProgress);
    return payloadToResult(payload);
  } catch (error) {
    console.warn(
      "[python-extract]",
      error instanceof Error ? error.message : "Python extraction failed"
    );
    return null;
  } finally {
    await unlink(pdfPath).catch(() => undefined);
  }
}
