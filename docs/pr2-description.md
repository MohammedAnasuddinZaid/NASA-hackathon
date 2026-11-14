## 1. Summary

Completes persistent scientific storage and core API-backed research browsing **on the current main backend**. It adds lossless SQLite records/measurements/source/claim tables alongside the existing FTS index, checks original hashes and CSV rows, serves controlled originals, and connects Atlas/details/sources/coverage/comparison with strict corpus-version fallback.

The user explicitly approved adapting to current main after another actor merged PR #1 and added the backend while the initial independent prototype was being verified. This PR introduces no duplicate API stack, external LLM, embeddings, new ranking algorithm or predictive model. Codex assisted implementation/tests/docs; human review is pending.

## 2. Architecture

```text
NASA originals -> existing ingestion -> normalized corpus / manifest / validation
                                      -> existing atomic index builder + source checks
                                      -> SQLite scientific snapshot + existing FTS
                                      -> existing EvidenceStore / FastAPI /api/v1
                                      -> existing typed client + version-checked UI session
                                      -> complete bundled fallback on failure/mismatch
```

Reuse: backend/api.py, app/v1, existing Pydantic contracts, deterministic assistant/scenario/export/FTS and published numeric matching tolerances. New snapshot helper persists complete JSON without re-parsing scientific values. See [foundation setup/dictionary](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api-current/docs/pr2-foundation.md).

## 3. New Features

- Scientific SQLite snapshot with stable IDs, foreign keys, source/ownership indexes, idempotent rebuild and schema metadata.
- Original-file SHA-256/CSV-row gate before publishing persistent storage; runtime rejects altered snapshot records or mismatched source registries.
- Source inventory and registered, hash-verified CC0 downloads; other originals stay authoritative external links.
- Backward-compatible Atlas search/sort flags and bounded offset/unsupported-filter rejection.
- Shared corpus-verified evidence session: real Atlas search/detail, drawer source access, calculated coverage, backend comparison; failure clears API coverage and uses complete bundled data.
- Coverage distinguishes non-null values, per-test measured/corrected fields and context-only labels.
- Existing comparison now checks flow direction; investigation-only matches display as partial context in React. No risk score is added.
- Combined localhost launcher, docs alias/CSP fix, focused regression/integration tests and genuine evidence.

## 4. API Endpoints

| Method | Endpoint | Purpose | Status |
|---|---|---|---|
| GET | `/api/v1/sources` | Source/context inventory with artifact availability | New |
| GET | `/api/v1/sources/{id}/download?artifact=…` | Registered CC0 original; optional corpus_version pin | New |
| GET | `/api/v1/experiments` | Search/filter/page with optional sort/material_exact/atlas_search | Existing, extended |
| GET | `/api/v1/experiments/{id}` | Raw fields, measurements, units/status/provenance | Existing, SQLite-backed |
| GET | `/api/v1/sources/{id}` | Source metadata and additive artifact_id/download_available | Existing, extended |
| GET | `/api/v1/coverage` | Computed status/missing/unit and measured/context counts | Existing, extended |
| POST | `/api/v1/compare` | Existing ids contract plus consequential direction audit | Existing, extended |
| GET | `/docs` | Redirect to functional `/api/docs` | New alias |
| GET | `/api/v1`, `/health/live`, `/health/ready` | Discovery and health | Preserved |
| POST | `/api/v1/ask`, `/api/v1/scenarios/evaluate`, `/api/v1/exports` | Existing deterministic research services | Preserved; not new scope |

No new passage extraction/API is claimed. Unknown IDs return404; invalid search422; corpus mismatch409. Existing body/rate/error middleware remains in use. Numeric filters retain null exclusion semantics, with no zero-filling. Published API defaults stay compatible; Atlas-only matching is opt-in.

## 5. Database Changes

New scientific_investigations, scientific_records, scientific_measurements, scientific_sources and scientific_claims tables inside the existing ignored backend/index/corpus_fts.sqlite3. IDs are unique; experiment→investigation and measurement→experiment are foreign keys. Composite source artifact IDs prevent collisions for multiple files per investigation. Complete JSON retains original/normalized values, units, corrected/derived/context statuses, flags, raw strings, notes and locators.

