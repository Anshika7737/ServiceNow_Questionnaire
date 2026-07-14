import { readFileSync } from "fs";
import { extractQuestionsFromPdf } from "../src/lib/pdf-extract";

const pdfPath =
  process.argv[2] ||
  "/Users/shivambhardwaj/Downloads/CIS - cmdb data foundation 2_174ea43c-d6ba-4942-841f-315016937668 1.pdf";

async function main() {
  console.log("Reading:", pdfPath);
  const buffer = readFileSync(pdfPath);
  console.log("Size:", buffer.length, "bytes");

  const result = await extractQuestionsFromPdf(buffer);
  console.log("Method:", result.method);
  console.log("Text length:", result.text.length);
  console.log("Questions found:", result.questions.length);
  if (result.questions[0]) {
    console.log("First question:", JSON.stringify(result.questions[0], null, 2));
  }
  if (result.questions.length === 0 && result.text.length > 0) {
    console.log("Text sample:", result.text.slice(0, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
