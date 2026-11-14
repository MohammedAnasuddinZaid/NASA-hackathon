from dataclasses import replace
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import pytest
from fastapi.testclient import TestClient
from backend.evidence.config import Settings
from backend.evidence.ingest import import_dataset, load_inputs
from backend.evidence.main import create_app
from backend.evidence.store import connect


@pytest.fixture
def settings(tmp_path):
    return Settings(database=tmp_path / "evidence.sqlite3")


@pytest.fixture
def client(settings):
    import_dataset(settings)
    with TestClient(create_app(settings)) as client:
        yield client


def test_reproducible_idempotent_import(settings):
    first = import_dataset(settings)
    with connect(settings.database) as c:
        rows = [tuple(row) for row in c.execute("SELECT * FROM experiments ORDER BY experiment_id")]
    assert import_dataset(settings) == first
    with connect(settings.database) as c:
        assert rows == [tuple(row) for row in c.execute("SELECT * FROM experiments ORDER BY experiment_id")]
        assert c.execute("PRAGMA foreign_key_check").fetchall() == []
    assert first["records"] == 131


def test_every_record_roundtrips_without_scientific_changes(settings):
    import_dataset(settings)
    corpus = load_inputs(settings.data_dir)[1][0]
    with connect(settings.database) as c:
        actual = {row[0]: json.loads(row[1]) for row in c.execute("SELECT experiment_id,payload FROM experiments")}
    for record in corpus["records"]:
        assert actual[record["experiment_id"]] == record
    b1 = actual["BASS2-B1"]
    assert b1["co_initial_ppm"]["value"] == 0
    assert b1["total_pressure_psia"]["value"] is None
    assert b1["gravity_regime"]["status"] == "investigation_level"
    assert actual["SAFFIRE1-S1"]["thickness_mm"]["unit"] == "mm"
    assert actual["SAFFIRE1-S1"]["oxygen_initial_pct"]["status"] == "reported_qualitative"
    assert "approximate" in actual["SAFFIRE1-S1"]["oxygen_initial_pct"]["note"]


@pytest.mark.parametrize("mutation", ["duplicate", "missing", "source", "count", "manifest", "nan", "raw", "claim"])
def test_invalid_import_preserves_previous_database(settings, tmp_path, mutation):
    before = import_dataset(settings)
    data = tmp_path / "inputs"
    shutil.copytree(settings.data_dir, data)
    path = data / "corpus.json"
    corpus = json.loads(path.read_text(encoding="utf-8"))
    if mutation == "duplicate": corpus["records"][1]["experiment_id"] = corpus["records"][0]["experiment_id"]
    if mutation == "missing": corpus["records"][0]["total_pressure_psia"]["value"] = 0
    if mutation == "source": corpus["records"][0]["source_id"] = "unregistered"
    if mutation == "count": corpus["meta"]["record_count"] = 1
    if mutation == "manifest": corpus["sources"][0]["sha256"] = "0" * 64
    if mutation == "nan": corpus["records"][0]["oxygen_initial_pct"]["value"] = float("nan")
    if mutation == "raw": corpus["records"][0]["raw"]["PI"] = "altered"
    if mutation == "claim": corpus["claims"].append(corpus["claims"][0])
    path.write_text(json.dumps(corpus), encoding="utf-8")
    with pytest.raises((ValueError, sqlite3.IntegrityError)): import_dataset(replace(settings, data_dir=data))
    with connect(settings.database) as conn:
        assert conn.execute("SELECT fingerprint FROM dataset").fetchone()[0] == before["dataset_id"]
        assert conn.execute("SELECT count(*) FROM experiments").fetchone()[0] == 131
    assert import_dataset(settings) == before


def test_original_hash_gate(settings, tmp_path):
    raw = tmp_path / "raw"
    raw.mkdir()
    with pytest.raises(ValueError, match="integrity"): import_dataset(replace(settings, raw_dir=raw))
    assert not settings.database.exists()


def test_optional_future_metadata_and_corrected_status_are_preserved(settings, tmp_path):
    data = tmp_path / "future-inputs"
    shutil.copytree(settings.data_dir, data)
    path = data / "corpus.json"
    corpus = json.loads(path.read_text(encoding="utf-8"))
    corpus["records"][0]["oxygen_initial_pct"]["status"] = "corrected"
    corpus["records"][0]["measurements"][0]["note"] = "Preserved optional metadata"
    path.write_text(json.dumps(corpus), encoding="utf-8")
    import_dataset(replace(settings, data_dir=data))
    with connect(settings.database) as conn:
        record = json.loads(conn.execute("SELECT payload FROM experiments WHERE experiment_id='BASS2-B1'").fetchone()[0])
    assert record["oxygen_initial_pct"]["status"] == "corrected"
    assert record["measurements"][0]["note"] == "Preserved optional metadata"


def test_health_and_openapi(client):
    assert client.get("/api/v1/health").json()["records"] == 131
    assert "/api/v1/experiments" in client.get("/openapi.json").json()["paths"]
    assert client.get("/docs").status_code == 200


@pytest.mark.parametrize("query,count", [("q=B1", 1), ("q=BASS2-B1", 1), ("investigation=Saffire-I", 2), ("material=SIBAL%20fabric", 29), ("source_id=PSI-98", 2), ("o2_min=99", 0), ("q=%27%20OR%201=1", 0)])
def test_search(client, query, count):
    response = client.get("/api/v1/experiments?" + query)
    assert response.status_code == 200, response.text
    assert response.json()["total"] == count


