# FIRETRACE local QA report

Date: 2026-11-15. Verdict: **CONDITIONAL PASS for local research-support review**.
Core evidence workflows pass the checks below. Live model generation and actual speech are
not configured and are not release-certified by these results. No deployment was performed.
The grouped QA PR must remain unmerged for human review.

## A. Environment and baseline

- Freshly fetched main: `19d33b5be23e8aced5141e97c2ef9cc7fe1a74f1` (rechecked before publication).
  PRs #1–#7 are merged. QA branch: `qa/complete-local-regression`, directly from that commit.
- Dedicated worktree `FIRETRACE-local-qa`; other feature worktrees and services left untouched.
  The enclosing NASA folder is a separate unborn repository, not the project checkout.
- Windows / PowerShell, Node 24.14.1, npm 11.9.0, Python 3.14.6, own `backend/.venv`.
  CI targets Python 3.12. No `py` launcher is installed locally.
- Fresh `npm ci`; audit reported zero vulnerabilities. Added dev-only
  `@axe-core/playwright` 4.14.0 (MPL-2.0); existing package versions unchanged.
- Core/AI backend requirements and openpyxl installed. Optional PDF audit pins pypdf 6.14.2.
  Small WebSocket transport installed for the degraded-voice test; no speech model downloaded.
- No credentials were configured, exposed or committed. `AI_ENABLED=false` on real QA servers.
- Installed Playwright Chromium 158.0.8127.18 (revision 1254), Firefox revision 1572 and WebKit
  revision 2388. Local headless execution needed the existing shared browser path and execution
  outside the restricted process sandbox. No security policy was disabled.
- GitHub and manual interactive browser checks used the signed-in ChatGPT in-app browser.
  A temporary in-app usage limit was respected; the same action succeeded after its reset.

## B. Startup and running modes

| Mode | Actual result |
|---|---|
| `npm.cmd run dev:full` | Index validation/build passed; frontend 5201 started. Backend bind failed because an unrelated service occupied 8000. That service was preserved. |
| Isolated development | Frontend 5199 + evidence API 8020 healthy and corpus-matched. |
| Combined backend | `main:app` on 8021: evidence/history healthy, voice explicitly unavailable. |
| Combined voice UI | Frontend 5200 pointed voice to 8021; Health showed not configured; speech disabled, typed TRACE usable. |
| Production build | TypeScript/build passed repeatedly during the browser suites. Production preview 4174 passed Chromium/Firefox/WebKit smoke. |
| Actual backend stop | Stopped only QA-owned 8020 processes; bundled workflows passed, then restored backend and verified reconnect. |
| Cold offline reload | Not guaranteed; no service worker. Not reported as passed. |

Reproduce isolated startup from the repository root after installation:

```powershell
# Terminal 1
$env:AI_ENABLED='false'
backend/.venv/Scripts/python.exe -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8020
# Terminal 2
$env:FIRETRACE_API_TARGET='http://127.0.0.1:8020'
$env:VITE_EVIDENCE_API='auto'
npm.cmd run dev -- --host 127.0.0.1 --port 5199
```

Frontend: <http://127.0.0.1:5199/#/overview>; API docs: <http://127.0.0.1:8020/api/docs>;
readiness: <http://127.0.0.1:8020/health/ready>. Optional combined docs: 8021/docs.
Processes are local and must be started again after a machine/app restart. Full installation,
production-preview and optional-model instructions are in [deployment.md](deployment.md).

## C. Feature and control inventory

Eight main routes plus Research Library = **9 views**. Initial rendered inventory contained
**309 control instances**, including repeated buttons/links. This is not a claim of 309 distinct
features. [Machine-readable inventory](evidence/local-qa/control-inventory.json) records them.
The 33 expanded tests exercise the control families below, including **all 131 record drawers
and 262 basket add/remove actions**. Existing suites add integration and provider-contract coverage.
“Pass” means the described assertion ran; it does not imply all possible input combinations.

