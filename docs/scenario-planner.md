# Scenario retrieval and comparison — policy scenario-retrieval-1.0

FIRETRACE now retrieves actual records for a hypothetical target instead of only
showing aggregate coverage. The standalone browser implementation uses the unchanged
131-record corpus:129 BASS-II rows and2 Saffire-I sample rows. No backend or AI is
required. No measurements, report passages, outcomes or source artifacts were added.

## Architecture and inputs

- scenarioAccess.ts implements RecordAccess.all/find over the existing corpus.
- scenario.ts contains pure validation, explicit unit conversions, condition evaluation,
  deterministic ranking, research-gap aggregation and comparison relationships.
- scenarioState.ts validates and stores only target/selected IDs in sessionStorage.
- GapPlanner reuses the existing atmosphere calculation, corpus coverage rules,
  source citation helper, RecordDrawer and design components.
- Compare keeps its existing reported-value table, export and blocker audit; it adds
  the shared condition rules, measurement-method/hardware rows and detail/source access.
- Atlas accepts id/from deep links and reuses its existing drawer. No second detail UI.

Targets: material family, geometry, investigation, measurement method, gravity regime,
initial oxygen (% by volume), absolute pressure (psia), flow (cm/s), flow direction,
thickness (mm). Blank means not requested. An editable material datalist allows
unrepresented hypothetical materials (e.g. Cotton); it never creates a source record.
Other categorical options come from the corpus, except clearly hypothetical gravity
targets. Case and whitespace are normalized; PMMA film/rod/slab are not aliases.

Validation: at least one nonblank condition; finite oxygen0–100%, pressure>0–500psia,
flow0–1000cm/s, thickness>0–1000mm. These are software input bounds, not validated
experimental operating limits. Invalid input stops retrieval and report download.
The existing Dalton calculation runs only with both valid user-supplied values.
10.2psia×30%=3.06psi is a derived composition value, never a measured experiment
or fire prediction. No nominal pressure is inserted into a record.

## Condition semantics

| Relation | Meaning | Credit multiplier |
|---|---|---|
| Same reported value/category | Exact numeric value or recognized category, with status shown |1|
| Within retrieval tolerance | Nearby directly reported/corrected number |0.75|
| Approximate/parsed similarity | Source approximation/range overlap or parsed derived value |0.5|
| Different | Verified values/categories differ beyond the rule |0|
| Missing | No usable experimental value |0|
| Unverified/ambiguous | Flagged status, suspect record number or varying flow tokens |0|
| Investigation context only | Context label, never measured per-test condition |0|
| Not comparable | Incompatible units or requested measurement method |0|
| Not requested | User left this target blank |Excluded from denominator|

Parsed material/geometry category matches retain the explicit warning that a category
is not a controlled material specification. They are retrieval signals only.
Corrected BASS oxygen retains its corrected status and note. Every condition carries
source ID/locator/raw/status/note; no correction is silently applied.

Saffire S1's raw21.5–21.7 oxygen interval is retained. A target inside earns only
approximate credit; one outside does not get a midpoint-based tolerance match.
S2's approximate single value remains approximate. Source ranges are not uncertainty.
BASS flow ranges summarize parsed display tokens, not a calibrated time series;
varying-flow records cannot get steady-state match credit from the first token.
Suspect numeric measurements earn no credit but remain visible.

Explicit compatible conversions: kPa↔psia (1psi=6.894757293168kPa), m/s↔cm/s,
cm/mm/micron dimensions, fraction↔oxygen percent. Incompatible/unknown units refuse
comparison. Values and source precision are not rounded into matches. The UI uses
canonical target units and retains source raw tokens/provenance.

## Numerical tolerances and ranking

For measured/corrected numeric values, within tolerance means
abs(actual−target) ≤ max(absolute tolerance, relative tolerance×max(abs(actual),abs(target))).
These are retrieval choices aligned with current backend matching-1.0 values,
not demonstrated physical equivalence or uncertainty limits.

| Dimension | Weight | Absolute tolerance | Relative tolerance |
|---|---:|---|---:|
| Material |3|Category only|—|
| Geometry |2|Category only|—|
| Initial oxygen |3|0.5percentage points|5%|
| Total pressure |3|0.5psia|3%|
| Gravity |3|Per-test category; current corpus context earns0|—|
| Reported flow |2|0.5cm/s|10%|
| Measurement method |2|Category only|—|
| Investigation |1|Category only|—|
| Flow direction |2|Per-test category only|—|
| Thickness |2|0.02mm|10%|

Points=sum(requested dimension weight×credit multiplier). Denominator=sum(all
requested weights), including unknowns, differences and context. Never redistribute
missing weights. Comparable field weight is reported separately and includes usable
different/approximate fields; it is coverage, not scientific comparability.

Default order: descending earned points, descending comparable field weight, ascending
differing/incompatible condition count, then ascending ASCII experiment ID. Coverage
order swaps the first two keys. Stable ordering does not depend on corpus input order.
No probabilities, confidence estimates, validated safety thresholds or material-safety
rankings are computed. Sparse records do not obtain full match credit simply because
the few available fields agree. No candidate is labelled a strong or certified match.

