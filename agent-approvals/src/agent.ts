import { askApproval } from "./approval.js";
import { logToolCall } from "./logger.js";
import {
  executeTool,
  openaiToolSchemas,
  toolByName,
  type ToolName,
} from "./tools.js";

export interface PlannedCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface AgentOptions {
  /** Non-interactive: approve all writes */
  autoApproveWrites?: boolean;
  /** Non-interactive: deny all writes */
  autoDenyWrites?: boolean;
}

async function runToolWithGate(
  tool: ToolName,
  args: Record<string, unknown>,
  opts: AgentOptions
): Promise<unknown> {
  const def = toolByName(tool);
  if (!def) {
    const result = { error: `Unknown tool: ${tool}` };
    await logToolCall({
      ts: new Date().toISOString(),
      tool,
      args,
      mutates: false,
      approved: null,
      result,
    });
    return result;
  }

  if (def.mutates) {
    const decision = await askApproval(
      tool,
      args,
      opts.autoApproveWrites,
      opts.autoDenyWrites
    );
    if (decision !== "approve") {
      const result = { skipped: true, reason: "human_denied" };
      await logToolCall({
        ts: new Date().toISOString(),
        tool,
        args,
        mutates: true,
        approved: false,
        result,
        skipped: true,
      });
      console.log("→ Denied. Tool not executed.\n");
      return result;
    }
    const result = await executeTool(tool, args);
    await logToolCall({
      ts: new Date().toISOString(),
      tool,
      args,
      mutates: true,
      approved: true,
      result,
    });
    console.log("→ Approved & executed.");
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // Reads auto-run
  const result = await executeTool(tool, args);
  await logToolCall({
    ts: new Date().toISOString(),
    tool,
    args,
    mutates: false,
    approved: null,
    result,
  });
  console.log(`→ Auto-ran read tool: ${tool}`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Scripted plan used when OPENAI_API_KEY is absent. */
export function mockPlan(userGoal: string): PlannedCall[] {
  const lower = userGoal.toLowerCase();
  const refundMatch = lower.match(/ord-\d+/i);
  const orderId = refundMatch?.[0]?.toUpperCase() ?? "ORD-1001";

  if (lower.includes("refund") || lower.includes("return money")) {
    return [
      { tool: "get_order", args: { orderId } },
      {
        tool: "refund_order",
        args: { orderId, reason: "Customer requested refund via agent demo" },
      },
    ];
  }

  if (lower.includes("list") || lower.includes("all orders")) {
    return [{ tool: "list_orders", args: {} }];
  }

  // Default: look up then optional refund proposal for ORD-1002
  return [
    { tool: "get_order", args: { orderId: "ORD-1002" } },
    {
      tool: "refund_order",
      args: {
        orderId: "ORD-1002",
        reason: "Demo scripted refund proposal",
      },
    },
  ];
}

export async function runMockAgent(
  userGoal: string,
  opts: AgentOptions = {}
): Promise<void> {
  console.log(`\n[mock LLM] Goal: ${userGoal}`);
  const plan = mockPlan(userGoal);
  console.log(
    `[mock LLM] Plan: ${plan.map((p) => p.tool).join(" → ")}\n`
  );

  for (const step of plan) {
    console.log(`\nProposing: ${step.tool}(${JSON.stringify(step.args)})`);
    await runToolWithGate(step.tool, step.args, opts);
  }
}

function forceLocal(): boolean {
  const v = process.env.DEMO_MODE?.trim().toLowerCase();
  return v === "local" || v === "mock" || process.env.AGENT_FORCE_MOCK === "1";
}

function hasOpenAI(): boolean {
  return !forceLocal() && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function runOpenAIAgent(
  userGoal: string,
  opts: AgentOptions = {}
): Promise<void> {
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
  type Msg = {
    role: string;
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
  };

  const messages: Msg[] = [
    {
      role: "system",
      content:
        "You are a support agent for a mock store. Use tools to look up and refund orders. Prefer get_order before refund_order. Be concise.",
    },
    { role: "user", content: userGoal },
  ];

  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: openaiToolSchemas(),
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`OpenAI error ${res.status}; falling back to mock plan.`);
      console.warn(body.slice(0, 240));
      await runMockAgent(userGoal, opts);
      return;
    }

    const json = (await res.json()) as {
      choices: Array<{ message: Msg; finish_reason: string }>;
    };
    const msg = json.choices[0]?.message;
    if (!msg) break;
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      console.log("\nAgent:", msg.content ?? "(no content)");
      break;
    }

    for (const call of calls) {
      const name = call.function.name as ToolName;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        args = {};
      }
      console.log(`\nProposing: ${name}(${JSON.stringify(args)})`);
      const result = await runToolWithGate(name, args, opts);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result),
      });
    }
  }
}

export async function runAgent(
  userGoal: string,
  opts: AgentOptions = {}
): Promise<void> {
  if (hasOpenAI()) {
    console.log("Mode: openai tool-calling");
    try {
      await runOpenAIAgent(userGoal, opts);
    } catch (err) {
      console.warn(
        `OpenAI agent failed; falling back to mock: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      await runMockAgent(userGoal, opts);
    }
  } else {
    console.log("Mode: mock (scripted plan — set OPENAI_API_KEY for real tool-calling)");
    await runMockAgent(userGoal, opts);
  }
}