| View/control | Expected behavior | Actual result/status | Evidence |
|---|---|---|---|
| Header, logo, eight route links | Correct view without losing basket | Pass | QA02/17, existing integration |
| Skip to content | Focus main without changing hash route | Pass after fix | QA02 |
| Menu open/close, all eight links | Named dialog; correct route | Pass | QA02 |
| Menu Tab/Shift+Tab/Escape | Contain focus, restore trigger | Pass after fix | QA02/20 |
| Footer and source/scope links | Valid routes/source destinations | Pass, NASA link checks below | QA17, HTTP evidence |
| Unknown route | Visible recovery instead of crash | Pass | QA17 |
| Overview CTAs | Reach Atlas/Gap/source workflows | Pass | QA18 |
| Overview atmosphere presets/sliders | Live composition updates, no fabricated experiment placement | Pass | QA18 |
| Overview feature cards | Six target sections navigate | Pass | QA18 |
| Explainer five chapters | Change visual/caption segment | Pass | QA18 |
| Explainer full screen | Browser full screen enters/exits | Pass | QA18 |
| Explainer missing audio | Explicit notice; captions continue | Pass after fix; actual audio absent | QA14 |
| Atmosphere three presets | pO2 = pressure × fraction | Pass | QA01 |
| Atmosphere numeric fields | Decimals/bounds handled honestly | Pass after fix | QA01 |
| Atmosphere sliders | Numeric fields/readout stay synchronized | Pass | QA01 |
| Atmosphere invalid/blank input | Alert, no stale/clamped calculation or invalid SVG | Pass | QA01 |
| Atmosphere chart/unknown placement | No pressure invented for 131 records | Pass | QA01/18, science checks |
| Atlas search | Trimmed IDs/material/author; no-results valid | Pass | QA03 |
| Atlas query bound | 200-character bound aligned with API | Pass after fix | QA03 |
| Atlas investigation/material/quality filters | Correct narrowing | Pass | QA03 |
| Atlas flow checkbox/O2 bounds | Filter correctly; invalid ranges visible | Pass after fix | QA03 |
| Atlas all five sort options | Accepted without losing API mode | Pass | QA03 |
| Atlas pagination/reset | Page 2/back and complete reset | Pass | QA03 |
| Atlas filtered CSV | Download matches current selection | Pass | QA03 |
| Atlas API status | Connected / bundled state accurately disclosed | Pass | QA03, actual stop journey |
| Every experiment row | Correct ID and row locator in drawer | Pass: 131/131 | QA04 |
| Every record basket toggle | Add then remove exact ID | Pass: 262 actions | QA04 |
| Drawer measurement/raw/ledger | Values, nulls, qualifiers and provenance visible | Pass | QA04/05 |
| Drawer citation copy/JSON | Correct source text and structured content | Pass | QA05 |
| Drawer Escape/focus | Close and return to trigger | Pass | QA05 |
| Scrollable evidence/CSV tables | Keyboard-reachable named regions | Pass after fix | QA13/20 and keyboard suites |
| Research search/type/investigation/state filters | Report findings distinct from records | Pass | QA06 |
| Research show more | Expand eligible result group | Pass | QA06 |
| Research compatibility/status detail | Explain separate corpus/version and fuel evidence | Pass | QA06, library suite |
| Research two JSON downloads | Actual downloadable valid data | Pass | QA06 |
| Research fetch failure/retry | Visible error and recovery | Pass, injected 503 | QA06 |
| Compare selection/max four | Limit and remove/reset behavior | Pass | QA07 |
| Compare conditions/audit/source links | Consequential differences and unknowns retained | Pass | QA07, backend tests |
| Compare CSV | Actual selected-record export | Pass | QA07 |
| Gap preset/numeric inputs | Target changes audit; invalid fields disable export | Pass | QA10/15 |
| Gap categorical inputs | Every offered option selectable | Pass | QA15 |
| Gap weights/ranking controls | Heuristic correspondence disclosed, no safety probability | Pass | QA15, scenario unit/API tests |
| Gap result filters/sort/show more | Candidate display updates | Pass | QA15 |
| Gap mandatory/no-credit disclosures | Missing evidence never becomes positive support | Pass | QA15 |
| Gap detail/basket/Compare path | Exact selected record continues | Pass | QA15, integration |
| Gap Markdown download | Actual bounded plan file | Pass | QA15 |
| Assistant suggestions/Enter | Source-backed deterministic response | Pass, 10 requested question classes | QA08 |
| Assistant follow-up/history | Recognized subject continuity | Pass | QA08, TRACE tests |
| Assistant deterministic checkbox | No external-model call mode | Pass | QA08, provider tests |
| Assistant copy | Exact claims plus mode/interpretation preserved | Pass after fix | TRACE mock browser suite |
| Assistant clipboard denial | Friendly status, no unhandled rejection | Pass after fix | QA19 |
| Assistant clear/retry | Conversation resets / request repeats | Pass | QA08 |
| Assistant rejection/rate limit | Safe actionable message | Pass, injected HTTP 429 | QA19 |
| Voice Health standalone | Evidence-only backend disclosed, no false ready | Pass after fix | QA09 |
| Voice network failure/retry | Disabled speech and safe status | Pass | QA09 |
| Voice Health combined | Models absent; typed TRACE still works | Pass actual UI | voice-combined.png |
| Voice microphone/ASR/TTS quality | Working auditory round trip | **Not configured**, no models/microphone test | G |
| Methodology source/original links | Eight original artifacts, correct bytes | Pass | QA11 |
| Methodology licenses/flags/locators | Published and consistent with corpus | Pass | QA11 + scientific checks |
| Export dataset scope/presets | All three scopes and two presets | Pass | QA10 |
| Export CSV/JSON/artifact downloads | Actual browser downloads, structured values | Pass | QA10/11 |
| Basket reorder/detail/removal | Exact selection order, continuity, reload persistence | Pass | QA16 |
| Brief title/question/section toggles | Validate title, reflect selection and options | Pass | QA16 |
| Brief stale preview/regenerate | Removal invalidates prior preview | Pass | QA16 |
| Basket CSV/JSON/Markdown/HTML | Four real files; identity/nulls/MIME/escaping | Pass | QA16 |
| Printable HTML | Headless browser can print to PDF | Pass; product exports HTML, not direct PDF | QA16 |
| Clear basket cancel/confirm | Cancel preserves; confirm empties | Pass | QA16 |
| All views console/assets | No uncaught page errors/failed required local assets | Pass; missing optional audio explicitly tested separately | QA17 |

