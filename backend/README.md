# FIRETRACE backend

Local-only, production-grade backend for the FIRETRACE evidence workspace.

## What it does

- Serves the bundled 131-record corpus over HTTP.
- Runs the deterministic retrieval engine (`/api/ask`, `/api/ask/stream`).
- Provides local text-to-speech (`/api/tts`) and a full voice turn (`/api/voice/turn`,
  `WS /ws/voice`) using whisper.cpp (ASR), Silero VAD, Ollama (optional LLM) and
  sherpa-onnx VITS (TTS).
- Persists sessions and turns in SQLite.
- Enforces local-only origins and rate limits.

The optional LLM may only re-word retrieved evidence. A numeric / source-id /
markdown guard rejects any output that introduces facts not present in the
retrieved answer and falls back to deterministic text.

## Run

```bash
cd backend
py -3.10 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Model files are not committed. Copy them from a CareSpeak checkout or run your own
setup into `backend/models/`:

- `models/whisper/ggml-base.en.bin`
- `models/whisper.cpp/cpu/Release/whisper-server.exe` (+ DLLs)
- `models/vad/silero_vad.onnx`
- `models/tts/sherpa-ljs/{vits-ljs.onnx,lexicon.txt,tokens.txt}`

Ollama must be running with `qwen2.5:3b` (or set `OLLAMA_MODEL`).

## Tests

```bash
.venv\Scripts\python.exe -m pytest -q
```
