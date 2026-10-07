#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from src.audit import audit_path, read_audit  # noqa: E402


def main() -> int:
    limit = 20
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            pass
    path = audit_path()
    rows = read_audit(limit)
    if not rows:
        print(f"No audit entries at {path}")
        return 0
    print(f"Last {len(rows)} entries from {path}\n")
    for e in rows:
        slim = {
            "ts": e.get("ts"),
            "question": e.get("question"),
            "templateId": e.get("templateId"),
            "params": e.get("params"),
            "rowCount": e.get("rowCount"),
            "modelVersion": e.get("modelVersion"),
            "mode": e.get("mode"),
        }
        print(json.dumps(slim, indent=2))
        print("---")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
