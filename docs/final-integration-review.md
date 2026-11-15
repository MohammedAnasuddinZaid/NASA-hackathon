# FIRETRACE final integration review

Reviewed 2026-11-15 in isolated `FIRETRACE-final-review`, branch `integration/firetrace-final-review`.
Default remote main: `d7c53f42b009b06aea2380064610d2362e6009d8`, fetched again after testing.
No existing worktree, feature branch, PR, release, deployment or DNS was modified.

## A. Actual PR status

Statuses were read from signed-in GitHub pages in the ChatGPT browser, not inferred from commit messages.
Descriptions/timelines/review areas and actual Git diffs were inspected. No submitted reviews were found.
The GitHub merge-status widget remained loading on this client; mergeability below is independently
checked with Git, not represented as a fresh GitHub widget result.

| PR | GitHub status / head | Functionality / main audit | Missing/conflicts | Recommendation |
|---|---|---|---|---|
| [1](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/pull/1) | Merged; 199c8e1; merge f752ab7 | Scientific traceability already integrated | None reapplied | Keep merged |
| [2](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/pull/2) | Open; ef603f7 | SQLite/API foundation substantially present through eb79a36, c34e162, 30b4710 | Atlas/Compare API use partly lost; direct merge conflicts | Restore specific behaviors here; recommend closure only after approval |
| [3](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/pull/3) | Merged; 771ed98; merge 79fd953 | TRACE retained | Corpus identity check strengthened | Keep merged |
| [4](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/pull/4) | Merged; bff5559; merge 7e29540 | Planner/deep links/comparison retained | No reapplication | Keep merged |
| [5](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/pull/5) | Open; 44352ad | Basket/brief/exports missing from baseline | One real CSS import conflict after PR6 | Locally merged with history; leave PR open |
| [6](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/pull/6) | Open; 867114b | Research discovery missing from baseline | Runtime actual-corpus guard incomplete | Locally merged then corrected; leave PR open |

Evidence: [GitHub page audit](evidence/integration/github-pr-audit.json),
[47-path PR2 comparison](evidence/integration/pr2-reconciliation.json).

## B. Integration decisions

Local merge `876e9f7` incorporates PR6; `fa5bf53` incorporates PR5. Their original commits and
attribution are retained. PR2 was not merged/cherry-picked/rebased. TRACE, record provenance,
planner selection/deep links, basket controls, research discovery and all useful npm scripts survive.
Keep the simple existing Vite/React + FastAPI/SQLite design. No predictive model/new service added.

Confirmed release issues and corresponding files (searchable symbols are stable locators):

| Issue | Original location | Correction / regression evidence |
|---|---|---|
| Research/coverage only checked each other | `src/lib/researchLibrary.ts:validateResearch` | Compare against actual build corpus SHA; coverage alert; unit mismatch case |
| Atlas/Compare stopped using PR2 API behavior | `src/pages/Atlas.tsx:Atlas`, `src/pages/Compare.tsx:Compare` | Hash-verified remote search/detail and separate backend matching audit; real API E2E |
| TRACE used a different API base and accepted unverified corpus | `src/lib/traceClient.ts:askTrace` | Shared base, request/header/body SHA guards; fallback tests |
| Git LF normalization changed locked source bytes on Linux | `.gitattributes`, `pipeline/ingest.py` output writes | Preserve existing verified CRLF originals/snapshots; explicit deterministic output; byte gate |
| Backend CSV source text could become a formula | `backend/app/v1/exports.py:records_csv/claims_csv` | Escape textual formula prefixes including hidden BOM/control characters; preserve numeric/null types |
| FLEX/report question could route to solid-fuel test answers | `backend/app/v1/assistant.py:Assistant._route`, `src/lib/assistant.ts:ask` | Explicit abstention and Research Library referral; no report-to-test attribution |
| Drawer lacked focus containment/return | `src/components/RecordDrawer.tsx:RecordDrawer` | Tab containment, Escape and return focus; combined keyboard test |
| Mobile source links overflowed | `src/css/modules.css:.source-card__foot/.context-source` | Wrap links/context cards; all routes tested at 390px |
| API timeout stopped at response headers | `src/lib/apiClient.ts:request` | Include JSON body read; remove abort listener and clear timer in finally |

