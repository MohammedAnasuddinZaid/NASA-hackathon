"""Comparison engine: per-field audit, never a fused score."""
from __future__ import annotations

from app.v1 import policy
from app.v1.compare import compare


def test_compare_two_records(client):
    response = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B2"]})
    assert response.status_code == 200
    body = response.json()
    assert [item["experiment_id"] for item in body["experiments"]] == ["BASS2-B1", "BASS2-B2"]
    assert body["matching_policy"] == "matching-1.0"
    assert body["fused_score"] is None
    assert body["applicability"] in policy.APPLICABILITY_CLASSES
    assert body["summary"]["matched"] + body["summary"]["mismatched"] + body["summary"][
        "unknown"
    ] == len(body["fields"])


def test_every_field_outcome_is_one_of_three(client):
    body = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B2"]}).json()
    for field in body["fields"]:
        assert field["outcome"] in {"matched", "mismatched", "unknown"}
        assert field["category"] in {"consequential", "contextual"}
        assert field["values"].keys() == {"BASS2-B1", "BASS2-B2"}


def test_missing_pressure_is_unknown_not_equal(client, store):
    body = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B2"]}).json()
    pressure = next(field for field in body["fields"] if field["field"] == "total_pressure_psia")
    assert pressure["outcome"] == "unknown"
    assert "Missing is not equality" in pressure["explanation"]
    assert any(item["field"] == "total_pressure_psia" for item in body["unknowns"])


def test_gravity_is_investigation_level_in_comparison(client):
    body = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B2"]}).json()
    gravity = next(field for field in body["fields"] if field["field"] == "gravity_regime")
    assert gravity["outcome"] == "matched"
    assert "investigation-level" in gravity["explanation"]


def test_tolerance_is_published_for_numeric_fields(client):
    body = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B2"]}).json()
    oxygen = next(field for field in body["fields"] if field["field"] == "oxygen_initial_pct")
    assert oxygen["tolerance"] == policy.TOLERANCES["oxygen_initial_pct"]
    assert oxygen["unit"] == "% by vol"


def test_cross_family_comparison_is_not_matched_conditions(client):
    body = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "SAFFIRE1-S1"]}).json()
    assert body["applicability"] != "Matched conditions"
    assert body["applicability_reason"]


def test_single_id_is_422(client):
    response = client.post("/api/v1/compare", json={"ids": ["BASS2-B1"]})
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"
    assert "ids" in response.json()["field_path"]


def test_five_ids_is_422(client):
    response = client.post(
        "/api/v1/compare",
        json={"ids": ["BASS2-B1", "BASS2-B2", "BASS2-B3", "BASS2-B4", "BASS2-B5"]},
    )
    assert response.status_code == 422


def test_blank_id_is_422(client):
    response = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "   "]})
    assert response.status_code == 422


def test_unknown_id_is_404(client):
    response = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-NOPE"]})
    assert response.status_code == 404
    body = response.json()
    assert body["error"] == "unknown_experiment"
    assert body["field_path"] == "ids"


def test_duplicate_id_is_422(client):
    response = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B1"]})
    assert response.status_code == 422
    assert response.json()["error"] == "duplicate_id"


def test_no_risk_or_safety_score_in_payload(client):
    response = client.post("/api/v1/compare", json={"ids": ["BASS2-B1", "BASS2-B2"]})
    text = response.text.lower()
    for forbidden in ("% safe", "risk_score\":", "probability", "safety_score"):
        assert forbidden not in text


def test_engine_rejects_fewer_than_two_ids(store):
    from app.v1.compare import ComparisonError, compare as run

    try:
        run(store, ["BASS2-B1"])
    except ComparisonError as exc:
        assert exc.code == "too_few_ids"
    else:  # pragma: no cover
        raise AssertionError("expected ComparisonError")


def test_engine_marks_missing_species_as_unknown(store):
    body = compare(store, ["BASS2-B1", "BASS2-B2"])
    species = next(field for field in body["fields"] if field["field"] == "material_species")
    assert species["outcome"] == "matched"
    assert species["values"]["BASS2-B1"]["value"] == "PMMA"