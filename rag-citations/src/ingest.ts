import "dotenv/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chunkMarkdown } from "./chunk.js";
import { embedTexts } from "./embeddings.js";
import type { IndexFile, IndexedChunk } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const INDEX_PATH = path.join(DATA, "index.json");

async function main() {
  const chunkSize = Number(process.env.RAG_CHUNK_SIZE ?? 500);
  const overlap = Number(process.env.RAG_CHUNK_OVERLAP ?? 80);

  const files = (await readdir(DATA)).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    throw new Error(`No .md files in ${DATA}`);
  }

  const allChunks = [];
  for (const file of files) {
    const text = await readFile(path.join(DATA, file), "utf8");
    allChunks.push(...chunkMarkdown(file, text, chunkSize, overlap));
  }

  console.log(`Chunked ${files.length} files → ${allChunks.length} chunks`);
  const { vectors, mode, model } = await embedTexts(allChunks.map((c) => c.text));

  const indexed: IndexedChunk[] = allChunks.map((c, i) => ({
    ...c,
    embedding: vectors[i]!,
  }));

  const index: IndexFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    embeddingMode: mode,
    model,
    chunks: indexed,
  };

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`Wrote ${INDEX_PATH} (embedding mode: ${mode}${model ? `, ${model}` : ""})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