Current integration line references:

- `src/lib/researchLibrary.ts:43` — `export function validateResearch`.
- `src/pages/Atlas.tsx:40` — `evidenceApi.experiments`.
- `src/pages/Compare.tsx:49` — `evidenceApi.compare`.
- `src/lib/traceClient.ts:28` — `export async function askTrace`.
- `pipeline/ingest.py:329` — `newline="\r\n"`.
- `backend/app/v1/exports.py:50` — `def spreadsheet_value`.
- `backend/app/v1/assistant.py:369` — `extra.get("research_scope")`.
- `src/components/RecordDrawer.tsx:70` — `const previousFocus`.
- `src/css/modules.css:1858` — `.source-card__foot {`.
- `src/lib/apiClient.ts:268` — `async function request`.

## C. PR2 disposition

Original merge base `2d9d4e7801b7cf521b8e3a424de5d65b008d280b`, head
`ef603f7639f3904c7ceb225daef39cf894a7f9a9`. 36/47 changed paths match main byte-for-byte,
including persistence/store/router, original downloads, index builder, foundation tests,
apiClient/evidenceSession and the provenance drawer. The 11 differing paths are listed in the JSON audit.
Most reflect newer main TRACE/scenario/test changes and must not be replaced with older files.

Unique useful behavior remained: API Atlas pagination/search/detail and API Compare audit were lost.
This branch reimplements those behaviors in the newer components, attributed to PR2 commits
`3c6da7d` and `ef603f7`, preserving all later interfaces. Public API configuration is documented again.
The backend audit is displayed separately from the stricter planner relationships, with its own
matching policy and explicit no-probability statement; the policies are not falsely equated.
After this integration is approved, no useful PR2 feature requires a separate blind merge.
Recommend marking the old PR superseded during human review; it is still open.

Read-only `git merge-tree` confirms a direct PR2 merge conflicts in `.env.example`, backend README,
`e2e/app.spec.ts`, Assistant, Atlas and Compare. No conflict files were applied to another branch.

## D. Merge conflicts

PR6 merged cleanly into current main. PR5 then produced exactly one actual unresolved path:
`src/main.tsx`. Resolution retains both `research-library.css` and `research.css`, existing
scenario styles, `EvidenceSession`, `BasketProvider` and application initialization.
README/package/Atlas overlap auto-merged; their final behavior was explicitly reviewed and tested.

## E. Scientific validation

- 131 experiment records: 129 BASS-II / 2 Saffire-I; 71 validated, 56 partial, 4 suspect.
- 131 initial oxygen values, 123 flow values; 0 total-pressure values, 0 measured test-level
  gravity values, 0 partial-gravity records, 0 standardized outcomes. Unknown remains null.
- 10 record-layer artifact inventory entries and 3 context entries, distinct from the research
  library's 8 source references. These inventories overlap; do not sum them as unique sources.
- Research: 3 investigations, 16 page-located findings (8 BASS-II / 8 FLEX), 2 reports;
  0 normalized FLEX records. All findings have empty experiment-ID mappings.
- 274 preserved FLEX source rows remain deferred because units and report/CSV version differences
  need reconciliation. Source presence does not imply normalized/validated measurements.
- PDF hash/page-anchor checks succeeded against the previously acquired original NASA PDFs;
  all 16 findings validated. No new scientific values were added in integration.
- Original values/units/correction flags/raw tokens and source rows are preserved; parsed dimensions
  stay derived, gravity stays investigation context, approximate Saffire oxygen stays qualified.
  Solid-fuel spread and droplet combustion are never ranked as equivalent evidence.

Actual corpus SHA: `89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`.
Research version: `8901d73c117984bd28f8195d41ace0d4021b44346b2c575d1eca7477ca24d5f8`.
24 generated files reproduce exact bytes. A fresh index checkout with core.autocrlf=false also passes all 19 pipeline tests and the 24-file byte gate. This models clean-checkout bytes locally; hosted Linux CI is tracked separately. The old Git LF corpus blob was `17178f22...`; Windows
verified source files/snapshots already used CRLF and the identity above. Git now preserves those
verified bytes on every platform. This creates a large line-ending-only diff, with no JSON value
or CSV token change. [Byte evidence](evidence/integration/cross-platform-bytes.json).

