"""SQLite persistence for FIRETRACE voice sessions and turns.

Only deterministic retrieval answers and their (guarded) spoken forms are
stored. Raw audio is never persisted. Storage is local to backend/data.
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

from app.config import settings


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(settings.db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    settings.ensure_dirs()
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                caller TEXT NOT NULL DEFAULT 'browser',
                callee TEXT NOT NULL DEFAULT 'firetrace',
                started_at REAL NOT NULL,
                ended_at REAL,
                turn_count INTEGER NOT NULL DEFAULT 0,
                demo_mode INTEGER NOT NULL DEFAULT 0,
                meta TEXT
            );
            CREATE TABLE IF NOT EXISTS turns (
                turn_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                input_kind TEXT,
                text TEXT NOT NULL,
                answer_json TEXT,
                spoken TEXT,
                grade TEXT,
                metrics_json TEXT,
                created_at REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_turns_session ON turns (session_id, created_at);
            CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event TEXT NOT NULL,
                detail TEXT,
                created_at REAL NOT NULL
            );
            """
        )


def create_session(
    session_id: str,
    *,
    caller: str = "browser",
    callee: str = "firetrace",
    demo_mode: bool = False,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (session_id, caller, callee, started_at, demo_mode, meta) VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, caller, callee, time.time(), int(demo_mode), json.dumps(meta or {})),
        )


def end_session(session_id: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE sessions SET ended_at = ? WHERE session_id = ?",
            (time.time(), session_id),
        )


def record_turn(
    *,
    turn_id: str,
    session_id: str,
    role: str,
    text: str,
    input_kind: Optional[str] = None,
    answer: Optional[dict[str, Any]] = None,
    spoken: Optional[str] = None,
    grade: Optional[str] = None,
    metrics: Optional[dict[str, Any]] = None,
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO turns
            (turn_id, session_id, role, input_kind, text, answer_json, spoken, grade, metrics_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                turn_id,
                session_id,
                role,
                input_kind,
                text,
                json.dumps(answer) if answer is not None else None,
                spoken,
                grade,
                json.dumps(metrics) if metrics is not None else None,
                time.time(),
            ),
        )
        conn.execute(
            "UPDATE sessions SET turn_count = (SELECT COUNT(*) FROM turns WHERE session_id = ?) WHERE session_id = ?",
            (session_id, session_id),
        )


def list_sessions(limit: int = 50) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?", (int(limit),)
        ).fetchall()
    return [dict(row) for row in rows]


def list_turns(session_id: str, limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM turns WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
            (session_id, int(limit)),
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        for key in ("answer_json", "metrics_json", "meta"):
            if item.get(key):
                try:
                    item[key] = json.loads(item[key])
                except (TypeError, json.JSONDecodeError):
                    pass
        result.append(item)
    return result


def healthcheck() -> dict[str, Any]:
    try:
        with _connect() as conn:
            conn.execute("SELECT 1").fetchone()
        return {"ok": True, "path": str(settings.db_path)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": str(settings.db_path)}


def audit(event: str, detail: Optional[str] = None) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO audit (event, detail, created_at) VALUES (?, ?, ?)",
            (event, detail, time.time()),
        )
