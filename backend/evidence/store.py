"""SQLite connections are closed after every operation. No scientific re-parsing."""
from contextlib import contextmanager
import json
import sqlite3

SCHEMA_VERSION = 1
SCHEMA = """
CREATE TABLE IF NOT EXISTS dataset (id INTEGER PRIMARY KEY CHECK(id=1), fingerprint TEXT NOT NULL, payload TEXT NOT NULL, validation TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS investigations (source_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources (artifact_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, filename TEXT, payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sources_investigation ON sources(source_id);
CREATE TABLE IF NOT EXISTS experiments (experiment_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES investigations(source_id), family TEXT NOT NULL, material TEXT NOT NULL, quality TEXT NOT NULL, oxygen REAL, flow REAL, search_text TEXT NOT NULL, sort_id TEXT NOT NULL, date TEXT, payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS experiments_family ON experiments(family);
CREATE INDEX IF NOT EXISTS experiments_material ON experiments(material);
CREATE INDEX IF NOT EXISTS experiments_oxygen ON experiments(oxygen);
CREATE INDEX IF NOT EXISTS experiments_flow ON experiments(flow);
CREATE TABLE IF NOT EXISTS measurements (measurement_id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiments(experiment_id) ON DELETE CASCADE, quantity TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS measurements_experiment ON measurements(experiment_id);
CREATE TABLE IF NOT EXISTS claims (claim_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
"""


@contextmanager
def connect(path, readonly=True):
    conn = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5) if readonly else sqlite3.connect(path, timeout=5)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        yield conn
    finally:
        conn.close()


def dump(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def metadata(conn):
    row = conn.execute("SELECT * FROM dataset WHERE id=1").fetchone()
    if row is None:
        raise RuntimeError("database requires import")
    return row["fingerprint"], json.loads(row["payload"])
