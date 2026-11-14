"""WebSocket voice session manager for FIRETRACE.

Adapted from the CareSpeak VoiceLink turn loop, but scoped to a single
browser-facing agent: no telephony, no patient directory. Every answer still
flows through the deterministic retrieval engine and the grounding guard.
"""
from __future__ import annotations

import asyncio
import base64
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np

from app import database
from app.asr import wav_bytes_from_float
from app.config import settings
from app.engine import VoiceEngine
from app.grounding import validate
from app.llm import LLMError
from app.prompts import system_prompt, user_prompt
from app.retrieval import answer_to_text, ask
from app.security import (
    clean_assistant_text,
    guard_user_text,
    is_local_origin,
    trim_for_call,
)
from app.tts import StreamingTTSChunker, split_sentences
from app.vad import PushToTalkBuffer, VADStream

SAMPLE_RATE = 16000


@dataclass
class VoiceSession:
    session_id: str
    websocket: Any
    vad: Optional[VADStream]
    created_at: float = field(default_factory=time.time)
    started_monotonic: float = field(default_factory=time.monotonic)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    turn_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    history: list[dict[str, str]] = field(default_factory=list)
    metrics: list[dict[str, Any]] = field(default_factory=list)
    turn_count: int = 0
    cancel_event: Optional[asyncio.Event] = None
    current_turn_id: Optional[str] = None
    current_task: Optional[asyncio.Task] = None
    ptt: PushToTalkBuffer = field(default_factory=PushToTalkBuffer)
    ptt_active: bool = False
    agent_speaking: bool = False
    audio_seq: int = 0
    closed: bool = False
    ended: bool = False

    async def send(self, event: dict[str, Any]) -> bool:
        if self.closed:
            return False
        try:
            async with self.send_lock:
                await self.websocket.send_json(event)
            return True
        except Exception:
            self.closed = True
            return False


