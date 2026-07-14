import { readFileSync } from "fs";
import { getData, CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

async function main() {
  PDFParse.setWorker(getData());
  const buf = readFileSync(
    "/Users/shivambhardwaj/Downloads/CIS - cmdb data foundation 2_174ea43c-d6ba-4942-841f-315016937668 1.pdf"
  );
  const parser = new PDFParse({ data: buf, CanvasFactory });
  const { recognize } = await import("tesseract.js").then((m) => m.default ?? m);
  const { total } = await parser.getText();

  for (const p of [1, 3, 5, 7]) {
    const shot = await parser.getScreenshot({
      imageBuffer: true,
      scale: 2,
      partial: [p],
    });
    const text = (await recognize(Buffer.from(shot.pages[0].data!), "eng")).data.text;
    console.log(`\n=== PAGE ${p} ===\n${text.slice(0, 1200)}`);
  }
  await parser.destroy();
}

main();
