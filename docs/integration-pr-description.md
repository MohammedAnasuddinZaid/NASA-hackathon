## 1. Executive summary

Integrates the remaining basket/export and research-discovery work into an isolated release candidate,
restores missing PR2 API browsing behaviors, and fixes confirmed scientific identity/security regressions.
Ready with documented limitations for human review. No GitHub PR merged/closed and no deployment made.

## 2. Actual PR1–6 status

Rechecked signed-in GitHub: #1 merged, #2 open, #3 merged, #4 merged, #5 open, #6 open.
Main baseline `d7c53f4`; original heads recorded in the [audit](docs/final-integration-review.md).
Git merge-tree confirms PR2 conflicts; its GitHub widget did not finish loading in the review client.

## 3. Integrated changes

Locally merge PR6 then PR5, retaining original commits/authorship. Preserve TRACE, scenario planning,
provenance, all eight routes, basket providers, research styles, filters and useful scripts.

## 4. PR2 reconciliation

36/47 changed paths match main; the 11 differing paths were individually reviewed. Keep newer backend,
TRACE/planner code. Restore API Atlas search/pagination/detail and separate API comparison audit,
attributed to PR2 `3c6da7d`/`ef603f7`. Do not merge its obsolete branch. After approval, recommend
closing PR2 as superseded; it remains open.

## 5. Conflict resolution

Only actual PR6→PR5 conflict: `src/main.tsx`; retain both research CSS imports, scenario CSS,
EvidenceSession, BasketProvider and App. Auto-merged README/package/Atlas behavior checked.

## 6. Architecture verification

Existing Vite/React/TypeScript + FastAPI/SQLite retained. Shared browser API base; corpus-pinned
responses; whole-session bundled fallback; atomic scientific/FTS index. No new service or predictive ML.

## 7. Scientific data verification

131 experiments (129 BASS-II / 2 Saffire-I), 16 separate findings (8 BASS-II / 8 FLEX), 3 research
investigations, 2 reports, 0 normalized FLEX records. Null pressure/gravity/outcomes remain unknown.
All 16 PDF page anchors verified; 24 generated files reproduce exact bytes. Research checks actual
bundled corpus identity, not just its paired coverage file.

**Large diff explanation:** Git previously normalized locked NASA/source snapshot CRLF bytes to LF.
Preserve the already-verified original bytes across platforms and make ingestion newline output explicit.
The corpus remains `89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`;
no scientific values changed. Review [byte evidence](docs/evidence/integration/cross-platform-bytes.json)
and use `git diff --ignore-space-at-eol` for semantic review.

## 8. API verification

210 backend tests cover storage/idempotence, original downloads, retrieval, comparison, scenarios,
answers/TRACE/calculation, exports, health/OpenAPI, validation/rate/CORS/path/error handling.
Actual uvicorn E2E verifies API browsing and failure/mismatch fallback. Unknown record returns 404.

## 9. TRACE verification

Real SDK wire-contract exercised via local MockTransport; provider/citation/timeout/follow-up tests
and two mocked browser tests pass. Seven requested questions run against deterministic backend TRACE.
No server key available: authenticated generation remains pending; no paid calls claimed.
Report/FLEX requests explicitly abstain and refer to Research Library rather than answering from
unrelated solid-fuel records. TRACE shares corpus/header/body verification with the evidence session.

## 10. Basket and Research Library

Combined real-backend journey: Atlas → basket/reorder/reload → compare → brief → four validated
downloads → report page citation → original experiment. Invalid research and stale IDs fail explicitly.
Research findings stay separate from experiment measurements and numeric rankings.

## 11. Security findings

Fix backend CSV formula injection including hidden BOM prefixes; keep true numeric/null types.
Fix stale dataset acceptance and report/test routing. API timeouts include body reads. Preserve
artifact allowlist/hash/path protections, React escaping and model grounding. No secrets committed.

## 12. Test results

- Baseline: 137 frontend, 195 backend; build passed.
- Final: 224 frontend, 210 backend, 19 data tests; production build passed.
- Exact regeneration: 24 files; PDF/hash/page checks passed.
- Browser: 30 standard + 5 API (including Swagger) + 2 mock TRACE + 5 combined passed.
- Dedicated basket 2 and library 2 passed (overlap standard coverage).
- Chromium revision1254 installed; 0 production dependency vulnerabilities.
- One nonfailing Starlette/httpx deprecation. Hosted CI status is separately recorded after publication.

## 13. E2E screenshots

[Atlas](docs/evidence/integration/atlas-api.png) · [basket](docs/evidence/integration/atlas-basket.png) ·
[comparison](docs/evidence/integration/comparison.png) · [brief](docs/evidence/integration/research-brief.png) ·
[research](docs/evidence/integration/research-citation.png) · [provenance](docs/evidence/integration/provenance-api.png) ·
[TRACE deterministic](docs/evidence/integration/trace-deterministic.png) ·
[Swagger](docs/evidence/integration/swagger.png) · [mobile](docs/evidence/integration/mobile-390.png).
Actual downloaded bytes checked by tests. [Logs and audit](docs/evidence/integration/).

## 14. CI changes

New least-privilege GitHub Actions frontend, science/backend and Chromium jobs on PR/push/manual.
Pinned dependencies, Node24/Python3.12, caching, browser installation and useful artifacts; no AI key.
Optional Swagger screenshot is CDN-dependent and skipped by default in hosted CI, executed locally.

## 15. Deployment readiness

Ready with documented limitations; frontend production build and backend startup work.
Same-origin/default API and explicit static-only configuration documented. No public hosting deployed.
See [deployment instructions](docs/deployment.md).

## 16. Known limitations

No live authenticated model check; TRACE does not retrieve Research Library passages; FLEX units and
report-version discrepancies deferred; no guaranteed cold offline reload; optional voice unvalidated;
core corpus bundle ~2.23MB / 214kB gzip. No pressure imputation, fire-risk prediction or certification.

## 17. Exact local startup

```powershell
npm.cmd ci
py -3.12 -m venv backend/.venv
& backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm.cmd run dev:full
```

Open http://127.0.0.1:5173/#/overview and http://127.0.0.1:8000/api/docs.
For TRACE install requirements-ai.txt and configure ignored server-side `.env`; basic app needs no key.
Linux equivalents and independent startup commands are in docs/deployment.md.

## 18. Manual review steps

1. Inspect original-byte-only changes and runtime corpus/research identities.
2. Search B1, open ledger/CSV row2, inspect corrected22.2% oxygen and null pressure.
3. Compare Saffire S1/S2 directions; review planner and separate backend audit limitations.
4. Basket two records, reload/reorder, generate and inspect CSV/JSON/Markdown/HTML brief.
5. Research daily oxygen PDFp14; FLEX shows8 findings and0 normalized records.
6. Ask missing-pressure/safety/report questions; inspect citations and abstention.
7. Stop backend: whole session falls back visibly. Check mobile and keyboard drawer.
8. Review hosted CI and known limitations before release approval.

## 19. Recommended next actions

Review this single integration PR; keep it unmerged until approval. Its history contains PR5/6 already,
so do not independently reapply them. After approval merge once, then reconcile/close superseded
PR2/5/6 only with human authorization. Provision/test optional AI and approve hosting separately.
Full A–M report: [final integration review](docs/final-integration-review.md).
