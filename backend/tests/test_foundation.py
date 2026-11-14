"""Regression checks for the foundation additions to the existing API."""
import copy
import hashlib
import json
import sqlite3
from pathlib import Path
import pytest
from app.config import settings
from app.v1.artifacts import original_path
from app.v1.persistence import validate_originals
from app.v1.store import EvidenceStore, build_fts_index


def test_lossless_sqlite_snapshot_and_idempotence(store):
    conn = sqlite3.connect(":memory:")
    try:
        for _ in range(2):
            build_fts_index(conn, store.records, store.claims, store.sources + store.context_sources, store.meta["investigations"])
            records = [json.loads(row[0]) for row in conn.execute("SELECT payload FROM scientific_records ORDER BY rowid")]
            assert records == store.records
            measurements = [json.loads(row[0]) for row in conn.execute("SELECT payload FROM scientific_measurements ORDER BY rowid")]
            assert measurements == [m for r in store.records for m in r["measurements"]]
            assert conn.execute("SELECT count(*) FROM scientific_sources").fetchone()[0] == len(store.sources) + len(store.context_sources)
            assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        conn.close()


def test_original_rows_and_hashes(store, tmp_path):
    validate_originals(settings.project_dir / "data/raw", store.sources, store.records)
    table = next(s for s in store.sources if s.get("role") == "experiment_table" and s["source_id"] == "PSI-25")
    path = tmp_path / table["original_filename"]
    path.write_bytes((settings.project_dir / "data/raw" / table["original_filename"]).read_bytes())
    sample = copy.deepcopy(store.records[:1])
    sample[0]["raw"]["PI"] = "altered"
    with pytest.raises(ValueError, match="CSV row"):
        validate_originals(tmp_path, [table], sample)
    path.write_bytes(b"altered")
    with pytest.raises(ValueError, match="integrity"):
        validate_originals(tmp_path, [table], [])
    assert original_path(table, tmp_path) is None


def test_persistent_snapshot_is_used_and_tampering_is_rejected(store, tmp_path):
    path = tmp_path / "snapshot.sqlite3"
    conn = sqlite3.connect(path)
    build_fts_index(conn, store.records, store.claims, store.sources + store.context_sources)
    conn.execute("INSERT OR REPLACE INTO index_meta VALUES('corpus_version',?)", (store.corpus_version,))
    conn.commit()
    conn.close()
    loaded = EvidenceStore(index_path=path)
    assert loaded.index_mode == "persistent"
    assert loaded.resolve_record("B1") == store.resolve_record("B1")
    loaded.close()
    conn = sqlite3.connect(path)
    conn.execute("UPDATE scientific_records SET payload='{}' WHERE experiment_id='BASS2-B1'")
    conn.commit()
    conn.close()
    with pytest.raises(RuntimeError, match="snapshot differs"):
        EvidenceStore(index_path=path)


def test_source_inventory_and_untouched_original_download(client):
    sources = client.get("/api/v1/sources").json()
    assert len(sources["items"]) == 5
    source = client.get("/api/v1/sources/PSI-25").json()
    artifact = next(s for s in source["artifacts"] if s["role"] == "experiment_table")
    assert artifact["download_available"]
    response = client.get("/api/v1/sources/PSI-25/download", params={"artifact": artifact["artifact_id"], "corpus_version": source["corpus_version"]})
    assert response.status_code == 200
    assert hashlib.sha256(response.content).hexdigest() == artifact["sha256"]
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize("identifier", ["../../.env", "C:/Windows/win.ini", "PSI-98--PSI-98_experimental.csv", "not-registered"])
def test_download_cannot_be_a_path_or_cross_source(client, identifier):
    assert client.get("/api/v1/sources/PSI-25/download", params={"artifact": identifier}).status_code == 404


def test_version_gate_and_documentation_csp(client):
    assert client.get("/api/v1/coverage", headers={"X-Corpus-Version": "wrong"}).status_code == 409
    response = client.get("/docs")
    assert response.status_code == 200
    assert "cdn.jsdelivr.net" in response.headers["content-security-policy"]
    assert client.get("/api/v1/coverage").headers["content-security-policy"].startswith("default-src 'none'; frame")


def test_atlas_filter_semantics_and_coverage(client):
    result = client.get("/api/v1/experiments?q=B1&atlas_search=true&sort=id").json()
    assert result["total"] == 1
    assert result["items"][0]["experiment_id"] == "BASS2-B1"
    assert client.get("/api/v1/experiments?offset=100001").status_code == 422
    assert client.get("/api/v1/experiments?sort=bad").status_code == 422
    assert client.get("/api/v1/experiments?unsupported=value").status_code == 422
    result = client.get("/api/v1/coverage").json()["field_coverage"]
    assert result["gravity_regime"]["per_test_measured"] == 0
    assert result["gravity_regime"]["context_only"] == 131
    assert result["outcome"]["per_test_measured"] == 0
    pair = client.post("/api/v1/compare", json={"ids": ["SAFFIRE1-S1", "SAFFIRE1-S2"]}).json()
    assert next(f for f in pair["fields"] if f["field"] == "flow_direction")["outcome"] == "mismatched"
