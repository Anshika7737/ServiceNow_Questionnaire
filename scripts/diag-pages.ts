import { readFileSync } from "fs";
import { getData, CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { parseQuestionsFromPageText } from "../src/lib/pdf-parser";
import { preprocessPageForOcr } from "../src/lib/pdf-image-preprocess";
import { normalizeOcrText } from "../src/lib/ocr-corrections";
import { ocrImageBuffer, terminateOcrPool } from "../src/lib/ocr-worker-pool";

async function main() {
  PDFParse.setWorker(getData());
  const buf = readFileSync(
    "/Users/shivambhardwaj/Downloads/CIS - cmdb data foundation 2_174ea43c-d6ba-4942-841f-315016937668 1.pdf"
  );
  const parser = new PDFParse({ data: buf, CanvasFactory });
  const { total } = await parser.getText();
  let headers = 0;
  let parsed = 0;
  const failed: number[] = [];

  for (let p = 1; p <= total; p++) {
    const shot = await parser.getScreenshot({
      imageBuffer: true,
      scale: 2.5,
      partial: [p],
    });
    const raw = Buffer.from(shot.pages[0].data!);
    const pre = await preprocessPageForOcr(raw);
    const text = normalizeOcrText(await ocrImageBuffer(pre));
    const count = parseQuestionsFromPageText(text).length;
    if (/(?:Question|Ouestion)/i.test(text)) headers++;
    if (count) parsed += count;
    else if (/(?:Question|Ouestion)/i.test(text)) failed.push(p);
  }

  console.log("pages", total, "with header", headers, "parsed questions", parsed);
  console.log("failed pages with header:", failed.join(", "));
  await parser.destroy();
  await terminateOcrPool();
}

main();
