# PR #9 release and cinematic Overview review

Status: verification in progress; no merge or deployment. Final measured results appear below
once the recorded runners finish. This report concerns the current 17-route workstation,
not the earlier eight-route QA baseline.

## Baseline and isolated work

Started directly from fetched main `c53b915eac48530803ac01ae55f568edfa974734` on
`codex/cinematic-overview`, worktree `FIRETRACE-cinematic`. Other worktrees and their services
are preserved. Main's [failed CI](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/actions/runs/43691307100)
reported 17 identical logo accessible-name failures and 53 passes. Local reproduction matched.
Baseline frontend: 300 unit tests and production build pass. Backend: 210 tests pass using a
worktree-local pytest temporary directory; the shared Windows temp initially denied access.
Pipeline: 19 tests and 24 generated-artifact reproductions pass.

Environment: Windows, PowerShell, Node24.14.1, npm11.9.0, Python3.14.6, own backend virtual
environment; hosted CI uses Python3.12. No live provider credential or speech-model downloads.
No new dependencies, package upgrades, paid services, cloud deployment or original media reuse.

## Release blockers found and repaired

| Issue | Cause | Scoped fix / evidence |
|---|---|---|
| 17-route WCAG label mismatch | Visible dotless-i `fıretrace®` differs from `FIRETRACE` aria-label | Accessible name includes exact visible word plus FIRETRACE home; original logo untouched. Existing axe checks retained. |
| Atlas no longer requests backend lists/search | Workbench replacement filters bundled records only | Small `atlasEvidence` adapter retrieves verified matching candidate IDs and resolves them against the identical bundled corpus. Saved views/columns/selection/Notebook UI retained. |
| Workbench text fields exceed legacy API search | Notes/methods/directions are searchable locally but not in legacy server text index | Exact record/test IDs use server lookup. Extended text uses the complete server-filtered candidate pool, then existing local text/presence/sort logic. No backend contract or search policy rewritten. |
| Research URL and selected record get erased | Saved-view URL sync drops `view=research`; separate hash listeners race when leaving Research | Guard Research mode and read view/record together in one handler. Actual BASS2-B1 deep link preserved; integration and cross-browser coverage. |
| Integration fixture no longer intercepts corrupt research response | Newly added service worker serves cached JSON before Playwright routing | Block service worker only in fault-injected integration config. Default suite still tests real PWA installation/offline state. |
| Integration locator stale | Native datalist gives Search a combobox role | Use current accessible role, preserving the same workflow/content assertions. |
| Existing film may start sound on scroll | Narration defaults enabled | Default muted; actual five audio clips and play/pause/chapter/retry/mute behavior retained and tested after explicit opt-in. |

Atlas additionally bounds the search to the existing 200-character API limit, validates O2
ranges visibly, handles HTTP500/503 as whole-session fallback, ignores obsolete responses,
rejects unknown/duplicate/incomplete API IDs and paginates matching candidates without losing
rows. It changes no measurement, normalization, ranking, saved-view schema or export format.
Validation errors remain visible instead of silently switching modes. Server/API test fixtures
remain real except explicitly injected failure responses and existing TRACE provider mocks.

## Cinematic UI & Scrollytelling Enhancements

### Effects and pages

- **Overview only:** sparse original SVG stars, restrained glow, fine orbital lines and a
  small original rocket silhouette following a conceptual path. Hero wordmark, live-model
  card, actions, original explainer, charts, statistics and all later sections remain.
- **Six scenes after the original explainer:** problem, orbital context, source-table records,
  missing measurements, real research workflow and direct Atlas/Gap CTAs. No scroll snapping,
  capture, forced sequence or progress gate. Browser Back/hash navigation remains native.
- Counts reveal as their final dataset values: no count-up through fabricated measurements.
  BASS-II/Saffire/total counts derive from `corpus.records`; pressure/gravity coverage derives
  from existing metadata. Missing *measurements* show an em dash, distinct from zero coverage.
- Context/orbit SVGs are explicitly conceptual, not NASA hardware, footage, observed flame
  behavior, a measured flight path or a graph of experimental causation. No NASA logos used.
