# XCatalyst AI Demos

Production-minded LLM samples you can clone and run offline: retrieval with **cited sources**, agents with a **human approval gate** before writes, and **safe LLM-to-SQL** via vetted query templates. Built as public portfolio demos aligned with real Upwork / consulting work—not client code, no real data, no committed API keys.

| Demo | Stack | What it shows |
|------|-------|----------------|
| [`rag-citations`](./rag-citations/) | TypeScript / Node | Ingest → embeddings → top-k retrieve → answer with source snippets + eval set |
| [`agent-approvals`](./agent-approvals/) | TypeScript / Node | Tool-calling agent; reads auto-run, writes require y/n; JSONL audit log |
| [`llm-sql-safe`](./llm-sql-safe/) | Python / SQLite | LLM picks from vetted SQL templates (never free SQL); replayable logs |

## Attribution

**Nabil Ashraf**, CTO @ [XCatalyst](https://xcatalyst.io)  
GitHub: [@nabilashraf](https://github.com/nabilashraf) · Org: [@chumchumagency](https://github.com/chumchumagency) (branded XCatalyst)

These are **sanitized demos** for portfolio and interview use. They are not production client systems and contain no client data.

## Clone and run

```bash
git clone https://github.com/nabilashraf/ai-demos.git
cd ai-demos
```

Each demo is self-contained. Mock / offline mode is the default (no `OPENAI_API_KEY` needed). Set the key in a local `.env` only if you want real model calls.

### 1. RAG with citations

```bash
cd rag-citations
npm install
npm run ingest
npm start -- "What is the refund window for Pro plans?"
npm run eval
# optional API: npm run api
```

### 2. Agent with approval gate

```bash
cd agent-approvals
npm install
npm start
# follow prompts: propose → approve/deny write tools
# smoke: npm start -- --auto-script --approve
```

### 3. Safe LLM-to-SQL

```bash
cd llm-sql-safe
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python -m src.seed
./.venv/bin/python -m src.cli "What was AAPL closing price on the last trade day?"
```

## License

MIT — see [LICENSE](./LICENSE).
