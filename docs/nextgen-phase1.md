# FIRETRACE Next-Gen Phase 1 — Implementation Checklist

## Audit baseline (verified)
- Repository tree, routes, components, libs, data, backend, and tests inspected.
- Corpus schema, manifest, validation report inspected: **131 records** (129 BASS-II + 2 Saffire-I), 0 pressure/gravity/outcome/ignition-method records.
- Backend API v1 contracts inspected; corpus-version pinning and `/api/health` verified.
- Test suites run: **213 Vitest pass**, **192 pytest pass (3 skipped when voice stack absent)**, **9 pipeline unittest pass**, **68 Playwright pass**, **36/36 benchmark pass**.
- Production build passes (`tsc -b && vite build`); only known large-chunk warning (~2.38 MB).

## Implemented in this phase
- [x] Command palette (Ctrl/Cmd+K) with route search, keyboard navigation, ARIA combobox/listbox, Escape close.
- [x] Coverage & Validation Center route computing all metrics from the bundled corpus at runtime; four zero-coverage constraints (pressure, per-test gravity, ignition method, standardized outcome) plus derived oxygen partial pressure.
- [x] Research Notebook (versioned localStorage, investigations, typed items, workflow states, per-item verification, calculation runner, Markdown + ZIP export, timeline).
- [x] Evidence graph (typed in-memory nodes/edges from corpus + manifest + validation + notebook + claims; 161 nodes, 603 edges, 0 orphans; subgraph search/export).
- [x] Claim verification engine (deterministic, independent of any LLM; citation resolution, numeric support, pressure conflict, safety-assertion checks).
- [x] Reproducible calculation engine (ppO2, unit conversions, 4 definitions, exact decimal arithmetic via BigInt scaling, serializable runs, rerun history, historical preservation).
- [x] Analysis run model + corpus diff (6 definitions, per-record fingerprints, versioned persistence, Markdown).
- [x] Research report generator (Markdown + JSON + hashed manifest, integrity/verification/graph/benchmark/analysis/notebook sections).
- [x] Saved views in Atlas (URL-synced state, saved-view CRUD in versioned localStorage, column config, multi-select).
- [x] Accessibility: axe-core 4.10.2 + 20 Playwright tests across all 17 routes; contrast tokens raised; focus traps; reduced motion; keyboard navigation.
- [x] Offline/PWA: manifest + service worker (same-origin static only, never `/api`), online/offline status indicator.
- [x] Exports upgraded: RFC 4180 escaping, formula-injection mitigation, generic/verification/analysis CSV writers, content manifest, deterministic ZIP.
- [x] Tests added for new modules (verification, evidenceGraph, benchmark, analysisRun, integrity, report, zip, notebook, calculation, atlasView, storage, capabilities, export hardening).
- [x] Navigation grouped into Explore / Workspace / Research / Evidence with primary routes visible and full list in menu + palette.

## Deferred / limitations
- No virtualization of tables (corpus is 131 rows; not needed at this scale).
- No cloud deployment or paid API keys.
- Optional voice stack (Ollama/whisper.cpp/sherpa-onnx) not installed in this environment; voice routes return structured `503 voice_unavailable`.
- `eval/run_eval.py` still reports retrieval hit@5/abstention as `null` with 0/30 labelled items (no gold answers shipped).
- Bundle is a single large JS chunk (~2.38 MB) because corpus JSON is imported directly for offline use.
- Playwright runs require an unblocked Chromium; verified working here with the installed browser.
- Reports are Markdown/JSON + ZIP only; PDF not implemented (dependency/deployment constraint).
- Service worker caches static assets only; no stale-corpus acceptance.
- Open PRs #2 and #4 remain technically open on GitHub but their code is merged into `main`.
- No `gh` CLI or token available to post PR comments; local integration only.
- All new installs/caches/models/artifacts placed on D: drive.