Controls: investigation/material result filters, relevance/coverage order, optional
exclusion of known material differences and inclusion of zero-credit records. Mandatory
material filtering retains unknowns as unknown; it does not imply a match. Turning off
zero-credit records can yield an explicit useful empty state. Default shows all records
and the count with any retrieval credit, making dataset gaps visible.

## Comparison and navigation

Select up to4 actual candidates, inspect their original-data drawer, open Atlas, return
to the saved scenario, then open Compare. Valid target and selection persist per tab;
filters/order/expanded details do not persist. Refresh restores valid target/selection.
Storage denial shows a notice. Malformed saved state resets safely. No credentials or
science files are written. Atlas supports `#/atlas?id=BASS2-B1&from=gap`; Compare
supports `#/compare?ids=BASS2-B1,SAFFIRE1-S1&from=gap`. Same-page query changes update
details/selection. Unknown IDs are reported rather than substituted with demo records.

Comparison relationships use the first selected record as the reference and explicitly
identify that asymmetry. Its missing, approximate, suspect, contextual or varying-flow
basis cannot become an exact equality claim for other records. Existing reported values,
correction statuses, burn duration, sample dimensions and outcome notes remain visible.
Different measurement methods and Saffire concurrent/opposed flow remain explicit.
Shared oxygen alone never establishes atmospheric or experimental equivalence.

Research-gap output includes counts of unresolved/context/incompatible fields and known
differences, plus reporting needs. The existing download now includes target, candidates,
source addresses, condition findings, blockers and suggested reporting fields. These are
data requirements, never physical combustion procedures or spacecraft safety advice.
The imported tables are not exhaustive NASA combustion research. BASS report pressure
context remains separately linked, not assigned to individual experimental rows.

## Verification and limitations

Baseline89 frontend tests,155 backend tests and build passed. Final130 frontend tests
(36 new domain +5 rendering regressions) and production build pass. Existing assistant
benchmark30/30 passed. No lint script exists. Source data/backend unchanged.

Three new Playwright workflows were attempted but could not launch because the installed
tool expects Chromium headless-shell1254, absent on this machine. No automated browser
pass is claimed. The ChatGPT in-app browser verified all8 routes, B1 ranking/conditions,
source drawer, Atlas return state, comparison selection, changed deep links, actual
Saffire directions, invalid input and empty results. Planner and Compare at390px have
zero page-level horizontal overflow; temporary viewport restored. Screenshots are real
and in docs/evidence/pr4, including before/after captures.

Limits: coarse parsed material labels, small two-investigation corpus, null per-record
pressure, investigation-only gravity, incomplete dimensions and nonstandardized outcomes.
The chosen weights/tolerances are documented heuristics, not empirically calibrated
relevance truth. Relative ordering is sensitive to chosen conditions and missingness.
Approximation and context handling is intentionally conservative. No droplet data,
predictive model, deployment, NASA endorsement or certification is added.

## Independent branch and integration

Branch feat/scenario-comparison-ranking starts directly from fetched main2d9d4e7.
PR #1 is already merged externally, despite the supplied prompt's stale statement.
PRs #2 and #3 remain open/unmerged and were inspected without copying their code.

PR #2 overlaps GapPlanner/Compare/Atlas, API client/session and source access. Preserve
its corpus identity checks and lossless detail contract, route data through RecordAccess,
and converge the Python/TypeScript matching policies using shared parity fixtures.
The numerical tolerances align, but ranking credit, ranges, suspect/context/flow handling
must be reconciled explicitly. Do not call these policies already interchangeable.
No backend storage/schema changes in this PR.

PR #3 assistant has no runtime dependency here. It can later cite planner conditions
and record IDs, but model prose must never generate ranking points or safety claims.
Shared README/methodology/limitations changes may need combining.

For PR #5: consume typed Candidate/ConditionEvaluation objects with policy version,
unchanged source addresses and dataset identity. Keep selected scope explicit and
distinguish user targets, reported values, transformations and research gaps in exports.
Do not flatten heuristic points into scientific probability or let AI alter calculations.

## Local review

```powershell
cd C:\Users\novaz\OneDrive\Documents\ChatGPT\NASA\FIRETRACE-scenario
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5186
npm.cmd test
npm.cmd run build
npm.cmd run e2e
```

Open http://127.0.0.1:5186/#/gap. Enter PMMA film,22.2% oxygen,5cm/s flow,
10.2psia hypothetical pressure. BASS2-B1/B2 receive8/14 retrieval points under this
target with lunar gravity context unresolved. Open B1 conditions: pressure unknown,
corrected oxygen22.2%, row2, no substitute pressure. Select B1/B2; inspect Atlas;
return and compare. Compare B1/Saffire S1 for method differences or Saffire S1/S2 for
flow direction. Set oxygen101 for a validation error. Set Cotton,oxygen100,blank flow
and hide zero-credit records for an empty state. Inspect sources and download the
reporting requirements. No model/API key or backend is needed.
