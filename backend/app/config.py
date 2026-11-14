"""FIRETRACE backend configuration.

Everything is local by default: the corpus is bundled with the repository and
every model runtime (Ollama, whisper.cpp, Silero VAD, sherpa-onnx) is expected
to run on this machine. No cloud key, billing account or telemetry is used.

Environment is loaded from ``backend/.env`` and then the repository ``.env``
(without overriding an already-set variable). Both files are git-ignored.
"""
from __future__ import annotations

import os
import socket
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent

for candidate in (BACKEND_DIR / ".env", PROJECT_DIR / ".env"):
    if candidate.exists():
        load_dotenv(candidate, override=False)


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value is not None else default


def _int_env(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(_env(name, str(default)))
    except ValueError:
        return default


def _bool_env(name: str, default: bool) -> bool:
    return _env(name, "1" if default else "0").lower() in {"1", "true", "yes", "on"}


def _lan_ip() -> str:
    """Best-effort private LAN address; no packet is actually sent."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.2)
        sock.connect(("10.255.255.255", 1))
        value = sock.getsockname()[0]
        sock.close()
        if value and not value.startswith("127."):
            return value
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            value = info[4][0]
            if value and not value.startswith("127."):
                return value
    except OSError:
        pass
    return "127.0.0.1"


@dataclass(frozen=True)
class Settings:
    base_dir: Path = BACKEND_DIR
    project_dir: Path = PROJECT_DIR
    data_dir: Path = BACKEND_DIR / "data"
    models_dir: Path = Path(_env("FIRETRACE_MODELS_DIR", str(BACKEND_DIR / "models")))
    logs_dir: Path = BACKEND_DIR / "logs"
    runtime_dir: Path = BACKEND_DIR / "runtime"

    host: str = _env("FIRETRACE_HOST", "127.0.0.1")
    port: int = _int_env("FIRETRACE_PORT", 8000)
    version: str = "1.0.0"
    service_name: str = "FIRETRACE Grounded Voice"

    # The bundled corpus is the single source of truth. Override only if the
    # pipeline output lives elsewhere.
    corpus_path: Path = Path(
        _env("FIRETRACE_CORPUS", str(PROJECT_DIR / "src" / "data" / "corpus.json"))
    )
    manifest_path: Path = Path(
        _env(
            "FIRETRACE_MANIFEST",
            str(PROJECT_DIR / "src" / "data" / "source_manifest.json"),
        )
    )
    validation_path: Path = Path(
        _env(
            "FIRETRACE_VALIDATION",
            str(PROJECT_DIR / "src" / "data" / "validation_report.json"),
        )
    )
    db_path: Path = Path(
        _env("FIRETRACE_DB_PATH", str(BACKEND_DIR / "data" / "firetrace.db"))
    )

    # --- local language model (Ollama) ---------------------------------
    ollama_url: str = _env("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    ollama_model: str = _env("OLLAMA_MODEL", "qwen2.5:3b")
    ollama_timeout_s: float = _float_env("OLLAMA_TIMEOUT_S", 120.0)
    ollama_keep_alive: str = _env("OLLAMA_KEEP_ALIVE", "30m")
    ollama_num_ctx: int = _int_env("OLLAMA_NUM_CTX", 4096)
    ollama_num_predict: int = _int_env("OLLAMA_NUM_PREDICT", 140)
    ollama_temperature: float = _float_env("OLLAMA_TEMPERATURE", 0.15)
    llm_warmup: bool = _bool_env("FIRETRACE_LLM_WARMUP", True)
    # When false the backend stays fully deterministic even if Ollama is up.
    llm_enabled: bool = _bool_env("FIRETRACE_LLM_ENABLED", True)

    # --- speech to text (whisper.cpp server) ---------------------------
    whisper_mode: str = _env("WHISPER_MODE", "server")  # server | cli
    whisper_model: Path = Path(
        _env(
            "WHISPER_MODEL",
            str(Path(_env("FIRETRACE_MODELS_DIR", str(BACKEND_DIR / "models")))
                / "whisper" / "ggml-base.en.bin"),
        )
    )
    whisper_binary_override: str = _env("WHISPER_BINARY", "")
    whisper_language: str = _env("WHISPER_LANGUAGE", "en")
    whisper_threads: int = _int_env(
        "WHISPER_THREADS", max(2, (os.cpu_count() or 8) // 2)
    )
    whisper_server_host: str = _env("WHISPER_SERVER_HOST", "127.0.0.1")
    whisper_server_port: int = _int_env("WHISPER_SERVER_PORT", 8178)
    whisper_timeout_s: float = _float_env("WHISPER_TIMEOUT_S", 90.0)
    whisper_auto_start: bool = _bool_env("WHISPER_AUTO_START", True)

    # --- text to speech (sherpa-onnx VITS LJSpeech) --------------------
    tts_engine: str = _env("TTS_ENGINE", "sherpa")
    tts_threads: int = _int_env("TTS_THREADS", 4)
    tts_speed: float = _float_env("TTS_SPEED", 1.0)
    tts_max_sentence_chars: int = _int_env("TTS_MAX_SENTENCE_CHARS", 220)
    sherpa_tts_dir: Path = Path(
        _env(
            "SHERPA_TTS_DIR",
            str(Path(_env("FIRETRACE_MODELS_DIR", str(BACKEND_DIR / "models")))
                / "tts" / "sherpa-ljs"),
        )
    )

    # --- voice activity detection (Silero VAD v5 ONNX) -----------------
    vad_model: Path = Path(
        _env(
            "VAD_MODEL",
            str(Path(_env("FIRETRACE_MODELS_DIR", str(BACKEND_DIR / "models")))
                / "vad" / "silero_vad.onnx"),
        )
    )
    vad_threshold: float = _float_env("VAD_THRESHOLD", 0.55)
    vad_silence_ms: int = _int_env("VAD_SILENCE_MS", 850)
    vad_min_speech_ms: int = _int_env("VAD_MIN_SPEECH_MS", 260)
    vad_barge_in_ms: int = _int_env("VAD_BARGE_IN_MS", 160)
    vad_preroll_ms: int = _int_env("VAD_PREROLL_MS", 400)
    vad_max_utterance_ms: int = _int_env("VAD_MAX_UTTERANCE_MS", 30_000)

    # --- HTTP / WebSocket surface --------------------------------------
    allowed_origins: List[str] = field(
        default_factory=lambda: [
            item.strip()
            for item in _env(
                "FIRETRACE_ALLOWED_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,"
                "http://localhost:4173,http://127.0.0.1:4173,"
                "http://localhost:3000,http://127.0.0.1:3000",
            ).split(",")
            if item.strip()
        ]
    )
    # Localhost + RFC1918 LAN only. A public origin can never pass this regex
    # unless an operator explicitly overrides it.
    allowed_origin_regex: str = _env(
        "FIRETRACE_ALLOWED_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d{1,5})?$",
    )
    allow_null_origin: bool = _bool_env("FIRETRACE_ALLOW_NULL_ORIGIN", True)
    max_question_chars: int = _int_env("FIRETRACE_MAX_QUESTION_CHARS", 500)
    max_tts_chars: int = _int_env("FIRETRACE_MAX_TTS_CHARS", 1_500)
    max_audio_bytes: int = _int_env("FIRETRACE_MAX_AUDIO_BYTES", 16 * 1024 * 1024)
    max_request_bytes: int = _int_env("FIRETRACE_MAX_REQUEST_BYTES", 20 * 1024 * 1024)
    rate_limit_per_minute: int = _int_env("FIRETRACE_RATE_LIMIT_PER_MINUTE", 90)
    rate_limit_burst: int = _int_env("FIRETRACE_RATE_LIMIT_BURST", 30)
    health_cache_seconds: float = _float_env("FIRETRACE_HEALTH_CACHE_S", 8.0)

    # --- voice session limits ------------------------------------------
    max_active_sessions: int = _int_env("FIRETRACE_MAX_SESSIONS", 4)
    max_turns: int = _int_env("FIRETRACE_MAX_TURNS", 40)
    max_session_minutes: int = _int_env("FIRETRACE_MAX_SESSION_MINUTES", 30)
    store_transcripts: bool = _bool_env("FIRETRACE_STORE_TRANSCRIPTS", True)
    log_transcripts: bool = _bool_env("FIRETRACE_LOG_TRANSCRIPTS", False)
    barge_in: bool = _bool_env("FIRETRACE_BARGE_IN", True)
    lan_ip: str = field(default_factory=_lan_ip)

    # --- model paths ----------------------------------------------------
    @property
    def sherpa_model_path(self) -> Path:
        return self.sherpa_tts_dir / "vits-ljs.onnx"

    @property
    def sherpa_lexicon_path(self) -> Path:
        return self.sherpa_tts_dir / "lexicon.txt"

    @property
    def sherpa_tokens_path(self) -> Path:
        return self.sherpa_tts_dir / "tokens.txt"

    @property
    def whisper_log_path(self) -> Path:
        return self.logs_dir / "whisper-server.log"

    @property
    def whisper_pid_path(self) -> Path:
        return self.runtime_dir / "whisper.pid"

    def whisper_binary(self) -> Path:
        candidates: list[Path] = []
        if self.whisper_binary_override:
            candidates.append(Path(self.whisper_binary_override))
        candidates.extend(
            [
                self.models_dir / "whisper.cpp" / "cpu" / "Release" / "whisper-server.exe",
                self.models_dir / "whisper.cpp" / "cuda" / "Release" / "whisper-server.exe",
                self.models_dir / "whisper.cpp" / "whisper-server.exe",
            ]
        )
        for candidate in candidates:
            if candidate.exists():
                return candidate
        found = _which("whisper-server")
        if found:
            return Path(found)
        return candidates[0]

    @property
    def engine_is_sherpa(self) -> bool:
        return self.tts_engine.strip().lower() == "sherpa"

    def ensure_dirs(self) -> None:
        for path in (
            self.data_dir,
            self.logs_dir,
            self.models_dir,
            self.runtime_dir,
            self.db_path.parent,
        ):
            path.mkdir(parents=True, exist_ok=True)


def _which(name: str) -> str | None:
    import shutil

    return shutil.which(name)


settings = Settings()