## D. Cross-page journeys

1. **Discover → inspect → compare:** Atlas filters/search, exact row source, basket and four-record
   comparison; blockers remain explicit. Passed QA03–07 and existing integration suite.
2. **Scenario → evidence → plan:** Adjust target conditions/weights, inspect ranked record,
   retain unknowns and export Markdown. Passed QA15; not a validated test protocol.
3. **Question → citation → follow-up → copy:** BASS2-B1 gives 22.2% initial O2; unsupported
   pressure/gravity/risk requests abstain. Copy retains the mode and optional interpretation.
4. **Selection → brief → reload:** Reorder records, change sections, generate/download four
   formats, remove a record, regenerate, reload, cancel and confirm clear. Passed QA16.
5. **Research → source → export:** Filter 16 attributed findings, retain droplet/solid distinction,
   inspect NASA sources and export report data without normalizing FLEX rows. Passed QA06/11.
6. **Actual server failure → recovery:** Verified API connected, stopped only 8020, searched B1,
   used Compare and Gap, answered B1 as 22.2% in bundled mode, downloaded basket JSON, restarted
   backend, reloaded and verified API connected. [Actual journey log](evidence/local-qa/actual-offline-journey.json).

## E. API verification

Live OpenAPI inventories and per-request statuses are in
[qa-http-audit.json](evidence/local-qa/qa-http-audit.json), not inferred from documentation.
Core schema has **15 operations**; **192 real HTTP cases** passed, including all 131 details.

| Surface | Verification |
|---|---|
| Root/version, experiments/list/detail, sources, coverage, artifact download | Actual responses, corpus SHA, null pressure, pagination/filter bounds, 404 unknown IDs, artifact byte hashes |
| Compare, scenario, exports | Valid payloads, current corpus identity, actual CSV/JSON/Markdown, malformed payloads 422 |
| Ask and TRACE | Ten scientific question categories; exact claims and abstentions; deterministic mode |
| Calculator | 10.2 × 30% = 3.06 psia; 500 kPa × 100% = 500; zero oxygen retained; negative pressure rejected |
| Version/body/security | Stale corpus 409, oversized POST 413, invalid bounds 422, malformed JSON 422, traversal attempts 404 |
| Swagger | Real browser evidence suite includes actual rendered Swagger; local OpenAPI always checked |

