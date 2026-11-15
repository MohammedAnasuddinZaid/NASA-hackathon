# Judge Q&A

## Is FIRETRACE predicting fire risk?

No. The corpus has no standardized ignition, spread or extinction outcome, no total pressure and no
per-test gravity. FIRETRACE computes no risk score and labels no material safe or unsafe. The Gap
Planner is a checklist, not a prediction or certification.

## Why not just use an LLM to answer the questions?

Exact facts use deterministic retrieval over records, validated claims and source locators.
An optional server-enabled model can add a separately labelled interpretation after evidence-ID
and response validation. Provider failures fall back to deterministic evidence. Unsupported questions
abstain instead of fabricating citations. Local QA verified mocked provider contracts, not a live
model call; no server credential was configured.

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

Already-loaded experiment search, comparison, planning, deterministic answers and basket exports
were verified after actually stopping the backend, then reconnecting after restart. Research data
and chunks load lazily and original NASA PDFs are external. Cold offline reload is not guaranteed;
there is no service worker. Optional external interpretation needs the backend and network.

## What would make this evidence defensible?

Reporting total pressure, oxygen fraction, per-test gravity and direction, calibrated flow, material
specification, ignition method, power and duration, a pre-registered outcome criterion, and
measurement uncertainty for every test.
