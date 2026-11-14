"""Composition root for the local ASR, VAD, LLM and TTS engines."""
from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

from app import database
from app.asr import WhisperASR
from app.config import settings
from app.llm import OllamaClient
from app.tts import SherpaTTS
from app.vad import SileroVADModel

START_TIME = time.time()


class VoiceEngine:
    def __init__(self) -> None:
        self.asr = WhisperASR()
        self.tts = SherpaTTS()
        self.llm = OllamaClient()
        self.vad_model: Optional[SileroVADModel] = None
        self._vad_error: Optional[str] = None
        self._health_cache: tuple[float, dict] = (0.0, {})
        self._background: list[asyncio.Task] = []
        self._warm_status: dict[str, Any] = {}

    async def start(self) -> None:
        settings.ensure_dirs()
        await asyncio.to_thread(database.init_db)
        tts_task = asyncio.create_task(self.tts.load())
        vad_task = asyncio.create_task(self._load_vad())
        await asyncio.gather(tts_task, vad_task, return_exceptions=True)
        self._background.append(asyncio.create_task(self._warm_asr()))
        if settings.llm_warmup:
            self._background.append(asyncio.create_task(self._warm_llm()))

    async def _load_vad(self) -> None:
        try:
            self.vad_model = await asyncio.to_thread(SileroVADModel.load)
            self._vad_error = None
        except Exception as exc:
            self.vad_model = None
            self._vad_error = str(exc)

    async def _warm_asr(self) -> None:
        try:
            ok = await self.asr.warm()
            self._warm_status["asr"] = {"ok": ok, "error": self.asr._last_error}
        except Exception as exc:
            self._warm_status["asr"] = {"ok": False, "error": str(exc)}

    async def _warm_llm(self) -> None:
        result = await self.llm.warmup()
        self._warm_status["llm"] = result

    def new_vad_stream(self):
        if self.vad_model is None:
            raise RuntimeError(self._vad_error or "Silero VAD is unavailable.")
        return self.vad_model.new_stream()

    async def health(self, refresh: bool = False) -> dict:
        now = time.monotonic()
        if not refresh and now - self._health_cache[0] < settings.health_cache_seconds:
            return self._health_cache[1]

        llm_health, whisper_running, db_health = await asyncio.gather(
            self.llm.health(refresh=refresh),
            self.asr.server_healthy(refresh=True),
            asyncio.to_thread(database.healthcheck),
        )
        tts_health = self.tts.health()
        vad_ready = self.vad_model is not None
        checks = {
            "database": bool(db_health.get("ok")),
            "ollama": bool(llm_health.get("ok")),
            "llm_model": bool(llm_health.get("model_installed")),
            "whisper_model": self.asr.model_ready,
            "whisper_server": bool(whisper_running),
            "tts_model": tts_health.get("files_ready", False),
            "tts_engine": bool(
                tts_health.get("loaded") and tts_health.get("self_test_ms") is not None
            ),
            "vad_model": vad_ready,
        }
        core = [
            "database",
            "whisper_model",
            "whisper_server",
            "tts_model",
            "tts_engine",
            "vad_model",
        ]
        ready = all(checks[item] for item in core)
        degraded = any(checks.values()) and not ready
        status = "ready" if ready else ("degraded" if degraded else "unavailable")
        result = {
            "status": status,
            "checks": checks,
            "details": {
                "database": db_health,
                "ollama": llm_health,
                "whisper": self.asr.health(),
                "tts": tts_health,
                "vad": {
                    "loaded": vad_ready,
                    "model": str(settings.vad_model),
                    "error": self._vad_error,
                },
                "warmup": self._warm_status,
            },
            "checked_at": time.time(),
        }
        self._health_cache = (now, result)
        return result

    def status(self, active_sessions: int) -> dict:
        return {
            "service": settings.service_name,
            "version": settings.version,
            "local_only": True,
            "uptime_s": int(time.time() - START_TIME),
            "active_sessions": active_sessions,
            "max_active_sessions": settings.max_active_sessions,
            "lan_ip": settings.lan_ip,
            "backend": {"host": settings.host, "port": settings.port},
            "models": {
                "llm": {
                    "name": settings.ollama_model,
                    "license": "Apache-2.0 (Qwen2.5)",
                    "runtime": "Ollama (local)",
                },
                "asr": {
                    "name": "whisper.cpp ggml-base.en",
                    "license": "MIT",
                    "runtime": "whisper.cpp (local)",
                },
                "tts": {
                    "name": "sherpa-onnx VITS LJSpeech",
                    "license": "Apache-2.0",
                    "runtime": "sherpa-onnx (local)",
                },
                "vad": {
                    "name": "Silero VAD v5",
                    "license": "MIT",
                    "runtime": "ONNX Runtime (local)",
                },
            },
        }

    async def shutdown(self) -> None:
        for task in self._background:
            task.cancel()
        await self.asr.shutdown()
        await self.tts.shutdown()
        await self.llm.shutdown()
        self.vad_model = None