Combined app: **11 additional real HTTP cases** passed, including fresh history initialization,
health/status/corpus/ask, TTS 503, and text-only voice turn 200 with no audio. Additional real SSE
gave deterministic answer events and a done event; three malformed legacy POSTs returned 422.
The real WebSocket returned a `voice_unavailable` error frame and closed 1011 without models.
See [legacy checks](evidence/local-qa/legacy-extra-qa.json).
These are bounded local checks, not a penetration test or public-service authentication review.

## F. Scientific validation

- **131** experiments = 129 BASS-II + 2 Saffire-I; quality **71 validated / 56 partial / 4 suspect**.
- **0** per-record total pressures; **0** measured per-test gravity values; **0** standardized
  outcomes; no partial-gravity experiment records. Nulls remain null, not zero or nominal values.
- Research remains **3 investigations / 16 findings / 2 reports / 0 normalized FLEX records**.
  The 274 source FLEX rows remain deferred; droplet findings never become solid-fuel records.
- Corpus SHA-256: `89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`.
- Research version: `8901d73c117984bd28f8195d41ace0d4021b44346b2c575d1eca7477ca24d5f8`.
- All **24 generated artifacts** reproduced byte-for-byte; original NASA files and corpus outputs
  are absent from this PR's diff. Eight served original artifacts checked against byte hashes.
- Both cached original NASA PDFs and all **16 page fingerprints/anchors** reverified using the
  pinned pypdf 6.14.2 extractor. Version 7.1.0 changed extracted text despite the same PDF bytes;
  fixed the audit dependency/version guard instead of changing source evidence hashes.
- Eight NASA URL probes returned HTTP 200 (three PSI investigations, three NTRS citations,
  two original PDFs). Official challenge page rendered in the in-app browser; Python's local
  certificate-store probe failed for that host, and TLS verification was not disabled.
- Corrected UI wording: Saffire display uses **one range midpoint and one approximate single
  value**, rather than calling both values range midpoints. Source values remain unchanged.
- Thirty deterministic benchmark questions passed; this is a fixed regression set, not a
  general scientific-answer accuracy metric. Gold-labelled retrieval metrics remain unavailable.

## G. TRACE and voice status

| Capability | Status and limits |
|---|---|
| Real deterministic TRACE | Passed on actual backend and bundled fallback |
| OpenAI SDK serialization/validation/failure behavior | Passed mocked HTTP transport/backend contracts and two TRACE browser tests |
| Live external model | **Not configured**; no credential, no live call claimed |
| Copied model interpretation | Mocked successful provider response correctly preserved with mode notice; no false offline claim |
| Voice health/degradation | Actual standalone and combined backend/UI checks passed |
| History without speech engine | Fresh SQLite history now initializes and returns 200 |
| SSE/WebSocket degraded transport | Actual local transport checks passed |
| ASR/microphone/TTS/auditory quality | **Not configured / unverified**; no large model download or microphone capture |
| Explainer MP3 | Asset absent in current repository. Visible caption fallback now explicit; narration quality unverified |

No model-generated scientific measurement was added. Retrieved text remains data rather than
executable instructions. Safe public error messages do not echo raw server paths or responses.

## H. Automated checks and reproducibility

| Check | Final result |
|---|---|
| Vitest | **232 passed**, 15 files |
| TypeScript + Vite production build | Pass; core JS approximately 2.23 MB / 214 kB gzip, existing large-chunk advisory |
| Backend pytest | **211 passed**; one upstream Starlette/httpx deprecation warning |
| Pipeline unittest | **19 passed** |
| Research subset | **10 passed** (included in 19, not additional) |
| Generated artifact reproduction | **24 verified**, unchanged identities |
| Cached PDF fingerprints | **16 verified**, original bytes preserved |
| Deterministic benchmark | **30/30** |
| Default browser | **30 passed** |
| Evidence API browser | **5 passed**, actual Swagger enabled |
| TRACE browser | **2 passed**, mocked provider, final clipboard fixes included |
| Combined integration browser | **5 passed** |
| Expanded QA browser | **33 passed**, 4.9 minutes locally |
| Dedicated basket / research library | **2 / 2 passed**, overlap default suite |
| Production cross-browser smoke | **Chromium / Firefox / WebKit pass**; 9 views each + calculation/detail/download |

