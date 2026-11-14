## 1. Summary

FIRETRACE now distinguishes omissions in its imported CSV record layer from pressure, ignition and outcomes documented elsewhere in NASA research. It exposes original values/units, correction status and source locators, serves small untouched PSI originals, and regenerates the corpus deterministically with fail-closed source integrity checks. The 131 records and scalar measurements remain intact.

## 2. Problems Identified

- **Confirmed bugs:** demo displayed fabricated oxygen values and cited B1 as row 14 rather than row 2; Saffire thickness measurement mislabeled original cm as mm; sensor notes occupied uncertainty; acquisition dates used checkout file mtimes. Earlier authorized fixes for LUCI/burn-time routing, comparison warnings and scoped exports are included.
- **Misleading scientific claims:** table omissions could imply no pressure/ignition/outcome information existed in NASA research; Saffire was described as two range midpoints; workbook checks overstated their numeric coverage; -1 was interpreted as below detection without evidence.
- **Missing functionality:** no original-file downloads or concise original/normalized measurement ledger.
- **Data integrity:** nondeterministic output timestamps, missing hash enforcement, weak CSV/identifier checks and ambiguous parenthetical flow-number extraction.
- **Documentation:** source-download claims, source inventory and setup/check instructions disagreed with implementation.

## 3. Changes Implemented

- **Scientific scope:** all modules receive a concise record-layer scope notice. Reviewed report context is linked with printed/PDF page references; no report pressure is imputed into records. Assistant pressure answers cite both table gaps and report context.
- **Traceability UI:** record values show original token/file/row and corrected status; expandable measurement ledger separates original/normalized units and notes. Sources distinguishes preserved NASA originals, normalized exports, and externally linked large PDFs.
- **Data pipeline:** pinned small dependency set; manifest-based timestamps with unknown dates null; source lock and acquisition-hash verification; finite numeric parsing, CSV shape and ID checks; uncertainty null with separate notes; contextual flow directions kept at investigation level. Ambiguous parenthetical flow annotations are excluded from descriptive token ranges.
- **Demo/coverage:** demo values and B1 citation now read real records. Main source/coverage counters and export selection quality counts derive from the dataset. Corrected comparison/assistant regressions are covered by tests.
- **Docs:** complete audit ledger, data dictionary, live source verification hashes, baseline/final check results and genuine UI evidence.

Files: pipeline/, src/data + public/data mirrors, source lock, record drawer, shared scope notice, demo, assistant/compare/exports, Methodology/Overview/shell, tests/e2e and docs. No backend files differ from current main.

## 4. Scientific Verification

