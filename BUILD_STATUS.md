# FIRETRACE integrated build status

Updated 2026-11-15. Release candidate for human review; no scientific certification or public deployment.

- Main baseline: d7c53f42b009b06aea2380064610d2362e6009d8.
- Local integration branch: integration/firetrace-final-review. PR6 then PR5 histories preserved.
- PR1/3/4 already merged; PR2/5/6 left open and untouched.
- 131 structured records: 129 BASS-II, 2 Saffire-I; 71 validated / 56 partial / 4 suspect.
- 0 per-record pressure, 0 measured test-level gravity, 0 standardized outcomes; no filled-in values.
- 3 research investigations, 16 findings (8 BASS-II / 8 FLEX), 2 reports, 0 normalized FLEX records.
- Original verified bytes preserved across Git/platforms; generated snapshots reproduced byte-for-byte.
- API Atlas/detail/compare behaviors restored without reverting TRACE or scenario planner.
- TRACE, evidence API and research snapshots checked against actual bundled corpus identity.
- Basket, selected briefs and all four formats integrated with the Research Library.
- Frontend: 224 unit tests pass; backend: 210 tests pass; ingestion/research: 19 tests pass.
- Browser environment repaired. Default 30, evidence API 5 including actual Swagger, TRACE mock 2,
  combined integration 5 pass. Focus containment/return and mobile source-link overflow corrected.
- No live OpenAI verification: no server credential. SDK wire-contract and provider failure tests pass.
- GitHub Actions added: frontend, science/backend and browser jobs without model credentials.
- CI hosted results and publication details are recorded in the final review after the branch is pushed.
- Remaining: report retrieval is separate from TRACE; FLEX units/version reconciliation; per-test
  report mapping; optional voice not validated; no guaranteed cold/offline reload; no public hosting.

See [Final integration review](docs/final-integration-review.md), [Deployment](docs/deployment.md),
and [genuine test/screenshot evidence](docs/evidence/integration/).
