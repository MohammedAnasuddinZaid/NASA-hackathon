# FIRETRACE integrated build status

Updated 2026-11-15. Local research-support QA candidate; no certification or public deployment.

- Baseline main: `19d33b5be23e8aced5141e97c2ef9cc7fe1a74f1`; PRs #1–#7 merged.
- QA branch: `qa/complete-local-regression`; grouped fixes are for review, not automatic merging.
- 131 records: 129 BASS-II / 2 Saffire-I; 71 validated / 56 partial / 4 suspect.
- Zero reported per-record pressure, measured test gravity or standardized outcomes.
- Research: 3 investigations, 16 findings, 2 reports; zero normalized FLEX records.
- Original NASA files unchanged; 24 generated artifacts reproduce byte-for-byte.
- 232 frontend, 211 backend, 19 pipeline tests pass; 30/30 deterministic benchmark.
- Browser: 30 default, 5 evidence, 2 TRACE mock, 5 integration, 33 expanded QA tests pass.
- Dedicated basket/library 2+2 tests pass (overlap the default suite).
- All 131 drawers and their basket add/remove controls exercised; real backend-stop/reconnect verified.
- Six widths, 9 views and expanded menu/drawer accessibility checks completed.
- No live provider credential or speech models: live AI and speech quality remain unverified.
- No service worker/cold offline guarantee. Research assets/PDFs need an initial network fetch.
- No predictive risk score, partial-gravity experiment inference or NASA endorsement.

See [local QA report](docs/local-qa-report.md), [deployment](docs/deployment.md), and
[screenshots/evidence](docs/evidence/local-qa/). Historical integration reports describe their
own earlier baseline; this file and the local QA report supersede their current-status claims.
