"""Lossless scientific snapshot alongside the existing FTS index; no re-parsing."""
import csv
import hashlib
import json
from pathlib import Path
import re

SCHEMA_VERSION = "1"


def validate_originals(raw_dir: Path, sources: list[dict], records: list[dict]) -> None:
    tables = {}
    for source in sources:
        filename = source.get("original_filename")
        if not filename:
            continue
        path = (raw_dir / filename).resolve()
        if Path(filename).name != filename or "\\" in filename or not path.is_relative_to(raw_dir.resolve()):
            raise ValueError("Invalid registered artifact filename")
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != source.get("sha256"):
            raise ValueError("Original artifact integrity failure: " + filename)
        if source.get("role") == "experiment_table":
            with path.open(encoding="utf-8-sig", newline="") as stream:
                tables[source["source_id"]] = list(csv.DictReader(stream))
    for record in records:
        match = re.search(r"CSV row (\d+)", record.get("source_locator", ""))
        rows = tables.get(record.get("source_id"), [])
        index = int(match[1]) - 2 if match else -1
        if not 0 <= index < len(rows) or record.get("raw") != rows[index]:
            raise ValueError("Record raw data does not match its original CSV row")


def write_snapshot(conn, records, claims, sources, investigations=()):
    """Called on the builder's temporary DB, or on a private in-memory DB."""
    records, claims, sources = list(records), list(claims), list(sources)
    dump = lambda value: json.dumps(value, ensure_ascii=False, allow_nan=False)
    conn.executescript("""
        DROP TABLE IF EXISTS scientific_measurements;
        DROP TABLE IF EXISTS scientific_records;
        DROP TABLE IF EXISTS scientific_sources;
        DROP TABLE IF EXISTS scientific_claims;
        DROP TABLE IF EXISTS scientific_investigations;
        CREATE TABLE scientific_investigations(source_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE scientific_records(experiment_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES scientific_investigations(source_id), payload TEXT NOT NULL);
        CREATE TABLE scientific_measurements(measurement_id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES scientific_records(experiment_id), payload TEXT NOT NULL);
        CREATE INDEX measurements_record ON scientific_measurements(experiment_id);
        CREATE INDEX records_source ON scientific_records(source_id);
        CREATE TABLE scientific_sources(artifact_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, payload TEXT NOT NULL);
        CREATE INDEX source_investigation ON scientific_sources(source_id);
        CREATE TABLE scientific_claims(claim_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    """)
    investigations = list(investigations) or [{"psi": sid} for sid in sorted({r["source_id"] for r in records})]
    with conn:
        conn.executemany("INSERT INTO scientific_investigations VALUES (?,?)", [(i["psi"], dump(i)) for i in investigations])
        conn.executemany("INSERT INTO scientific_records VALUES (?,?,?)", [(r["experiment_id"], r["source_id"], dump(r)) for r in records])
        conn.executemany("INSERT INTO scientific_measurements VALUES (?,?,?)", [(m["measurement_id"], r["experiment_id"], dump(m)) for r in records for m in r.get("measurements", [])])
        conn.executemany("INSERT INTO scientific_claims VALUES (?,?)", [(c["claim_id"], dump(c)) for c in claims])
        conn.executemany("INSERT INTO scientific_sources VALUES (?,?,?)", [(s["source_id"] + "--" + (s.get("original_filename") or s["role"]), s["source_id"], dump(s)) for s in sources])
        conn.execute("INSERT OR REPLACE INTO index_meta VALUES ('scientific_schema', ?)", (SCHEMA_VERSION,))
