# PR #2 specification and progress

Independent base: `origin/main` at `2fb1d1239b7a83a388c2b3687fe0f72283f67dde` (fetched 2026-11-14). Branch: `feat/backend-evidence-api`. Separate worktree: FIRETRACE-backend. PR #1 remains open and untouched. The user's independent-branch instruction supersedes the pasted prompt's stacked strategy.

MVP: persist current pipeline output, preserving its contract exactly; provide bounded read/search, coverage, provenance/download and deterministic comparison APIs; connect the existing Atlas/detail/comparison and coverage UI with a whole-session bundled fallback. No new models, voice implementation, source expansion or predictive analysis.

Acceptance criteria:

- Import every normalized record and measurement without changing its raw/normalized values, statuses, units, notes or citations. Reject invalid, duplicate, mismatched or tampered sources before persistence. Re-import is idempotent and transactional.
- Health and OpenAPI work without voice/model dependencies. Search/filter/pagination/detail/coverage/source/compare contracts are validated and tested offline against temporary databases.
- API downloads accept registered identifiers only and return untouched, hash-verified CC0 originals; other sources retain authoritative links.
- Atlas performs real API search and detail requests, coverage comes from database records, comparison requests use the API. Dataset mismatch/failure disables all evidence API use for the session and preserves every route with bundled data.
- Run unit/build/browser checks, capture genuine evidence, document setup, limitations and PR #1 integration concerns. Open exactly one PR against main; merge neither PR.

Milestones: (1) inspection/base/baseline, (2) database and API, (3) React integration and failure handling, (4) verification/documentation/PR. Baseline: 80 Vitest, 18 Playwright, 20 existing backend tests, production build pass; pre-existing bundle-size warning. Optional voice dependencies not started. No repository issues found during read-only issue search.

Inspection findings: main already has `backend/main.py`, optional voice/model dependencies and voice-session SQLite storage. Those remain separate. Existing `pipeline/ingest.py` generates the normalized corpus; this PR imports those outputs instead of duplicating the scientific parsing. Main's data is pipeline v0.1.0, not PR #1's v0.2.0.

Execution notes: Node 24.14.1, Python 3.14.6. Old Pydantic pin lacked a compatible wheel; selected compatible binary packages. Windows sandbox temp-file renames and shared pytest temp permissions required tests outside sandbox and workspace-local temporary databases. These were environment failures, not counted as successful tests.

Completed: SQLite/API foundation, source-row integrity gates, React connection/fallback, controlled originals, conservative comparison, coverage with explicit measured/context distinctions, docs/dictionary/evidence. Final checks: 44 evidence backend tests, 20 existing backend tests, 83 frontend tests, 18 static browser flows, five real integration/capture checks, production build and 30/30 existing benchmark. Local combined launcher verified on5174 with API8000; original5173 server untouched. Known warnings: large bundle and upstream TestClient deprecation. PR description prepared in docs/pr2-description.md; publication status will be reported after actual GitHub creation.
