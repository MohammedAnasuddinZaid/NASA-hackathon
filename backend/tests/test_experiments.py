"""Experiment listing, filtering, pagination and record detail."""
from __future__ import annotations

from app.v1 import policy


def test_list_default_page(client):
    response = client.get("/api/v1/experiments")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 131
    assert len(body["items"]) == 25
    assert body["limit"] == 25 and body["offset"] == 0
    assert body["corpus_version"] == response.headers["x-corpus-version"]


def test_pagination_window_is_stable(client):
    first = client.get("/api/v1/experiments?limit=5&offset=0").json()
    second = client.get("/api/v1/experiments?limit=5&offset=5").json()
    assert [item["experiment_id"] for item in first["items"]] == [
        "BASS2-B1",
        "BASS2-B2",
        "BASS2-B3",
        "BASS2-B4",
        "BASS2-B5",
    ]
    assert first["items"][0]["experiment_id"] != second["items"][0]["experiment_id"]
    assert second["offset"] == 5


def test_family_filter(client):
    body = client.get("/api/v1/experiments?family=Saffire-I").json()
    assert body["total"] == 2
    assert {item["family"] for item in body["items"]} == {"Saffire-I"}


def test_material_filter_matches_species_text(client):
    body = client.get("/api/v1/experiments?material=pmma&limit=200").json()
    assert body["total"] > 0
    for item in body["items"]:
        haystack = " ".join(
            str(item.get(key) or "")
            for key in ("material_raw", "material_family", "material_species")
        ).lower()
        assert "pmma" in haystack


def test_validation_status_filter(client):
    body = client.get("/api/v1/experiments?validation_status=suspect&limit=200").json()
    assert body["total"] == 4
    assert all(item["validation_status"] == "suspect" for item in body["items"])


def test_oxygen_range_filter_excludes_unreported(client):
    body = client.get("/api/v1/experiments?min_o2=30&max_o2=100&limit=200").json()
    for item in body["items"]:
        oxygen = item.get("oxygen_initial_pct") or {}
        assert oxygen.get("status") in policy.VALUE_BEARING_STATUSES
        assert float(oxygen["value"]) >= 30


def test_inverted_oxygen_range_is_422_with_field_path(client):
    response = client.get("/api/v1/experiments?min_o2=40&max_o2=10")
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "validation_error"
    assert body["field_path"] == "query.min_o2"


def test_out_of_domain_query_parameter_is_422(client):
    response = client.get("/api/v1/experiments?min_o2=101")
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


def test_text_query_with_no_match_returns_empty_page_not_error(client):
    response = client.get("/api/v1/experiments?q=zzzzz-no-such-material")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_flow_only_filter(client):
    body = client.get("/api/v1/experiments?flow_only=true&limit=200").json()
    assert body["total"] > 0
    for item in body["items"]:
        flow = item.get("flow_initial_cm_s") or {}
        assert flow.get("value") is not None


def test_record_detail_has_statuses_and_locator(client):
    response = client.get("/api/v1/experiments/BASS2-B1")
    assert response.status_code == 200
    body = response.json()
    assert body["experiment_id"] == "BASS2-B1"
    assert body["source_id"] == "PSI-25"
    assert "CSV row 2" in body["source_locator"]
    for field, payload in body["fields"].items():
        assert payload["status"] in policy.VALUE_STATUSES, field
    oxygen = body["fields"]["oxygen_initial_pct"]
    assert oxygen["value"] == 22.2
    assert oxygen["unit"] == "% by vol"
    assert oxygen["status"] == "corrected"


def test_record_detail_pressure_is_null_not_zero(client):
    body = client.get("/api/v1/experiments/BASS2-B1").json()
    pressure = body["fields"]["total_pressure_psia"]
    assert pressure["value"] is None
    assert pressure["status"] == "not_reported"
    assert pressure["unit"] == "psia"


def test_record_alias_by_test_number_resolves(client):
    response = client.get("/api/v1/experiments/B1")
    assert response.status_code == 200
    assert response.json()["experiment_id"] == "BASS2-B1"


def test_unknown_record_is_404(client):
    response = client.get("/api/v1/experiments/BASS2-NOPE")
    assert response.status_code == 404
    body = response.json()
    assert body["error"] == "not_found"
    assert body["field_path"] == "path.experiment_id"


def test_source_detail(client):
    response = client.get("/api/v1/sources/PSI-25")
    assert response.status_code == 200
    body = response.json()
    assert body["source_id"] == "PSI-25"
    assert body["doi"] == "10.60555/4qc4-de67"
    assert body["license"].startswith("Creative Commons Zero")
    assert body["experiment_count"] == 129
    assert len(body["artifacts"]) >= 1
    assert body["limitations"]


def test_context_source_resolves(client):
    body = client.get("/api/v1/sources/NTRS-20250010653").json()
    assert body["source_id"] == "NTRS-20250010653"
    assert body["artifacts"]


def test_unknown_source_is_404(client):
    response = client.get("/api/v1/sources/NOPE-1")
    assert response.status_code == 404
    assert response.json()["error"] == "not_found"


def test_source_lookup_is_case_insensitive_and_keeps_records(client):
    response = client.get("/api/v1/sources/psi-25")
    assert response.status_code == 200
    body = response.json()
    assert body["source_id"] == "PSI-25"
    assert body["experiment_count"] == 129
    assert "BASS2-B1" in body["experiment_ids"]


def test_unknown_validation_status_filter_is_422(client):
    response = client.get("/api/v1/experiments?validation_status=bogus")
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "validation_error"
    assert body["field_path"] == "query.validation_status"


def test_coverage_recomputes_and_matches_declared_meta(client):
    body = client.get("/api/v1/coverage").json()
    assert body["record_count"] == 131
    assert body["family_counts"] == {"BASS-II": 129, "Saffire-I": 2}
    recomputed = body["recomputed"]
    assert recomputed["pressure_reported"] == 0
    assert recomputed["gravity_per_record_reported"] == 0
    assert recomputed["standardized_outcome_reported"] == 0
    assert body["declared_matches_recomputed"]
    assert all(body["declared_matches_recomputed"].values())
    assert body["gaps"]


def test_coverage_field_counts_are_internally_consistent(client):
    body = client.get("/api/v1/coverage").json()
    total = body["record_count"]
    for field, summary in body["field_coverage"].items():
        assert summary["reported"] + summary["missing"] == total, field
        assert sum(summary["statuses"].values()) == total, field
        # Numeric quantities must publish their unit; categorical fields
        # (flow_direction, gravity_regime, outcome) legitimately have none.
        if summary["reported"] and field in policy.TOLERANCES:
            assert summary["units"], field