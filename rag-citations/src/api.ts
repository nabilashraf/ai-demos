import "dotenv/config";
import express from "express";
import { answerQuestion } from "./answer.js";
import { retrieve } from "./retrieve.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rag-citations" });
});

app.post("/ask", async (req, res) => {
  try {
    const question = String(req.body?.question ?? "").trim();
    if (!question) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    const topK = Number(req.body?.topK ?? process.env.RAG_TOP_K ?? 3);
    const { citations, chunks } = await retrieve(question, topK);
    const result = await answerQuestion(question, chunks, citations);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

const port = Number(process.env.PORT ?? 3847);
app.listen(port, () => {
  console.log(`rag-citations API listening on http://localhost:${port}`);
  console.log(`POST /ask  { "question": "..." }`);
});