The five distinct primary browser suites total **75 test executions** (30+5+2+5+33), not 75
independent user features. Existing dedicated suites overlap; do not inflate the total with them.
[Raw final logs](evidence/local-qa/) retain actual runner summaries.

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-ai.txt -r pipeline/requirements-audit.txt
$env:FIRETRACE_PYTHON=(Resolve-Path backend/.venv/Scripts/python.exe).Path
npm.cmd test
npm.cmd run build
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
backend/.venv/Scripts/python.exe -m unittest discover -s pipeline -p 'test_*.py' -v
backend/.venv/Scripts/python.exe scripts/verify-release-data.py
npx.cmd playwright install chromium
npm.cmd run e2e
npm.cmd run e2e:evidence
npm.cmd run e2e:trace
npm.cmd run e2e:integration
npm.cmd run e2e:qa
```

If using the already-installed Windows browsers, set
`PLAYWRIGHT_BROWSERS_PATH=C:/Users/novaz/AppData/Local/ms-playwright`; fresh installations should
use Playwright's normal install location. Expanded QA uses dedicated ports 4200/8030 and fails
if they are occupied, rather than silently reusing another server. CI now runs this suite too.
No linter is configured; no lint pass is claimed. Hosted CI is separate from these local results;
review the PR checks before merging.

The first hosted run passed frontend/science/backend and 32/33 expanded browser checks, but
the rapid bulk-export sequence timed out waiting for a download on the faster Linux runner.
Nine scope downloads now finish before a deliberate 1.1-second pause and the next four artifact
downloads, respecting Chromium's ten-downloads-per-second burst limit. Content assertions and
all four artifact downloads remain mandatory; named test steps identify any subsequent failure.

## I. Responsive, accessibility and performance checks

- **54 view/width visits:** 9 views × 320, 390, 768, 1024, 1440, 1920 pixels. No document-level
  horizontal overflow after wrapping long comparison/gap/source tokens. Wide data tables keep
  intentional internal scrolling instead of truncating evidence.
- Axe WCAG 2 A/AA and 2.1 AA: **zero violations** in the nine initial views plus expanded menu
  and measurement drawer snapshots. Improved faint-label contrast and source-link affordance.
- Keyboard checks include skip link, menu containment/return, drawer close/return and named,
  focusable scrolling regions. Automated checks are not a screen-reader or full WCAG audit.
- No uncaught page errors in the nine-view route sweep or cross-browser smoke. Missing optional
  MP3 is separately verified and disclosed, not hidden as a successful asset load.
- Local production time to visible main heading: Chromium first Overview **582 ms**, Firefox
  **1310 ms**, WebKit **1907 ms**. Lazy Research view **377 / 627 / 458 ms** respectively.
  These are one local smoke sample per browser, not statistically stable performance scores,
  cold-network metrics or a memory-leak guarantee. Full timings are in the cross-browser JSON.
- Repeated navigation, 131 drawers and basket toggles completed without uncaught errors.
  No prolonged stress run or formal heap-growth analysis was performed.

## J. Bugs found, causes, fixes and regression evidence

| ID / priority | Cause and user effect | Fix | Verification |
|---|---|---|---|
| QA-01 P1 | Atmosphere input silently clamps, displaying a calculation for a different target; blank becomes zero | Keep raw input, validate finite/range, suppress invalid calculation | QA01, before-atmosphere-invalid |
| QA-02 P1 | Saffire aggregate wording mislabels approximate single value as range midpoint | Correct qualifier, preserve original values | Source dictionary review, atmosphere test |
| QA-03 P2 | Skip anchor interpreted by hash router as route | Focus main and preserve route | QA02 |
| QA-04 P2 | Menu focus leaves overlay; CSS transition delays initial focus | Dialog semantics, contained Tab/Escape, transition-safe focus | QA02/20 |
| QA-05 P2 | Faint text and inline evidence link fail contrast/link audit | Adjust contrast and underline source/scope link | QA13/20 |
| QA-06 P2 | Long comparison/gap/source labels overflow 320px | Wrap tokens and constrain grid children | QA12, before-320 captures |
| QA-07 P2 | Scroll regions/CSV preview unreachable to keyboard | Named focusable regions | QA13/20 |
| QA-08 P2 | Voice points at wrong origin; 404/raw error can appear ready | Shared configured base, optional separate voice base, bounded safe requests/health gate | Voice unit7, QA09, combined UI |
| QA-09 P1 | Combined history SQLite initializes only through absent voice engine, HTTP500 | Initialize history independently at app startup | New fresh-DB backend test + actual history200 |
| QA-10 P1 | Copied AI answer omits interpretation and falsely says no external model | Copy actual mode notice/model/interpretation | Strengthened TRACE mock clipboard test |
| QA-11 P2 | Denied clipboard rejects unhandled promise | Catch rejection and provide manual-copy status | QA19 |
| QA-12 P1 | Vite proxy500 does not trigger complete bundled fallback | Treat all server5xx as unavailable | New unit case + actual backend-stop journey |
| QA-13 P2 | Atlas invalid bounds/overlong query can switch session out of API mode | Bound query, validate ranges locally, distinguish API validation | QA03 |
| QA-14 P2 | Absent MP3 silently presented as voiced content | Visible per-clip audio-unavailable fallback | QA14 |
| QA-15 P2 | TRACE rejected/rate-limited response produces unhelpful generic error | Typed safe rejection/error text | QA19, provider tests |
| QA-16 P2 | Unpinned PDF extractor changes passage hashes for identical original | Pin audit extractor, fail with actionable version message | 16 fingerprints reproduced |
| QA-17 P2 | Docs claim old test counts, open merged PRs, fully offline/language-only assistant | Update current guides/status and explicit limits | Final documentation review |

All listed bugs are addressed in this QA branch. These IDs are local report identifiers, not
invented GitHub issues. Missing optional audio/models/credentials remain disclosed below.

## K. Genuine screenshots and artifacts

[Evidence directory](evidence/local-qa/) contains original captures, not mockups:

- Before: `before-atmosphere-invalid.png`, `before-voice.png`,
  `before-320-compare.png`, `before-320-gap.png`, `before-320-methodology.png`.
- After: `overview.png`, `atmosphere.png`, `record-drawer.png`, `research-library.png`,
  `compare.png`, `assistant.png`, `gap-planner.png`, `exports.png`, `methodology.png`,
  `basket-brief.png`, `voice-combined.png`, `backend-stopped.png`.
- Responsive: `viewport-320.png` through `viewport-1920.png`; these capture Research Library
  at the end of the width sweep, while the automated sweep checks all nine views.
- Logs/JSON: actual HTTP cases/OpenAPI, source URL checks, actual stopped-backend journey,
  cross-browser timings, unit/backend/pipeline/browser results and PDF audit.
- Historical integration screenshots are preserved unchanged. Runtime DBs, credentials,
  browser profiles, traces, node_modules, build output and local PDF caches are not committed.

## L. Remaining limitations and blockers

1. No live provider credential: actual model output/latency/cost remain unverified. Mock tests
   establish contracts and failure handling only. Human opt-in required to test paid usage.
2. No speech models/microphone run: real ASR/TTS and auditory quality unverified. Voice stays
   disabled honestly. Explainer audio assets are absent; captions work with an explicit notice.
3. The corpus lacks pressure, measured test gravity and standardized outcomes. No risk model,
   material safety verdict, certification or partial-gravity generalization is justified.
4. Research findings are separate from experiment TRACE/scenario evidence; no normalized FLEX
   records. Dataset expansion requires further unit/version and per-test mapping work.
5. No cold offline guarantee, public authentication/security hardening, deployment validation,
   prolonged memory profiling, full screen-reader audit or direct product PDF exporter.
6. Default launcher needs free port8000; isolated startup avoids existing services. Upstream
   deprecation/large-bundle advisory remain nonblocking. Source challenge Python TLS probe has
   a local issuer limitation; browser rendering succeeded without weakening TLS.

## M. Verdict and human review

**CONDITIONAL PASS**: the tested local evidence product is ready for review; optional live AI and
speech are not certified as working. No unresolved core-flow P0/P1 remains in the tested scope.
Do not merge or deploy automatically. Check hosted PR jobs and review the substantive fixes.

Manual review: start the isolated services, open all header routes, search BASS2-B1 and confirm
22.2% with its source row; add it and a Saffire record to Compare, inspect blockers, set 10.2 psia /
30% and confirm 3.06 psia; enter 100 psia and confirm validation instead of a clamped result.
Exercise Gap Planner and basket downloads, reload to check persistence, ask an unsupported
pressure/risk question, and confirm abstention. At 320px use Menu/Tab/Escape and open a drawer.
Stop only your own evidence backend, search again, confirm Bundled data, then restart/reload.
Keep AI disabled unless separately configuring a server credential; do not mistake mock-provider
tests or text-only voice responses for functioning live generation or speech.
