"""The combined app must boot and serve evidence without any AI runtime."""
from __future__ import annotations

import sys

import pytest
from fastapi.testclient import TestClient

import main


def test_main_imports_without_optional_ai_wheels():
    # If sherpa-onnx / onnxruntime were imported eagerly this import would have
    # raised ModuleNotFoundError, so reaching here is the assertion.
    assert main.app is not None


def test_voice_stack_is_lazy_not_imported_at_module_load():
    assert "sherpa_onnx" not in sys.modules


def test_combined_app_serves_evidence_api_when_voice_is_absent():
    with TestClient(main.app) as client:
        draft = client.post(
            "/api/v1/ask", json={"question": "What oxygen did BASS2-B1 report?"}
        )
        assert draft.status_code == 200
        assert draft.json()["grade"] == "direct"


def test_health_reports_voice_status():
    with TestClient(main.app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        body = response.json()
        status = main.voice_status()
        if status["available"]:
            assert body["voice"]["available"] is True
        else:
            assert body["status"] == "degraded"
            assert body["voice"]["available"] is False
        assert body["corpus_version"]


def test_status_endpoint_explains_the_missing_runtime():
    if main.voice_status()["available"]:
        pytest.skip("voice stack available in this environment")
    with TestClient(main.app) as client:
        body = client.get("/api/status").json()
        assert body["available"] is False
        assert "reason" in body


def test_tts_returns_structured_503_not_a_crash():
    if main.voice_status()["available"]:
        pytest.skip("voice stack available in this environment")
    with TestClient(main.app) as client:
        response = client.post("/api/tts", json={"text": "hello"})
        assert response.status_code == 503
        body = response.json()
        assert body["error"] == "voice_unavailable"
        assert isinstance(body["message"], str)
        assert not body["message"].startswith("{")
        assert "evidence API" in body["message"]
        assert body["request_id"]
        assert body["corpus_version"]


def test_legacy_ask_still_answers_from_the_deterministic_engine():
    with TestClient(main.app) as client:
        response = client.post(
            "/api/ask", json={"question": "What pressure was BASS-II run at?"}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["answer"]["grade"] == "absent"
        assert body["spoken"]


def test_legacy_corpus_routes_still_work():
    with TestClient(main.app) as client:
        summary = client.get("/api/corpus/summary")
        assert summary.status_code == 200
        records = client.get("/api/corpus/records?limit=3")
        assert records.status_code == 200
        assert records.json()["total"] == 131


def test_websocket_reports_voice_unavailable_instead_of_hanging():
    if main.voice_status()["available"]:
        pytest.skip("voice stack available in this environment")
    with TestClient(main.app) as client:
        with client.websocket_connect("/ws/voice") as websocket:
            message = websocket.receive_json()
            assert message["type"] == "error"
            assert message["code"] == "voice_unavailable"
            assert message["fatal"] is True


def test_origin_check_rejects_public_origin_on_legacy_route():
    with TestClient(main.app) as client:
        response = client.post(
            "/api/ask",
            json={"question": "What is missing from the corpus?"},
            headers={"Origin": "https://evil.example.com"},
        )
        assert response.status_code == 403


def test_legacy_request_body_cap_is_larger_than_evidence_cap():
    # The voice path carries base64 audio, so it must not be capped at 1 MiB.
    from app.config import settings

    assert settings.max_audio_bytes > settings.max_request_bytes