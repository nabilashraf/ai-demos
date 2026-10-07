import { hasOpenAI, lexicalScore, queryTerms } from "./embeddings.js";
import type { AnswerResult, Citation, IndexedChunk } from "./types.js";

function scoreSentence(question: string, sentence: string): number {
  const qTerms = queryTerms(question);
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const t of qTerms) {
    if (lower.includes(t)) score += Math.min(3, Math.max(1, t.length / 3));
  }
  if (/\b\d[\d,]*(?:\.\d+)?\b/.test(sentence)) score += 0.8;
  if (/requests?\/minute|refund|trial|AES-\d+|phone|SLA|encrypted/i.test(sentence)) {
    score += 1.5;
  }
  if (/SSO|SOC 2|DPA|GDPR/i.test(sentence) && !/sso|soc|gdpr|compliance/i.test(question)) {
    score -= 2;
  }
  return score;
}

function extractiveAnswer(
  question: string,
  chunks: IndexedChunk[],
  citations: Citation[]
): string {
  if (chunks.length === 0) {
    return "I could not find relevant material in the NovaDesk corpus.";
  }

  const ranked = [...chunks]
    .map((c) => ({
      chunk: c,
      lex: lexicalScore(question, `${c.source} ${c.text}`),
    }))
    .sort((a, b) => b.lex - a.lex);

  const primary = ranked[0]!.chunk;
  const secondary = ranked.slice(1, 3).map((r) => r.chunk);
  const pool = [primary, ...secondary];

  const sentences = pool.flatMap((c, rank) =>
    c.text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12 && !s.startsWith("#"))
      .map((s) => ({
        text: s,
        source: c.source,
        score: scoreSentence(question, s) + (rank === 0 ? 1 : 0),
      }))
  );

  const picked = sentences
    .filter((s) => s.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const body = picked.length
    ? picked.map((p) => p.text).join(" ")
    : primary.text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .slice(0, 6)
        .join(" ");

  const sources = [...new Set([primary.source, ...citations.map((c) => c.source)])]
    .slice(0, 4)
    .join(", ");
  return `${body}\n\n(Sources: ${sources})`;
}

async function openaiAnswer(
  question: string,
  chunks: IndexedChunk[],
  citations: Citation[]
): Promise<string> {
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.source})\n${c.text}`)
    .join("\n\n");
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Answer using only the provided context. Cite sources by filename in brackets like [pricing.md]. If context is insufficient, say so.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI chat failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const answer = json.choices[0]?.message?.content?.trim() ?? "";
  const sources = [...new Set(citations.map((c) => c.source))].join(", ");
  return `${answer}\n\n(Retrieved: ${sources})`;
}

export async function answerQuestion(
  question: string,
  chunks: IndexedChunk[],
  citations: Citation[]
): Promise<AnswerResult> {
  if (hasOpenAI()) {
    const answer = await openaiAnswer(question, chunks, citations);
    return { question, answer, citations, mode: "openai" };
  }
  return {
    question,
    answer: extractiveAnswer(question, chunks, citations),
    citations,
    mode: "mock",
  };
}
