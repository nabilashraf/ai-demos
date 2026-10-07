export interface Chunk {
  id: string;
  source: string;
  text: string;
  start: number;
  end: number;
}

export interface IndexedChunk extends Chunk {
  embedding: number[];
}

export interface IndexFile {
  version: 1;
  createdAt: string;
  embeddingMode: "local" | "openai";
  model?: string;
  chunks: IndexedChunk[];
}

export interface Citation {
  source: string;
  snippet: string;
  score: number;
  chunkId: string;
}

export interface AnswerResult {
  question: string;
  answer: string;
  citations: Citation[];
  mode: "mock" | "openai";
}
