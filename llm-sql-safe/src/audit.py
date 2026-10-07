from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db import ROOT


def audit_path() -> Path:
    raw = os.environ.get("SQL_AUDIT_LOG", "./data/query-audit.jsonl")
    p = Path(raw)
    if not p.is_absolute():
        p = ROOT / p
    return p


def append_audit(entry: dict[str, Any]) -> Path:
    path = audit_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return path


def read_audit(limit: int = 20) -> list[dict[str, Any]]:
    path = audit_path()
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    rows = [json.loads(line) for line in lines if line.strip()]
    return rows[-limit:]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
