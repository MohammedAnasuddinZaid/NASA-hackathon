# Real PR #2 verification evidence

Screenshots were captured by Playwright Chromium against the actual local FastAPI service and built React frontend using `e2e/evidence.spec.ts`. The service imported main's corpus into a temporary SQLite database. No rendered UI or API screenshot is synthetic or AI-generated.

- `swagger.png`: actual FastAPI docs, nine registered endpoints. Swagger uses its normal CDN assets; optional capture enabled with FIRETRACE_CAPTURE_SWAGGER=1.
- `record-response.png`: genuine BASS2-B1 API response, including row2, null pressure, investigation-level gravity, raw source and measurements.
- `atlas-api.png`: successful API search, one B1 row, version-verified connection banner.
- `provenance-api.png`: source row, DOI/CC0 and controlled original-download links in the drawer. Actual CSV download filename and backend SHA-256 verified by tests.
- `coverage-api.png`: calculated field/status counts from SQLite with non-null versus per-test/context distinctions. Includes unchanged main-branch scientific metadata outside the added API panel.
- `fallback.png`: deliberately unverified API response intercepted in the browser test; full bundled search stays available. Actual 503 and version409 transitions are also exercised. This image is not labeled as a stopped-server screenshot.
- `backend-tests.txt`, `frontend-tests.txt`, `integration-tests.txt`, `build.txt`: captured command output from actual validation runs.

These are new capabilities, so no misleading before/after pairs are supplied. Baseline checks and known pre-existing scientific issues are documented in `docs/pr2-plan.md` and `docs/pr2-integration.md`. AI usage: Codex assisted implementation, tests and documentation; source data/screenshots are actual preserved NASA artifacts and local runtime captures. Human team review remains pending.
