## 1. QA summary

Fix confirmed scientific-display, failure-handling and accessibility bugs found during actual
local regression QA. All eight main routes plus Research Library, all 131 experiment drawers,
selection/brief exports, actual backend-stop fallback and production browser smoke were exercised.
**CONDITIONAL PASS for local research-support review. Leave this PR unmerged for human review.**

Full [A–M QA report](docs/local-qa-report.md) and [genuine evidence](docs/evidence/local-qa/).

## 2. Environment and baseline

Independent `qa/complete-local-regression` worktree from fetched main
`19d33b5be23e8aced5141e97c2ef9cc7fe1a74f1`; PRs #1–#7 already merged.
Windows, Node 24.14.1, npm 11.9.0, Python 3.14.6; CI Python 3.12.
Own virtual environment; pre-existing port8000 service preserved. Isolated UI/API 5199/8020;
combined voice8021 and production preview4174. No credential or speech models configured.

## 3. Features tested

Nine views; 309 initially inventoried control instances (not distinct feature count).
Every record drawer and 262 basket add/remove actions; all Atlas filters/sorts; comparison;
scenario targets/ranking disclosures; deterministic questions/follow-ups; source links;
four selected brief formats, persistence, print; menu/keyboard; six viewport widths.

## 4. Bugs found

Report QA-01–17 covers silent atmosphere clamping, wrong Saffire qualifier, skip-link routing,
menu focus, contrast/scroll/320px overflow, wrong optional voice origin/status, fresh history500,
copied AI answer's false offline claim, denied clipboard rejection, proxy500 fallback,
invalid Atlas filters, absent audio disclosure, TRACE429 messaging, unpinned PDF extractor and
stale documentation. Missing optional models/credentials remain explicit limitations.

## 5. Root causes

Coercing raw inputs before validation; hash-router anchor conflict; focus outside overlay;
unwrapped evidence tokens; hardcoded legacy voice origin; history initialization coupled to
voice engine; export text unaware of TRACE mode; 500 omitted from unavailable statuses;
extractor-version-dependent passage hashes and outdated release claims.

## 6. Fixes implemented

Validate raw atmosphere inputs and suppress invalid calculations; preserve Saffire qualifiers;
focus main/menu/scroll regions; wrap long tokens and improve contrast; configure/gate optional
voice with safe bounded requests; initialize history independently; copy mode/interpretation and
handle clipboard denial; restore full bundled fallback; bound Atlas inputs; disclose missing MP3;
surface safe TRACE rejections; pin optional PDF audit extractor; update current guides/status.
No original NASA files or generated scientific datasets changed. No new prediction/chat scope.

## 7. Automated tests

- 232 frontend unit, 211 backend, 19 pipeline: pass.
- Production TypeScript/build: pass; existing large-chunk advisory remains.
- 24 generated artifacts byte-identical; 16 cached PDF page fingerprints reverified.
- 30/30 deterministic benchmark questions pass; not a general accuracy metric.
- Browser: default30 + evidence5 + TRACE2 + integration5 + expandedQA33 = 75 executions pass.
- Dedicated basket2/library2 also pass; these overlap default tests.
- Add dev-only axe 4.14.0, optional pypdf6.14.2 audit requirements and CI expanded QA step.
  Existing package versions unchanged. No lint script exists; no lint pass claimed.

## 8. Real-browser tests

Production Chromium/Firefox/WebKit each passed nine views, 3.06psia calculator, BASS2-B1 detail
and actual basket JSON download. Chromium expanded QA exercised 54 view/width visits and axe
checks on nine initial views plus expanded menu/drawer, with zero violations in tested states.
Actually stopped QA backend8020, verified bundled workflows, restarted and verified reconnect.
GitHub/manual UI checks used the ChatGPT in-app browser; no external browser UI.

## 9. Scientific validation

131 records:129 BASS-II/2 Saffire-I; quality71/56/4. Zero per-record pressure, measured test
gravity or standardized outcomes. Research3 investigations/16 findings/2 reports/0 normalized
FLEX records. Corpus SHA `89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`
unchanged. Eight original artifact downloads verified; NASA source URLs accessible; challenge
page rendered in-app despite a local Python certificate-store limitation.

## 10. API verification

Actual OpenAPI inventory:15 core operations;192 real HTTP cases including131 details,
version409/body413/validation422/traversal404. Eleven combined HTTP cases plus real SSE,
malformed legacy payloads and degraded WebSocket error/close checked. Actual Swagger rendered.
Full request statuses and inventories committed as evidence; not a penetration-test claim.

## 11. TRACE/voice status

Actual deterministic backend and bundled answers pass. SDK wire-contract/provider failures and
UI interpretation/copy behavior use mocks; **no live external model call verified**.
Combined voice health correctly unavailable, history200, TTS503, text-only turn200 with null
audio; actual speech/microphone/ASR/TTS quality **not configured**. Explainer MP3 absent;
explicit caption fallback works. No model files or credentials added.

## 12. Screenshots

See `docs/evidence/local-qa/`: nine view/brief captures, six responsive captures,
`record-drawer.png`, `voice-combined.png` and `backend-stopped.png`, plus raw logs/JSON.
Historical integration screenshots preserved unchanged.

## 13. Before/after evidence

- `before-atmosphere-invalid.png` → `atmosphere.png` + QA01 invalid-input assertions.
- `before-voice.png` → `voice-combined.png` + QA09.
- `before-320-compare.png`, `before-320-gap.png`, `before-320-methodology.png`
  → viewport captures + 54 no-overflow checks.
- Clipboard false-mode bug → strengthened TRACE mock test; history500 → fresh DB test and
  actual combined history200; backend failure → actual stop/restart journey JSON.

## 14. Known limitations

No live provider/speech certification; absent optional explainer audio; no service worker or
cold offline guarantee; lazy research/PDF first fetch needs network. Report findings remain
separate from experiment TRACE/scenario evidence; FLEX normalization deferred. No risk
prediction, NASA endorsement, engineering certification, public deployment, full screen-reader
audit or prolonged heap profiling. Upstream deprecation and bundle advisory remain nonblocking.

## 15. Manual review instructions

Follow `docs/deployment.md` isolated startup. Open5199, visit all routes; search BASS2-B1,
confirm22.2% and original row, compare with Saffire, inspect blockers. Set10.2psia/30%=3.06;
enter100psia and confirm validation. Adjust scenario, generate/reorder/download a basket,
reload, ask an unsupported pressure/risk question, test320px Menu/Tab/Escape. Stop only your
own backend, search in bundled mode, restart/reload. Keep AI disabled unless separately
configuring a server credential. Review hosted CI and diff. **Do not auto merge or deploy.**
