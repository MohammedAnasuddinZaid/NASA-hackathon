# FIRETRACE Next-Gen Phase 2 — Scientific Intelligence, Evidence Graph, Reproducibility & Workflows

## Verified starting state
- Phase 1 implementation verified: 300 Vitest pass, 226 pytest pass (3 skipped), 19 pipeline unittest pass, 70 Playwright pass, 36/36 benchmark pass, production build passes.
- Corpus: 131 records, 0 pressure/gravity/outcome/ignition-method.
- Evidence graph: 161 nodes, 603 edges, 0 orphans.
- Integrity: 19 checks, 0 warn, 0 fail.
- Benchmark: 36 cases (retrieval, abstention, provenance, coverage, safety, adversarial), 100% pass, corpus `89446315d96a0115…`, case fingerprint `60a88bab2c36d72b…`.

## Implemented in this phase
- [x] **Evidence graph** (`src/lib/evidenceGraph.ts`, `src/pages/Graph.tsx`): typed nodes/edges built deterministically from corpus + source manifest + validation + claims + notebook items. Stable IDs, explicit edge types, orphan stats, neighborhood traversal, search/filter, SVG visualization with keyboard-accessible nodes, copy/export of subgraph JSON.
- [x] **Claim verification engine** (`src/lib/verification.ts`, `src/pages/Verification.tsx`): independent of any LLM. Verifies citation resolution, numeric support, pressure conflicts, safety assertions, trace honesty for answers, claims, and notebook items. Verdicts: supported / partial / unsupported / contradicted / unverifiable.
- [x] **TRACE query planning** (`src/lib/assistant.ts`, `src/pages/Assistant.tsx`): explicit query-plan stage with classification, selected records, search strategy, applied filters, evidence fields, missing info, calculation steps, verification findings. Surfaced as "Query plan & retrieval trace" in the UI.
- [x] **Benchmark + adversarial harness** (`src/lib/benchmark.ts`, `src/pages/Evaluation.tsx`, `scripts/run-benchmark.ts`): 36 versioned deterministic/adversarial cases (exact lookup, missing pressure/gravity/outcome, source attribution, unit handling, comparability, numeric calculation, ambiguous/unsupported claims, fabricated source IDs, prompt injection). Metrics: total/passed/failed/pass rate, by category, case fingerprint, corpus version. Regression gates in Vitest.
- [x] **Calculation engine** (`src/lib/calculation.ts`, Notebook runner): exact decimal arithmetic via BigInt scaling, 4 calculation definitions, serializable runs with formula/inputs/units/assumptions/steps, rerun history, historical preservation, validation of inputs.
- [x] **Analysis runs** (`src/lib/analysisRun.ts`, `src/pages/Analysis.tsx`): 6 reproducible definitions (coverage, validation, materials, atmosphere, sources, comparability), per-record fingerprints, corpus diff vs current, versioned persistence, Markdown output, replay comparison.
- [x] **Corpus integrity** (`src/lib/integrity.ts`, `src/pages/Integrity.tsx`): 19 checks (manifest hashes, validation gates, source uniqueness, null discipline, duplicate sample numbers, excluded rows, claim resolution). 19 pass / 0 warn / 0 fail.
- [x] **Research reports** (`src/lib/report.ts`, `src/pages/Reports.tsx`): Markdown + JSON + hashed manifest (5 content files + manifest = 6 ZIP entries), integrity/verification/graph/benchmark/analysis/notebook sections, optional benchmark inclusion, download as ZIP.
- [x] **Model/service health** (`src/lib/capabilities.ts`, `src/pages/Health.tsx`): real capability probes (bundled corpus, API, storage, offline shell, etc.), 10 capabilities, honest status (available/degraded/unavailable/not_configured), no fabricated telemetry.
- [x] **Deterministic ZIP writer** (`src/lib/zip.ts`): STORE method, CRC32, fixed DOS timestamp for reproducible exports, path-traversal rejection.
- [x] **Advanced navigation**: grouped routes (Explore / Workspace / Research / Evidence), primary routes visible, full list in menu + command palette.

## Deferred / limitations
- No graph database; typed in-memory graph only.
- No embeddings/semantic retrieval; deterministic lexical + structured retrieval remains authoritative.
- No optional external context retrieval (offline-first preserved).
- No PDF export (Markdown/JSON/ZIP only).
- No model download or auto-install; capability probes report installed state only.
- `eval/run_eval.py` still reports null metrics (no gold answers shipped).
- Reports are evidence summaries, not peer-reviewed conclusions.
- TypeScript/Python retrieval parity preserved (no parity break introduced).

## Security
- Origin checks, body caps, path-traversal protection in ZIP/extraction.
- Formula-injection mitigation in CSV exports.
- No secrets in exports; manifest records hashes only.
- Prompt-injection adversarial cases in benchmark (A01–A06) all pass.
- AI interpretation separated from deterministic evidence; unsafe output falls back to deterministic text.

## Dependencies / licenses
- Frontend: React 19 (MIT), React-DOM 19 (MIT), Vite 7 (MIT), TypeScript 5.9 (Apache-2.0), @vitejs/plugin-react 5 (MIT), Vitest 4 (MIT), @playwright/test 1.65 (Apache-2.0), tsx 4 (MIT).
- axe-core 4.10.2 (MPL-2.0), now a devDependency (installed via `npm ci`/`npm install`), cache `D:\npm-cache` locally.
- Fonts: Manrope and Inter via Google Fonts (OFL-1.1).
- Backend: FastAPI, uvicorn, pydantic, pytest (MIT/BSD); optional voice stack (Silero VAD, whisper.cpp, sherpa-onnx, Ollama) under their own licenses.
- No new runtime dependencies added to package.json; all Phase 1/2 capabilities use existing stack + standard Web APIs.
- openpyxl 3.1.5 (MIT) installed to `D:\firetrace-tools\pipeline-deps` for pipeline tests only.

## Run commands
- Frontend dev: `npm run dev` (http://localhost:5173)
- Full stack: `npm run dev:full`
- Production build: `npm run build && npm run preview` (http://localhost:4173, `VITE_EVIDENCE_API=off`)
- Unit tests: `npm test`
- Benchmark: `npm run benchmark`
- Pipeline: `PYTHONPATH=D:\firetrace-tools\pipeline-deps python -m unittest discover -s pipeline -p "test_*.py" -v` (use backend venv python)
- Backend pytest: `cd backend && .\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp C:\Users\mohda\AppData\Local\Temp\opencode\basetemp`
- E2E: `npm run e2e`
- Accessibility axe path: `D:/firetrace-tools/node_modules/axe-core/axe.min.js` (override via `FIRETRACE_AXE_PATH`)

## Test results (actual)
- Vitest: 300 pass / 0 fail across 25 files.
- pytest: 226 pass / 3 skipped / 0 fail.
- Pipeline unittest: 19 pass / 0 fail.
- Playwright: 70 pass / 0 fail.
- Benchmark: 36/36 pass (100%).
- Production build: passes (chunk-size warning only).
