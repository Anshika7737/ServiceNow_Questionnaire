import { readFileSync } from "fs";
import { extractQuestionsFromPdf } from "../src/lib/pdf-extract";

async function main() {
  const buf = readFileSync(
    "/Users/shivambhardwaj/Downloads/CIS - cmdb data foundation 2_174ea43c-d6ba-4942-841f-315016937668 1.pdf"
  );
  const start = Date.now();
  let lastPage = 0;

  const result = await extractQuestionsFromPdf(buf, ({ page, total }) => {
    if (page !== lastPage) {
      lastPage = page;
      process.stdout.write(`\rPage ${page}/${total}`);
    }
  });

  console.log(`\n\nExtracted ${result.questions.length} questions in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log("Method:", result.method);
  console.log("Sample:", result.questions[0]?.text?.slice(0, 80));
}

main();