Verified: **131 records,1207 measurements,2 investigations,12 claims,13 source entries (10 original-artifact metadata +3 context entries)**. Eight CC0 originals are available for controlled download. No normalized data, source artifact or scientific ingestion rule is changed. Schema is index_meta.scientific_schema=1; existing atomic builder rebuilds old formats or the loader creates a private memory snapshot. Runtime records are read from SQLite and compared with the curated corpus; changed payloads fail closed. Re-import is equivalent/idempotent, not a claim of identical SQLite file bytes.

## 6. Integration with PR #1

**Base main; not stacked.** This branch is `feat/backend-evidence-api-current`, created directly from freshly fetched main `2d9d4e7801b7cf521b8e3a424de5d65b008d280b`. The original `feat/backend-evidence-api` prototype remains preserved, but no PR was created for it and none of its commits was cherry-picked/merged into this branch.

PR #1 was merged externally while implementation was in progress. After checking that state, the user selected “Adapt to current main.” PR #1 code now present through the default branch is preserved: scope notices, corrected statuses, units, measurement ledger, original static downloads and report context. This work did not merge or modify PR #1 and cannot claim it remains open.

The current diff contains only adaptations to the already-landed backend. No unresolved PR #1 dependency. Likely future shared-file conflicts are Atlas, Compare, Methodology, RecordDrawer, App, apiClient, store/router/builder and package scripts; retain scientific scope/ledger behavior and combine API/static download selection rather than duplicating it. Rebuild the index and frontend together after corpus changes; mismatched hashes deliberately fall back. Offline/backend tolerance parity remains future reconciliation work. Leave this PR unmerged.

## 7. Bug Fixes and Previous Issues

No repository issue was found to reference; no invented closing keywords.

- Existing SQLite index stored search text only; full scientific records now persist losslessly and remain verifiable.
- Existing API comparison omitted flow direction, so the Saffire concurrent/opposed difference was absent. Direction is now audited with a regression test; numeric tolerances are unchanged.
- Swagger inherited a JSON-only default-src-none CSP. The documentation path alone now permits its normal assets; API JSON CSP stays restrictive.
- Store-load errors could include server paths; clients now receive a generic initialization message.
- Corpus identity was exposed but not enforced by the browser. Both request409 and response-header checks prevent cross-version mixing and provide explicit fallback.

## 8. Screenshots and Evidence

Genuine current-branch local SQLite/FastAPI/Chromium captures, visually inspected. No fabricated before/after pairs.

![Swagger](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/backend-evidence-api-current/docs/evidence/pr2/swagger.png)
![API Atlas](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/backend-evidence-api-current/docs/evidence/pr2/atlas-api.png)
![API provenance and originals](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/backend-evidence-api-current/docs/evidence/pr2/provenance-api.png)

[Coverage](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api-current/docs/evidence/pr2/coverage-api.png), [actual response](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api-current/docs/evidence/pr2/record-response.png), [fallback](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/backend-evidence-api-current/docs/evidence/pr2/fallback.png), [logs/evidence notes](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/tree/feat/backend-evidence-api-current/docs/evidence/pr2). Fallback image is a deliberately intercepted409;503 behavior is separately tested. Prototype-branch results are not reused as proof for this PR.

## 9. Testing

| Test / Check | Command | Result | Notes |
|---|---|---|---|
| Current-main baseline | pytest backend/tests; npm test; npm run build |155 backend /89 frontend + build pass | Before adaptations |
| Full backend | python -m pytest backend/tests -q |165 pass | Adds snapshot roundtrip/idempotence/tamper, originals/security/version/docs/coverage/direction checks |
| Frontend | npm test |92 pass | Includes API pinning, zero filter and mismatch regressions |
| Existing browser flows | npm run e2e |23 pass | Eight routes, source ledger/download, assistant, export, mobile and offline |
| Real API integration/capture | FIRETRACE_CAPTURE_SWAGGER=1 npm run e2e:evidence |5 pass | Isolated index/backend8012 and preview4182 |
| Production build | npm run build |Pass | Existing large-bundle warning |
| Existing index builder | python backend/scripts/build_index.py |Pass |18 validation gates, originals untouched,131 records |
| Combined launcher | FIRETRACE_FRONTEND_PORT=5180 npm run dev:full |Running | Existing API8000, frontend5180; user's5173 untouched |
| Full diff | git diff --check |Pass |No lint script configured |

