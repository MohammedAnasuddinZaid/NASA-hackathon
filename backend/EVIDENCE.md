# Scientific evidence backend

Run from the repository root. This model-free service is separate from the existing optional voice service (`backend/main.py`); both default to port 8000, so run only one there. No model files, credentials, Docker or external API is required.

## Setup (Windows PowerShell)

Requires Python 3.11+ (tested 3.14.6), Node 20.19+ or 22.12+ (tested 24.14.1). Use `.cmd` for npm when PowerShell disables `.ps1` scripts.

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-evidence.txt
npm.cmd run dev:full
```

This initializes SQLite, starts FastAPI on 127.0.0.1:8000 and Vite on 127.0.0.1:5173. Open http://127.0.0.1:5173/#/atlas and http://127.0.0.1:8000/docs. Stop with Ctrl+C. If 5173 is occupied by another worktree, set `$env:FIRETRACE_FRONTEND_PORT='5174'` before running the launcher; use the Vite proxy. Add that origin explicitly if calling cross-origin.

Unix: `python3 -m venv backend/.venv`, `backend/.venv/bin/python -m pip install -r backend/requirements-evidence.txt`, then `npm run dev:full`.

Separate commands:

```powershell
backend/.venv/Scripts/python.exe -m backend.evidence.ingest
backend/.venv/Scripts/python.exe -m uvicorn backend.evidence.main:app --host 127.0.0.1 --port 8000 --timeout-keep-alive 5
# A second terminal:
npm.cmd run dev
```

Activate the venv to use `npm run db:init` and `npm run test:backend`, or use explicit Python paths. `FIRETRACE_PYTHON` optionally supplies a Python executable to the Node launcher. No shell execution is used by that launcher.

## Data flow and architecture

```text
preserved NASA artifacts -> existing pipeline/ingest.py -> normalized JSON + manifest + validation
                                                          |
                                             evidence.ingest validation
                                                          |
                                          SQLite -> evidence.services -> FastAPI /api/v1
                                                                          |
                                                     fingerprint-checked React client
```

The importer does not run the existing ingestion script or rewrite its outputs. To intentionally regenerate scientific inputs, install the existing pipeline's `openpyxl` dependency separately, run that pipeline, inspect its outputs, rebuild SQLite and restart/rebuild the frontend. Main's upstream ingestion uses timestamps and has validation limitations addressed independently by PR #1.

Tables: `dataset` stores a fingerprint and corpus metadata/context/claims/presets/limitations plus upstream validation; `investigations` stores investigation context; `experiments` stores lossless record JSON plus indexed search scalars; `measurements` stores each lossless measurement with record foreign key; `sources` stores artifact registry and context links; `claims` preserves existing claims. Source IDs identify investigations; multiple artifacts share a source ID. Artifact IDs are `<source_id>--<original_filename>`, while context-only links use the source ID. JSON payloads preserve optional future provenance fields. No verified report passage collection exists in main, so there is no invented passage table or excerpt.

Schema version is `PRAGMA user_version=1`; serving refuses incompatible versions. Import initializes v0 or replaces v1 contents in a transaction. Future schema versions require an explicit migration or a fresh database. Rebuild/reset by stopping the service and importing again (replaces rows atomically); a new path with `--database backend/data/new-evidence.sqlite3` provides a fresh isolated build. Generated databases are ignored.

Validation: Pydantic checks types, finite quantities and missing-null invariants; checks report totals/FAIL gates/duplicate IDs/investigation references; verifies all manifest artifact SHA-256s; checks each raw record against its original CSV row. Unique keys enforce record, measurement, source-artifact and claim identity. No missing values are filled. Original and normalized units/statuses are imported verbatim; validation means contract/integrity validation, not a new scientific audit. Existing suspect records are retained with flags. Identical import inputs yield equivalent records/coverage and the same fingerprint, not necessarily identical SQLite file bytes.

Dataset ID: SHA-256 over the three UTF-8 input files (`corpus.json`, `source_manifest.json`, `validation_report.json`), CRLF normalized to LF, joined with LF in that order. Vite computes the same ID at build/start time without bundling raw JSON a second time. Every evidence request sends `X-Firetrace-Dataset`; mismatch is 409. Responses carry the matching header. Downloads also pin the dataset in their URL. Rebuild after changing data. A fingerprint is an identity check, not proof of NASA authenticity; original-file hashes and locators supply provenance.

## API

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/api/v1/health` | Database readiness, schema, dataset identity, count |
| GET | `/api/v1/experiments` | Full records, `items,total,limit,offset,dataset_id` |
| GET | `/api/v1/experiments/{id}` | Original normalized record, raw values, units, flags, measurements, locators; 404 unknown |
| GET | `/api/v1/coverage` | Calculated non-null/null, per-test measured/corrected, context-only, status/unit counts and investigation/quality/source breakdown |
| GET | `/api/v1/sources` | Artifact/context registry, availability and authoritative links |
| GET | `/api/v1/sources/{source_id}` | All registered artifacts for a source; 404 unknown |
| GET | `/api/v1/sources/{source_id}/download?artifact_id=…` | Registered CC0 original only; otherwise 404 with authoritative-link guidance |
| POST | `/api/v1/compare` | `{"experiment_ids":["BASS2-B1","SAFFIRE1-S1"]}`; 1–4 distinct IDs |
| GET | `/api/v1/passages` | Empty collection with explicit unavailable-text limitation |

