"""Scenario evaluation: applicability classes and honest coverage gaps."""
from __future__ import annotations

from app.v1 import policy

FORBIDDEN_KEYS = ("risk_score", "risk", "probability", "safe", "safety_score", "certification")


def _evaluate(client, **payload):
    response = client.post("/api/v1/scenarios/evaluate", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_pressure_request_reports_the_structural_gap(client):
    body = _evaluate(client, material="PMMA", oxygen_pct=30, pressure_psia=14.7)
    assert body["applicability"] in policy.APPLICABILITY_CLASSES
    gaps = " ".join(body["coverage_gaps"])
    assert "total-pressure" in gaps
    assert body["class_counts"].keys() == set(policy.APPLICABILITY_CLASSES)
    assert body["matching_policy"] == "matching-1.0"


def test_lunar_gravity_is_reported_as_not_covered(client):
    body = _evaluate(client, material="PMMA", gravity="lunar")
    gaps = " ".join(body["coverage_gaps"])
    assert "partial-gravity" in gaps
    assert "0 records" in gaps
    assert body["applicability"] != "Matched conditions"


def test_microgravity_request_matches_investigation_level_regime(client):
    body = _evaluate(client, material="PMMA", gravity="microgravity", oxygen_pct=21)
    assert body["applicability"] in policy.APPLICABILITY_CLASSES
    assert body["candidates"]
    gravity = next(
        condition
        for candidate in body["candidates"]
        for condition in candidate["conditions"]
        if condition["field"] == "gravity_regime"
    )
    assert "investigation level" in gravity["explanation"]


def test_unknown_material_has_no_applicable_record(client):
    body = _evaluate(client, material="unobtainium")
    assert body["applicability"] == "No applicable record"
    assert body["candidates"] == []
    assert "No curated record reports material" in " ".join(body["coverage_gaps"])


def test_oxygen_only_scenario_returns_candidates(client):
    body = _evaluate(client, oxygen_pct=21)
    assert body["candidates"]
    for candidate in body["candidates"]:
        assert candidate["source_id"]
        assert candidate["source_locator"]
        assert candidate["applicability"] in policy.APPLICABILITY_CLASSES
        assert candidate["conditions"]


def test_class_counts_cover_the_full_candidate_population(client):
    body = _evaluate(client, material="PMMA", oxygen_pct=21)
    assert body["population_size"] == 131
    assert body["candidate_count"] == 43
    assert len(body["candidates"]) <= 5
    assert sum(body["class_counts"].values()) == body["candidate_count"]


def test_no_fused_score_or_safety_percentage(client):
    response = client.post(
        "/api/v1/scenarios/evaluate",
        json={"material": "PMMA", "gravity": "microgravity", "oxygen_pct": 30},
    )
    body = response.json()
    for key in FORBIDDEN_KEYS:
        assert key not in body, key
    assert body["not_provided"]
    # The phrase may only appear in the explicit "we do not provide this" list.
    emitted = {key: value for key, value in body.items() if key != "not_provided"}
    assert not any("% safe" in str(value).lower() for value in emitted.values())
    assert any("% safe" in item.lower() for item in body["not_provided"])


def test_flow_alias_is_accepted(client):
    for payload in ({"flow": 5}, {"flow_cm_s": 5}, {"flow": 5.0, "material": "PMMA"}):
        body = _evaluate(client, **payload)
        assert body["requested"]["flow_cm_s"] == 5


def test_empty_scenario_is_422(client):
    response = client.post("/api/v1/scenarios/evaluate", json={})
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


def test_oxygen_out_of_range_is_422(client):
    response = client.post("/api/v1/scenarios/evaluate", json={"oxygen_pct": 150})
    assert response.status_code == 422
    assert "oxygen_pct" in response.json()["field_path"]


def test_pressure_out_of_range_is_422(client):
    response = client.post("/api/v1/scenarios/evaluate", json={"pressure_psia": 0})
    assert response.status_code == 422


def test_missing_conditions_are_never_filled(client):
    body = _evaluate(client, oxygen_pct=21, pressure_psia=14.7)
    for candidate in body["candidates"]:
        pressure = next(
            (
                condition
                for condition in candidate["conditions"]
                if condition["field"] == "total_pressure_psia"
            ),
            None,
        )
        assert pressure is not None
        assert pressure["record_value"] is None
        assert pressure["outcome"] == "unknown"