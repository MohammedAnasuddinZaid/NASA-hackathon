## 1. Summary

FIRETRACE's scientific records were bundled-only while its optional voice backend stored voice sessions, not a validated evidence database. This PR adds a separate model-free FastAPI/SQLite evidence service and connects Atlas search, details, provenance/downloads, calculated coverage and comparison to it. Explicit whole-session bundled fallback preserves offline use.

This is an **independent PR against main**. PR #1 remains open/unmerged and is neither a dependency nor included in this branch. No original files, normalized scientific records, existing ingestion rules or optional voice/model implementation are changed. Codex assisted code, tests and documentation; source artifacts and screenshots are genuine, and human team review remains pending.

## 2. Architecture

```text
NASA originals -> existing ingestion -> normalized corpus + manifest + validation
                                      -> validated transactional import
                                      -> SQLite -> evidence services -> FastAPI /api/v1
                                                                         |
                                           dataset-fingerprint-checked React client
                                           complete bundled fallback on failure
```

New `backend/evidence` uses stdlib SQLite, Pydantic validation and per-operation closed connections. It never imports the optional voice/model stack. Separate entry point: `backend.evidence.main:app`. Setup/API contract: [backend/EVIDENCE.md](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api/backend/EVIDENCE.md).

## 3. New Features

- Model-free backend with versioned OpenAPI routes, explicit errors, health, bounded inputs, configured CORS and request timing logs.
- Lossless normalized records, measurements, source registry, claims and investigation context in SQLite; hash and original-CSV-row verification before import; transactional/idempotent rebuilds.
- Indexed scalar filtering and deterministic literal keyword retrieval; no vectors, embeddings or ranking changes.
- Registered CC0 original downloads with containment/hash checks; authoritative links for other sources.
- Conservative condition comparisons with differences, missing evidence and source addresses; no safety probability.
- Shared React API client/provider, version-checked Atlas search/details, source downloads, database coverage and backend comparison. Any failure/mismatch switches the entire session to bundled data.
- Windows-compatible `npm run dev:full`, independent requirements, isolated API/browser tests, setup and integration notes.

## 4. API Endpoints

| Method | Endpoint | Purpose | Status |
|---|---|---|---|
| GET | `/api/v1/health` | Database readiness, schema/dataset/count | Implemented |
| GET | `/api/v1/experiments` | Filtered/paginated full records and total | Implemented |
| GET | `/api/v1/experiments/{experiment_id}` | Lossless conditions, measurements, raw/provenance | Implemented |
| GET | `/api/v1/coverage` | Calculated non-null/null, measured/context/status/unit counts | Implemented |
| GET | `/api/v1/sources` | Source artifact and context registry | Implemented |
| GET | `/api/v1/sources/{source_id}` | Source metadata and download availability | Implemented |
| GET | `/api/v1/sources/{source_id}/download` | Explicit registered original artifact only | Implemented |
| POST | `/api/v1/compare` | 1–4 distinct records, differences and limitations | Implemented |
| GET | `/api/v1/passages` | Explicit empty collection/unavailable-text limitation | Implemented; no invented excerpts |

Search supports q, investigation, material, quality, experiment/source ID, oxygen/flow bounds, flow-only, five sort modes, limit1–100 and offset0–100000. Unknown search parameters and invalid/reversed ranges are rejected. Missing numbers are excluded only by numeric/flow-only filters; never replaced with zero. Download requires artifact_id; generated URLs pin dataset_id. Comparison accepts experiment_ids. All contracts/errors are described in the backend guide and `/docs`.

## 5. Database Changes

Schema1: dataset singleton, investigations, experiments, measurements, sources and claims. Experiment→investigation and measurement→experiment foreign keys, unique stable IDs, indexes on investigation/family/material/oxygen/flow and measurement ownership. Lossless JSON payloads retain optional future provenance while indexed scalars support retrieval. `PRAGMA user_version` rejects unsupported schema versions; rebuild documented.

