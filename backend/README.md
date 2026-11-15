# FIRETRACE backend

Local-only FastAPI service for the FIRETRACE evidence workspace.

TRACE adds an optional server-side OpenAI interpretation endpoint at
`POST /api/v1/assistant/query`, disabled by default, and a deterministic calculation
endpoint at `POST /api/v1/assistant/calculate`. Install requirements-ai.txt for generation;
see [setup, evidence checks, privacy and limits](../docs/trace-assistant.md).

It has two layers:

| Layer | Prefix | Needs AI runtime? |
|---|---|---|
| Typed evidence API | `/api/v1` | No |
| Legacy local voice surface | `/api`, `/ws/voice` | Yes (optional) |

The evidence layer boots with FastAPI, Pydantic and the standard library only. If the optional
voice stack is not installed, booting still succeeds. TTS/audio-only requests return structured
`503 voice_unavailable`; text-only voice turns can return HTTP 200 with deterministic text and
null audio. History storage initializes independently of speech models. The evidence API is unaffected.

## What the evidence API does

- Serves the bundled 131-record corpus with per-field status and provenance.
- Exposes experiments, sources and a recomputed coverage report.
- Compares records on published tolerances and reports unknowns instead of a similarity score.
- Evaluates a requested scenario against the curated population and lists coverage gaps.
- Answers questions with validated, source-located claims, or abstains.
- Produces CSV and Markdown exports.
- Enforces a 1 MiB POST body cap, per-client rate limiting and local-origin CORS.
- Adds `X-Request-ID`, `X-Response-Time-Ms` and `X-Corpus-Version` to every response.

`corpus_version` is the SHA-256 of the raw `corpus.json` bytes. It is the only dataset identity
the API reports, and it is what ties an exported answer back to the exact data.

The contract is documented in `docs/data_dictionary.md` and at `/api/docs` when the service is
running.

## Run

### Evidence API only (recommended)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8000
```

```text
GET  /health/live
GET  /health/ready
GET  /api/v1/experiments
GET  /api/v1/coverage
POST /api/v1/compare
POST /api/v1/ask
POST /api/v1/scenarios/evaluate
POST /api/v1/exports
GET  /api/docs
```

### Combined app with the optional voice stack

```bash
pip install -r requirements-voice.txt
copy .env.example .env
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Voice model files are not committed. Provide your own local copies under `backend/models/`:

- `models/whisper/ggml-base.en.bin`
- `models/whisper.cpp/cpu/Release/whisper-server.exe` (+ DLLs)
- `models/vad/silero_vad.onnx`
- `models/tts/sherpa-ljs/{vits-ljs.onnx,lexicon.txt,tokens.txt}`

Ollama is optional. If enabled it may only re-word retrieved evidence; a numeric, source-id and
markdown guard rejects any output that introduces facts not present in the retrieved answer and
falls back to the deterministic text.

## Corpus index

The API prefers a persistent SQLite FTS5 index at `backend/index/corpus_fts.sqlite3`. It is used
only when its stored `corpus_version` matches the current corpus; otherwise the index is rebuilt
in memory for that process.

```bash
python scripts/build_index.py
```

The builder validates the corpus first and exits non-zero on any structural problem. It never
rewrites `src/data/corpus.json`.

## Tests

```bash
python -m pytest -q
```

The suite covers the HTTP contract, status vocabulary, null discipline, comparison outcomes,
scenario gaps, exports, assistant grounding and abstention, and booting without AI wheels.

## Configuration

`backend/.env.example` lists every supported variable with placeholders and documented defaults.
It contains no credentials.
