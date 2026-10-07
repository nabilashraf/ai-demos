import "dotenv/config";
import { answerQuestion } from "./answer.js";
import { retrieve } from "./retrieve.js";

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm start -- "your question"');
    process.exit(1);
  }

  const topK = Number(process.env.RAG_TOP_K ?? 3);
  const { citations, chunks } = await retrieve(question, topK);
  const result = await answerQuestion(question, chunks, citations);

  console.log(`\nMode: ${result.mode}`);
  console.log(`\nQ: ${result.question}\n`);
  console.log(`A: ${result.answer}\n`);
  console.log("Citations:");
  for (const c of result.citations) {
    console.log(`  - [${c.score}] ${c.source} (${c.chunkId})`);
    console.log(`    ${c.snippet.replace(/\n/g, " ").slice(0, 160)}…`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