Verified import: **131 records, 1207 measurements, 2 investigations, 12 claims, 8 original-artifact registry entries + 2 context-only entries**. Quality flags/suspect records remain intact. Six CC0 originals are downloadable; NTRS entries retain authoritative links. Every original is checked against manifest SHA-256; raw records must match their registered CSV row. Repeated import does not duplicate records. Invalid preflight or a mid-transaction constraint failure leaves the old dataset intact. No generated database is committed.

Dictionary: [backend data dictionary](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api/docs/backend-data-dictionary.md).

## 6. Integration with PR #1

**Not stacked. Base: main.** Branch created directly from freshly fetched `origin/main` at `2fb1d1239b7a83a388c2b3687fe0f72283f67dde`. No PR #1 commits were copied, cherry-picked, merged or rebased. Its code/schema/docs were inspected read-only for compatibility.

PR #2 preserves current-main contracts, including legacy status/unit/uncertainty metadata; it does not claim PR #1's scientific corrections. Extra provenance fields and corrected/unverified statuses are accepted losslessly. After integrating PR #1, rebuild both SQLite and Vite so their fingerprint matches. Old/new combinations deliberately fall back.

Potential shared-file conflicts: README, package.json, App.tsx, RecordDrawer.tsx, Atlas.tsx, Compare.tsx, Methodology.tsx, e2e/app.spec.ts and .gitignore. Retain PR #1 scope notices/ledger/corrections and PR #2 API hooks/coverage/status. Combine source-download displays rather than duplicating them. Reconcile conservative backend comparison semantics with offline frontend checks using parity fixtures. Full resolution notes: [independent integration guide](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api/docs/pr2-integration.md).

The diff contains only this backend milestone's commits against main. Leave both PRs unmerged.

## 7. Bug Fixes and Previous Issues

Read-only repository issue search found no existing issues; no invented closing references. This is primarily a new foundation. During implementation, tests caught incorrect assumed main-branch labels/counts, missing build-time fingerprint configuration in Vitest, and a comparison test's incorrect unknown-field count. Corrected the tests/configuration against the actual corpus. Review also separated non-null context values from measured coverage and exposed the dataset header for configured cross-origin clients. Regression checks cover these behaviors.

## 8. Screenshots and Evidence

Actual local FastAPI + SQLite + Chromium captures, visually inspected. No fabricated before/after images.

![Swagger routes](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/backend-evidence-api/docs/evidence/pr2/swagger.png)
![Atlas using API](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/backend-evidence-api/docs/evidence/pr2/atlas-api.png)
![Source provenance and downloads](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/backend-evidence-api/docs/evidence/pr2/provenance-api.png)

Additional [coverage capture](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api/docs/evidence/pr2/coverage-api.png), [actual B1 response](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api/docs/evidence/pr2/record-response.png), [explicit fallback](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api/docs/evidence/pr2/fallback.png) and [evidence notes/logs](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/tree/feat/backend-evidence-api/docs/evidence/pr2). Fallback image uses a deliberately unverified response; actual503 and dataset409 transitions are separately tested. Swagger CDN capture is opt-in; default data/API tests require no NASA/model network.

## 9. Testing

| Test / Check | Command | Result | Notes |
|---|---|---|---|
| Baseline frontend | npm test / npm run build | 80 tests + build pass | Existing large bundle warning |
| Baseline browser | npm run e2e | 18 pass | Before integration |
| Evidence API | python -m pytest backend/evidence/tests -q | 44 pass | Isolated DBs; roundtrip, source hashes/rows, rollback, filters, security, coverage, abstention, CORS |
| Existing backend | PYTHONPATH=backend python -m pytest backend/tests -q | 20 pass | Voice/model runtime not started |
| Frontend | npm test | 83 pass | Includes three API-client identity/query tests |
| Production | npm run build | Pass | TypeScript + Vite; large bundle warning remains |
| Existing user flows | npm run e2e | 18 pass | Eight routes, drawer, filters, assistant, offline, exports, mobile, film |
| Real API integration | FIRETRACE_CAPTURE_SWAGGER=1 npm run e2e:evidence | 5 pass | Search/detail/download/coverage/compare/fallback/409/503 + genuine capture |
| Assistant benchmark | npm run benchmark | 30/30 | Existing limited benchmark, not universal accuracy |
| Full launcher | FIRETRACE_FRONTEND_PORT=5174 npm run dev:full | Running | Avoids disturbing existing5173; API on8000 |
| Whitespace | git diff --check | Pass | No lint script configured |

