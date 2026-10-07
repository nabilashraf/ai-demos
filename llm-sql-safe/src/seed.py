#!/usr/bin/env python3
"""Seed fictional portfolio / trading tables."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from .db import db_path


SCHEMA = """
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS prices;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS instruments;

CREATE TABLE instruments (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL
);

CREATE TABLE prices (
  symbol TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume INTEGER NOT NULL,
  PRIMARY KEY (symbol, trade_date),
  FOREIGN KEY (symbol) REFERENCES instruments(symbol)
);

CREATE TABLE positions (
  symbol TEXT PRIMARY KEY,
  quantity REAL NOT NULL,
  avg_cost REAL NOT NULL,
  FOREIGN KEY (symbol) REFERENCES instruments(symbol)
);

CREATE TABLE trades (
  trade_id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (symbol) REFERENCES instruments(symbol)
);
"""

INSTRUMENTS = [
    ("AAPL", "Apple Inc.", "Technology"),
    ("MSFT", "Microsoft Corp.", "Technology"),
    ("JPM", "JPMorgan Chase", "Financials"),
    ("XOM", "Exxon Mobil", "Energy"),
]

# Fake daily closes (sparse)
PRICES = [
    ("AAPL", "2026-01-02", 188.0, 190.5, 187.2, 189.4, 52_000_000),
    ("AAPL", "2026-01-03", 189.5, 191.0, 188.8, 190.2, 48_000_000),
    ("AAPL", "2026-01-06", 190.0, 192.4, 189.5, 191.8, 55_000_000),
    ("AAPL", "2026-01-07", 191.5, 193.0, 190.9, 192.1, 50_000_000),
    ("MSFT", "2026-01-02", 410.0, 415.0, 408.5, 412.3, 22_000_000),
    ("MSFT", "2026-01-03", 412.0, 418.0, 411.0, 416.5, 24_000_000),
    ("MSFT", "2026-01-06", 416.0, 420.0, 414.0, 419.2, 21_000_000),
    ("MSFT", "2026-01-07", 419.0, 421.5, 417.0, 420.0, 20_000_000),
    ("JPM", "2026-01-02", 195.0, 198.0, 194.0, 197.2, 12_000_000),
    ("JPM", "2026-01-07", 197.0, 199.5, 196.5, 198.8, 11_000_000),
    ("XOM", "2026-01-02", 105.0, 106.5, 104.2, 105.8, 15_000_000),
    ("XOM", "2026-01-07", 106.0, 107.2, 105.5, 106.9, 14_000_000),
]

POSITIONS = [
    ("AAPL", 120, 175.5),
    ("MSFT", 40, 380.0),
    ("JPM", 60, 182.0),
]

TRADES = [
    (1, "AAPL", "2025-11-10", "BUY", 100, 170.0),
    (2, "AAPL", "2025-12-01", "BUY", 20, 180.0),
    (3, "MSFT", "2025-10-15", "BUY", 50, 375.0),
    (4, "MSFT", "2025-12-20", "SELL", 10, 405.0),
    (5, "JPM", "2025-09-01", "BUY", 60, 182.0),
    (6, "XOM", "2025-08-01", "BUY", 30, 100.0),
    (7, "XOM", "2025-12-15", "SELL", 30, 108.0),
]


def main() -> None:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(str(path))
    try:
        conn.executescript(SCHEMA)
        conn.executemany(
            "INSERT INTO instruments(symbol, name, sector) VALUES (?, ?, ?)",
            INSTRUMENTS,
        )
        conn.executemany(
            "INSERT INTO prices(symbol, trade_date, open, high, low, close, volume) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            PRICES,
        )
        conn.executemany(
            "INSERT INTO positions(symbol, quantity, avg_cost) VALUES (?, ?, ?)",
            POSITIONS,
        )
        conn.executemany(
            "INSERT INTO trades(trade_id, symbol, trade_date, side, quantity, price) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            TRADES,
        )
        conn.commit()
    finally:
        conn.close()
    print(f"Seeded {path}")


if __name__ == "__main__":
    main()
