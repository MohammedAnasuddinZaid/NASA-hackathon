# FIRETRACE — Flame in Freefall evidence intelligence

FIRETRACE is an independent, offline-capable web application for the NASA Space Apps 2026
“Flame in Freefall” challenge. It turns public NASA Physical Sciences Informatics (PSI) microgravity
combustion experiment tables into a traceable evidence workspace: every record, measurement,
quality flag, source locator and limitation is visible, and the application refuses to answer
questions the sources cannot support.

This repository is a static Vite + React + TypeScript application. It has no external AI/API
dependency, no database and no server-side runtime. All evidence is bundled as JSON and can be
used offline after a build.

## What it does

- **Overview** — a 45-second voiced explainer, corpus ledger, coverage counts and the central
  evidence gap.
- **Atmosphere Explorer** — Dalton-law oxygen partial-pressure calculator, reference atmospheres,
  the reported oxygen distribution, and an explicit “unknown pressure” placement for every record.
- **Evidence Atlas** — searchable, filterable table of all 131 records, with a provenance drawer.
- **Compare** — side-by-side comparison with a comparability audit that reports blockers instead
  of a similarity score.
- **Gap Planner** — target-condition evidence audit and a downloadable Markdown test plan.
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

## Central scientific finding

The experimental tables report **oxygen fraction** and **flow** but contain **no total-pressure
column** and **no per-test gravity value**. FIRETRACE therefore reports:

- total pressure: **0 of 131 records**
- measured per-test gravity: **0 of 131 records**
- standardized ignition/extinction outcome: **0 of 131 records**
- ignition method: **0 of 131 records**

Missing values are preserved as unknown. They are never zero-filled, imputed or converted into a
score.

## Requirements

- Node.js 20 or newer
- Python 3.10 or newer (only for re-running the ingestion pipeline)
- A modern browser

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The static output is written to `dist/`. It can be served from any static host or opened locally.

## Backend and voice agent

A production-grade local backend lives in `backend/`. It serves the corpus, runs the
deterministic retrieval engine, and provides a grounded voice agent (whisper.cpp ASR,
Silero VAD, Ollama LLM, sherpa-onnx TTS). See `backend/README.md`.

## Design

The interface uses a three-color system — black `#0B0B0C`, white `#FFFFFF` and lime `#C6F432` —
with Manrope for display type and Inter for body copy. The overview explainer is voiced by five
recorded narration clips in `public/audio/`; if the browser blocks unmuted autoplay, the player
shows a **Sound on** prompt and starts narration on the first click.

## Tests

```bash
npm test        # 80 Vitest unit tests
npm run e2e     # 18 Playwright end-to-end tests
npm run benchmark # 30-question assistant benchmark
```

The current repository state passes all 80 unit tests, all 16 end-to-end tests and the 30-question
assistant benchmark.

## Re-running the data pipeline

```bash
npm run ingest
```

This uses `py pipeline/ingest.py` and rewrites `src/data/corpus.json`, mirrors it to
`public/data/`, and refreshes `data/processed/validation_report.json`.

## Project layout

```text
src/
  components/      shell, charts, drawer, UI primitives
  data/            bundled corpus and source manifest
  lib/             types, corpus, atmosphere, records, compare, gap, assistant, export, router
  pages/           eight routed pages
  styles.css       design system
pipeline/          Python ingestion and validation
tests/             Vitest unit tests
e2e/               Playwright end-to-end tests
docs/              methodology, sources, limitations, demo, Q&A, deployment
presentation/      screenshots and pitch deck
scripts/           capture and benchmark scripts
```

## Scientific policy

- No measurement, source, citation, benchmark result, deployment or NASA endorsement is fabricated.
- Missing data remains unknown; no zero-filling and no imputation.
- BASS-II, Saffire-I, LUCI and the challenge page are kept distinct.
- No arbitrary risk/relevance score, no fire-risk prediction and no material certification.
- Every assistant answer cites its source locator and abstains when unsupported.

## Deployment

See `docs/deployment.md`. The application is a static Vite build and works offline after the first
load because all evidence is bundled. No secrets or paid services are required.

## License and provenance

Source artifacts are preserved under their published licenses (PSI data is CC0 1.0 Universal).
FIRETRACE is an independent project and is not affiliated with, endorsed by or certified by NASA.
See `docs/data_sources.md` and `docs/methodology.md`.
