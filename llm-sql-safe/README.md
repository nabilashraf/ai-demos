# LLM SQL Safe

**Problem:** Letting an LLM write free SQL against a trading or portfolio database is an audit and injection nightmare. This demo never generates SQL from scratch—it **selects a vetted template**, fills typed parameters, runs it via SQLite bound parameters, and logs everything for replay.

**What it proves for Upwork:** You can map “LLM over data” jobs (fintech, ops) to a controllable semantic layer: templates / views, parameter binding, and replayable audit trails—not string-concatenated queries.

## Architecture

```
Question
   ↓
Router (mock heuristics OR OpenAI JSON pick)
   ↓
Template id + params  →  prepared statement  →  rows
   ↓
JSONL audit: question, templateId, params, rows, modelVersion
```

There is **no path** where model output becomes raw SQL text executed against the DB.

## Schema (fake data)

| Table | Purpose |
|-------|---------|
| `instruments` | symbols, names, sectors |
| `prices` | daily OHLCV-ish closes |
| `positions` | holdings in a demo portfolio |
| `trades` | buy/sell history |

## Setup

```bash
cd llm-sql-safe
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env   # optional; set DEMO_MODE=local to ignore shell OPENAI_API_KEY
./.venv/bin/python -m src.seed
```

## Run

```bash
./.venv/bin/python -m src.cli "What was AAPL closing price on the last trade day?"
./.venv/bin/python -m src.cli "Show my portfolio positions"
./.venv/bin/python -m src.cli "Total realized PnL for MSFT trades"
./.venv/bin/python -m src.replay
```

## Vetted templates

Defined in `src/templates.py`: `last_close`, `closes_range`, `portfolio_positions`, `trades_for_symbol`, `realized_pnl_symbol`, `sector_exposure`.

## Auditability

Each query appends to `data/query-audit.jsonl` (question, template id, params, rows used, model version). `./.venv/bin/python -m src.replay` prints recent entries—maps to compliance review in fintech LLM-over-SQL work.

## Modes

| Mode | Behavior |
|------|----------|
| No `OPENAI_API_KEY` | Keyword / heuristic router (`mock-router-v1`) |
| Key set | OpenAI returns JSON `{templateId, params}` only |