| Claim or field | Original issue | Source checked | Correction | Verification |
|---|---|---|---|---|
| Pressure | Table omission implied broad absence | [BASS-II report](https://ntrs.nasa.gov/citations/20210011385), printed p.38/PDF p.46; printed p.94/PDF p.102 | Monitored 99.2–99.5 kPa and 1 atm are subset context; no row mapping inferred | Retrieved 144-page original, recorded hash and page review |
| Calculation pressure | Could be mistaken for measurement | Same report printed p.11/PDF p.19 | P=1 atm and T=300 K identified as calculation assumptions | Passage reviewed |
| Oxygen correction | Reported readings not distinguished as source-corrected | PSI-25 ReadMe “Calibrated initial and final O2”; report printed p.6 | corrected status; no additional offset applied | Local source + pipeline tests |
| Approximate Saffire O2 | Two “range midpoints” | [PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98), CSV rows 2–3 | S1 midpoint, S2 approximate single value | Live CSV identical to preserved SHA-256 |
| Thickness | Original unit mislabeled | PSI-98 Sample Thickness (cm), rows 2–3 | Original 0.37 cm → normalized 3.7 mm | Conversion regression |
| CO -1 | Unsupported below-detection interpretation | PSI-25 CSV + ReadMe | Unresolved flag preserved | Parser regression |
| Uncertainty | Notes masqueraded as uncertainty | Both table schemas | null uncertainty; separate note | All-measurement assertion |
| Demo values/citation | Fictitious values, wrong row | [PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25), B1 row 2; other selected rows | Actual data, exact locator | Browser regression + screenshot |
| LUCI | Distinction between partial-gravity context and orbital records | [NTRS LUCI](https://ntrs.nasa.gov/citations/20250010653), PDF pp.12,16,19–22 | Context retained; not new structured rows | Presentation and citation review |

Full claim review, scope and limitations: [scientific audit](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scientific-traceability/docs/scientific-audit.md); [source verification](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scientific-traceability/docs/source-verification.json).

## 5. GitHub Issues

Repository issue and PR searches returned no existing items during the audit. No issue-closing references are invented. Root causes and regressions are documented above.

## 6. Screenshots / Evidence

Real local Chromium captures, visually inspected. Before is integrated baseline 0a50e68, including previous authorized fixes and teammate upstream work.

| Before | After | Result |
|---|---|---|
| ![Record before](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/before/record.png) | ![Record after](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/after/record.png) | Correction status, raw token/row, scoped nulls |
| ![Provenance before](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/before/provenance.png) | ![Provenance after](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/after/provenance.png) | Original CSV access and measurement ledger |
| ![Methodology before](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/before/methodology.png) | ![Methodology after](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/after/methodology.png) | Source-scope notice and computed inventory |

![Report context](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/after/report-context.png)
![Corrected demo](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/scientific-traceability/docs/evidence/pr1/after/demo.png)

No separate baseline demo screenshot was captured; it is not mislabeled as before evidence. See [evidence notes](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/scientific-traceability/docs/evidence/pr1/README.md).

## 7. Testing and Validation

| Check | Result | Notes |
|---|---|---|
| npm ls --depth=0 | Pass | Existing dependencies verified |
| npm run build | Pass | Includes TypeScript; existing large-bundle warning |
| npm test | 89 passed | Baseline 88 |
| npm run e2e | 23 passed | Baseline 20; local provenance download hash checked |
| npm run benchmark | 30/30 | Existing limited intent benchmark, not universal accuracy |
| python pipeline/ingest.py | Pass | Isolated environment with pinned dependencies |
| python -m unittest discover -s pipeline -p test_*.py -v | 9 passed | Reproducibility, source integrity, malformed input, IDs, units, nulls, originals |
| PYTHONPATH=backend python -m pytest backend/tests -q | 20 passed | Existing upstream suite; no backend implementation changes |
| Lint | Not configured | No lint script exists; not claimed passed |
| git diff --check | Pass | No whitespace errors |

## 8. Data Integrity

131 records: 129 BASS-II + two Saffire sample rows; no claim that rows equal independent flight burns. Quality remains 71 pipeline-validated / 56 partial / four suspect. No original files or scalar numeric measurements changed. Pressure, measured per-test gravity and standardized outcome coverage remain zero; final O2 127, flow 123, thickness 44. Metadata inventory expands from 8 to 10 by including the two already-preserved PSI snapshots. Eight small PSI originals are copied unchanged for download; 3 context sources include the reviewed BASS report.

Status/notes, source-unit labeling, unknown acquisition timestamps, contextual direction basis and locators change. Nine token ranges change after excluding parenthetical numbers with unverified basis; flow-varies flags now total 75 rather than 79. Hash-locked originals and raw strings remain available. “validated” is an extraction-check status, not scientific certification.

## 9. Breaking Changes / Compatibility

Static explorer architecture retained. Existing fields remain; optional provenance/download fields and measurement notes are additive. Consumers must support corrected/unverified statuses and nullable source acquisition timestamps. Measurement uncertainty is now correctly null, with old explanatory content in note. No database migration. The teammate's backend/voice feature was integrated from main and remains unchanged in this PR; future full answer-parity expansion belongs to a separate change.

## 10. Known Limitations

- Report pressure/ignition passages are not mapped to each CSV row. No pressure or g-level is backfilled.
- Not every numeric workbook column or cited paper was independently verified.
- Historical acquisition timestamps cannot be reconstructed for some preserved artifacts.
- Large NTRS PDFs are linked; the reviewed BASS original remains in local ignored audit cache, not the frontend bundle.
- Existing MP3 narration remains record-layer narration; report context is provided onscreen, not in regenerated audio.
- Assistant remains deterministic, scenario planner a checklist; no safety predictions, ranking or certification.
- Optional upstream voice/model integrations were not runtime-tested; existing backend tests pass.
- Large bundle warning and submission/AI-disclosure packaging remain later work.

## 11. Review Instructions

1. npm ci; npm run dev; open http://localhost:5173.
2. Atlas → search BASS2-B1 → open row. Check corrected 22.2% O2, raw token and CSV row 2; pressure remains “Not reported in this record.”
3. Inspect provenance; download preserved NASA CSV. Expand measurement ledger and raw source row.
4. Inspect Saffire S1 thickness: original 0.37 cm, normalized 3.7 mm; inspect one range-midpoint and one approximate-single oxygen value.
5. Methodology → report context: inspect exact pages in authoritative NTRS PDF; confirm these values were not inserted into the record layer.
6. Overview demo: B1/B2 22.2, P22b 20, S1 21.6 and B1 source CSV row 2.
7. Compare Saffire S1/S2: opposed/concurrent direction is flagged. Export Saffire: quality summary is 0 validated / 2 partial / 0 suspect.
8. Install pipeline/requirements.txt in an activated Python environment; run npm run ingest and npm run validate:data. Two runs must match byte-for-byte.
9. Review docs/scientific-audit.md and data-dictionary.md; leave the PR unmerged for human review.
