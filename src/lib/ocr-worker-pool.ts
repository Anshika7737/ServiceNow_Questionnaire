import type { Worker } from "tesseract.js";
import { runWithConcurrency } from "./parallel-pool";

const POOL_SIZE = 4;

class OcrWorkerPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private waitQueue: Array<(worker: Worker) => void> = [];
  private ready: Promise<void> | null = null;

  private async init() {
    const { createWorker } = await import("tesseract.js").then((mod) => {
      const m = mod as typeof import("tesseract.js") & { default?: typeof import("tesseract.js") };
      return m.default ?? m;
    });

    this.workers = await Promise.all(
      Array.from({ length: POOL_SIZE }, async () => {
        const worker = await createWorker("eng");
        await worker.setParameters({
          tessedit_pageseg_mode: (await import("tesseract.js")).PSM.SINGLE_BLOCK,
        });
        return worker;
      })
    );
    this.idle = [...this.workers];
  }

  private ensureReady() {
    if (!this.ready) this.ready = this.init();
    return this.ready;
  }

  private async acquire(): Promise<Worker> {
    await this.ensureReady();
    const worker = this.idle.pop();
    if (worker) return worker;
    return new Promise((resolve) => this.waitQueue.push(resolve));
  }

  private release(worker: Worker) {
    const next = this.waitQueue.shift();
    if (next) next(worker);
    else this.idle.push(worker);
  }

  async recognize(buffer: Buffer): Promise<string> {
    const worker = await this.acquire();
    try {
      const result = await worker.recognize(buffer);
      return result.data.text;
    } finally {
      this.release(worker);
    }
  }

  async recognizeMany(buffers: Buffer[]): Promise<string[]> {
    await this.ensureReady();
    return runWithConcurrency(buffers, POOL_SIZE, (buf) => this.recognize(buf));
  }

  async terminate() {
    if (!this.workers.length) return;
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idle = [];
    this.waitQueue = [];
    this.ready = null;
  }
}

const pool = new OcrWorkerPool();

export const ocrImageBuffer = (buffer: Buffer) => pool.recognize(buffer);
export const ocrImageBuffers = (buffers: Buffer[]) => pool.recognizeMany(buffers);
export const terminateOcrPool = () => pool.terminate();