def test_pagination_sort_and_filters(client):
    first = client.get("/api/v1/experiments?limit=2").json()
    second = client.get("/api/v1/experiments?limit=2&offset=2").json()
    assert first["total"] == 131
    assert [r["experiment_id"] for r in first["items"]] == ["BASS2-B1", "BASS2-B2"]
    assert not set(r["experiment_id"] for r in first["items"]) & set(r["experiment_id"] for r in second["items"])
    result = client.get("/api/v1/experiments?flow_only=true&flow_min=20&o2_max=22&sort=o2-desc&limit=100").json()
    assert all(r["flow_initial_cm_s"]["value"] >= 20 and r["oxygen_initial_pct"]["value"] <= 22 for r in result["items"])


@pytest.mark.parametrize("query", ["limit=101", "offset=-1", "sort=DROP", "unknown=x", "o2_min=30&o2_max=10", "o2_min=NaN", "q=" + "a"*201, "quality=certified"])
def test_invalid_search(client, query):
    result = client.get("/api/v1/experiments?" + query)
    assert result.status_code == 422
    assert result.json()["error"]["code"] == "invalid_request"


def test_detail_and_missing(client):
    record = client.get("/api/v1/experiments/BASS2-B1").json()
    assert "CSV row 2" in record["source_locator"]
    assert record["oxygen_initial_pct"]["raw"] == "22.2"
    assert client.get("/api/v1/experiments/NOT-FOUND").status_code == 404
    assert client.get("/api/v1/experiments/invalid%20id").status_code == 422


def test_coverage_statuses_are_not_inferred(client):
    result = client.get("/api/v1/coverage").json()
    assert result["total"] == sum(result["investigations"].values()) == 131
    assert result["fields"]["total_pressure_psia"]["missing"] == 131
    assert result["fields"]["gravity_regime"]["statuses"] == {"investigation_level": 131}
    assert result["fields"]["gravity_regime"]["per_test_measured"] == 0
    assert result["fields"]["gravity_regime"]["context_only"] == 131
    assert result["fields"]["outcome"]["per_test_measured"] == 0
    assert result["fields"]["flow_derived_cm_s"]["statuses"]["derived"] > 0
    assert result["fields"]["oxygen_initial_pct"]["statuses"]["reported_qualitative"] == 2


def test_source_registry_downloads(client, settings):
    items = client.get("/api/v1/sources/PSI-25").json()["items"]
    source = next(s for s in items if s["role"] == "experiment_table")
    assert source["download_available"]
    result = client.get(source["download_url"])
    assert hashlib.sha256(result.content).hexdigest() == source["sha256"]
    assert result.headers["x-content-type-options"] == "nosniff"
    assert str(settings.raw_dir) not in json.dumps(items)
    assert client.get("/api/v1/sources/NONE").status_code == 404
    context = client.get("/api/v1/sources/NTRS-20250010653").json()["items"]
    assert not any(s["download_available"] for s in context)


@pytest.mark.parametrize("artifact", ["../../.env", "C:/Windows/win.ini", "PSI-98--PSI-98_experimental.csv", "unregistered"])
def test_download_rejects_paths_and_cross_source(client, artifact):
    assert client.get("/api/v1/sources/PSI-25/download", params={"artifact_id": artifact}).status_code == 404


def test_comparison_abstains_and_distinguishes_conditions(client):
    result = client.post("/api/v1/compare", json={"experiment_ids": ["BASS2-B1", "SAFFIRE1-S1"]})
    assert result.status_code == 200, result.text
    data = result.json()
    checks = {c["id"]: c for c in data["checks"]}
    assert checks["total_pressure_psia"]["state"] == "unknown"
    assert checks["gravity_regime"]["state"] == "unknown"
    assert checks["outcome"]["state"] == "unknown"
    assert checks["family"]["state"] == "blocked"
    assert checks["thickness_mm"]["state"] == "blocked"
    assert "total_pressure_psia" in data["missing_measurements"]["BASS2-B1"]
    assert data["citations"][0]["locator"].endswith("test B1")
    assert "probability" not in data
    saffire = client.post("/api/v1/compare", json={"experiment_ids": ["SAFFIRE1-S1", "SAFFIRE1-S2"]}).json()
    assert next(c for c in saffire["checks"] if c["id"] == "flow_direction")["state"] == "blocked"


@pytest.mark.parametrize("body", [{"experiment_ids": []}, {"experiment_ids": ["BASS2-B1"]*2}, {"experiment_ids": ["x"]*5}, {"experiment_ids": ["../file"]}, {"experiment_ids": ["BASS2-B1"], "risk": True}])
def test_invalid_comparison(client, body):
    assert client.post("/api/v1/compare", json=body).status_code == 422


def test_malformed_missing_large_and_dataset_mismatch(client):
    assert client.post("/api/v1/compare", content="{", headers={"Content-Type": "application/json"}).status_code == 422
    assert client.post("/api/v1/compare", json={"experiment_ids": ["not-found"]}).status_code == 404
    assert client.post("/api/v1/compare", content="x"*9000).status_code == 413
    assert client.get("/api/v1/coverage", headers={"X-Firetrace-Dataset": "wrong"}).status_code == 409
    assert client.get("/api/v1/passages").json()["items"] == []


def test_cors_and_unexpected_error(client, settings):
    allowed = client.options("/api/v1/coverage", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    actual = client.get("/api/v1/coverage", headers={"Origin": "http://localhost:5173"})
    assert "X-Firetrace-Dataset" in actual.headers["access-control-expose-headers"]
    denied = client.get("/api/v1/coverage", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in denied.headers
    missing = TestClient(create_app(replace(settings, database=settings.database.parent / "missing.db")))
    result = missing.get("/api/v1/health")
    assert result.status_code == 503
    assert str(settings.database.parent) not in result.text
