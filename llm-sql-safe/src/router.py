"""Route a natural-language question to a vetted template id + params."""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from .templates import TEMPLATES, list_templates_for_prompt


@dataclass
class RouteResult:
    template_id: str
    params: dict[str, Any]
    mode: str  # mock | openai
    model_version: str
    rationale: str


SYMBOL_RE = re.compile(r"\b([A-Z]{1,5})\b")
KNOWN = {"AAPL", "MSFT", "JPM", "XOM"}


def _extract_symbol(question: str, default: str | None = "AAPL") -> str | None:
    upper = question.upper()
    for sym in KNOWN:
        if re.search(rf"\b{sym}\b", upper):
            return sym
    # fallback: any ticker-like token that is known
    for m in SYMBOL_RE.finditer(upper):
        if m.group(1) in KNOWN:
            return m.group(1)
    return default


def _extract_dates(question: str) -> tuple[str | None, str | None]:
    dates = re.findall(r"\b(20\d{2}-\d{2}-\d{2})\b", question)
    if len(dates) >= 2:
        return dates[0], dates[1]
    if len(dates) == 1:
        return dates[0], dates[0]
    return None, None


def mock_route(question: str) -> RouteResult:
    q = question.lower()
    model = os.environ.get("MODEL_VERSION", "mock-router-v1")

    if "sector" in q or "exposure" in q:
        return RouteResult("sector_exposure", {}, "mock", model, "keyword: sector/exposure")

    if "position" in q or "holding" in q or "portfolio" in q:
        return RouteResult(
            "portfolio_positions", {}, "mock", model, "keyword: portfolio/positions"
        )

    if "pnl" in q or "cashflow" in q or "realized" in q:
        sym = _extract_symbol(question, "MSFT")
        return RouteResult(
            "realized_pnl_symbol",
            {"symbol": sym},
            "mock",
            model,
            "keyword: pnl/realized",
        )

    if "trade" in q and ("list" in q or "show" in q or "all" in q or "for" in q):
        sym = _extract_symbol(question, "MSFT")
        return RouteResult(
            "trades_for_symbol",
            {"symbol": sym},
            "mock",
            model,
            "keyword: trades list",
        )

    start, end = _extract_dates(question)
    if start and end and ("close" in q or "price" in q or "between" in q or "from" in q):
        sym = _extract_symbol(question, "AAPL")
        return RouteResult(
            "closes_range",
            {"symbol": sym, "start_date": start, "end_date": end},
            "mock",
            model,
            "keyword: date range closes",
        )

    if "close" in q or "price" in q or "last" in q:
        sym = _extract_symbol(question, "AAPL")
        return RouteResult(
            "last_close",
            {"symbol": sym},
            "mock",
            model,
            "keyword: last close/price",
        )

    # Safe default: portfolio overview (no free SQL)
    return RouteResult(
        "portfolio_positions",
        {},
        "mock",
        model,
        "fallback: portfolio_positions",
    )


def openai_route(question: str) -> RouteResult:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini").strip()
    system = (
        "You route questions to vetted SQL templates. "
        "Respond with ONLY JSON: "
        '{"templateId":"...","params":{...},"rationale":"..."}. '
        "Never invent SQL. Params must match the template. "
        f"Templates:\n{list_templates_for_prompt()}"
    )
    body = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": question},
        ],
    }
    req = request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        raise RuntimeError(f"OpenAI HTTP {e.code}: {e.read().decode()}") from e

    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    tid = parsed["templateId"]
    if tid not in TEMPLATES:
        raise ValueError(f"Model returned unknown templateId: {tid}")
    params = parsed.get("params") or {}
    return RouteResult(
        template_id=tid,
        params=params,
        mode="openai",
        model_version=model,
        rationale=str(parsed.get("rationale", "")),
    )


def force_local() -> bool:
    v = (os.environ.get("DEMO_MODE") or "").strip().lower()
    return v in {"local", "mock"} or os.environ.get("SQL_FORCE_MOCK") == "1"


def route(question: str) -> RouteResult:
    if force_local() or not os.environ.get("OPENAI_API_KEY", "").strip():
        return mock_route(question)
    try:
        return openai_route(question)
    except Exception as exc:  # noqa: BLE001 — demo fallback
        print(f"OpenAI routing failed; falling back to mock: {exc}")
        return mock_route(question)
