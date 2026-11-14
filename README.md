# FIRETRACE — Flame in Freefall evidence intelligence

FIRETRACE is an independent, offline-capable web application for the NASA Space Apps 2026
“Flame in Freefall” challenge. It turns public NASA Physical Sciences Informatics (PSI) microgravity
combustion experiment tables into a traceable evidence workspace: every record, measurement,
quality flag, source locator and limitation is visible, and the application refuses to answer
questions the sources cannot support.

The repository ships two runnable surfaces over one curated corpus:

- a **static Vite + React + TypeScript application** that bundles all evidence as JSON and works
  offline after a build;
- a **local FastAPI evidence API** in `backend/` that serves the same corpus with per-field
  provenance, claim validation and explicit abstention.

The optional TRACE endpoint can call OpenAI when explicitly enabled server-side; see
[TRACE setup and safeguards](docs/trace-assistant.md). Its default is deterministic with no
external model call. The evidence API boots with no Ollama, whisper.cpp or
sherpa-onnx installed; those are optional extras used only by the legacy local voice routes.

For combined local startup, install the existing backend requirements in `backend/.venv`, then
run `npm run dev:full`. Atlas/detail/source browsing and coverage use the local evidence API
when its corpus matches the bundle, with explicit complete bundled fallback otherwise.
See [the evidence foundation guide](docs/pr2-foundation.md) for setup, SQLite schema, source
downloads, tests and the user-approved adaptation to current main after PR #1 was merged externally.

## What it does

- **Overview** — a 45-second voiced explainer, corpus ledger, coverage counts and the central
  evidence gap.
- **Atmosphere Explorer** — Dalton-law oxygen partial-pressure calculator, reference atmospheres,
  the reported oxygen distribution, and an explicit “unknown pressure” placement for every record.
- **Evidence Atlas** — searchable, filterable table of all 131 records, with a provenance drawer.
- **Compare** — side-by-side comparison with a comparability audit that reports blockers instead
  of a similarity score.
- **Gap Planner** — target-condition evidence audit and a downloadable Markdown test plan.
- **Scenario retrieval** — condition-by-condition candidate explanations, documented heuristic
  ordering, persistent selections and linked Atlas/Compare inspection. See [scenario policy](docs/scenario-planner.md).
- **Evidence Assistant** — deterministic retrieval and citation engine with abstention.
- **Methodology & Sources** — pipeline rules, validation gates, anomalies, sources and licenses.
- **Exports** — CSV/JSON exports of records, claims and the source manifest.

## Corpus

| Investigation | PSI ID | Records | Material focus |
|---|---:|---:|---|
| BASS-II | PSI-25 | 129 | Solid fuels in low-velocity forced flow |
| Saffire-I | PSI-98 | 2 | SIBAL fabric samples |

Total: **131 experiment records**. Context only (not structured records): LUCI (NTRS 20250010653)
and the official challenge page.

## Current table coverage

The experimental tables report **oxygen fraction** and **flow** but contain **no total-pressure
column** and **no per-test gravity value**. FIRETRACE therefore reports:

- total pressure: **0 of 131 records**
- measured per-test gravity: **0 of 131 records**
- standardized ignition/extinction outcome: **0 of 131 records**
- ignition method: **0 of 131 records**

Missing values are preserved as unknown. They are never zero-filled, imputed or converted into a
score.

## Requirements

- Node.js 20 or newer (web app)
- Python 3.10 or newer (evidence API, tests, evaluation, ingestion)
- A modern browser

## Quick start

**Web app** — one command, no backend required:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Assistant page calls the evidence API first and falls back to
the bundled deterministic engine when the API is not running.

On Windows, `run-local.bat` (or `run-local.ps1`) starts the evidence API and the Vite dev
server together. It uses `backend\.venv` when present and otherwise falls back to `python` on
`PATH`.

**Evidence API** — one command after installing the core requirements:

```bash
cd backend
pip install -r requirements.txt
uvicorn api:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/api/docs` for the OpenAPI console. This entry point has no AI runtime
dependency and does not touch the voice stack.

**Combined app** (evidence API plus the optional local voice routes):

```bash
cd backend
pip install -r requirements-voice.txt   # optional AI wheels
uvicorn main:app --host 127.0.0.1 --port 8000
```

If the voice wheels or models are absent, `/api/v1` keeps working and the voice routes return a
structured `503 voice_unavailable`.

## Production build

```bash
npm run build
npm run preview
```

The static output is written to `dist/`. Serve it over HTTP using the preview command.

## Backend and voice agent

`backend/` contains two layers:

