"""Vetted SQL templates. The LLM may only choose an id + params — never free SQL."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Template:
    id: str
    description: str
    sql: str
    params: tuple[str, ...]  # ordered parameter names
    example_question: str


TEMPLATES: dict[str, Template] = {
    "last_close": Template(
        id="last_close",
        description="Latest closing price for a symbol",
        sql="""
            SELECT p.symbol, p.trade_date, p.close
            FROM prices p
            WHERE p.symbol = :symbol
            ORDER BY p.trade_date DESC
            LIMIT 1
        """,
        params=("symbol",),
        example_question="What was AAPL closing price on the last trade day?",
    ),
    "closes_range": Template(
        id="closes_range",
        description="Daily closes for a symbol between two dates (inclusive)",
        sql="""
            SELECT trade_date, close, volume
            FROM prices
            WHERE symbol = :symbol
              AND trade_date >= :start_date
              AND trade_date <= :end_date
            ORDER BY trade_date
        """,
        params=("symbol", "start_date", "end_date"),
        example_question="Show AAPL closes from 2026-01-01 to 2026-01-10",
    ),
    "portfolio_positions": Template(
        id="portfolio_positions",
        description="Current portfolio positions with instrument names",
        sql="""
            SELECT pos.symbol, i.name, pos.quantity, pos.avg_cost,
                   (pos.quantity * pos.avg_cost) AS cost_basis
            FROM positions pos
            JOIN instruments i ON i.symbol = pos.symbol
            ORDER BY pos.symbol
        """,
        params=(),
        example_question="Show my portfolio positions",
    ),
    "trades_for_symbol": Template(
        id="trades_for_symbol",
        description="All trades for a symbol",
        sql="""
            SELECT trade_id, trade_date, side, quantity, price
            FROM trades
            WHERE symbol = :symbol
            ORDER BY trade_date, trade_id
        """,
        params=("symbol",),
        example_question="List MSFT trades",
    ),
    "realized_pnl_symbol": Template(
        id="realized_pnl_symbol",
        description="Naive realized PnL for sells of a symbol (sum of sell notional minus matched avg — demo only)",
        sql="""
            SELECT t.symbol,
                   SUM(CASE WHEN t.side = 'SELL' THEN t.quantity * t.price ELSE 0 END) AS sell_notional,
                   SUM(CASE WHEN t.side = 'BUY' THEN t.quantity * t.price ELSE 0 END) AS buy_notional,
                   SUM(CASE WHEN t.side = 'SELL' THEN t.quantity * t.price
                            WHEN t.side = 'BUY' THEN -t.quantity * t.price
                            ELSE 0 END) AS net_cashflow
            FROM trades t
            WHERE t.symbol = :symbol
            GROUP BY t.symbol
        """,
        params=("symbol",),
        example_question="Total realized PnL cashflow for MSFT trades",
    ),
    "sector_exposure": Template(
        id="sector_exposure",
        description="Portfolio cost-basis exposure by sector",
        sql="""
            SELECT i.sector,
                   SUM(pos.quantity * pos.avg_cost) AS exposure,
                   COUNT(*) AS position_count
            FROM positions pos
            JOIN instruments i ON i.symbol = pos.symbol
            GROUP BY i.sector
            ORDER BY exposure DESC
        """,
        params=(),
        example_question="What is my sector exposure?",
    ),
}


def list_templates_for_prompt() -> str:
    lines = []
    for t in TEMPLATES.values():
        lines.append(
            f"- id={t.id} params={list(t.params)} :: {t.description} "
            f"(e.g. {t.example_question})"
        )
    return "\n".join(lines)


def validate_params(template: Template, params: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for name in template.params:
        if name not in params or params[name] in (None, ""):
            raise ValueError(f"Missing required param '{name}' for template {template.id}")
        val = params[name]
        if name == "symbol":
            val = str(val).upper().strip()
        elif name.endswith("_date"):
            val = str(val).strip()
        cleaned[name] = val
    # Reject unexpected keys (defense in depth)
    extra = set(params) - set(template.params)
    if extra:
        raise ValueError(f"Unexpected params for {template.id}: {sorted(extra)}")
    return cleaned
