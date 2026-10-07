from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from .templates import TEMPLATES, Template, validate_params

ROOT = Path(__file__).resolve().parents[1]


def db_path() -> Path:
    raw = os.environ.get("SQL_DB_PATH", "./data/portfolio.sqlite")
    p = Path(raw)
    if not p.is_absolute():
        p = ROOT / p
    return p


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def run_template(
    template_id: str, params: dict[str, Any]
) -> tuple[Template, list[dict[str, Any]]]:
    if template_id not in TEMPLATES:
        raise KeyError(f"Unknown template id: {template_id}")
    template = TEMPLATES[template_id]
    cleaned = validate_params(template, params)
    conn = connect()
    try:
        cur = conn.execute(template.sql, cleaned)
        rows = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
    return template, rows