## F. Backend validation

210 passing pytest cases include startup/health; SQLite lossless records/measurements and repeated
idempotent ingestion; FTS retrieval; search/filter/detail; source inventory and original bytes;
coverage; comparisons; scenario evaluation; deterministic answers; TRACE; calculations; exports;
bad IDs/bounds/malformed input; corpus 409; rate limits; CORS; artifact/path controls; error redaction.
Live HTTP API browser suites use a fresh temporary index and genuine uvicorn responses.
`/health/live`, `/health/ready`, `/api/v1/coverage`, B1 detail, PSI25 source, `/api/openapi.json`,
and `/api/docs` returned 200; invalid record returned 404. Original CSV download matched preserved bytes.

## G. TRACE verification

Server credentials stay in ignored backend/root `.env`; none were present in process/project files.
AI defaults disabled. Real OpenAI 2.54.0 SDK serialization/parsing is exercised with httpx MockTransport,
plus mocked provider grounding/citation rejection, timeout, rate limit, disabled/missing-key and follow-up tests.
Two browser TRACE mock tests pass; no mock is labeled authenticated generation. Seven requested
scientific questions were executed against real backend deterministic TRACE; see
[responses](evidence/integration/scientific-question-smoke.json). Safety certification abstains,
missing pressure stays absent, and FLEX/report requests explicitly refer to Research Library.
Standalone follow-up without prior user context returns retrieved context, not invented anaphora.
Live authenticated model testing is pending because there is no credential; no paid call made.

## H. Frontend functionality

All eight pages, research filters/source citations, record detail/measurement ledger, basket add/remove/
clear/reorder/persistence and selected comparison are covered. The combined real-API journey follows
Atlas -> basket -> comparison -> brief -> CSV/JSON/Markdown/HTML downloads -> research page citation ->
original experiment drawer. Export contents are read and checked, not merely clicked. Missing pressure
remains unknown/null/empty as appropriate to format. A Markdown fixture assertion was corrected to
account for deliberate punctuation escaping; exported content was correct.

Negative cases include invalid record links, empty search, stale basket IDs, invalid research JSON,
corpus mismatch, mid-session backend failure, AI unavailable and already-loaded offline navigation.
Responsive tests inspect all routes plus research at 1440/768/390px without document overflow.
Keyboard Tab stays inside the drawer; Escape closes it and focus returns to its trigger.
The integrated application was also inspected manually in the ChatGPT browser on localhost:5198,
confirming API-connected B1 values, source row and preserved-original provenance.

## I. Test matrix

| Test | Command | Final local result | Notes |
|---|---|---|---|
| Install | npm ci --ignore-scripts | Pass, 101 packages | Pinned lockfile; no package install scripts needed |
| Main baseline | npm test / build / pytest | 137 / build pass / 195 | Prior to local feature merges |
| Frontend | npm test | 224 passed | 14 files |
| Production | npm run build | Pass | Core ~2234 kB / 214 kB gzip; research lazy ~9.3 kB |
| Original + research pipeline | validate:data | 19 passed | Correct local Python with openpyxl |
| Research pipeline subset | validate:research | Included, 10 passed | Also in full pipeline suite |
| Exact generated bytes | python scripts/verify-release-data.py | 24 files pass | Both snapshots and actual base SHA |
| PDFs | pipeline/research.py --verify-pdfs ... --output-root tmp/pdf-verified | Pass | Cached authoritative PDFs, no value invention |
| Backend | python -m pytest backend/tests -q | 210 passed | One Starlette/httpx deprecation warning |
| Browser executable | npx playwright install chromium | Installed | Chromium/headless shell revision 1254 |
| Standard browser | npm run e2e | 30 passed | Includes planner, research and basket |
| Actual API | e2e:evidence, FIRETRACE_CAPTURE_SWAGGER=1 | 5 passed | Swagger CDN succeeded locally |
| TRACE mock | npm run e2e:trace | 2 passed | Not live generation |
| Combined | npm run e2e:integration | 5 passed | Real backend, exports and 3 viewport sizes |
| Basket dedicated | npm run e2e:research | 2 passed | Repeat subset, not additional distinct coverage |
| Research dedicated | npm run e2e:research-library | 2 passed | Repeat subset |
| Dependency audit | npm audit --omit=dev --audit-level=high | 0 vulnerabilities | Snapshot at review time |