Python3.14.6 / Node24.14.1 on Windows. The old Pydantic pin could not build on3.14; selected compatible binary requirements ([upstream Python support](https://pydantic.dev/articles/pydantic-v2-12-release)). Shared Windows pytest temp permissions required workspace-local basetemp; sandbox file-rename restrictions required checks outside sandbox. These initial environment failures were resolved, not reported as passes. One upstream Starlette/httpx TestClient deprecation warning remains. Actual final command logs are under evidence/pr2.

## 10. Performance and Security

Read-only serving, indexed SQLite scalar queries, parameterized user values, fixed allowlisted sort expressions, result/body/ID/query bounds, five-second SQLite busy timeout and connection cleanup. Client timeout4s. CORS uses explicit configured origins, exposes the version header, and allows no credentials/wildcards. Paths and traces are not returned to clients; query/body content is not logged by the request timing logger. Download paths come exclusively from a contained hash-verified CC0 registry, never a client path or URL proxy. Dataset identity gates prevent version mixing. Localhost defaults; no authentication/Internet deployment/rate-limit infrastructure is claimed.

## 11. Breaking Changes

Existing static contracts, scientific values and optional voice entry point remain unchanged. New evidence API is `/api/v1`, separate from existing `/api` voice routes. React now attempts an optional same-origin evidence connection and shows explicit status; set VITE_EVIDENCE_API=off for static-only use. API-connected comparison adds more conservative condition checks than the unchanged offline evaluator. No database migration for voice sessions; evidence uses a separate ignored SQLite file.

## 12. Known Limitations

- Main's legacy metadata is preserved, including Saffire qualitative/approximate labels, original-unit labeling defects and notes in uncertainty fields. PR #1 addresses those; this independent PR does not import its corrections. Textual uncertainty is not a numerical error bound.
- No verified report-passage collection is available in the main contract. No report extraction, generation, model calls, embeddings, ranking or safety prediction is introduced.
- Scenario endpoint is deferred; existing Gap Planner works unchanged. Offline comparison remains the main-branch implementation; reconcile rule parity during integration.
- No standardized measured outcomes or measured per-test gravity in these tables. Qualitative outcomes/context are counted separately from measurements. Missing imported values do not imply absence across all NASA research.
- Sources lacking clear CC0 redistribution are linked, not served. Existing large bundle warning and upstream test-client deprecation remain.
- Optional existing voice/model runtime is not tested here. It shares default port8000; run one service there. No public deployment performed.

## 13. Manual Review Guide

1. In this branch/worktree, npm ci; python -m venv backend/.venv; install backend/requirements-evidence.txt with that Python. See backend/EVIDENCE.md for exact Windows/Unix commands.
2. npm run dev:full initializes the DB and starts localhost5173 + localhost8000. If5173 is occupied, set FIRETRACE_FRONTEND_PORT=5174. Visit /docs and /api/v1/health.
3. Atlas: confirm API connected and131 records; search BASS2-B1; inspect22.2% O2, null pressure, context gravity and CSV row2/raw fields.
4. Download the genuine PSI-25 CSV; compare its hash to the registry. Review API coverage, including0 measured gravity despite131 context labels.
5. Compare Saffire S1/S2: flow direction differs. Inspect missing pressure/ignition method/outcome evidence; no safety score.
6. Stop backend and change an Atlas filter: banner must switch to bundled data; all eight routes remain usable. Reload retries. Dataset mismatch tests prove409 cannot silently mix versions.
7. Run tests/build; inspect integration notes for PR #1 reconciliation and evidence logs. Keep both PRs open and unmerged.

Before PR #3: integrate/review scientific provenance changes, rebuild the matched dataset, agree comparison parity fixtures, and establish verified passages plus grounded-answer/citation evaluation. Do not assume this PR already adds an LLM.