- New workflow nodes link to actual Sources, Atlas, Verification, Reports and Evidence Graph.
  These are navigation relationships; the real Evidence Graph is neither replaced nor animated.
- Hover/pressed accents are limited to the new workflow/CTA elements. Dense research pages
  have no decorative starfields or newly animated measurements.

### Modules and removal

`src/components/cinematic/` contains `SpaceScene`, `RocketTrajectory`, `ScrollStory`,
`RevealOnScroll`, and the shared `useMotionBoundary` hook. Their styles are isolated in
`src/css/cinematic.css` with `cinema-*` names. Overview imports this layer; removing its imports,
three insertion sites and control row removes the visual layer without touching science logic.
Release fixes in AppShell/Atlas/narration remain independent of those effects.

### Motion safety, accessibility and lifecycle

- All story content is visible before observation. No `opacity:0` initial content, timers
  gating text, mandatory animation, screen-reader-hidden evidence or inaccessible scroll traps.
- One-shot opacity/12px translation reveals, final-value numbers and line drawing. Rocket flight
  is one-shot; slow star drift is the only continuous new decoration. No flashes/strobes.
- An explicit keyboard-accessible pause/resume control pauses all new decorative motion.
  Story entry focuses its heading without rewriting the route; next Tab continues into the story.
- `prefers-reduced-motion` produces static vectors, no reveal animations and instant scrolling.
  Preference changes while open are covered. At ≤640px decoration is static; hero rocket is
  omitted while the story retains a static rocket. All content and CTAs remain.
- IntersectionObserver pauses offscreen effects; document visibility pauses hidden effects.
  Cleanup disconnects observers and removes media/visibility listeners. No per-scroll React
  state, custom requestAnimationFrame loop, Canvas/WebGL, animation dependency or external art.
- Focused tests exercise real onscreen/offscreen scrolling, pause/resume, reduced motion,
  disabled IntersectionObserver, repeated route cleanup and simulated document-hidden signals.
  The hidden-signal test is event simulation, not a claim of physical background-tab/GPU profiling.
- Automated axe WCAG2/2.1/2.2 A/AA checks cover all17 existing routes. This is not complete
  screen-reader certification. New SVGs are decorative/aria-hidden, with explanatory captions.

### Performance method and budget

Budget: no runtime dependencies, no new scientific-data copies, <8KiB additional combined
entry JS+CSS gzip and <3% growth relative to the original combined entry payload.
`scripts/measure-cinematic.mjs` records raw/gzip sizes plus three fresh-context timings at
normal and 4× CPU throttling. The metric is time to the original h1 assertion, not LCP or a
Lighthouse score. Service workers are blocked in this controlled measurement.

Live-font samples showed inconsistent throttled timing, so keep them as observations rather
than claiming a speed improvement. A disposable `git archive` copy of the exact baseline is
built separately under ignored `tmp/`; the controlled before/after comparison fulfills the
Google Fonts stylesheet with an empty CSS fixture in both versions to remove font-network
variance. This measurement uses system fallback fonts; genuine visual captures retain the
normal font loading. Four-times CPU throttling approximates limited CPU, not an actual low-end
phone/GPU test. No prolonged heap leak or hardware performance certification is claimed.

Final measurements: pending.

## Final verification

Final runner summaries: pending. Raw logs are retained under `docs/evidence/pr9/` when complete.
Scientific identity must remain
`89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9`.
No NASA experimental records or scientific calculations are changed by this PR. Final Git diff
and byte-reproduction checks verify that statement rather than relying on intent alone.

## Genuine visual evidence

[Evidence directory](evidence/pr9/): `before/hero.png` shows the actual original main;
`after/hero-live.png`, `scene-problem.png`, `scene-context.png`, `scene-records.png`,
`scene-gaps.png`, `scene-workflow.png`, `scene-begin.png`, pause, mobile and reduced-motion
captures show the real local app. `after/cinematic-walkthrough.webm` is a native browser recording,
not generated footage. `manual-browser.json` records actual in-app pause/story/Atlas navigation.
`cross-browser.json` records Chromium/Firefox/WebKit smoke, including the actual research-to-record
drawer transition. Screenshots/logs are not mockups. Historical integration PNGs are restored
unchanged after their automated suite regenerates them; PR9 evidence is separate.

