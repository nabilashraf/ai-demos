import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type ApprovalDecision = "approve" | "deny";

export async function askApproval(
  tool: string,
  args: Record<string, unknown>,
  autoApprove?: boolean,
  autoDeny?: boolean
): Promise<ApprovalDecision> {
  console.log("\n─── PENDING APPROVAL (write tool) ───");
  console.log(`Tool: ${tool}`);
  console.log(`Args: ${JSON.stringify(args, null, 2)}`);
  console.log("────────────────────────────────────");

  if (autoApprove) {
    console.log("Auto-approve: yes");
    return "approve";
  }
  if (autoDeny) {
    console.log("Auto-deny: no");
    return "deny";
  }

  if (!input.isTTY) {
    console.log("Non-interactive stdin — denying write for safety.");
    return "deny";
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question("Approve this action? [y/N] ")).trim().toLowerCase();
    return answer === "y" || answer === "yes" ? "approve" : "deny";
  } finally {
    rl.close();
  }
}
