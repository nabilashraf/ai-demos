import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ToolLogEntry {
  ts: string;
  tool: string;
  args: Record<string, unknown>;
  mutates: boolean;
  approved: boolean | null;
  result: unknown;
  skipped?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveLogPath(): string {
  return (
    process.env.AGENT_LOG_PATH?.trim() ||
    path.resolve(__dirname, "..", "data", "tool-calls.jsonl")
  );
}

export async function logToolCall(entry: ToolLogEntry): Promise<void> {
  const file = resolveLogPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(entry) + "\n", "utf8");
}
