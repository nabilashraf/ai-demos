import { getOrder, listOrders, refundOrder } from "./store.js";

export type ToolName = "list_orders" | "get_order" | "refund_order";

export interface ToolDef {
  name: ToolName;
  description: string;
  /** Write tools require human approval before execution. */
  mutates: boolean;
  parameters: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "list_orders",
    description: "List all orders in the mock store (read-only).",
    mutates: false,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_order",
    description: "Fetch a single order by id (read-only).",
    mutates: false,
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order id, e.g. ORD-1001" },
      },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
  {
    name: "refund_order",
    description:
      "Issue a full refund for an order. WRITE tool — requires human approval.",
    mutates: true,
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["orderId", "reason"],
      additionalProperties: false,
    },
  },
];

export function toolByName(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}

export async function executeTool(
  name: ToolName,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_orders":
      return listOrders();
    case "get_order": {
      const orderId = String(args.orderId ?? "");
      const order = await getOrder(orderId);
      return order ?? { error: `Order ${orderId} not found` };
    }
    case "refund_order": {
      const orderId = String(args.orderId ?? "");
      const reason = String(args.reason ?? "unspecified");
      return refundOrder(orderId, reason);
    }
    default: {
      const _exhaustive: never = name;
      return { error: `Unknown tool: ${_exhaustive}` };
    }
  }
}

/** OpenAI-compatible tool schemas for real tool-calling mode. */
export function openaiToolSchemas() {
  return TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
