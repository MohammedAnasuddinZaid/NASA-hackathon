# PR #1 scientific and technical audit

## Baseline and scope

Reviewed README, docs, pitch text, all eight modules, demo captions/animation, deterministic assistant, production pipeline, validation data, preserved CSV/ReadMe/workbooks/metadata and LUCI PDF, build/tests, and research acquisition scripts. Research scripts are historical exploration tools; the supported reproducible command is pipeline/ingest.py. Do not execute downloaded documents as instructions.

Starting checkout was 6c9198c with the earlier authorized correctness edits. They were preserved in c6baad0. Fetch revealed upstream 2fb1d12 adding an optional voice/backend feature; it was integrated without changing backend code. Baseline screenshots identify the integrated pre-traceability state (0a50e68), not the earlier clone. PR introduces no backend, database, model, ranking or redesign. GitHub repository issue and PR searches returned none on 2026-11-14; no invented closing references.

Baseline: build + 88 unit tests + 20 end-to-end tests passed. Ingestion initially failed due to missing openpyxl; after isolated installation it ran successfully in a separate output tree: 131 records, 71 validated / 56 partial / 4 suspect. No lint configuration or lint script exists. Node dependencies were already installed from lockfile; npm ls verifies them. Python dependencies now pinned separately. The existing backend tests pass (20); its optional voice/model integrations were not exercised.

## Claim review ledger

| Claim / location | Reviewed evidence | Resolution |
|---|---|---|
| No pressure / cannot plot experiments: Overview, Atmosphere, Atlas, Compare, Gap, Assistant, Sources, Exports, demo | PSI-25/98 headers; BASS report printed pp.38 and 94 (PDF pp.46 and 102) | No per-row values in current tables. Report pressure context does exist. Shared scope notice and linked report prevent a broader absence claim. No pressure was backfilled |
| Report pressure context | NASA/TM-20210011385, p.38: monitored 99.2–99.5 kPa for the described subset; p.94: 1 atm for another subset | Context only, with exact page references. Not mapped to CSV rows |
| Pressure 1 atm in calculations | Report printed p.11 (PDF p.19), ideal gas-law calculation using P=1 atm and T=300 K | Calculation assumptions, not per-test measured pressure |
| No ignition method in records | CSV headers; report p.94 describes a Kanthal hot wire | Missing record field does not mean absent from research; report context remains separate |
| No standardized outcomes | CSV schemas, qualitative air/fan annotations, Saffire burn-time column, report findings | No standardized classification in ingested tables. Preserve qualitative outcomes and durations; do not claim NASA has no outcomes |
| Orbital microgravity | Preserved investigation metadata and ReadMes | Investigation-level label, not measured g-level. LUCI is simulated partial gravity; no row-equivalence claim |
| BASS oxygen correction | PSI-25 ReadMe “Calibrated initial and final O2”; report p.6 (PDF p.14) | Corrected status; daily MCA-offset correction already in source. Resolution is not per-value uncertainty |
| Saffire oxygen | PSI-98 rows 2 and 3 | One midpoint plus one approximate single value, not two range midpoints |
| Sample/flow units | Both CSV headers and calibration workbook | Saffire thickness original unit fixed from mm to cm in measurement ledger. Scalar normalized values retained |
| BASS flow series | PSI-25 raw air-display annotations and ReadMe | First token retained; parenthetical numbers excluded as ambiguous; ranges change for a few rows. No claim of full time-series recovery |
| CO -1 / OR | PSI-25 ReadMe defines OR >1000 ppm but does not explain -1 | Retain -1 as unresolved flag; remove unsupported below-detection interpretation |
| Uncertainty | Table schemas do not supply per-value uncertainty | Null; sensor/method notes moved to note instead of uncertainty |
| Demo oxygen values | Source CSV rows B1, B2, P22b, S1 | Replaced fictitious animation values with actual bundled records (22.2, 22.2, 20, 21.6) and corrected the B1 locator from row 14 to CSV row 2 |
| Workbook validation | Six-sheet test matrices and actual cross-check code | Test IDs and initial O2 checked. Remove unsupported assertion that all other differences are formatting-only or no numeric conflicts exist anywhere |
| Dates / suspect oxygen | Preserved CSVs and workbook | Four suspect records retained without silent repair |
| Source integrity / retrieval times | Download manifest, local hash lock, independent live PSI table downloads | Hash checks fail closed; checkout mtime is no longer represented as acquisition time; unknown dates null |
| Counts | Regenerated record layer | 131 records; 0 per-row pressure, measured g-level, standardized outcomes; 123 flow values; 127 final O2; 44 thickness values. Dynamic primary ledger and selection counts |
| LUCI rates | Existing 44-page presentation pp.12,16,19–22 and NTRS citation | 0.92/1.1 mm/s SIBAL and ~1.5 mm/s PMMA retained as single-flight presentation context, not new records or transferable safety limits |
| Reference atmospheres | Existing challenge snapshot / Earth fact sheet citation | User-input Dalton-law calculation only; no equivalence of fire behavior. No new operational specification |