Search parameters: `q` (all whitespace-separated literal keyword terms, up to 200 characters; exact test/full ID takes precedence), `investigation` (family label), `material` (exact parsed family), `quality`, `experiment_id`, `source_id`, `o2_min/max` (% by vol), `flow_min/max` (cm/s display/setting), `flow_only`, `sort` (`id,o2-asc,o2-desc,material,date`), `limit` (1–100, default24), `offset` (0–100000). Numeric filters exclude null values. Without a numeric filter nulls are retained; oxygen sorts put null last. Date sorting uses existing reported strings, not chronological reinterpretation. ID order is natural numeric. Exact source/material filters are case sensitive. Unknown list-search parameters are rejected. Indexed scalars and parameterized queries suffice for this small corpus; keyword matching uses SQLite `instr`, no FTS/vector service.

Comparison returns selected records, condition checks, differing fields, missing measurement fields, source locators, limitations and dataset identity. It conservatively checks dimensions, raw material specification, geometry, atmosphere, per-test gravity, flow basis/direction, ignition, outcome and test method. A shared value does not establish comparability. No probability or ranking is returned. Gap Planner stays on its current deterministic frontend implementation; scenario migration is deferred to avoid duplicating its planning/report behavior in this foundation PR.

Errors: `{"error":{"code":"…","message":"…"}}`, validation adds safe field locations. Invalid inputs422, unknown IDs404, mismatch409, oversized POST413, unavailable database503. Server paths and traces are not returned. Sync routes use bounded SQLite connections closed after each operation; 5-second DB busy timeout, maximum8192-byte POST bodies, 4-second client fetch timeout. CORS allows only configured origins, no credentials/wildcards. Logs omit request bodies and query strings. Original downloads use only the imported registry, containment checks, CC0 license and hash revalidation, never a user path or proxy URL. This local service does not implement authentication or production Internet rate limiting.

Environment: `FIRETRACE_EVIDENCE_DB` (default backend/data/evidence.sqlite3), `FIRETRACE_EVIDENCE_ORIGINS` (comma-separated explicit frontend origins); set in the process environment. The evidence service does not read voice `.env` settings. Vite uses `.env` with `VITE_EVIDENCE_API=off` to disable API attempts and `VITE_EVIDENCE_API_BASE` for a separate backend origin. Default blank base uses Vite's localhost proxy. Production static hosting uses bundled fallback or needs an explicitly configured API origin/reverse proxy; this PR deploys nothing.

## Frontend behavior

One shared provider verifies identity and database coverage. Atlas calls paginated search and detail APIs. The drawer obtains registered source metadata/downloads. Methodology shows calculated API field coverage. Compare requests deterministic backend checks. Other routes keep the existing bundle and deterministic assistant; API and bundle must be identical inputs. Any API failure/mismatch switches the whole session to the complete bundle, clears API coverage, stops subsequent evidence calls and displays a reason. Reload retries. No cross-version merging occurs. Short in-flight transitions may show identical bundled rows until the response arrives; this is not a dataset switch. Static builds remain usable.

## Tests and review

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/evidence/tests -q
npm.cmd test
npm.cmd run build
npm.cmd run benchmark
npm.cmd run e2e
npm.cmd run e2e:evidence
```

Tests use isolated temporary SQLite databases. On this Windows environment the shared pytest temp directory is inaccessible; `--basetemp=tmp/<new-test-directory>` works after creating `tmp`. Browser tests require installed Playwright Chromium (`npx playwright install chromium`); existing local browsers can be selected with `PLAYWRIGHT_BROWSERS_PATH`. The integration configuration starts an isolated database/backend on8000 and preview on4182 and refuses to reuse existing servers. The original browser suite explicitly exercises bundled mode. Swagger screenshot capture needs access to FastAPI's normal CDN assets; API/unit tests do not require NASA or model network access.

Manual review: check health and `/docs`; search B1 in Atlas; inspect CSV row2/raw fields and original download; inspect Methodology coverage/status counts; compare the two Saffire samples' directions; stop backend and change an Atlas filter to trigger explicit fallback; confirm all eight routes still work. To test mismatched versions, rebuild the database from a changed, reviewed normalized dataset without rebuilding Vite: the browser must refuse API use. No data editing is necessary for normal review.

PR #3 can reuse these source-linked search/detail contracts for evidence retrieval. First reconcile PR #1's richer provenance/statuses, add verified passage ingestion if needed, and agree grounded-answer evaluation criteria. PR #2 introduces no new LLM integration; the pre-existing optional voice service remains unchanged.
