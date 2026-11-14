# PR #2 — evidence storage and browsing foundation

## Scope and branch history

The first independent implementation was based on main `2fb1d12` and remains preserved on `feat/backend-evidence-api`; no PR was created for it. While it was being verified, another actor merged PR #1 and added a substantial evidence backend to main. The user then explicitly selected **adapt to current main**. This review branch, `feat/backend-evidence-api-current`, starts directly at new main `2d9d4e7`. It does not cherry-pick or merge the prototype branch. No published history, PR #1 branch, or main was rewritten. PR #1 is already merged externally; this work did not merge it and cannot truthfully leave it open.

The existing FastAPI entry point (`backend/api.py`), typed contracts/client, deterministic assistant, FTS retrieval and matching tolerances are reused. This PR supplies missing persistent scientific storage, controlled source downloads, core React integration and explicit version fallback. It introduces no second API stack, model integration, ranking algorithm, report generation or predictive behavior.

## Acceptance and progress

- Preserve current normalized records, raw tokens, corrected/derived/context statuses, nulls, units, measurements and source addresses in SQLite. Verify original hashes/CSV rows before publishing a new persistent index. Rebuild is idempotent and atomic.
- Keep existing API contracts/tests usable; add source inventory/download access, bounded Atlas sorting/filter semantics, version-conflict rejection and coverage that distinguishes non-null context from measured values.
- Make Atlas call real search/detail APIs, the drawer use registered originals, Methodology display calculated coverage, and Compare use the existing backend audit with a missing direction check. Preserve all eight routes and the deterministic assistant in explicit bundled fallback.
- Run actual backend/frontend/browser checks, capture genuine evidence, document setup and limitations, publish one PR against main and leave it unmerged.

Baseline at `2d9d4e7`: 155 backend tests, 89 frontend tests and production build pass. Existing bundle-size and Starlette/httpx TestClient deprecation warnings remain. Results for this branch are in `docs/evidence/pr2`; tests from the superseded prototype are not claimed as evidence for this implementation.

## Architecture and data dictionary

```text
NASA originals -> existing scientific ingestion -> corpus + manifest + validation
                                                  |
                                   existing build_index.py + original hash/row gate
                                                  |
                               SQLite scientific snapshot + unchanged FTS index
                                                  |
                                    existing EvidenceStore / FastAPI /api/v1
                                                  |
                               existing typed client + version-checked UI session
                                                  |
                                  complete bundled fallback on failure/mismatch
```

Snapshot schema1 is registered as `index_meta.scientific_schema`. Old indexes are rebuilt or fall back to a private in-memory snapshot. The existing atomic builder writes a temporary file, closes it and replaces the persistent index only after validation. Source files and normalized JSON are never overwritten. If the same inputs are imported again, scientific rows and IDs remain equivalent; SQLite file bytes/timestamps need not be identical.

| Table | Keys and preserved content |
|---|---|
| scientific_investigations | source_id PK; original investigation metadata JSON (ISS/Cygnus context, not per-test gravity) |
| scientific_records | experiment_id PK, investigation FK/source index; complete unchanged record JSON |
| scientific_measurements | measurement_id PK, experiment FK/ownership index; original/normalized values, units, status, null uncertainty, notes and locators |
| scientific_sources | composite artifact_id PK (`source_id--filename/role`), source index; complete artifact/context metadata |
| scientific_claims | claim_id PK; unchanged original claims, supporting source IDs, locators and limitations |
| evidence_fts / index_meta | Existing keyword index and metadata, extended with snapshot schema version |

Current import has131 records,1207 measurements,2 investigations,12 claims and13 source entries (10 original-artifact metadata entries +3 context-only entries). Eight registered CC0 originals can be served; NTRS/context-only sources retain authoritative links. Values are stored as JSON scalars/nulls without conversion. Numeric zero remains zero. Corrected O2 remains corrected; approximate source tokens remain qualitative/approximate notes. No report pressure is mapped into records. Runtime reads records from the SQLite snapshot and verifies it matches the curated input before serving. Referential checks run before opening the index; duplicate IDs or source-registry disagreement fail closed.

Coverage `reported` is the existing non-null value count, not proof of measurement. Additive `per_test_measured` counts only non-null measured/corrected fields without investigation-level basis; `context_only` counts non-null investigation-level values. Existing complete status/unit histograms and missing counts remain. Qualitative outcome notes are not standardized measured outcomes.

## New and adapted API behavior

| Method | Endpoint | Change |
|---|---|---|
| GET | `/api/v1/sources` | New typed inventory of all source groups and download availability |
| GET | `/api/v1/sources/{id}/download?artifact=…` | New registered CC0 original download; optional corpus_version pins identity |
| GET | `/api/v1/sources/{id}` | Existing contract; artifact_id/download_available added to artifact metadata |
| GET | `/api/v1/experiments` | Existing filters retained; optional sort, material_exact, atlas_search; offset bounded to100000, unknown filters422 |
| GET | `/api/v1/experiments/{id}` | Existing lossless detail contract, now backed by SQLite scientific records |
| GET | `/api/v1/coverage` | Existing coverage with explicit per-test/context counts |
| POST | `/api/v1/compare` | Existing `{ids:[…]}` contract/tolerances, with consequential flow-direction audit |
| GET | `/docs` | Alias to existing `/api/docs`; docs-only CSP permits normal Swagger assets |

