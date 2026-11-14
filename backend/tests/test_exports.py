"""Export shapes and null discipline."""
from __future__ import annotations

import csv
import io


def _export(client, **payload):
    response = client.post("/api/v1/exports", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_records_csv_shape(client, store):
    body = _export(client, kind="records_csv", limit=1000)
    assert body["kind"] == "records_csv"
    assert body["content_type"].startswith("text/csv")
    assert body["row_count"] == 131
    assert body["filename"].endswith(".csv")
    assert body["corpus_version"] == store.corpus_version
    rows = list(csv.DictReader(io.StringIO(body["content"])))
    assert len(rows) == 131
    assert rows[0]["experiment_id"] == "BASS2-B1"


def test_records_csv_keeps_missing_values_empty_with_status(client):
    body = _export(client, kind="records_csv", limit=1000)
    rows = {row["experiment_id"]: row for row in csv.DictReader(io.StringIO(body["content"]))}
    row = rows["BASS2-B1"]
    assert row["total_pressure_psia_value"] == ""
    assert row["total_pressure_psia_status"] == "not_reported"
    assert row["total_pressure_psia_unit"] == "psia"
    assert row["oxygen_initial_pct_value"] == "22.2"
    assert row["oxygen_initial_pct_status"] == "measured"
    assert row["gravity_regime_status"] == "investigation_level"


def test_records_csv_limit_and_family(client):
    body = _export(client, kind="records_csv", family="Saffire-I", limit=10)
    rows = list(csv.DictReader(io.StringIO(body["content"])))
    assert len(rows) == 2
    assert {row["family"] for row in rows} == {"Saffire-I"}


def test_records_csv_rejects_unknown_ids(client):
    response = client.post(
        "/api/v1/exports", json={"kind": "records_csv", "ids": ["BASS2-NOPE"]}
    )
    assert response.status_code == 422
    assert response.json()["error"] == "unknown_experiment"


def test_records_csv_resolves_aliases_before_filtering(client):
    body = _export(client, kind="records_csv", ids=["B1"])
    rows = list(csv.DictReader(io.StringIO(body["content"])))
    assert body["row_count"] == 1
    assert [row["experiment_id"] for row in rows] == ["BASS2-B1"]


def test_claims_csv_shape(client):
    body = _export(client, kind="claims_csv")
    assert body["kind"] == "claims_csv"
    assert body["row_count"] == 12
    rows = list(csv.DictReader(io.StringIO(body["content"])))
    assert len(rows) == 12
    for row in rows:
        assert row["claim_id"]
        assert row["claim_text"]
        assert row["supporting_locators"]


def test_evidence_brief_for_records(client):
    body = _export(client, kind="evidence_brief", ids=["BASS2-B1"])
    assert body["kind"] == "evidence_brief"
    content = body["content"]
    assert "# FIRETRACE evidence brief" in content
    assert body["corpus_version"] in content
    assert "research-evidence support only" in content
    assert "BASS2-B1" in content
    assert "CSV row 2" in content
    assert "Null discipline" in content


def test_evidence_brief_for_question_uses_validated_answer(client):
    body = _export(
        client, kind="evidence_brief", question="What oxygen did BASS2-B1 report?"
    )
    content = body["content"]
    assert "## Answer" in content
    assert "22.2" in content
    assert "PSI-25" in content
    assert "% safe" not in content.lower()


def test_evidence_brief_for_family(client):
    body = _export(client, kind="evidence_brief", family="Saffire-I")
    assert "Family filter: Saffire-I" in body["content"]
    assert "Records matched: 2" in body["content"]


def test_evidence_brief_requires_a_selector(client):
    response = client.post("/api/v1/exports", json={"kind": "evidence_brief"})
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "validation_error"
    assert body["field_path"] == "body.ids"


def test_unknown_export_kind_is_422(client):
    response = client.post("/api/v1/exports", json={"kind": "pdf"})
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


def test_export_limit_bounds_are_enforced(client):
    assert client.post("/api/v1/exports", json={"kind": "records_csv", "limit": 0}).status_code == 422
    assert client.post("/api/v1/exports", json={"kind": "records_csv", "limit": 5000}).status_code == 422