Logs in [evidence directory](evidence/integration/). Failed intermediate assertions/BOM case were
fixed and rerun successfully; no failing scientific check was disabled. CI's optional Swagger
screenshot remains skipped by default because it needs CDN access; actual local run enabled it.
Hosted CI status is recorded in the publication update below; do not infer a green run from this table.

## J. Screenshots

Genuine local browser evidence: [API Atlas](evidence/integration/atlas-api.png),
[basket selection](evidence/integration/atlas-basket.png), [comparison](evidence/integration/comparison.png),
[brief](evidence/integration/research-brief.png), [research citation](evidence/integration/research-citation.png),
[provenance](evidence/integration/provenance-api.png), [TRACE disabled](evidence/integration/trace-deterministic.png),
[Swagger](evidence/integration/swagger.png), [actual response](evidence/integration/record-response.png),
[mobile](evidence/integration/mobile-390.png), [tablet](evidence/integration/mobile-768.png).
Screenshots are after-state evidence, not fabricated before/after comparisons. Download bytes are
asserted in tests; export serializers/content/MIME and missing-data discipline also have unit coverage.

## K. Security findings

Fixed CSV formula text, stale-corpus acceptance, report-to-test routing and response-body timeout.
Existing artifact registry/CC0/hash/path checks, React escaping, finite-number validation, request
bounds/rate limits and AI citation/numeric gates retained. No `.env`, key, runtime database, model
or browser session file is committed. SDK credentials never enter browser variables. Source files
are data, never executable instructions. No new external service, broad permission or paid model call.
GitHub workflow token grants only contents:read; CI uses no model secret.

## L. Remaining limitations

| Severity | Reproduction / affected area | Remaining work |
|---|---|---|
| P1 before claiming live AI | Enable TRACE without a provisioned accessible server key | Verify one authenticated model response; currently pending, not a basic-app blocker |
| P1 scientific scope | Ask about report/FLEX passages in Assistant | Explicitly abstains; use Atlas Research Library. Report ingestion into TRACE not implemented |
| P1 data scope | Attempt FLEX numeric comparison / cabin certification | 0 normalized FLEX tests, no partial gravity/pressure/outcomes; requires verified source reconciliation, not imputation |
| P2 offline | Cold-load research/PDF after network loss | Lazy assets/PDFs need initial network; no service worker/offline reload guarantee |
| P2 optional runtime | Enable legacy voice without models/wheels | Voice remains unvalidated; use typed assistant; optional dependencies separate |
| P2 performance | Build warning / slow cold network | Bundled exact corpus yields ~2.23 MB JS; lazy research retained, broader splitting deferred |
| P2 hosting | Copy static dist to host without API proxy | Configure same-origin reverse proxy or public API base; otherwise honest bundled fallback |
| P3 dependency | Run pytest | Starlette warns about legacy httpx TestClient; tests pass, do not upgrade pinned framework during release review |

No known unresolved P0 blocker in tested local flows. Public hosting, deployment validation, and
hackathon submission page/presentation/AI disclosure remain human follow-up; not deployed here.

## M. Release readiness

**Ready with documented limitations** as a local research-support release candidate, subject to
human integration review and hosted CI results. This is not fire-safety certification or NASA endorsement.
Before approval: inspect line-ending-only scientific diff and identities; open B1 original/ledger;
compare Saffire S1/S2; run planner and basket/brief downloads; inspect FLEX page citations;
disable backend and confirm explicit fallback; review live-AI/voice/offline limits.
After approval, merge this integration once. PR5/6 histories are already included; do not reapply them.
Then close PR2 as superseded and reconcile PR5/6 closure only with human authorization. All left open now.

## Publication / hosted CI

Pending branch publication and hosted checks; updated after the review PR is created.
