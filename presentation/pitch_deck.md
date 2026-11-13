# FIRETRACE pitch deck

Companion file: `presentation/pitch_deck.pptx` (12 slides).

## Slide 1 — Title

FIRETRACE: Flame in Freefall evidence intelligence  
NASA Space Apps 2026  
Know what the evidence says. See what it doesn't.

Screenshot: `presentation/screenshots/overview.png`

## Slide 2 — Problem

- Spacecraft fire safety depends on atmosphere and gravity.
- Public microgravity combustion tables do not report total pressure or per-test gravity.
- A plausible answer can still be unsupported.

## Slide 3 — Evidence

- BASS-II: 129 records (PSI-25)
- Saffire-I: 2 records (PSI-98)
- LUCI: context only (NTRS 20250010653)
- Challenge page: context only

## Slide 4 — Central finding

- Initial O2 reported: 131 / 131
- Total pressure reported: 0 / 131
- Measured per-test gravity: 0 / 131
- Standardized outcome: 0 / 131
- Missing means unknown, not zero.

Screenshot: `presentation/screenshots/atmosphere.png`

## Slide 5 — What FIRETRACE does

- Overview
- Atmosphere Explorer
- Evidence Atlas
- Compare
- Gap Planner
- Evidence Assistant
- Methodology & Sources
- Exports

## Slide 6 — Atmosphere Explorer

- ppO2 = total pressure × oxygen fraction
- Lunar cabin planning point: 10.2 psi × 30 % = 3.06 psi
- Spacesuit: 4.3 psi × 100 % = 4.3 psi
- Every corpus record sits on the unknown-pressure axis
- Oxygen fraction alone is not an atmosphere

## Slide 7 — Evidence Atlas

- Search and filter 131 records
- Quality: 71 validated, 56 partial, 4 suspect
- Suspect flags retained, not corrected
- Drawer shows measurements, raw fields, provenance and citations

Screenshot: `presentation/screenshots/atlas.png`, `presentation/screenshots/atlas-drawer.png`

## Slide 8 — Compare

- Side-by-side values with measurement basis
- Comparability audit reports blockers
- Pressure and per-test gravity unknown
- Different flow measurement bases
- No similarity score is computed

Screenshot: `presentation/screenshots/compare.png`

## Slide 9 — Gap Planner

- Set a target atmosphere and gravity regime
- See which dimensions are evidenced
- Required measurements for a comparable test
- Comparability controls
- Downloadable Markdown plan
- Planning aid only

Screenshot: `presentation/screenshots/gap.png`

## Slide 10 — Evidence Assistant

- Deterministic retrieval, no external model
- Every answer cites source locators
- Abstains when the corpus cannot support an answer
- 30 / 30 benchmark questions passed
- Safety and certification questions are refused

Screenshot: `presentation/screenshots/assistant-answer.png`

## Slide 11 — Why this matters

- No fabricated measurements or citations
- No zero-filling or imputation
- No arbitrary risk or relevance score
- BASS-II, Saffire-I, LUCI and the challenge stay distinct
- Missing data is shown as unknown

## Slide 12 — Demo path

- 0:00 Overview
- 0:25 Atmosphere Explorer
- 0:55 Evidence Atlas
- 1:25 Compare
- 1:55 Gap Planner
- 2:25 Evidence Assistant
- 2:50 Exports and close

See `docs/demo_script.md` and `docs/judge_qa.md`.
