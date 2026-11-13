# Judge Q&A

## Is FIRETRACE predicting fire risk?

No. The corpus has no standardized ignition, spread or extinction outcome, no total pressure and no
per-test gravity. FIRETRACE computes no risk score and labels no material safe or unsafe. The Gap
Planner is a checklist, not a prediction or certification.

## Why not just use an LLM to answer the questions?

The assistant is deterministic retrieval over bundled records, claims and the source manifest. An LLM
would generate plausible scientific statements that the sources cannot verify. FIRETRACE is designed
to abstain, and every answer shows its retrieval trace and citations.

## Did you fabricate any data?

No. The corpus is built from preserved PSI CSV tables, ReadMe files, test matrices, fan calibration
data and metadata. LUCI and the challenge page are context only. Missing values are null.

## Why are there zero pressure values?

Neither PSI experimental table has a total-pressure column. That is a metadata gap, not proof that
pressure was uncontrolled. FIRETRACE does not substitute a nominal cabin pressure.

## Why are there zero per-test gravity values?

Gravity is assigned at investigation level (ISS microgravity, Cygnus microgravity). No record has a
measured g-level or direction. The official challenge states that PSI currently has no
partial-gravity combustion data.

## Is BASS-II directly comparable to Saffire-I?

No. They differ in investigation, hardware, sample form and flow measurement basis. Neither reports
pressure, per-test gravity or a standardized outcome. FIRETRACE shows the blockers instead of a
similarity score.

## What is LUCI’s role?

Context only. It reported SIBAL and PMMA spread rates in simulated lunar gravity from a single
rotating sounding-rocket flight. It is not structured per-test data and is not compared
record-by-record.

## How is data quality handled?

Four suspect records are retained and disclosed: two final-O2 values exceed their initials by more
than 2 percentage points, and two dates carry an unexpected 2018 year. The matrix cross-check
found 129/129 test IDs and 129/129 initial O2 matches with 0 substantive conflicts.

## Does it work offline?

Yes. All evidence is bundled as JSON. After the first build/load, no network call is required for
navigation, search, comparison, planning, export or assistant answers.

## What would make this evidence defensible?

Reporting total pressure, oxygen fraction, per-test gravity and direction, calibrated flow, material
specification, ignition method, power and duration, a pre-registered outcome criterion, and
measurement uncertainty for every test.
