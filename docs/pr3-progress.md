# TRACE implementation progress

## Starting point

User specification: Downloads/Prompt.md, read completely on 2026-11-14.
Independent worktree: FIRETRACE-ai-assistant. Branch:
feat/evidence-grounded-ai-assistant, created directly from fetched origin/main
2d9d4e7801b7cf521b8e3a424de5d65b008d280b. No PR commits copied.

The specification's PR state is stale: GitHub confirms PR #1 is merged and
PR #2 remains open. Main already has FastAPI, FTS retrieval, deterministic
claim validation, rate/body middleware and a typed frontend client. Reuse
these boundaries; do not duplicate PR #2's persistent scientific snapshot.

## Audit findings

- Existing assistant constructs claims deterministically and validates source
  resolution, numeric tokens and reproducible computations.
- Existing React assistant calls /api/v1/ask and falls back to bundled answers.
  It retains displayed messages but sends no follow-up history to the server.
- Existing UI repeatedly promises that no external model is called. These labels
  must become accurate per-answer mode labels when generation is introduced.
- Corpus retains corrected values, raw tokens, flags and contextual gravity.
  Table pressure omissions must not be generalized to all NASA research.
- Verified report context is separate from row measurements; do not infer mappings.
- Existing voice/Ollama functionality is separate from this milestone.
- No lint script is configured. Build includes TypeScript checks.

## Baseline

- Backend: 155 tests passed. Existing Starlette/httpx deprecation and Windows
  pytest cache permission warning observed.
- Frontend baseline:89 tests and production build passed.

## Implementation acceptance plan

1. Add isolated assistant request/response schemas and configurable server-side
   provider adapter; disabled/missing credentials must retain deterministic output.
2. Retrieve fresh controlled evidence for each question, resolving history only
   as query context. Preserve stable IDs, units, statuses and source addresses.
3. Validate structured generation, citation membership and numeric/field support;
   preserve deterministic safety abstention and exact calculations.
4. Integrate conversation, explicit mode/failure labels, citations and retry into
   existing UI. Keep browser-offline behavior.
5. Add offline provider mocks and labelled scientific evaluation, run regression
   checks, capture actual browser states and document unverified live calls.
6. Commit/push one independent PR against main with integration notes. No merges.

## Status

Implementation and regression verification complete:185 backend tests,93 frontend
tests, TypeScript and production build pass.30 backend/4 frontend tests added.
Real SDK serialization/parsing tested through mocked HTTP transport; no authenticated
live model call because no key is configured.10 labelled evaluation cases pass.
Eight routes and core assistant interactions checked in ChatGPT browser. Standalone
Playwright blocked by missing headless-shell1254; mobile override ineffective, unverified.
Source data unchanged. Screenshots/logs in docs/evidence/pr3. See trace-assistant.md.
PR publication is the remaining handoff step.