Python3.14.6, Node24.14.1, Windows. Test logs are included. Workspace-local pytest basetemp avoids this machine's shared-temp permissions; tests/browser processes ran outside restrictive sandbox file locks. Existing Starlette/httpx TestClient deprecation and large-bundle warnings remain. Swagger capture is opt-in due to CDN assets; normal scientific/API tests need no NASA/model network.

## 10. Performance and Security

Existing FTS/indexed retrieval and request/body/rate middleware are preserved; no new ranking service. Scientific tables use primary/foreign keys and source/measurement indexes. Connections are closed on failed index loads; snapshots are read-only when persistent. Pagination remains bounded (existing max200), offset capped100000, client timeout8s. Registered downloads use fixed source IDs, contained basenames, existing CC0 metadata and rechecked SHA-256, never client paths or unrestricted URLs. Generated URLs pin corpus identity. Client/server mismatch causes409/bundled fallback. Existing configured CORS/provenance headers remain; Swagger CSP relaxation is confined to /api/docs. Localhost launch defaults, no credentials or generated database committed. No public deployment or production security certification is claimed.

## 11. Breaking Changes

Default existing API search semantics, typed response envelopes, deterministic services and source data remain. Added fields/routes/Atlas flags are additive. Unknown experiment filters now422 and excessive offset422. All requests may pin X-Corpus-Version; stale pins409. API-backed comparison now exposes direction mismatches and may classify applicability more conservatively. React now attempts same-origin API use and displays explicit session status; VITE_EVIDENCE_API=off keeps browsing bundled. Old index formats rebuild/fall back rather than serving incomplete snapshots.

## 12. Known Limitations

- No new verified report-passage collection, embeddings, generative AI or predictive model.
- Main's existing deterministic assistant/scenario/export/FTS implementation is reused; this PR does not claim to have newly implemented those features.
- Offline comparison retains the existing frontend audit; API comparison retains published tolerances plus the added direction check. Shared investigation labels are context, not measured g-levels.
- Date sort uses source-reported strings, not an inferred chronology. Snapshot verification still reads curated JSON on startup to establish identity.
- No authentication/Internet deployment/large-scale benchmark or optional voice-runtime validation. Existing warnings remain.
- Both PRs cannot remain open because PR #1 was merged externally. This PR stays open/unmerged; no merge was performed by this work.

## 13. Manual Review Guide

1. npm ci; create backend/.venv and install backend/requirements.txt. npm run dev:full validates/rebuilds storage and starts backend8000/frontend5173. Use FIRETRACE_FRONTEND_PORT=5180 if5173 is occupied. Full Windows/Unix commands are in docs/pr2-foundation.md.
2. Open /docs and /health/ready. Atlas: confirm API connected, search BASS2-B1, inspect corrected22.2% O2, null pressure, context gravity and raw CSV row2.
3. Download the registered PSI-25 original; verify its manifest hash. Inspect the retained measurement ledger and report-scope note.
4. Methodology: check calculated coverage, including0 per-test measured gravity versus131 context labels.
5. Compare Saffire S1/S2: direction is mismatched; unknown pressure stays unknown and no fused safety score appears.
6. Stop backend and change an Atlas filter: whole session falls back to bundled data. Check every route and assistant. Reload retries. Version409/unverified responses are covered by automated tests.
7. Review schema/integration notes, actual logs/screenshots and original-file diff (unchanged). Leave this PR unmerged.

Before PR #3: agree offline/backend comparison parity fixtures, verified passage ingestion and grounded-answer evaluation over the now-integrated scientific provenance. No new LLM integration is included here.
