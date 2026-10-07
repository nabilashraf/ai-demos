import type { Chunk } from "./types.js";

export function chunkMarkdown(
  source: string,
  text: string,
  chunkSize: number,
  overlap: number
): Chunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  // Prefer heading-aware sections first
  const sections = cleaned.split(/(?=^## )/m).map((s) => s.trim()).filter(Boolean);
  const units = sections.length > 1 ? sections : [cleaned];

  const chunks: Chunk[] = [];
  let idx = 0;
  let cursor = 0;

  for (const unit of units) {
    const startBase = cleaned.indexOf(unit, cursor);
    cursor = startBase >= 0 ? startBase + 1 : cursor;

    if (unit.length <= chunkSize) {
      chunks.push({
        id: `${source}#${idx}`,
        source,
        text: unit,
        start: Math.max(0, startBase),
        end: Math.max(0, startBase) + unit.length,
      });
      idx += 1;
      continue;
    }

    let start = 0;
    while (start < unit.length) {
      let end = Math.min(start + chunkSize, unit.length);
      if (end < unit.length) {
        const breakAt = unit.lastIndexOf("\n", end);
        if (breakAt > start + chunkSize * 0.4) end = breakAt;
      }
      const slice = unit.slice(start, end).trim();
      if (slice) {
        chunks.push({
          id: `${source}#${idx}`,
          source,
          text: slice,
          start: Math.max(0, startBase) + start,
          end: Math.max(0, startBase) + end,
        });
        idx += 1;
      }
      if (end >= unit.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }

  return chunks;
}
