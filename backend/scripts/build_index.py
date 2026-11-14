"""Validate the curated corpus and build the FTS5 retrieval index.

This script never writes to ``corpus.json`` or ``source_manifest.json``. It only
reads them, checks their invariants and writes ``backend/index/corpus_fts.sqlite3``
atomically. It exits non-zero when any check fails, so it can gate CI.

    python scripts/build_index.py
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings  # noqa: E402
from app.v1 import policy  # noqa: E402
from app.v1.store import DEFAULT_INDEX_PATH, build_fts_index, value_fields  # noqa: E402

CORPUS_PATH = Path(settings.corpus_path)
MANIFEST_PATH = Path(settings.manifest_path)
INDEX_PATH = Path(DEFAULT_INDEX_PATH)


def _load(path: Path) -> tuple[dict[str, Any], bytes]:
    raw = path.read_bytes()
    return json.loads(raw.decode("utf-8")), raw


def main() -> int:
    checks: list[dict[str, Any]] = []
    failures: list[str] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "ok": bool(ok), "detail": detail})
        if not ok:
            failures.append(f"{name}: {detail}")

    if not CORPUS_PATH.exists():
        print(json.dumps({"ok": False, "error": f"missing corpus: {CORPUS_PATH}"}, indent=2))
        return 2
    if not MANIFEST_PATH.exists():
        print(json.dumps({"ok": False, "error": f"missing manifest: {MANIFEST_PATH}"}, indent=2))
        return 2

    corpus, corpus_bytes = _load(CORPUS_PATH)
    manifest, _manifest_bytes = _load(MANIFEST_PATH)
    corpus_version = hashlib.sha256(corpus_bytes).hexdigest()

    records: list[dict[str, Any]] = list(corpus.get("records") or [])
    claims: list[dict[str, Any]] = list(corpus.get("claims") or [])
    meta: dict[str, Any] = dict(corpus.get("meta") or {})

    sources: list[dict[str, Any]] = list(manifest.get("sources") or [])
    context_sources: list[dict[str, Any]] = list(manifest.get("context_sources") or [])
    known_sources = {str(item.get("source_id")) for item in sources + context_sources}

    # ---- counts ------------------------------------------------------- #
    declared = int(meta.get("record_count") or -1)
    check(
        "record_count",
        declared == len(records),
        f"meta.record_count={declared} records={len(records)}",
    )
    check(
        "experiment_record_count",
        int(meta.get("experiment_record_count") or -1) == len(records),
        f"meta.experiment_record_count={meta.get('experiment_record_count')}",
    )
    check("source_count", len(known_sources) == 4, f"sources={sorted(known_sources)}")

    # ---- identifiers --------------------------------------------------- #
    ids = [str(record.get("experiment_id")) for record in records]
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    check("unique_experiment_ids", not duplicates, f"duplicates={duplicates}")
    check("non_empty_ids", all(ids), "every record has an experiment_id")

    # ---- referential integrity ----------------------------------------- #
    unresolved_records = sorted(
        {
            f"{record.get('experiment_id')} -> {record.get('source_id')}"
            for record in records
            if str(record.get("source_id")) not in known_sources
        }
    )
    check("record_sources_resolve", not unresolved_records, "; ".join(unresolved_records) or "all resolve")

    unresolved_claims = sorted(
        {
            f"{claim.get('claim_id')} -> {source_id}"
            for claim in claims
            for source_id in claim.get("supporting_source_ids") or []
            if str(source_id) not in known_sources
        }
    )
    check("claim_sources_resolve", not unresolved_claims, "; ".join(unresolved_claims) or "all resolve")

    locators = [
        str(record.get("source_locator"))
        for record in records
        if record.get("source_locator")
    ]
    check(
        "every_record_has_locator",
        len(locators) == len(records),
        f"locators={len(locators)} records={len(records)}",
    )

    # ---- status and null discipline ------------------------------------ #
    unknown_status: list[str] = []
    value_with_null_status: list[str] = []
    null_status_with_value: list[str] = []
    missing_unit: list[str] = []
    for record in records:
        experiment_id = record.get("experiment_id")
        for field, payload in value_fields(record).items():
            status = str(payload.get("status"))
            value = payload.get("value")
            if status not in policy.VALUE_STATUSES:
                unknown_status.append(f"{experiment_id}.{field}={status}")
            if value is not None and status in policy.NO_VALUE_STATUSES:
                value_with_null_status.append(f"{experiment_id}.{field}")
            if value is None and status in {"measured", "derived"}:
                null_status_with_value.append(f"{experiment_id}.{field}")
            if policy.is_number(value) and not payload.get("unit"):
                missing_unit.append(f"{experiment_id}.{field}")
    check("known_statuses", not unknown_status, ", ".join(unknown_status[:5]) or "all statuses known")
    check(
        "no_value_with_no_value_status",
        not value_with_null_status,
        ", ".join(value_with_null_status[:5]) or "null discipline holds",
    )
    check(
        "measured_values_not_null",
        not null_status_with_value,
        ", ".join(null_status_with_value[:5]) or "measured and derived fields carry values",
    )

    # ---- documented gaps stay gaps ------------------------------------- #
    coverage = dict(meta.get("coverage") or {})
    pressure_reported = sum(
        1
        for record in records
        if policy.has_value(value_fields(record).get("total_pressure_psia"))
    )
    gravity_measured = sum(
        1
        for record in records
        if policy.status_of(value_fields(record).get("gravity_regime")) == "measured"
    )
    check(
        "pressure_absent_matches_meta",
        pressure_reported == int(coverage.get("pressure_reported", -1)),
        f"reported={pressure_reported} meta={coverage.get('pressure_reported')}",
    )
    check(
        "gravity_not_measured",
        gravity_measured == int(coverage.get("gravity_per_record_reported", -1)),
        f"measured={gravity_measured} meta={coverage.get('gravity_per_record_reported')}",
    )

    # ---- index --------------------------------------------------------- #
    index_ok = False
    index_detail = "not built"
    if not failures:
        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = INDEX_PATH.with_suffix(".sqlite3.tmp")
        if tmp_path.exists():
            tmp_path.unlink()
        conn = sqlite3.connect(tmp_path)
        try:
            build_fts_index(conn, records, claims, sources + context_sources)
            conn.execute(
                "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('corpus_version', ?)",
                (corpus_version,),
            )
            conn.execute(
                "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('built_at', ?)",
                (datetime.now(timezone.utc).isoformat(timespec="seconds"),),
            )
            conn.execute(
                "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('sqlite_version', ?)",
                (sqlite3.sqlite_version,),
            )
            conn.execute(
                "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('policy_version', ?)",
                (policy.POLICY_VERSION,),
            )
            conn.commit()
            total_docs = conn.execute("SELECT count(*) FROM evidence_fts").fetchone()[0]
            index_detail = f"documents={total_docs} path={INDEX_PATH}"
            index_ok = total_docs > 0
        finally:
            conn.close()
        if index_ok:
            os.replace(tmp_path, INDEX_PATH)
        elif tmp_path.exists():
            tmp_path.unlink()

    check("fts_index_built", index_ok, index_detail)
    check("index_readable", INDEX_PATH.exists() and INDEX_PATH.stat().st_size > 0, str(INDEX_PATH))

    report = {
        "ok": not failures,
        "corpus_version": corpus_version,
        "corpus_path": str(CORPUS_PATH),
        "manifest_path": str(MANIFEST_PATH),
        "index_path": str(INDEX_PATH),
        "records": len(records),
        "claims": len(claims),
        "sources": sorted(known_sources),
        "checks": checks,
        "failures": failures,
        "wrote_data_files": False,
    }
    print(json.dumps(report, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
