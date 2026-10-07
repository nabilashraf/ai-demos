# RAG Citations

**Problem:** Reviewers (and clients) ask whether an LLM answer is grounded. Chatbots that shrug “trust me” fail audits. This demo shows retrieval + answers with **cited source snippets**, plus a tiny eval set you can score.

**What it proves for Upwork:** You can ship a measurable RAG loop—ingest, embed, retrieve top-k, answer with citations, and fail loudly when sources or keywords miss—without needing a full production stack on day one.

## Architecture

```
data/*.md  →  chunk  →  embed (local hash/TF or OpenAI)
                              ↓
                     data/index.json
                              ↓
              query → top-k cosine → answer + citations
```

- **Offline / mock (default):** deterministic local embeddings + extractive answers. No API key.
- **OpenAI:** set `OPENAI_API_KEY` for `text-embedding-3-small` (configurable) and chat completions.

## Setup

```bash
cd rag-citations
cp .env.example .env   # optional
npm install
npm run ingest
```

## Run

```bash
npm start -- "What is the refund window for Pro plans?"
npm run eval
npm run api            # POST http://localhost:3847/ask {"question":"..."}
```

## Eval

`eval/questions.json` lists questions, expected keywords, and expected source filenames. `npm run eval` retrieves, answers, and prints PASS/FAIL with a score.

## Corpus

Fictional product **NovaDesk** (`data/*.md`): overview, pricing, security, integrations, support. Not client data.
