import { createHash } from "node:crypto";

const LOCAL_DIM = 384;

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "what", "which", "how", "long",
  "for", "and", "or", "of", "to", "in", "on", "at", "by", "with", "from",
  "does", "do", "did", "only", "available", "about", "into",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function queryTerms(text: string): string[] {
  return tokenize(text).filter((t) => t.length > 1 && !STOP.has(t));
}

/** Deterministic local embedding: multi-hash bag-of-tokens with TF weighting. */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(LOCAL_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    tf.set(bigram, (tf.get(bigram) ?? 0) + 1);
  }

  for (const [token, count] of tf) {
    const weight = 1 + Math.log(count);
    const hash = createHash("sha256").update(token).digest();
    for (let i = 0; i < 16; i++) {
      const idx = ((hash[i]! << 8) | hash[(i + 1) % 32]!) % LOCAL_DIM;
      const sign = hash[(i + 16) % 32]! % 2 === 0 ? 1 : -1;
      vec[idx]! += sign * weight;
    }
  }

  return l2Normalize(vec);
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Weighted lexical overlap. Longer / rarer query terms count more so
 * "trial" beats a generic "NovaDesk" co-occurrence.
 */
export function lexicalScore(query: string, text: string): number {
  const terms = queryTerms(query);
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  let num = 0;
  let den = 0;
  for (const t of terms) {
    const w = Math.min(3, Math.max(1, t.length / 3));
    den += w;
    if (lower.includes(t)) num += w;
  }
  return den === 0 ? 0 : num / den;
}

function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  if (sum === 0) return v;
  const norm = Math.sqrt(sum);
  return v.map((x) => x / norm);
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function forceLocal(): boolean {
  const v = process.env.DEMO_MODE?.trim().toLowerCase();
  return v === "local" || v === "mock" || process.env.RAG_FORCE_LOCAL === "1";
}

export async function embedTexts(texts: string[]): Promise<{
  vectors: number[][];
  mode: "local" | "openai";
  model?: string;
}> {
  if (forceLocal() || !hasOpenAI()) {
    return { vectors: texts.map(localEmbed), mode: "local" };
  }

  const model =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: texts }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(
        `OpenAI embeddings failed (${res.status}); falling back to local embeddings.`,
      );
      console.warn(body.slice(0, 240));
      return { vectors: texts.map(localEmbed), mode: "local" };
    }

    const json = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    const ordered = [...json.data].sort((a, b) => a.index - b.index);
    return {
      vectors: ordered.map((d) => d.embedding),
      mode: "openai",
      model,
    };
  } catch (err) {
    console.warn(
      `OpenAI embeddings error; falling back to local embeddings: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { vectors: texts.map(localEmbed), mode: "local" };
  }
}
