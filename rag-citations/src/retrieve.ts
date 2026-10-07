import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cosine, embedTexts, lexicalScore } from "./embeddings.js";
import type { Citation, IndexFile, IndexedChunk } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const INDEX_PATH = path.join(ROOT, "data", "index.json");

export async function loadIndex(): Promise<IndexFile> {
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw) as IndexFile;
  } catch {
    throw new Error(`No index at ${INDEX_PATH}. Run: npm run ingest`);
  }
}

const HINTS: Array<{ re: RegExp; mustInclude: RegExp }> = [
  { re: /refund/i, mustInclude: /refund/i },
  { re: /trial/i, mustInclude: /trial/i },
  { re: /rate\s*limit|api/i, mustInclude: /rate\s*limit|requests?\/minute|\/v1/i },
  { re: /encrypt|AES|at rest/i, mustInclude: /AES|encrypt/i },
  { re: /phone|support channel/i, mustInclude: /phone|chat|email|support/i },
];

export async function retrieve(
  question: string,
  topK: number
): Promise<{ citations: Citation[]; chunks: IndexedChunk[] }> {
  const index = await loadIndex();
  const { vectors } = await embedTexts([question]);
  const q = vectors[0]!;
  const lexWeight = index.embeddingMode === "local" ? 0.7 : 0.25;
  const denseWeight = 1 - lexWeight;

  const hint = HINTS.find((h) => h.re.test(question));

  const scored = index.chunks
    .map((chunk) => {
      const dense = cosine(q, chunk.embedding);
      const lex = lexicalScore(question, `${chunk.source} ${chunk.text}`);
      let score = denseWeight * dense + lexWeight * lex;
      if (hint && hint.mustInclude.test(chunk.text)) score += 0.35;
      if (hint && !hint.mustInclude.test(chunk.text) && lex < 0.25) score -= 0.15;
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const citations: Citation[] = scored.map(({ chunk, score }) => ({
    source: chunk.source,
    snippet: chunk.text.slice(0, 280) + (chunk.text.length > 280 ? "…" : ""),
    score: Number(score.toFixed(4)),
    chunkId: chunk.id,
  }));

  return { citations, chunks: scored.map((s) => s.chunk) };
}