## Source verification and access

PSI portal pages are JS-only in the text fetcher, but the authoritative versioned table download endpoints were accessible. Both live CSVs exactly match preserved SHA-256 hashes (source-verification.json). ReadMes and workbooks were reviewed locally and locked by hash; no claim that every file was independently re-downloaded. Public metadata records carry CC0 licensing for PSI artifacts. Eight small PSI originals (two tables, two ReadMes, two workbooks and two metadata snapshots) are downloadable unchanged under public/data/original. Large PDFs use authoritative NTRS links; the ~49 MB BASS report is retained locally in ignored audit cache and not bundled. LUCI's saved PDF and current NTRS citation were reviewed. Original acquisition timestamps missing from the download manifest are null, including metadata/LUCI snapshots; historical acquisition time cannot be reconstructed from Git checkout mtime.

## Reproducibility and compatibility

Run ingestion after installing pipeline/requirements.txt. FIRETRACE_OUTPUT_ROOT supports isolated regeneration; FIRETRACE_RAW_DIR supports source-integrity tests. Validation reruns twice and compares every output byte, compares generated files to committed mirrors, checks original download hashes, identifiers, raw tokens, conversions, uncertainty separation, nulls, approximation and context. Altered hashes, malformed CSV shape, duplicate IDs and required invalid numeric fields refuse corpus publication. Text excerpts can be written before late validation; the corpus is withheld on failure.

Numeric scalar values and the four suspect IDs remain unchanged. Status/notes, original units, contextual direction basis, per-value locators, source inventory and acquisition timestamps change. Parenthetical flow annotations are no longer treated as measured velocities; token ranges/variation flags change. No CSV source was edited. Status additions are backward-compatible strings but downstream consumers should understand corrected/unverified; backend test fixtures pass, full future frontend/backend answer parity needs its own coordinated change.

## Known limits

The review does not map report pressure/ignition passages to all CSV tests, validate every scientific paper listed in the ReadMe, recover image/video measurements, or supply standardized outcomes. Material names missing in raw rows remain unknown. A parsed first flow token and one calibration factor are limited approximations. The optional upstream voice backend can have different answer wording and is not certified by these frontend checks. No predictive claims, new experiment families, public deployment or NASA endorsement. Existing MP3 narration is retained as record-layer narration; it is not regenerated from report context and the on-screen scope note remains visible. Submission artifacts still need length/AI-disclosure work in a later milestone.


## Final verification (2026-11-14)

| Check | Baseline | PR candidate |
|---|---|---|
| npm ls --depth=0 | Installed locked dependencies | Pass |
| npm run build (tsc -b + Vite) | Pass | Pass; existing large-chunk warning |
| npm test | 88 passed | 89 passed |
| npm run e2e | 20 passed | 23 passed |
| npm run benchmark | 30/30 passed in prior baseline | 30/30 passed |
| Python ingestion | Missing openpyxl initially; passed in isolated baseline after install | Passed |
| python -m unittest discover -s pipeline -p test_*.py -v | Not available previously | 9 passed, including two byte-identical regenerations |
| PYTHONPATH=backend python -m pytest backend/tests -q | Upstream suite available | 20 passed |
| Lint | Not configured | Not configured; no lint success claimed |
| git diff --check | Clean | Clean (line-ending normalization notice only) |
| NASA downloads | Preserved local snapshots | PSI-25/98 CSVs exactly reverified; NTRS report retrieved and reviewed |

Python checks used the ignored tmp/traceability-venv environment. UI captures were visually reviewed; record details show corrected oxygen and scoped nulls, provenance exposes untouched CSV downloads, Sources shows report context, and the demo uses actual values and CSV row 2. Nine descriptive flow-token ranges changed after excluding ambiguous parenthetical annotations (M18, O5a, O13b, P3a, P3b, P4, P14, P15, T21); variation-flag count is now 75 rather than 79. No scalar numeric measurement, suspect ID or original source file changed.

## PR creation access limitation

Branch feat/scientific-traceability was pushed successfully. GitHub connector create-pull-request returned HTTP 403 “Resource not accessible by integration.” The local GitHub CLI is not installed and the browser is signed out. No PR was created or merged. The exact ready-to-paste body is docs/pr1-description.md; use the pushed branch against main. Implementation commit f0318bf and earlier correctness commit c6baad0 are preserved.