Existing `/api/v1` discovery, `/api/v1/ask`, `/api/v1/scenarios/evaluate`, `/api/v1/exports`, `/health/live` and `/health/ready` stay available. No external generation is introduced. Verified report passages are not available as a structured collection; no excerpts or passage table are invented.

Search defaults remain backward compatible. `sort=source` retains existing order; optional id (natural numeric), o2-asc/o2-desc (null last), material and date (reported string order) support Atlas. `material_exact=true` uses the parsed material family exactly; `atlas_search=true` adds existing Atlas keyword fields, all-term matching and exact test-ID precedence. These flags leave older API consumers' defaults unchanged. No SQL uses client-supplied expressions.

All evidence client requests pin the exact bundled SHA-256 using X-Corpus-Version. Server409 or a nonmatching response header causes explicit bundled fallback. Vite computes the expected hash from the exact corpus bytes at build time. CORS already exposes the existing header. Reload retries; no cross-version merging occurs. Same-version list IDs are mapped to the identical bundle for full table rendering; detail/raw/measurement data is fetched from the API. A failure clears API coverage and stops subsequent evidence calls for the session, including the assistant. Validation errors remain errors in the existing typed client.

Comparison preserves the current engine's numeric tolerance policy. Flow direction is now checked because equal speed is insufficient when concurrent/opposed geometry differs. Investigation-level direction remains unknown for per-test matching. Existing gravity context comparisons retain their API meaning (the label matches); the UI marks these partial context rather than a shared measured test condition. No safety score, probability or new relevance ranking is added.

## Local setup

Tested with Python3.14.6 and Node24.14.1; use the existing Node/Python requirements and pinned `backend/requirements.txt`. Windows PowerShell:

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm.cmd run dev:full
```

The launcher uses no shell, binds to127.0.0.1 and initializes the existing index before starting backend8000/frontend5173. Ctrl+C stops its child services. If5173 is occupied, set `$env:FIRETRACE_FRONTEND_PORT='5180'` before the command. Unix uses `python3 -m venv backend/.venv` and `backend/.venv/bin/python -m pip install …`; the launcher detects the platform's executable. FIRETRACE_PYTHON can supply another executable.

Open http://127.0.0.1:5173/#/atlas and http://127.0.0.1:8000/docs. Separate commands from the repository root:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/build_index.py
backend/.venv/Scripts/python.exe -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8000
# Another terminal:
npm.cmd run dev
```

Configuration: existing FIRETRACE_INDEX_PATH selects the ignored SQLite file; existing corpus/manifest/validation paths and origins remain in backend configuration. Frontend VITE_EVIDENCE_API_BASE defaults to blank same-origin proxy, VITE_EVIDENCE_API=off disables the initial session connection. FIRETRACE_API_TARGET is a **process** environment variable for the Vite proxy (default http://127.0.0.1:8000); the browser integration test uses8012. Set explicit allowed origins when calling cross-origin. No credentials are required or committed. Production static hosting can use bundled mode or a configured API/proxy; no public deployment is performed.

Stop the API before rebuilding a Windows-locked persistent index. Running build_index.py again is the reset/rebuild command; set a fresh FIRETRACE_INDEX_PATH for an isolated database. Do not delete source artifacts to reset storage.

## Verification and limitations

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
npm.cmd test
npm.cmd run build
npm.cmd run e2e
npm.cmd run e2e:evidence
```

Browser integration uses isolated SQLite under ignored tmp, backend8012 and frontend4182; it refuses to reuse existing servers. Set PLAYWRIGHT_BROWSERS_PATH if reusing an installed browser. Swagger screenshot capture is opt-in with FIRETRACE_CAPTURE_SWAGGER=1 because its default assets use a CDN; normal scientific/API tests require no NASA/model network. A workspace-local pytest --basetemp is needed in this machine's restricted Windows temp environment.

Known limitations: no new report-passage extraction; current FTS ranking/scenario/export/assistant logic is reused, not redesigned; offline comparison retains the existing frontend audit rather than numerical API tolerance parity. Date sorting remains reported-string order. Production authentication/deployment/large-scale performance work is out of scope. Existing voice runtimes were not started. The existing request/body limits, error handlers and logging remain; store-load errors now avoid exposing server paths. Swagger CSP is relaxed only on its documentation page, not API JSON responses. Original downloads never accept a filesystem path or proxy URL and fail on changed hashes, traversal/symlinks outside raw, non-CC0 sources or unregistered identifiers.

Before PR #3: review the combined scientific metadata now in main, agree offline/backend comparison parity fixtures, decide how to ingest verified report passages and define grounded-answer/citation evaluation. No new LLM or embedding integration is part of this PR.
