#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Allow `python -m src.cli` and `python src/cli.py`
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from src.audit import append_audit, now_iso  # noqa: E402
from src.db import db_path, run_template  # noqa: E402
from src.router import route  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    question = " ".join(argv).strip()
    if not question:
        print('Usage: python -m src.cli "Your question about the portfolio"')
        return 1

    if not db_path().exists():
        print(f"No database at {db_path()}. Run: python -m src.seed")
        return 1

    routed = route(question)
    print(f"Mode: {routed.mode}  model={routed.model_version}")
    print(f"Template: {routed.template_id}")
    print(f"Params: {json.dumps(routed.params)}")
    print(f"Rationale: {routed.rationale}")

    template, rows = run_template(routed.template_id, routed.params)

    entry = {
        "ts": now_iso(),
        "question": question,
        "templateId": routed.template_id,
        "params": routed.params,
        "rowCount": len(rows),
        "rows": rows,
        "modelVersion": routed.model_version,
        "mode": routed.mode,
        "sql": " ".join(template.sql.split()),
    }
    path = append_audit(entry)

    print(f"\nRows ({len(rows)}):")
    print(json.dumps(rows, indent=2))
    print(f"\nAudited → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
