# Actual verification evidence for the adapted PR #2

These files were captured against `feat/backend-evidence-api-current`, based on main2d9d4e7 after the user selected adaptation. They are not captures/results from the superseded standalone prototype branch.

- `atlas-api.png`: version-verified API search returning BASS2-B1.
- `provenance-api.png`: genuine source row2, DOI/license, preserved PR #1 caveats and registered API downloads.
- `coverage-api.png`: actual database-backed coverage with non-null versus measured/context counts.
- `fallback.png`: deliberate409 response in the browser test; whole-session bundled search remains usable. The503 transition is separately exercised.
- `swagger.png`: actual existing FastAPI docs, including new source inventory/download routes; docs-only CSP fix allows its normal assets.
- `record-response.png`: actual B1 API response with raw tokens/units/statuses/measurements.
- `backend-tests.txt`, `frontend-tests.txt`, `build.txt`, `integration-tests.txt`, `static-tests.txt`: actual command output. Only trailing whitespace was trimmed.

Screenshots were generated with Playwright Chromium against an isolated real SQLite/backend8012 + frontend4182. They were visually inspected. No screenshots, scientific data or results are synthetic/AI-generated. Swagger capture is opt-in because standard Swagger assets use a CDN; normal source/API tests require no NASA/model network. No before/after image is fabricated for these new capabilities.

Codex assisted implementation, tests and documentation. Human team review is pending. No NASA endorsement or safety certification is claimed. Existing large-bundle and upstream TestClient deprecation warnings are recorded in the logs.