- `/api/v1/*` — the typed evidence API documented in `docs/data_dictionary.md` and
  `backend/app/v1/`. It exposes experiments, sources, coverage, comparison, scenario evaluation,
  grounded answers and exports. Every response carries `X-Corpus-Version`, `X-Request-ID` and
  `X-Response-Time-Ms`.
- `/api/*` — the legacy local voice surface (whisper.cpp ASR, Silero VAD, optional Ollama
  rewording, sherpa-onnx TTS, SSE, SQLite session history). It is optional and degrades to
  `voice_unavailable`.

See `backend/README.md` for model setup.

## Design

The interface uses a three-color system — black `#0B0B0C`, white `#FFFFFF` and lime `#C6F432` —
with Manrope for display type and Inter for body copy. The overview explainer is voiced by five
recorded narration clips in `public/audio/`; if the browser blocks unmuted autoplay, the player
shows a **Sound on** prompt and starts narration on the first click.

## Tests

```bash
npm test                                    # Vitest unit tests
npm run build                               # type-check + production build
npm run benchmark                           # 30-question local assistant benchmark

cd backend
python -m pytest -q                         # evidence API contract and policy suite
cd ..
python eval/run_eval.py                     # 30-question grounding check
```

Verified in this workspace: 89 Vitest tests, `npm run build`, 30/30 benchmark questions,
155 backend pytest tests, and `eval/run_eval.py` with 0 integrity problems. The Playwright
suite in `e2e/` is present but could not run in this environment because the OS
application-control policy blocks the Playwright Chromium binary; no pass result is claimed
for it here.

`eval/run_eval.py` reports retrieval hit@5 and abstention accuracy as `null` with `0/30`
labelled items, because the shipped question set has no gold answers. It does not estimate
them.

## Re-running the data pipeline

```bash
npm run ingest
```

This uses `python pipeline/ingest.py` and rewrites `src/data/corpus.json`, mirrors it to
`public/data/`, and refreshes `data/processed/validation_report.json`.

## Project layout

```text
src/
  components/      shell, charts, drawer, UI primitives
  data/            bundled corpus and source manifest
  lib/             types, corpus, atmosphere, records, compare, gap, assistant, apiClient, export, router
  pages/           eight routed pages
  styles.css       design system
backend/
  api.py           standalone evidence API (no AI runtime)
  main.py          combined evidence + optional voice app
  app/v1/          typed API: policy, store, schemas, router, compare, scenario, assistant, exports
  scripts/         corpus validation and FTS index builder
  tests/           pytest contract, grounding and policy suite
pipeline/          Python ingestion and validation
eval/              question set and honest evaluation runner
tests/             Vitest unit tests
e2e/               Playwright end-to-end tests (blocked by this machine's application policy)
docs/              methodology, data dictionary, sources, limitations, demo, Q&A, deployment
presentation/      screenshots and pitch deck
scripts/           capture and benchmark scripts
```

## Scientific policy

- No measurement, source, citation, benchmark result, deployment or NASA endorsement is fabricated.
- Missing data remains unknown; no zero-filling and no imputation.
- BASS-II, Saffire-I, LUCI and the challenge page are kept distinct.
- No risk score, fire-risk prediction or material certification. Scenario retrieval uses
  explicitly documented heuristic points with missingness shown separately; these are not
  physical measurements, probabilities or scientific confidence.
- Every assistant answer cites its source locator and abstains when unsupported.

## Deployment

The web application is a static Vite build and works offline after the first load because all
evidence is bundled. The evidence API is a separate local service; it is not required for the
static build and is not deployed by it. See `docs/deployment.md`.

## License and provenance

Source artifacts are preserved under their published licenses (PSI data is CC0 1.0 Universal).
FIRETRACE is an independent project and is not affiliated with, endorsed by or certified by NASA.
See `docs/data_sources.md` and `docs/methodology.md`.

Current correctness milestone and remaining work: see `docs/work-plan.md`.

## Scientific traceability validation

The table-coverage gaps above do not imply NASA never measured pressure or studied outcomes.
The BASS-II Summary Report provides pressure/ignition context for subsets; no row mapping is inferred.
See [scientific audit](docs/scientific-audit.md), [data dictionary](docs/data-dictionary.md) and
[source verification](docs/source-verification.json).

```bash
python -m venv .venv
# Windows: .venv/Scripts/Activate.ps1 (or use .venv/Scripts/python.exe directly)
# POSIX: source .venv/bin/activate
python -m pip install -r pipeline/requirements.txt
npm run ingest
npm run validate:data
```

Validation is offline and regenerates in temporary directories; two runs must be byte-identical.
The static explorer does not require the optional upstream voice backend. This PR does not change
or introduce that backend. No lint command is configured; production build includes TypeScript checking.