class VoiceManager:
    def __init__(self, engine: VoiceEngine) -> None:
        self.engine = engine
        self.sessions: dict[str, VoiceSession] = {}
        self._lock = asyncio.Lock()

    @property
    def active_count(self) -> int:
        return len([s for s in self.sessions.values() if not s.ended])

    async def create_session(self, websocket: Any, session_id: Optional[str] = None) -> VoiceSession:
        async with self._lock:
            if self.active_count >= settings.max_active_sessions:
                raise RuntimeError("Voice session capacity reached.")
            sid = session_id or "vs_" + uuid.uuid4().hex[:10]
            vad = None
            try:
                vad = self.engine.new_vad_stream()
            except Exception:
                vad = None
            session = VoiceSession(session_id=sid, websocket=websocket, vad=vad)
            self.sessions[sid] = session
        await database.create_session(sid, caller="browser", callee="firetrace", demo_mode=False, meta={"vad": vad is not None})
        await session.send(
            {
                "type": "hello",
                "session_id": sid,
                "service": settings.service_name,
                "capabilities": {
                    "vad": vad is not None,
                    "push_to_talk": True,
                    "text_fallback": True,
                    "barge_in": settings.barge_in,
                },
                "limits": {"max_turns": settings.max_turns, "max_minutes": settings.max_session_minutes},
            }
        )
        return session

    async def close_session(self, session: VoiceSession) -> None:
        session.ended = True
        session.closed = True
        if session.current_task is not None and not session.current_task.done():
            session.current_task.cancel()
        try:
            await database.end_session(session.session_id)
        except Exception:
            pass
        self.sessions.pop(session.session_id, None)

    async def handle_audio(self, session: VoiceSession, frame: bytes) -> None:
        if session.ended or session.closed:
            return
        try:
            pcm = np.frombuffer(frame, dtype="<i2").astype(np.float32) / 32768.0
        except Exception:
            return
        if pcm.size == 0:
            return

        if session.ptt_active:
            session.ptt.append(pcm)
            return

        vad = session.vad
        if vad is None:
            return

        events = vad.feed(pcm, agent_speaking=session.agent_speaking)
        for event in events:
            if event["type"] == "speech_start":
                if session.agent_speaking and settings.barge_in:
                    await self._interrupt(session, reason="barge_in")
                await session.send({"type": "vad", "event": "speech_start", "barge_in": bool(event.get("barge_in"))})
            elif event["type"] == "speech_end":
                samples = event.get("samples")
                if isinstance(samples, np.ndarray) and samples.size > 0:
                    await session.send({"type": "vad", "event": "speech_end", "duration_ms": event.get("duration_ms")})
                    self._schedule_turn(session, samples, input_kind="speech")

    def _schedule_turn(self, session: VoiceSession, samples, input_kind: str) -> None:
        if session.current_task is not None and not session.current_task.done():
            # queue by cancelling? For simplicity, drop overlapping utterance
            return
        session.current_task = asyncio.create_task(self._run_turn(session, samples=samples, text=None, input_kind=input_kind))

    async def handle_control(self, session: VoiceSession, message: dict[str, Any]) -> bool:
        kind = str(message.get("type", "")).strip().lower()
        if kind in ("ping",):
            await session.send({"type": "pong", "t": time.time()})
            return True
        if kind in ("interrupt", "stop"):
            await self._interrupt(session, reason="user")
            return True
        if kind in ("ptt_start", "push_to_talk_start"):
            session.ptt.start()
            session.ptt_active = True
            await session.send({"type": "vad", "event": "ptt_start"})
            return True
        if kind in ("ptt_stop", "push_to_talk_stop"):
            session.ptt_active = False
            samples = session.ptt.finish()
            if isinstance(samples, np.ndarray) and samples.size > 0:
                self._schedule_turn(session, samples, input_kind="ptt")
            await session.send({"type": "vad", "event": "ptt_stop"})
            return True
        if kind in ("text", "ask"):
            text = guard_user_text(str(message.get("text", "")), settings.max_question_chars)
            if text:
                self._schedule_turn(session, None, input_kind="text", text=text) if False else None
                session.current_task = asyncio.create_task(self._run_turn(session, samples=None, text=text, input_kind="text"))
            return True
        if kind in ("end", "close", "hangup"):
            await self.close_session(session)
            return False
        return True

    async def _interrupt(self, session: VoiceSession, reason: str = "interrupted") -> None:
        if session.cancel_event is not None:
            session.cancel_event.set()
        if session.current_task is not None and not session.current_task.done():
            session.current_task.cancel()
        session.agent_speaking = False
        await session.send({"type": "interrupted", "reason": reason})

    async def _run_turn(
        self,
        session: VoiceSession,
        *,
        samples: Optional[np.ndarray],
        text: Optional[str],
        input_kind: str,
    ) -> None:
        turn_id = "turn_" + uuid.uuid4().hex[:8]
        session.current_turn_id = turn_id
        session.cancel_event = asyncio.Event()
        cancel_event = session.cancel_event
        metrics: dict[str, Any] = {
            "turn_id": turn_id,
            "input": input_kind,
            "asr_ms": None,
            "llm_ms": None,
            "tts_ms": 0,
            "grounded": True,
        }
        started = time.perf_counter()
        session.agent_speaking = False

        async with session.turn_lock:
            try:
                # 1. ASR
                transcript_text = (text or "").strip()
                if samples is not None and samples.size > 0:
                    t0 = time.perf_counter()
                    try:
                        transcript_text = await self.engine.asr.transcribe(samples)
                    except Exception as exc:
                        transcript_text = ""
                        await session.send({"type": "error", "code": "asr_error", "message": str(exc), "fatal": False})
                    metrics["asr_ms"] = int((time.perf_counter() - t0) * 1000)
                    await session.send({"type": "transcript", "turn_id": turn_id, "role": "user", "text": transcript_text, "final": True})

                if cancel_event.is_set():
                    await self._finalize_turn(session, turn_id, "", metrics, interrupted=True)
                    return

                if not transcript_text:
                    # nothing to answer
                    await session.send({"type": "assistant", "turn_id": turn_id, "text": "I didn't catch that. Please try again.", "final": True})
                    await self._finalize_turn(session, turn_id, "I didn't catch that. Please try again.", metrics, interrupted=False)
                    return

                # 2. Retrieval (deterministic, source of truth)
                answer = ask(transcript_text)
                grade = answer.get("grade")

                # 3. Optional LLM verbalization (guarded)
                spoken = self._deterministic_spoken(answer)
                llm_used = False
                llm_ok = False
                if settings.llm_enabled:
                    t0 = time.perf_counter()
                    try:
                        health = await self.engine.llm.health()
                        if health.get("model_installed"):
                            messages = [
                                {"role": "system", "content": system_prompt()},
                                {"role": "user", "content": user_prompt(transcript_text, answer)},
                            ]
                            candidate = await self.engine.llm.generate_once(messages)
                            metrics["llm_ms"] = int((time.perf_counter() - t0) * 1000)
                            result = validate(candidate, answer)
                            if result.ok:
                                spoken = trim_for_call(clean_assistant_text(candidate), max_sentences=3, max_words=95)
                                llm_used = True
                                llm_ok = True
                            else:
                                metrics["grounded"] = False
                                metrics["grounding_reason"] = result.reason
                                metrics["grounding_offending"] = list(result.offending)
                    except (LLMError, Exception) as exc:
                        metrics["llm_error"] = str(exc)

                # 4. Send assistant text
                await session.send({"type": "assistant_delta", "turn_id": turn_id, "delta": spoken})
                await session.send({"type": "assistant", "turn_id": turn_id, "role": "assistant", "text": spoken, "answer": answer, "final": True, "grade": grade, "llm_used": llm_used})

                # 5. TTS
                session.agent_speaking = True
                tts_started = time.perf_counter()
                total_seconds = 0.0
                try:
                    for sentence in split_sentences(spoken):
                        if cancel_event.is_set():
                            break
                        try:
                            res = await self.engine.tts.synthesize(sentence)
                        except Exception as exc:
                            await session.send({"type": "error", "code": "tts_error", "message": str(exc), "fatal": False})
                            break
                        if cancel_event.is_set():
                            break
                        self.audio_seq += 1
                        session.audio_seq = self.audio_seq
                        b64 = base64.b64encode(res.wav).decode("ascii")
                        await session.send(
                            {
                                "type": "audio",
                                "turn_id": turn_id,
                                "seq": self.audio_seq,
                                "data": b64,
                                "sample_rate": res.sample_rate,
                                "duration_s": res.duration_s,
                                "text": res.text,
                            }
                        )
                        total_seconds += res.duration_s
                    metrics["tts_ms"] = int((time.perf_counter() - tts_started) * 1000)
                finally:
                    session.agent_speaking = False

                interrupted = cancel_event.is_set()
                await session.send(
                    {
                        "type": "assistant_end",
                        "turn_id": turn_id,
                        "text": spoken,
                        "interrupted": interrupted,
                        "metrics": metrics,
                    }
                )

                # persist
                try:
                    await asyncio.to_thread(
                        database.record_turn,
                        turn_id=turn_id,
                        session_id=session.session_id,
                        role="user",
                        text=transcript_text,
                        input_kind=input_kind,
                        answer=None,
                    )
                    await asyncio.to_thread(
                        database.record_turn,
                        turn_id=turn_id + "_a",
                        session_id=session.session_id,
                        role="assistant",
                        text=spoken,
                        input_kind=input_kind,
                        answer=answer,
                        spoken=spoken,
                        grade=grade,
                        metrics=metrics,
                    )
                except Exception:
                    pass

                session.history.append({"role": "user", "text": transcript_text})
                session.history.append({"role": "assistant", "text": spoken})
                session.history = session.history[-24:]
                session.turn_count += 1
                session.metrics.append(metrics)
                await session.send({"type": "metrics", **metrics})
            except asyncio.CancelledError:
                await session.send({"type": "interrupted", "turn_id": turn_id, "reason": "cancelled"})
            except Exception as exc:
                await session.send({"type": "error", "code": "turn_error", "message": str(exc), "fatal": False})
            finally:
                session.current_turn_id = None
                session.current_task = None
                session.cancel_event = None

    def _deterministic_spoken(self, answer: dict[str, Any]) -> str:
        headline = answer.get("headline") or ""
        paragraphs = " ".join(answer.get("paragraphs") or [])
        bullets = " ".join(answer.get("bullets") or [])
        text = f"{headline} {paragraphs} {bullets}".strip()
        return trim_for_call(clean_assistant_text(text), max_sentences=3, max_words=95) or headline


# (PushToTalkBuffer.finish is provided by vad.py)