## Running and reproducing

Install the repository's existing locked dependencies and a new backend environment:

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-ai.txt -r pipeline/requirements.txt
# Terminal 1
$env:AI_ENABLED='false'
backend/.venv/Scripts/python.exe -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8022
# Terminal 2
$env:FIRETRACE_API_TARGET='http://127.0.0.1:8022'
npm.cmd run dev -- --host 127.0.0.1 --port 5212
```

Open <http://127.0.0.1:5212/#/overview> and <http://127.0.0.1:8022/api/docs>.
Review the story, pause it, use keyboard entry/Back, inspect BASS2-B1 and generate a report.
Film narration starts muted; explicitly enable Sound if desired. No public deployment.

```powershell
$env:FIRETRACE_PYTHON=(Resolve-Path backend/.venv/Scripts/python.exe).Path
npm.cmd test
npm.cmd run e2e -- cinematic.spec.ts --workers=1
npm.cmd run e2e -- --workers=2
npm.cmd run e2e:evidence
npm.cmd run e2e:trace
npm.cmd run e2e:integration
backend/.venv/Scripts/python.exe -m pytest backend/tests -q --basetemp=tmp/pytest-pr9-review
backend/.venv/Scripts/python.exe -m unittest discover -s pipeline -p 'test_*.py' -v
backend/.venv/Scripts/python.exe scripts/verify-release-data.py
node scripts/capture-cinematic.mjs
```

Playwright browsers must be installed. Windows local runs used the existing installation at
`C:/Users/novaz/AppData/Local/ms-playwright`; set `PLAYWRIGHT_BROWSERS_PATH` only if reusing it.
Source reproduction with `npm run benchmark` writes a generated timestamped benchmark snapshot;
restore that generated file after verifying it if it is not part of the intended change.

## Integration with PR #8

This branch uses current main and does not merge/cherry-pick or modify PR8. Potential shared-file
overlap: AppShell (accessible label versus menu/skip fixes), ExplainerFilm (default mute versus
missing-clip disclosure), Atlas (current workbench/API adapter versus the older filter fixes),
integration fixtures and README/status documentation. Preserve the 17-route workbench, new saved
views/columns/Notebook integration, this atomic research deep link and the API adapter when
reconciling PR8. Keep both the sound opt-in and its unavailable-audio disclosure. Never replace
the current Atlas with its old eight-route-era implementation. No API contract/schema or
scientific dataset reconciliation is introduced here.

## Limitations and submission handoff

- Optional live OpenAI and speech-model quality are not configured; existing mocks do not
  establish live generation. These capabilities were not expanded for decorative effects.
- Actual screen-reader use, physical low-power hardware, full background-tab GPU scheduling
  and prolonged heap profiling remain unverified. Tested lifecycle cleanup is narrower evidence.
- Existing initial corpus bundle remains large. This task does not restructure the architecture
  or split scientific business logic merely for visuals.
- Original MP3s are present in this main baseline; actual narration controls are tested. No
  new audio or autoplay background video was introduced.
- Research support only: no safety probability, certification, NASA endorsement or automatic
  submission/publishing. Existing methodological gaps and fuel/gravity distinctions remain.
- Codex assisted implementation, tests, analysis and documentation. SVGs are original code-based
  illustrations; screenshots/recordings are genuine browser captures. Team scientific review and
  AI-use disclosure remain necessary for submission. No reused NASA logo/artwork is introduced.
- The supplied additional PR9 prompt was implemented; no separate earlier PR9 release brief was
  attached. Existing demo/submission documentation is preserved and the short review path below
  is optional, not a change to external event rules.

Suggested 30-second visual demo: hero/pause (5s), scene3 corpus counts (6s), scene4 missingness
(6s), Atlas/B1 source (8s), final report/limitations (5s). Use an actual captured demo, and keep
NASA data attribution and AI assistance disclosure on the team project page. Do not submit or
publish anything automatically.
