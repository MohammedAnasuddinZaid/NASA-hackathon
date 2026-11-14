"""HTTP contract: provenance headers, status codes, size cap, rate limit, readiness."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from app.config import settings
from app.v1.middleware import limiter
from app.v1.router import readiness


def _expected_version() -> str:
    return hashlib.sha256(Path(settings.corpus_path).read_bytes()).hexdigest()


def test_corpus_version_matches_corpus_file(client):
    expected = _expected_version()
    for method, path, kwargs in (
        ("get", "/health/live", {}),
        ("get", "/api/v1/experiments", {}),
        ("get", "/api/v1/coverage", {}),
        ("post", "/api/v1/ask", {"json": {"question": "What oxygen did BASS2-B1 report?"}}),
    ):
        response = getattr(client, method)(path, **kwargs)
        assert response.status_code == 200
        assert response.headers["x-corpus-version"] == expected
        assert response.json()["corpus_version"] == expected


def test_every_response_has_request_and_timing_headers(client):
    response = client.get("/api/v1/experiments")
    assert response.headers["x-request-id"]
    assert float(response.headers["x-response-time-ms"]) >= 0


def test_request_id_is_echoed(client):
    response = client.get("/api/v1/coverage", headers={"X-Request-ID": "test-request-1"})
    assert response.headers["x-request-id"] == "test-request-1"


def test_unsafe_request_id_is_replaced(client):
    response = client.get(
        "/api/v1/coverage", headers={"X-Request-ID": "bad id <script>"}
    )
    assert response.headers["x-request-id"] != "bad id <script>"
    assert len(response.headers["x-request-id"]) == 32


def test_security_headers_present(client):
    response = client.get("/health/live")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert response.headers["cache-control"] == "no-store"


def test_error_envelope_also_carries_provenance(client):
    response = client.get("/api/v1/experiments/DOES-NOT-EXIST")
    assert response.status_code == 404
    body = response.json()
    assert body["error"] == "not_found"
    assert body["field_path"] == "path.experiment_id"
    assert body["request_id"]
    assert body["corpus_version"] == _expected_version()
    assert response.headers["x-corpus-version"] == _expected_version()


def test_unknown_route_returns_json_envelope(client):
    response = client.get("/api/v1/not-a-route")
    assert response.status_code == 404
    assert response.json()["error"] == "not_found"


def test_malformed_json_returns_422_with_field_path(client):
    response = client.post(
        "/api/v1/ask",
        content=b'{"question": "unterminated',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "validation_error"
    assert body["field_path"] == "body"
    assert body["details"]


def test_body_over_one_megabyte_returns_413(client):
    payload = b'{"question": "' + b"a" * (1_200_000) + b'"}'
    response = client.post(
        "/api/v1/ask", content=payload, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert response.json()["error"] == "payload_too_large"
    assert response.headers["x-corpus-version"] == _expected_version()


def test_post_flood_returns_429_with_retry_after(client):
    limiter.reset()
    limiter.limit = 2
    try:
        first = client.post("/api/v1/ask", json={"question": "What is missing?"})
        second = client.post("/api/v1/ask", json={"question": "What is missing?"})
        third = client.post("/api/v1/ask", json={"question": "What is missing?"})
    finally:
        limiter.limit = 1000
        limiter.reset()
    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.headers["retry-after"].isdigit()
    assert third.json()["error"] == "rate_limited"


def test_get_requests_are_not_rate_limited(client):
    limiter.reset()
    limiter.limit = 1
    try:
        for _ in range(5):
            assert client.get("/api/v1/coverage").status_code == 200
    finally:
        limiter.limit = 1000
        limiter.reset()


def test_health_live(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["corpus_version"] == _expected_version()


def test_liveness_does_not_depend_on_corpus(client, monkeypatch):
    from app.v1 import router as router_module

    def unavailable():
        raise RuntimeError("corpus unavailable")

    monkeypatch.setattr(router_module, "get_store", unavailable)
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["corpus_version"] == "unavailable"


def test_readiness_flags_a_value_with_a_no_value_status(client, store, monkeypatch):
    payload = store.records[0]["oxygen_initial_pct"]
    monkeypatch.setitem(payload, "status", "not_reported")
    ok, checks, _loaded, _expected = readiness(store)
    assert ok is False
    null_check = next(check for check in checks if check["name"] == "null_discipline")
    assert null_check["ok"] is False
    assert "BASS2-B1.oxygen_initial_pct" in null_check["detail"]


def test_health_ready_ok(client, store):
    response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["record_count"] == body["expected_record_count"] == 131
    assert all(check["ok"] for check in body["checks"])


def test_health_ready_degrades_on_count_mismatch(client, store, monkeypatch):
    monkeypatch.setitem(store.meta, "record_count", 999)
    ok, checks, loaded, expected = readiness(store)
    assert ok is False
    assert loaded == 131 and expected == 999
    response = client.get("/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    failed = [check["name"] for check in body["checks"] if not check["ok"]]
    assert "record_count" in failed


def test_openapi_parses(client):
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "/api/v1/ask" in schema["paths"]
    assert "/api/v1/scenarios/evaluate" in schema["paths"]
    assert "/health/ready" in schema["paths"]


def test_cors_rejects_public_origin(client):
    response = client.options(
        "/api/v1/ask",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in {
        key.lower() for key in response.headers
    }


def test_cors_allows_localhost_origin(client):
    response = client.options(
        "/api/v1/ask",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
