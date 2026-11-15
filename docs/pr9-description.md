## Summary

Add a calm six-scene cinematic Overview while preserving FIRETRACE's 17-route scientific
workstation. Repair release regressions in accessibility, Atlas API integration and research
deep links. Keep the existing layout, demo, source citations, charts, Notebook, Graph, reports,
PWA and scientific business logic. **Review only: do not merge or deploy automatically.**

Started from main `c53b915`; incorporated the concurrent main update `8a73040`, including QA
fixes and the expanded regression suite. No PR8 branch was merged, cherry-picked or modified.
See [the full review](docs/pr9-review.md) and [genuine evidence](docs/evidence/pr9/).

## Navbar follow-up

Restore all 17 direct page tabs at every viewport: wrapped rows on desktop/tablet and a native
horizontal tab strip on phones, with Menu retained as a secondary index. Measure the actual
header height so page content stays clear; reveal the active tab after route, size and font
changes. Fix the Graph grid minimum sizing on narrow screens. Eight regression tests cover
seven widths, every tab, keyboard activation and active-tab visibility. Chromium, Firefox and
WebKit each pass all seven widths. See [final navbar QA](docs/navbar-final-qa.md).

## Cinematic UI & Scrollytelling Enhancements

- **Overview only:** original sparse SVG starfield, restrained atmospheric glow, a fine orbital
  trajectory and elegant rocket silhouette. No stock artwork, NASA logo, video background,
  Canvas/WebGL or animation dependency. Original hero/card/actions/demo remain recognizable.
- **Six scenes:** problem → orbital conditions → actual source-table records → missing
  measurements → real research workflow → Atlas/Gap CTAs. Native scrolling and hash/Back
  navigation; no forced snapping, scroll capture or essential content hidden pending an effect.
- **Components:** isolated `SpaceScene`, `RocketTrajectory`, `ScrollStory`, `RevealOnScroll`
  and `useMotionBoundary`; namespaced `cinematic.css`. The layer can be removed independently.
- **Scientific purpose:** emphasize source addresses and reporting gaps. Counts read directly
  from the corpus/coverage metadata; no animated invented measurements. Null measurements stay
  unknown, separate from zero coverage counts. Illustrations are labelled conceptual metaphors,
  not hardware, footage, observed trajectories or experimental-causation graphs.
- **Motion/accessibility:** visible static content; explicit keyboard pause/resume; offscreen and
  hidden-document pause; observer/media-listener cleanup; reduced-motion preference changes;
  static mobile treatment. Story entry focuses its heading. Existing narration starts muted and
  remains available by explicit opt-in. No automatic sound or flashing.
- **Performance:** entry JS+CSS grows by **5,400 bytes gzip (1.838%)**, within the <8KiB/<3%
  budget. No new runtime dependency, custom frame loop, per-scroll React state or
  scientific-data duplication. Raw/gzip bundle sizes and three-sample normal/4× CPU comparisons
  are in the report. Controlled comparisons remove remote-font variance; they are local samples,
  not a Lighthouse, GPU, physical-device or general speed-improvement claim.
- **Responsive evidence:** desktop, 320/390/768/1440/1920px forward/reverse/fast scrolling;
  reduced-motion and observer-disabled cases; original CTA/Back/record navigation. Genuine
  screenshots and native WebM demonstrate hero, rocket, scenes, counts, final CTA and mobile.

## Release fixes and preservation

- Align the visible `fıretrace®` wordmark and accessible name; retain all axe checks.
- Keep all 17 grouped menu links; restore modal semantics, complete focus containment including
  Close, transition-safe focus and return. Remove the stale unconditional “0 model calls” claim.
- Use one bounded Atlas API adapter while preserving saved views, advanced columns, pagination,
  selection, Notebook actions, all 10 local sorts and extended-field search. Exact IDs use server
  lookup; extended text filters the complete verified candidate pool locally. No backend schema
  or API contract change. Validate bounds and retain explicit HTTP500/503 bundled fallback.
- Preserve Research Library's hash and atomically read its view/record ID so BASS2-B1 opens its
  actual drawer. Keep the scientific field/provenance assertions in integration tests.
- Adapt stale QA roles/labels to current controls. Block service workers only for fault-injected
  suites; default tests retain real PWA installation/offline coverage. Pace native download
  bursts without removing content assertions. Preserve incoming unavailable-audio disclosure.

**Verified boundaries:** no NASA experimental records altered; no scientific calculations
rewritten; no core feature removed; no major redesign. Data reproduction and Git diff checks
support these statements. Existing functionality is covered by the final regression matrix
linked in the report. No model-generated measurement or unsupported safety score added.

## Validation

Local results: **316 frontend units, 211 backend tests, 19 pipeline tests, 24 byte-identical
artifacts, 36/36 deterministic benchmark**, and production build pass. Browser suites:
**88 default + 6 real API + 2 TRACE + 5 integration + 33 expanded QA = 134 executions**.
All pass; the 10 cinematic cases are included in 88. Chromium/Firefox/WebKit smoke and actual
backend stop/restart pass. Automated accessibility covers all 17 routes plus expanded menu/drawer.
Final local/hosted runner results are recorded in the linked review and attached check runs.
Unit, backend, pipeline, byte-reproduction, benchmark, real API/TRACE/integration, default
workbench and expanded QA suites are included. The new tests cover lifecycle cleanup,
pause/reduced motion, routes and current Atlas adapter contracts. Actual provider generation
is not claimed: credentials/speech models remain optional and unconfigured.

## Before/after and manual review

`docs/evidence/pr9/before/hero.png` preserves the initial main identity. `after/hero-live.png`,
six scene captures, mobile/reduced-motion captures and `after/cinematic-walkthrough.webm` are
genuine browser output. `cross-browser.json` records Chromium/Firefox/WebKit smoke.

Start the isolated services using `docs/pr9-review.md` (frontend 5212, backend 8022). Open Overview,
pause/resume and enter the story by keyboard, scroll down/back, change reduced-motion preference
and use the final CTA. Confirm 129 BASS-II + 2 Saffire-I = 131 records; missing pressure/gravity are
unknown. Inspect BASS2-B1's 22.2% and source row, compare conditions, open Notebook/Graph and
download a brief/report. The original film is muted until Sound is requested.

## Limitations / AI disclosure

No public deployment/submission, certification or NASA endorsement. No live AI/speech-quality
verification, full screen-reader certification, physical low-end-device/GPU profiling or prolonged
heap analysis. The hidden-document signal test is simulated; actual offscreen scrolling and
observer cleanup are tested. Existing scientific gaps and large corpus bundle remain explicit.

Codex assisted code, tests, analysis and documentation. SVGs are original code-based illustration;
screenshots/recordings are real browser captures. Human team/scientific review and submission
AI-use attribution remain necessary. Keep this PR open and unmerged for review.
