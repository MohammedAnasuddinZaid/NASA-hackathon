## 1. Summary

Turns Gap Planner into a local evidence-retrieval workflow: users define hypothetical conditions, inspect actual experiment candidates, understand individual match/difference/unknown findings, review transparent ordering, and carry selections through Atlas and Compare. All131 source records and original scientific values remain unchanged.

Independent branch `feat/scenario-comparison-ranking` starts directly from fetched `main` at `2d9d4e7`. No unmerged PR implementation was copied. Codex assisted implementation, tests and documentation; human review remains necessary. Leave this PR unmerged.

## 2. Previous Behavior

Gap Planner provided aggregate coverage, target oxygen partial pressure and a downloadable checklist, but no per-record candidates or ordering. Compare had a useful reported-value table and blocker audit, but lacked the new shared condition classifications, source-detail actions and scenario workflow. Query changes on an already-open comparison could retain the previous selection; invalid IDs silently fell back to a demo pair.

## 3. Features Implemented

- **Scenario planning:** optional material/geometry/oxygen/pressure/gravity/flow/method/investigation/direction/thickness targets; explicit units, bounds and hypothetical labels. Material datalist accepts unrepresented targets without creating records.
- **Condition evaluation:** exact, tolerance, approximate/derived, different, missing, ambiguous, context and incompatible categories; raw/status/notes/locators retained.
- **Candidate retrieval:** actual bundled records, investigation/material filters, mandatory-material difference exclusion, zero-credit visibility and paginated rendering.
- **Transparent ranking:** fixed documented weights, separate coverage/missingness, stable ties, relevance or coverage order, expandable per-condition contributions. No safety/confidence probability.
- **Advanced comparison:** same condition engine relative to an explicitly identified first-record reference; method/hardware fields; original values, outcomes/corrections and blocker audit retained; source/detail actions.
- **Research gaps:** target/candidate condition findings, unresolved/different counts and reporting requirements in the existing Markdown download. No physical testing procedures.
- **Navigation:** session-persisted target and up-to4 selections, reusable RecordDrawer, Atlas ID deep links and return links, Compare IDs reflected in URL, same-page query changes handled and invalid IDs reported.

## 4. Ranking Methodology

Policy `scenario-retrieval-1.0`; pure functions independent of React/backend.

Weights: material3, geometry2, oxygen3, pressure3, gravity3, flow2, method2, investigation1, direction2, thickness2. Exact reported value/category earns full weight; close measured/corrected value0.75; approximate/derived similarity0.5. Different/missing/unverified/context/incompatible earns0. Unrequested dimensions are omitted; requested unknown weights remain in the denominator and are never redistributed.

Numerical tolerance is max(absolute, relative×larger magnitude): O2 max(0.5percentage points,5%); pressure max(0.5psia,3%); flow max(0.5cm/s,10%); thickness max(0.02mm,10%). These are retrieval choices, not physical equivalence limits. Compatible units are explicitly converted; incompatible ones refuse comparison. Source ranges retain bounds; midpoint precision and varying flow-token ranges are never uncertainty.

Order: descending earned points, descending comparable field weight, fewer differing/incompatible conditions, then ASCII experiment ID. Coverage ordering swaps the first two. Parsed material names are not controlled specifications. Suspect numeric values earn no credit. Investigation gravity/direction cannot become per-test equality or difference. Sparse candidates cannot receive full requested credit merely because the few known fields agree.

Full policy/tolerances/data boundaries: [scenario documentation](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/scenario-planner.md).

## 5. Scientific Validation

| Scenario | Evidence used | Expected behavior | Actual result |
|---|---|---|---|
| A — Partial relevance |BASS2-B1, PSI-25 CSV row2; PMMA film,22.2% O2,5cm/s|Relevant with important unknowns|B1/B2 first;8/14 retrieval points for target material/O2/flow plus10.2psia/lunar target; pressure/gravity earn0|
| B — Missing pressure |All131 imported records|Never insert cabin pressure|Pressure missing; no match credit or experimental ppO2 calculated|
| C — Unlike materials |BASS2-B1 vs SAFFIRE1-S1|Material differences affect retrieval|PMMA film versus SIBAL fabric explicitly different; no equivalence inferred|
| D — Different investigations |BASS2-B1 vs SAFFIRE1-S1|Method/configuration limits remain|Methods differ; requested flow-method comparison incompatible; gravity remains context|
| E — Insufficient evidence |Cotton target,100% O2,blank flow, hide zero-credit|No invented match|Useful empty state in real browser; pressure-only test also yields0 credit for every record|
| F — Missingness-heavy candidate |Actual unknown-material row, first BASS2-B5|Cannot look fully matched|Domain test confirms less than half requested credit and multiple unresolved fields|
| Approximation |SAFFIRE1-S1, PSI-98 row2, raw21.5–21.7|Preserve interval|Target21.6 approximate only;21.8 outside range; no exact midpoint match|
| Direction |SAFFIRE1-S1/S2|Expose consequential difference|Concurrent versus Opposed retained in audit and relationship table|

Genuine corpus cases are in tests/scenario.test.ts. One isolated unit-conversion/status fixture is explicitly synthetic and never enters the application corpus. Exact targets are user inputs, not invented measurements.

## 6. GitHub Issues

GitHub issues page showed0 open issues; no invented closing references. Fixed invalid-ID demo substitution and same-page query/selection staleness with rendering/browser workflow coverage. Also added a stable React Fragment key in the existing comparison groups while extending the table.

## 7. Screenshots

Actual ChatGPT in-app browser captures. Before images were captured from this branch's unmodified main base; no fabricated before/after pair.

[Planner before](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/evidence/pr4/planner-before.png) · [Compare before](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/evidence/pr4/compare-before.png)

