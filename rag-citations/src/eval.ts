import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerQuestion } from "./answer.js";
import { retrieve } from "./retrieve.js";

interface EvalCase {
  id: string;
  question: string;
  expectedKeywords: string[];
  expectedSources: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_PATH = path.resolve(__dirname, "..", "eval", "questions.json");

/** Require at least ceil(n/2) keyword hits (min 1). */
function keywordHit(answer: string, keywords: string[]): boolean {
  const lower = answer.toLowerCase();
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const need = Math.max(1, Math.ceil(keywords.length / 2));
  return hits >= need;
}

function sourceHit(
  citations: Array<{ source: string }>,
  expected: string[]
): boolean {
  const got = new Set(citations.map((c) => c.source));
  return expected.some((s) => got.has(s));
}

async function main() {
  const cases = JSON.parse(await readFile(EVAL_PATH, "utf8")) as EvalCase[];
  const topK = Number(process.env.RAG_TOP_K ?? 3);
  let passed = 0;

  console.log(`Running ${cases.length} eval cases (topK=${topK})\n`);

  for (const c of cases) {
    const { citations, chunks } = await retrieve(c.question, topK);
    const result = await answerQuestion(c.question, chunks, citations);
    const kw = keywordHit(result.answer, c.expectedKeywords);
    const src = sourceHit(result.citations, c.expectedSources);
    const ok = kw && src;
    if (ok) passed += 1;

    console.log(
      `${ok ? "PASS" : "FAIL"} ${c.id}: ${c.question.slice(0, 60)}`
    );
    if (!ok) {
      console.log(`  keywords=${kw} sources=${src}`);
      console.log(
        `  got sources: ${[...new Set(result.citations.map((x) => x.source))].join(", ")}`
      );
      console.log(
        `  answer snippet: ${result.answer.slice(0, 160).replace(/\n/g, " ")}`
      );
    }
  }

  console.log(`\nScore: ${passed}/${cases.length}`);
  process.exit(passed === cases.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
