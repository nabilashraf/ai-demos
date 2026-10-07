import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runAgent } from "./agent.js";
import { resolveLogPath } from "./logger.js";
import { resetDemoState } from "./store.js";

async function main() {
  const args = process.argv.slice(2);
  const autoScript = args.includes("--auto-script");
  const approve = args.includes("--approve");
  const deny = args.includes("--deny");

  console.log("Agent Approvals Demo — XCatalyst");
  console.log(`Audit log: ${resolveLogPath()}`);

  const goalFromArgs = args.filter((a) => !a.startsWith("--")).join(" ").trim();

  if (autoScript) {
    await resetDemoState();
    const goal = goalFromArgs || "Please refund order ORD-1001 for the customer";
    // For smoke tests: --approve or default approve when neither flag set; --deny wins
    const autoApproveWrites = deny ? false : true;
    const autoDenyWrites = Boolean(deny);
    await runAgent(goal, { autoApproveWrites, autoDenyWrites });
    console.log("\nDone (auto-script).");
    return;
  }

  let goal = goalFromArgs;
  if (!goal) {
    if (input.isTTY) {
      const rl = readline.createInterface({ input, output });
      goal = (await rl.question('Goal (e.g. "Refund ORD-1001"): ')).trim();
      rl.close();
    } else {
      goal = "Look up ORD-1002 and propose a refund";
    }
  }

  if (!goal) {
    console.error("No goal provided.");
    process.exit(1);
  }

  await runAgent(goal, {
    autoApproveWrites: approve,
    autoDenyWrites: deny,
  });
  console.log("\nDone. Inspect the JSONL audit log for tool call history.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