![Updated planner](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scenario-comparison-ranking/docs/evidence/pr4/planner-after.png)
![Actual candidate ordering](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scenario-comparison-ranking/docs/evidence/pr4/candidate-ranking.png)
![Missing pressure and condition contributions](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scenario-comparison-ranking/docs/evidence/pr4/conditions-missing-pressure.png)
![Cross-investigation comparison](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scenario-comparison-ranking/docs/evidence/pr4/cross-investigation.png)

[Provenance](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/evidence/pr4/provenance.png), [empty state](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/evidence/pr4/no-evidence.png), [mobile planner](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/evidence/pr4/mobile-planner.png), [mobile Compare](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scenario-comparison-ranking/docs/evidence/pr4/mobile-compare.png). More actual captures and results: [evidence directory](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/tree/feat/scenario-comparison-ranking/docs/evidence/pr4).

## 8. Tests

| Test / Check | Command | Result | Notes |
|---|---|---|---|
| Frontend baseline |`npm test`|89 passed|Before changes|
| Backend baseline |Python pytest backend/tests|155 passed|No backend diff; existing Starlette/httpx deprecation|
| Final frontend |`npm test`|130 passed|36 domain and5 React rendering regressions added|
| TypeScript/production |`npm run build`|Pass|Existing large-chunk warning|
| Assistant benchmark |`npm run benchmark`|30/30 passed|Generated timestamp-only change excluded|
| New browser workflows |`npx playwright test e2e/scenario.spec.ts --workers=1`|Blocked before page launch|Expected Chromium headless-shell1254 executable missing; no passing automated browser result claimed|
| ChatGPT browser |All8 routes + planner/detail/Compare flow|Checked|Actual values, source locators, persistence, invalid/empty states|
| Responsive browser |390px planner and Compare|Pass for tested views|innerWidth390, page horizontal overflow0; viewport restored|
| Diff |`git diff --check`|Pass|No science/backend changes; no lint command configured|

Testing notes are recorded from actual runs in docs/evidence/pr4/verification.md. Browser suite contains23 existing and3 new cases; only new cases were attempted here and all were blocked at launch.

## 9. Architecture

`scenarioAccess.ts`: small local RecordAccess adapter. `scenario.ts`: validation, unit conversion, condition evaluation, ranking, gap summaries and reference-aware comparisons. `scenarioState.ts`: validated session storage. GapPlanner: composition of existing components/calculator/source helpers with candidate controls. Compare: retained legacy audit/value table plus new shared relationship table and sources. Atlas: ID/return navigation with existing drawer. Small responsive CSS extension; no heavy libraries, new backend, AI calls or data pipeline.

## 10. PR Compatibility

Independent main base, no stacking/cherry-picking/copying PRs #2/#3. PR #1 is already merged externally, contrary to the prompt's stale status; traceability remains preserved.

PR #2 overlaps Atlas/Compare/GapPlanner, evidence session/client and source access. Retain its corpus-version checks and lossless contracts; adapt RecordAccess and reconcile Python/TypeScript policies using shared parity fixtures. Numerical tolerances align, but range/suspect/context/flow/ranking semantics are not claimed identical. No storage/schema changes here.

PR #3 has no runtime dependency. Assistant integration can reference condition evidence/IDs later; model prose must not author ranking or calculations. Combine shared README/methodology/limitations edits during review.

PR #5 should consume typed Candidate/ConditionEvaluation data with source addresses, policy version, corpus identity and explicit selected scope. Keep user targets/reported/derived/context/gap findings distinct in exports; never convert retrieval points into risk probabilities.

## 11. Scientific Limitations

Weights/tolerances are transparent heuristics, not validated relevance truth or physical equivalence. Data are small, two-investigation, partially parsed/approximate, pressure-null, gravity-context-only and lack standardized outcomes. Source range and suspect handling are conservative. No droplet/orbital/partial-gravity interchangeability, safety ordering, prediction, NASA endorsement or certification. The corpus is not exhaustive NASA research; report context is not mapped to rows.

## 12. Breaking Changes

No scientific corpus, ingestion or backend API contract changes. Gap Planner's UI now returns candidates and its existing Markdown download includes structured evidence requirements rather than the old generic checklist. Validated per-tab target/selection state added. Atlas accepts optional id/from parameters; Compare preserves selected IDs and no longer silently substitutes demo rows for invalid explicit IDs. Default demo pair remains when no IDs are supplied. Existing comparison CSV export remains.

## 13. Manual Review Instructions

```powershell
cd C:\Users\novaz\OneDrive\Documents\ChatGPT\NASA\FIRETRACE-scenario
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5186
```

1. Open http://127.0.0.1:5186/#/gap. Enter PMMA film,22.2% oxygen,5cm/s; retain hypothetical10.2psia/lunar target.
2. Review BASS2-B1/B2 at8/14 retrieval points. Expand B1 conditions: corrected oxygen22.2%, pressure missing, gravity context, CSV row2. Inspect weights and contributions.
3. Select B1/B2; open Atlas detail and return. Target/selections persist; compare the selected records and inspect provenance/NASA links.
4. Compare B1/SAFFIRE1-S1 for method differences and SAFFIRE1-S1/S2 for concurrent/opposed flow. Try an invalid ID and changing query IDs on an already-open Compare page.
5. Set oxygen101: validation error. Set Cotton/oxygen100/blank flow and hide zero-credit records: honest empty state. Change order/filters and inspect data requirements/download.
6. Test390px layout. Run `npm test`, `npm run build`, optional `npm run e2e` after installing the expected Playwright browser. No backend/API key needed.
7. Review scientific/integration limits and leave this PR unmerged.
