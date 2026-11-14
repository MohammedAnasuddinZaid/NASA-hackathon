"""FIRETRACE FastAPI application.

Two mount points:

* ``/api/v1/*`` — the typed, deterministic evidence API (``app.v1``). It has no
  optional runtime dependency and boots with no models installed.
* ``/api/*`` — the legacy voice surface (ASR, TTS, SSE, session history).

Every optional AI runtime (sherpa-onnx, onnxruntime, whisper.cpp, Ollama) is
imported lazily. When one is missing the voice endpoints report
``voice_unavailable`` with HTTP 503 instead of preventing the server from
starting.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app import database
from app.config import settings
from app.security import (
    ValidationError,
    clean_assistant_text,
    guard_user_text,
    is_local_origin,
    trim_for_call,
)
from app.v1.middleware import install_middleware
from app.v1.router import health_router, install_error_handlers, router as v1_router
from app.v1.store import get_store

logger = logging.getLogger("firetrace.voice")

_state: dict[str, Any] = {
    "engine": None,
    "voice_manager": None,
    "unavailable": None,
    "started": False,
}


class VoiceUnavailable(RuntimeError):
    """The optional local voice stack is not installed or failed to load."""


def voice_stack() -> tuple[Any, Any]:
    """Return ``(engine, voice_manager)``, loading the optional stack lazily."""
    if _state["engine"] is not None and _state["voice_manager"] is not None:
        return _state["engine"], _state["voice_manager"]
    if _state["unavailable"]:
        raise VoiceUnavailable(_state["unavailable"])
    try:
        from app import voice as voice_module
        from app.engine import VoiceEngine

        engine = VoiceEngine()
        manager = voice_module.VoiceManager(engine)
        _state["engine"] = engine
        _state["voice_manager"] = manager
        _state["unavailable"] = None
        return engine, manager
    except Exception as exc:  # ImportError or a model/runtime failure
        _state["unavailable"] = f"{type(exc).__name__}: {exc}"
        logger.warning("Voice stack unavailable: %s", _state["unavailable"])
        raise VoiceUnavailable(_state["unavailable"]) from exc


def voice_status() -> dict[str, Any]:
    if _state["engine"] is None and _state["unavailable"] is None:
        try:
            voice_stack()
        except VoiceUnavailable:
            pass
        except Exception:  # pragma: no cover - defensive
            pass
    if _state["unavailable"]:
        return {"available": False, "reason": _state["unavailable"]}
    engine = _state["engine"]
    manager = _state["voice_manager"]
    return {
        "available": True,
        "engine_loaded": engine is not None,
        "active_sessions": manager.active_count if manager else 0,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        engine, _manager = voice_stack()
        await engine.start()
        _state["started"] = True
    except Exception as exc:
        _state["unavailable"] = f"{type(exc).__name__}: {exc}"
        logger.warning("Running without voice features: %s", exc)
    yield
    engine = _state.get("engine")
    if engine is not None and _state.get("started"):
        try:
            await engine.shutdown()
        except Exception:  # pragma: no cover - shutdown best effort
            pass


app = FastAPI(
    title="FIRETRACE",
    description=(
        "Typed evidence API at /api/v1 plus the optional local voice surface at /api. "
        "Research-evidence support only: not NASA certification, not a fire-risk predictor, "
        "not emergency guidance."
    ),
    version=settings.version,
    lifespan=lifespan,
)

install_error_handlers(app, get_store)
app.include_router(v1_router, prefix="/api/v1")
app.include_router(health_router)
install_middleware(
    app,
    get_store,
    large_max_bytes=max(settings.max_audio_bytes, settings.max_request_bytes),
    large_prefixes=("/api/tts", "/api/voice"),
)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and not is_local_origin(origin):
        raise HTTPException(status_code=403, detail="Origin not allowed.")


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Request body is not valid JSON.") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")
    return payload


def _require_voice() -> tuple[Any, Any]:
    try:
        return voice_stack()
    except VoiceUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "voice_unavailable",
                "message": (
                    "The optional local voice stack is not installed or failed to load. "
                    "The evidence API at /api/v1 remains available."
                ),
                "reason": str(exc),
            },
        ) from exc


# --------------------------------------------------------------------------- #
# legacy voice + corpus routes
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health(refresh: bool = False):
    status = voice_status()
    if not status["available"]:
        return {
            "status": "degraded",
            "service": settings.service_name,
            "version": settings.version,
            "voice": status,
            "corpus_version": get_store().corpus_version,
        }
    engine, _manager = voice_stack()
    try:
        payload = engine.health(refresh=refresh)
    except Exception as exc:  # pragma: no cover - defensive
        return {
            "status": "degraded",
            "voice": {"available": False, "reason": str(exc)},
            "corpus_version": get_store().corpus_version,
        }
    if asyncio.iscoroutine(payload):
        return payload
    payload["voice"] = status
    payload["corpus_version"] = get_store().corpus_version
    return payload


@app.get("/api/status")
def status():
    payload = voice_status()
    payload["corpus_version"] = get_store().corpus_version
    return payload


@app.get("/api/corpus/summary")
def corpus_summary():
    from app.corpus import get_corpus

    return get_corpus().summary()


@app.get("/api/corpus/records")
def corpus_records(
    q: str = "",
    family: str = "",
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.corpus import get_corpus

    items, total = get_corpus().search_records(q, family, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/corpus/record/{experiment_id}")
def corpus_record(experiment_id: str):
    from app.corpus import get_corpus

    corpus = get_corpus()
    record = corpus.records_by_id.get(experiment_id.upper()) or corpus.alias.get(
        experiment_id.upper()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")
    return record


@app.post("/api/ask")
async def ask_route(request: Request):
    _check_origin(request)
    body = await _json_body(request)
    question = guard_user_text(str(body.get("question", "")), settings.max_question_chars)
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    from app.retrieval import answer_to_text, ask

    answer = ask(question)
    return {"answer": answer, "spoken": answer_to_text(answer)}


@app.post("/api/ask/stream")
async def ask_stream(request: Request):
    _check_origin(request)
    body = await _json_body(request)
    question = guard_user_text(str(body.get("question", "")), settings.max_question_chars)
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    from app.retrieval import answer_to_text, ask

    answer = ask(question)

    if voice_status().get("available"):
        engine, _manager = voice_stack()
    else:
        engine = None

    async def generator():
        yield "event: answer\ndata: " + json.dumps({"answer": answer}) + "\n\n"
        if engine is not None and settings.llm_enabled:
            from app.grounding import validate
            from app.llm import LLMError
            from app.prompts import system_prompt, user_prompt

            try:
                health_state = await engine.llm.health()
                if health_state.get("model_installed"):
                    messages = [
                        {"role": "system", "content": system_prompt()},
                        {"role": "user", "content": user_prompt(question, answer)},
                    ]
                    candidate_parts: list[str] = []
                    async for item in engine.llm.stream_chat(messages):
                        if item.get("delta"):
                            candidate_parts.append(item["delta"])
                            yield "event: delta\ndata: " + json.dumps({"delta": item["delta"]}) + "\n\n"
                        if item.get("done"):
                            candidate = "".join(candidate_parts).strip()
                            result = validate(candidate, answer)
                            if not result.ok:
                                yield "event: fallback\ndata: " + json.dumps(
                                    {"reason": result.reason, "text": answer_to_text(answer)}
                                ) + "\n\n"
                            else:
                                yield "event: done\ndata: " + json.dumps({"text": candidate}) + "\n\n"
                            return
            except LLMError as exc:
                yield "event: error\ndata: " + json.dumps(
                    {"code": exc.code, "message": str(exc)}
                ) + "\n\n"
        yield "event: done\ndata: " + json.dumps({"text": answer_to_text(answer)}) + "\n\n"

    return StreamingResponse(generator(), media_type="text/event-stream")


@app.post("/api/tts")
async def tts_route(request: Request):
    _check_origin(request)
    engine, _manager = _require_voice()
    body = await _json_body(request)
    text = guard_user_text(str(body.get("text", "")), settings.max_tts_chars)
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")
    try:
        result = await engine.tts.synthesize(text)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return Response(
        content=result.wav,
        media_type="audio/wav",
        headers={
            "X-Sample-Rate": str(result.sample_rate),
            "X-Duration-S": f"{result.duration_s:.3f}",
            "X-Gen-Ms": str(result.gen_ms),
        },
    )


@app.post("/api/voice/turn")
async def voice_turn(request: Request):
    """One-shot voice turn: text or base64 audio in, answer + wav out."""
    _check_origin(request)
    body = await _json_body(request)
    text = guard_user_text(str(body.get("text", "")), settings.max_question_chars)
    audio_b64 = body.get("audio_b64")
    samples = None
    if audio_b64 and not text:
        try:
            raw = base64.b64decode(audio_b64)
            import numpy as np

            samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid audio payload.")
    transcript = text
    if samples is not None and samples.size > 0:
        engine, _manager = _require_voice()
        try:
            asr_result = await engine.asr.transcribe(samples)
            transcript = (
                asr_result.get("text", "")
                if isinstance(asr_result, dict)
                else str(asr_result)
            )
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc))
    if not transcript:
        raise HTTPException(status_code=400, detail="No speech detected.")

    from app.retrieval import answer_to_text, ask

    answer = ask(transcript)
    spoken = answer_to_text(answer)
    llm_used = False
    if voice_status().get("available") and settings.llm_enabled:
        engine, _manager = voice_stack()
        from app.grounding import validate as _validate
        from app.prompts import system_prompt, user_prompt

        try:
            health_state = await engine.llm.health()
            if health_state.get("model_installed"):
                messages = [
                    {"role": "system", "content": system_prompt()},
                    {"role": "user", "content": user_prompt(transcript, answer)},
                ]
                candidate = await engine.llm.generate_once(messages)
                if _validate(candidate, answer).ok:
                    spoken = trim_for_call(
                        clean_assistant_text(candidate), max_sentences=3, max_words=95
                    ) or spoken
                    llm_used = True
        except Exception:
            pass
    wav_b64 = None
    if voice_status().get("available"):
        engine, _manager = voice_stack()
        try:
            result = await engine.tts.synthesize(spoken)
            wav_b64 = base64.b64encode(result.wav).decode("ascii")
        except Exception:
            wav_b64 = None
    return {
        "transcript": transcript,
        "answer": answer,
        "spoken": spoken,
        "llm_used": llm_used,
        "audio_b64": wav_b64,
        "voice_available": voice_status().get("available", False),
    }


@app.websocket("/ws/voice")
async def ws_voice(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if origin and not is_local_origin(origin):
        await websocket.close(code=4403)
        return
    try:
        _engine, manager = voice_stack()
    except VoiceUnavailable as exc:
        await websocket.accept()
        await websocket.send_json(
            {"type": "error", "code": "voice_unavailable", "message": str(exc), "fatal": True}
        )
        await websocket.close(code=1011)
        return
    await websocket.accept()
    session = None
    try:
        session = await manager.create_session(websocket)
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            if "bytes" in message and message["bytes"] is not None:
                await manager.handle_audio(session, message["bytes"])
                continue
            if "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    data = {"type": "text", "text": message["text"]}
                if not await manager.handle_control(session, data):
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        if session is not None:
            await session.send(
                {"type": "error", "code": "ws_error", "message": str(exc), "fatal": True}
            )
    finally:
        if session is not None:
            await manager.close_session(session)


@app.get("/api/history/sessions")
def history_sessions(limit: int = Query(50, ge=1, le=200)):
    return {"sessions": database.list_sessions(limit)}


@app.get("/api/history/session/{session_id}")
def history_session(session_id: str):
    return {"session_id": session_id, "turns": database.list_turns(session_id)}


# --------------------------------------------------------------------------- #
# error handling
# --------------------------------------------------------------------------- #
@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.code,
            "message": exc.message,
            "request_id": getattr(request.state, "request_id", None),
            "corpus_version": getattr(request.state, "corpus_version", None),
        },
    )
