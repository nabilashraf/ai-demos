# Agent Approvals

**Problem:** Agents that call write APIs without a human in the loop create refund, delete, and send risks. This demo separates **read tools** (auto-run) from **write tools** (explicit y/n approval) and logs every call.

**What it proves for Upwork:** You understand the approval pattern used in production agent systems—propose → gate → execute → audit—not just “the model called a function.”

## Pattern

```
User goal
   ↓
LLM (or mock script) proposes tool calls
   ↓
Read tools (get_order, list_orders) → auto-execute
Write tools (refund_order) → pending approval → y/n → execute or skip
   ↓
JSONL audit log: name, args, approved?, result
```

## Setup

```bash
cd agent-approvals
cp .env.example .env   # optional
npm install
```

Mock store: `data/orders.json`. Audit log: `data/tool-calls.jsonl` (gitignored).

## Run

Interactive (TTY):

```bash
npm start
# enter a goal like: Refund ORD-1001
# when refund_order is proposed, type y or n
```

Non-interactive smoke / CI:

```bash
npm start -- --auto-script --approve
npm start -- --auto-script --deny
```

With a real key, the same CLI uses OpenAI tool-calling instead of the scripted plan.

## Modes

| Mode | Behavior |
|------|----------|
| No `OPENAI_API_KEY` | Scripted plan: get_order → refund_order (or list) |
| Key set | Multi-turn chat completions with tool schemas |

## Audit log

Each line in `data/tool-calls.jsonl`:

```json
{"ts":"...","tool":"refund_order","args":{...},"mutates":true,"approved":true,"result":{...}}
```
