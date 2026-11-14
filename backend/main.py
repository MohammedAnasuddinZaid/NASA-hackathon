"""FastAPI application for the FIRETRACE grounded voice backend."""
from __future__ import annotations

import asyncio
import base64
import json
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app import database, voice as voice_module
from app.config import settings
from app.engine import VoiceEngine
from app.grounding import validate
from app.llm import LLMError
from app.prompts import system_prompt, user_prompt
from app.retrieval import answer_to_text, ask
from app.security import (
    ValidationError,
    clean_assistant_text,
    guard_user_text,
    is_local_origin,
    trim_for_call,
)
from app.tts import normalize_for_speech

engine = VoiceEngine()
voice_manager = voice_module.VoiceManager(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await engine.start()
    yield
    await engine.shutdown()


app = FastAPI(
    title="FIRETRACE Grounded Voice",
    version=settings.version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


_rate_state: dict[str, list[float]] = {}


def _rate_limit(request: Request) -> None:
    ip = _client_ip(request)
    now = time.time()
    window = _rate_state.setdefault(ip, [])
    window[:] = [t for t in window if now - t < 60.0]
    if len(window) >= settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")
    window.append(now)


def _check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and not is_local_origin(origin):
        raise HTTPException(status_code=403, detail="Origin not allowed.")


# --------------------------------------------------------------------------- #
# routes
# --------------------------------------------------------------------------- #
@app.get("/api/health")
async def health(refresh: bool = False):
    return await engine.health(refresh=refresh)


@app.get("/api/status")
async def status():
    return engine.status(voice_manager.active_count)


@app.get("/api/corpus/summary")
async def corpus_summary():
    from app.corpus import get_corpus

    corpus = get_corpus()
    return corpus.summary()


@app.get("/api/corpus/records")
async def corpus_records(
    q: str = "",
    family: str = "",
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    from app.corpus import get_corpus

    corpus = get_corpus()
    items, total = corpus.search_records(q, family, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/corpus/record/{experiment_id}")
async def corpus_record(experiment_id: str):
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
    _rate_limit(request)
    body = await request.json()
    question = guard_user_text(str(body.get("question", "")), settings.max_question_chars)
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    answer = ask(question)
    spoken = answer_to_text(answer)
    return {"answer": answer, "spoken": spoken}


@app.post("/api/ask/stream")
async def ask_stream(request: Request):
    _check_origin(request)
    _rate_limit(request)
    body = await request.json()
    question = guard_user_text(str(body.get("question", "")), settings.max_question_chars)
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    answer = ask(question)

    async def generator():
        yield "event: answer\ndata: " + json.dumps({"answer": answer}) + "\n\n"
        if settings.llm_enabled:
            try:
                health = await engine.llm.health()
                if health.get("model_installed"):
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
                yield "event: error\ndata: " + json.dumps({"code": exc.code, "message": str(exc)}) + "\n\n"
        yield "event: done\ndata: " + json.dumps({"text": answer_to_text(answer)}) + "\n\n"

    return StreamingResponse(generator(), media_type="text/event-stream")


@app.post("/api/tts")
async def tts_route(request: Request):
    _check_origin(request)
    _rate_limit(request)
    body = await request.json()
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
    _rate_limit(request)
    body = await request.json()
    text = guard_user_text(str(body.get("text", "")), settings.max_question_chars)
    audio_b64 = body.get("audio_b64")
    samples = None
    if audio_b64 and not text:
        try:
            raw = base64.b64decode(audio_b64)
            import numpy as np

            pcm = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
            samples = pcm
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid audio payload.")
    transcript = text
    if samples is not None and samples.size > 0:
        try:
            transcript = await engine.asr.transcribe(samples)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc))
    if not transcript:
        raise HTTPException(status_code=400, detail="No speech detected.")
    answer = ask(transcript)
    spoken = answer_to_text(answer)
    # optional LLM
    llm_used = False
    if settings.llm_enabled:
        try:
            health = await engine.llm.health()
            if health.get("model_installed"):
                messages = [
                    {"role": "system", "content": system_prompt()},
                    {"role": "user", "content": user_prompt(transcript, answer)},
                ]
                candidate = await engine.llm.generate_once(messages)
                from app.grounding import validate as _validate

                if _validate(candidate, answer).ok:
                    spoken = trim_for_call(
                        clean_assistant_text(candidate), max_sentences=3, max_words=95
                    ) or spoken
                    llm_used = True
        except Exception:
            pass
    # TTS
    wav_b64 = None
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
    }


@app.websocket("/ws/voice")
async def ws_voice(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if origin and not is_local_origin(origin):
        await websocket.close(code=4403)
        return
    await websocket.accept()
    session = None
    try:
        session = await voice_manager.create_session(websocket)
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            if "bytes" in message and message["bytes"] is not None:
                await voice_manager.handle_audio(session, message["bytes"])
                continue
            if "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    data = {"type": "text", "text": message["text"]}
                ok = await voice_manager.handle_control(session, data)
                if not ok:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        if session is not None:
            await session.send({"type": "error", "code": "ws_error", "message": str(exc), "fatal": True})
    finally:
        if session is not None:
            await voice_manager.close_session(session)


@app.get("/api/history/sessions")
async def history_sessions(limit: int = Query(50, ge=1, le=200)):
    return {"sessions": await asyncio.to_thread(database.list_sessions, limit)}


@app.get("/api/history/session/{session_id}")
async def history_session(session_id: str):
    turns = await asyncio.to_thread(database.list_turns, session_id)
    return {"session_id": session_id, "turns": turns}


# --------------------------------------------------------------------------- #
# error handling
# --------------------------------------------------------------------------- #
@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.code, "message": exc.message})
