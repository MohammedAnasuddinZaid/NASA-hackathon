## 1. Summary

Expands FIRETRACE's verified research coverage with16 attributed report findings from the BASS-II Summary Report and FLEX Detailed Results. Users can search findings, source documents, investigation overviews and original records with clear evidence types, scientific category filters, exact source/page links and transparent coverage. The original131 records remain unchanged; no FLEX test rows or missing measurements are invented.

Independent branch `feat/nasa-research-dataset-expansion` starts directly from fetched default `main` **d7c53f4**, reconfirmed before publication. The supplied prompt's all-unmerged premise was stale: owner merged #1/#3/#4; #2/#5 remain open and current main separately includes foundation integrations. This PR modifies no other branch and merges nothing. Codex assisted research/implementation/tests/documentation; source review and downstream scientific interpretation still need human review.

## 2. Previous Coverage

131 normalized table rows:129 BASS-II/PSI-25 and2 Saffire-I/PSI-98. These are source-record counts, not a proof of independent flight-burn counts. Eight original source artifacts plus three context references. BASS's report was already linked as context; LUCI/challenge remain distinct context. Twelve existing claims are not counted as the new typed report findings. Pressure, measured per-test gravity and standardized outcomes remain absent from the record layer.

## 3. New Research Sources

| Source | Investigation | Evidence type | Status |
|---|---|---|---|
|[Burning and Suppression of Solids-II (BASS-II) Summary Report](https://ntrs.nasa.gov/citations/20210011385), NASA/TM-20210011385, October2021|PSI-25|Research report|144-page original reviewed; prior cached original SHA verified;8 curated findings|
|[Detailed Results From the Flame Extinguishment Experiment (FLEX) March2009 to December2011](https://ntrs.nasa.gov/citations/20150023456), NASA/TP-2015-216046, November2015|PSI-69|Research report|314-page original acquired/reviewed;8 curated findings|
|[Flame Extinguishment Experiment](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69), DOI10.60555/mbq8-0451|PSI-69|Investigation metadata|Actual public NASA JSON preserved and hashed; objective/platform context|
|FLEX experimental CSV, version1|PSI-69|Experimental source table|274 raw rows preserved;0 normalized imports, unresolved unit/source differences|
|Existing BASS-II/Saffire-I tables and metadata|PSI-25/98|Two tables +two metadata artifacts|Original bytes/IDs/DOIs/values preserved; metadata objectives are intent, not results|

The research collection links8 selected artifacts:3 tables,3 metadata snapshots,2 reports. This is separate from the unchanged legacy source inventory, not an inflated overall document total. PSI originals are CC0; NTRS rights differ: BASS metadata says use by/on behalf of US government permitted, FLEX says Public Use Permitted. Only short attributed FIRETRACE paraphrases are published; full PDFs/figures are externally linked, not redistributed. Original acquisition dates remain null when unknown. See [source/rights guide](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/nasa-research-dataset-expansion/docs/research-expansion.md).

## 4. BASS-II Integration

Eight stable findings cover solid sample geometry/flow/ignition, daily MCA oxygen offset/resolution, dilution-model assumptions, oxygen-consumption calorimetry factor, qualified heat-release aggregate, monitored pressure for a report subset, gas-law assumptions and configuration-dependent combustion-product behavior. Each includes source ID, section, printed page, one-based PDF page, verification anchor/page hash, tags, qualifications and explicit paraphrase origin.

No report-to-CSV test mapping is claimed.99.2–99.5kPa is not assigned to all129 rows;1atm/300K are calculation assumptions;0.1% sensor resolution is not measurement uncertainty; most well-below100W is not an individual100W measurement or safety threshold. Already-corrected table oxygen is not corrected again.

## 5. FLEX Integration

FLEX is **liquid-fuel droplet combustion**, distinct from solid-fuel flame spread. Adds authentic PSI metadata/DOI and report passages covering MDCA/CIR, methanol/n-heptane atmosphere scope, free/fiber-supported/translated droplets, extinction behaviors, imaging uncertainty, unavailable radiometry, field-of-view gaps and needle-contamination qualifications. Historical284 report tests are not normalized rows.

The actual PSI version1 CSV contains274 rows. Its burning-rate header says “mm”; gas headers omit subscripts; test1 initial diameter1.69mm differs from report TableI1.80mm. Original Windows-1252 bytes (including0x96 en dash) are retained. No values are averaged, relabeled or silently reconciled. Normalizing even apparently clear fields is deliberately deferred until unit/version/measurement definitions and test correspondence are resolved. Cool-flame passages were not curated from these selected sources; no absence-of-phenomenon claim.

## 6. Dataset Changes

| Count / category | Before | After |
|---|---:|---:|
|Investigations represented in research discovery|2|3|
|Structured experiment records|131|131|
|BASS-II / Saffire-I / FLEX normalized records|129 /2 /0|129 /2 /0|
|Typed report findings|0|16 (8 BASS-II,8 FLEX)|
|Reports with typed curated findings|0|2|
|Selected linked artifacts in new research collection|not present|8|
|Per-record pressure /measuredg /standardized outcomes|0 /0 /0|0 /0 /0|
|Measurement categories|Original record fields|Same record fields; separate report-method/aggregate quantities, no new per-test categories|

Counts are generated from real inputs. Report-source rows, historical test scope, source documents and findings remain separate. FLEX has no normalized measurement denominator, not a misleading0/0 coverage percentage. Solid-fuel droplet dimensions are not applicable, not missing mandatory solid-fuel fields.

## 7. Schema and Ingestion

New **firetrace.research/1** envelope, separately authored/validated/published from legacy corpus. ResearchInvestigation contains category/fuel/platform/objective metadata with source locator; ResearchDocument contains NASA IDs/URLs/DOIs/version/rights/hash/acquisition; ReportFinding contains semantic ID, type, paraphrase, locator, tags, raw numeric wording/reference/unit/status/qualifier/uncertainty and limitations. experiment_ids is empty for all findings. No ExperimentRecord/schema/API change.

pipeline/research.py validates IDs, duplicates, original hashes, NASA identities, report associations, locators, unit/status vocabulary and no test promotion before writing. Repeated imports are byte-identical; optional output-root supports isolation. Canonical-input SHA and exact base-corpus SHA are both retained. Optional acquire_research_pdfs.py reacquires only registered exact-hash NASA PDFs; --verify-pdfs checks original file hashes and all16 page anchors/hashes using pinned optional pypdf6.14.2. Default tests/import need no network or PDF dependency.

Outputs: public/data/research.json, generated coverage in src/data plus public mirror, data/research/validation_report.json. Small raw metadata/CSV and authoritative curation remain in data/research; raw files have Git no-text-conversion rules. Large PDFs stay in ignored tmp. No legacy ingestion output is rewritten. [Dictionary, commands and source decisions](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/nasa-research-dataset-expansion/docs/research-expansion.md).

## 8. Frontend Improvements

Atlas retains its original filters/table/detail/CSV behavior and adds a lazy **Research findings & coverage** subview. Search uses deterministic token-AND matching with exact experiment/finding-ID precedence, including source titles/IDs and investigation DOIs. Six filters: query, investigation, combustion type, evidence type, topic and source. Results distinguish experimental record, research finding, source document and investigation overview,24 at a time. Loading/retry/version mismatch and empty states are explicit.

Methodology adds generated investigation/measurement/status coverage and actual BASS/FLEX references. Objective/platform metadata is identified as intent/context. Research compatibility explains solid/droplet and report/test differences without a numerical equivalence score. Downloads use the existing Blob helper and retain separate research JSON/coverage identities. Existing Assistant/API/Compare/ranking/Exports scope remains the original record corpus; no false claim of new model retrieval.

Research JSON is about34kB and fetched only in the research subview, never full PDFs. Final initial JS2201.40kB versus2185.73kB baseline (+15.67kB before gzip); lazy research chunk9.29kB. Existing large-bundle warning remains. No runtime dependency/backend/cloud/model service added.

## 9. Scientific Validation

| Finding or field | NASA source | Source locator | Verification result |
|---|---|---|---|
|Oxygen sensor offset/resolution|NTRS20210011385|Printed6 /PDF14, §1.2|Daily MCA offset;0.1% resolution, not per-value uncertainty|
|Calorimetry factor|NTRS20210011385|Printed2 /PDF10, abstract continuation|13.1kJ/gO2 retained as calculation constant|
|Qualified heat release|NTRS20210011385|Printed11 /PDF19, §1.6|Most well below100W; no test-level or safe-limit assignment|
|Subset monitored pressure|NTRS20210011385|Printed38 /PDF46, setup/Fig2.16|99.2–99.5kPa report range; legacy pressures remain null|
|Gas-law inputs|NTRS20210011385|Printed11 /PDF19, Eq1.3|1atm/300K remain assumptions|
|Liquid-droplet report scope|NTRS20150023456|Printed1 /PDF7, executive summary|284 historical tests is report scope only|
|Droplet imaging estimate|NTRS20150023456|Printed8 /PDF14, §3.1.2|±50µm method estimate retained; not copied into CSV uncertainty|
|Radiometry|NTRS20150023456|Printed4 /PDF10, §2.2|Insufficient sensitivity; quantitative output not reported|
|Trace truncation /contamination|NTRS20150023456|Printed16–17 /PDF22–23, §5.1–5.2|Preserves view-loss and qualified/probable/unresolved interpretations|
|Unchanged BASS2-B1|PSI-25|CSV row2|Corrected22.2%, original null pressure/provenance unchanged|
|Deferred FLEX test1 diameter|PSI-69 table /NTRS20150023456|CSV row2 /printed10 PDF16 TableI|1.69mm versus1.80mm disclosed, not silently corrected|

Both full PDFs were inspected locally after web-reader size limits; relevant pages rendered and visually checked. PDF integrity/anchors are location checks, not automatic proof of summary entailment. Human scientific review remains appropriate. Actual downloaded research and coverage JSON equal the generated snapshots; existing exported CSV retains131 rows and empty pressure cells.

## 10. GitHub Issues

Repository issues page showed0 open issues. No invented Fixes references. Native download-link events were not observable in ChatGPT browser; research downloads now use the already-existing Blob helper and actual downloaded files were verified. Source discrepancies are documented unresolved items, not claimed corrections to NASA originals. No fabricated before/after images.

## 11. Screenshots

Genuine ChatGPT in-app browser captures; no external browser UI or generated screenshots.

![Research coverage](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/nasa-research-dataset-expansion/docs/evidence/pr6/research-coverage.png)
![BASS report quantities and citation](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/nasa-research-dataset-expansion/docs/evidence/pr6/bass-report-finding.png)
![FLEX investigation](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/nasa-research-dataset-expansion/docs/evidence/pr6/flex-investigation.png)
![FLEX contamination search](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/nasa-research-dataset-expansion/docs/evidence/pr6/flex-contamination-search.png)
![Methodology sources](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/nasa-research-dataset-expansion/docs/evidence/pr6/methodology-research-sources.png)

[All screenshots, actual downloaded JSON/CSV and executed check logs](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/tree/feat/nasa-research-dataset-expansion/docs/evidence/pr6). Evidence README distinguishes intermediate captures from final inventory and explains limitations. No mobile verification claimed.

## 12. Testing

| Test /Check | Command | Result | Notes |
|---|---|---|---|
|Main frontend baseline|npm test; npm run build|137 pass +build pass|Initial sandbox temp EPERM before tests; workspace TEMP/TMP rerun passed|
|Backend baseline|python -m pytest backend/tests -q -p no:cacheprovider --basetemp tmp/pr6-baseline-elevated|195 pass|Sandbox run stalled/interrupted; unrestricted local process run passed; no backend changes|
|Final frontend|npm test|169 pass|32 new research/source/search/render/load/export regressions|
|Research pipeline|python -m unittest discover -s pipeline -p test_research.py -v|10 pass|Hashes, counts, duplicates, associations, units, nulls, unchanged originals and byte-identical regeneration|
|Original ingestion|python -m unittest discover -s pipeline -p test_ingest.py -v|9 pass|Existing isolated environment with openpyxl; unchanged source records/mirrors|
|Original report verification|python pipeline/research.py --verify-pdfs tmp|Pass|Exact2 PDF hashes and16 page anchors/hash checks, pinned parser|
|Exact cached acquisition|python pipeline/acquire_research_pdfs.py|Pass|Both cached originals verify; no false claim of new download in this invocation|
|TypeScript/production|npm run build|Pass|Initial missing Node type reference in new test fixed; final build passes|
|Isolated browser workflows|npm run e2e:research-library|Blocked before launch|2 workflows included; missing Chromium headless-shell1254, no pass claimed|
|ChatGPT browser|Eight routes +research/search/source/category/download cases|Verified|Actual JSON/coverage download equality and original131-row CSV validation|
|Lint/diff|git diff --check|Pass; no lint script|No invented lint pass|

Locked dependencies installed via npm ci (offline cache lacked yallist); no new dependency/lockfile change. Default tests use no NASA/model network. Existing Starlette/httpx deprecation and large-chunk warnings remain. Automated browser execution is a genuine environment blocker, not a tested success.

## 13. Scientific Limitations

No new normalized droplet tests. No verified report-to-CSV mappings. Report pressure, heat aggregates, sensor resolution, method uncertainty and calculation assumptions remain report-level. Context microgravity does not become measuredg or partial gravity. Original table gaps remain; qualitative annotations do not become standardized outcomes. Solid-fuel spread and droplet burning/extinction are not interchangeable. No prediction, certification, compliance or NASA endorsement.

## 14. Compatibility with PRs #1–5

[Cross-PR compatibility report](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/nasa-research-dataset-expansion/docs/cross-pr-compatibility.md) records actual states, confirmed file/interface overlaps versus possible conflicts, version/schema/API/AI/ranking/basket boundaries, recommended review order and integration checks. No trial merges were used.

#1 provenance is already on main; #2 functionality is separately integrated on main while PR remains open; #3/#4 are owner-merged. Open #5 overlaps README/package/main/Atlas. Combine scripts/CSS/provider wrapping/row actions while retaining the lazy research subview. Report IDs never become experiment basket entries. Existing experiment IDs/base SHA remain stable, so research-only additions do not invalidate saved experiment selections. Current backend/TRACE do not automatically retrieve new findings; that needs a separately versioned evidence adapter, not relaxed record validators.

## 15. Breaking Changes

None to original normalized JSON, measurement contracts, IDs, source manifest, backend API, matching/ranking or record export columns. New separately versioned research schema/files are additive. Methodology/source counts are explicitly scoped; Atlas adds a query-driven subview and preserves eight routes. Original ingestion and research ingestion remain separate commands.

## 16. Known Limitations

Playwright executable missing; no automated browser pass or mobile/cross-browser claim. No new Assistant report retrieval or report-aware basket/brief export. FLEX source/unit/version discrepancies need dedicated reconciliation. BASS rights are not CC0; PDFs remain external/cache-only. No exhaustive review of all144/314 pages or related papers, cool-flame corpus, mass import or semantic truth guarantee. Existing broader documentation contains historical test/hash wording; this guide/code/results define current PR scope.

## 17. Manual Review Instructions

```powershell
cd C:\Users\novaz\OneDrive\Documents\ChatGPT\NASA\FIRETRACE-research-expansion
npm.cmd ci
$env:VITE_EVIDENCE_API='off'
npm.cmd run dev -- --host 127.0.0.1 --port 5190
# Another terminal; restricted Windows temp environment only:
$env:TEMP=Join-Path (Get-Location) 'tmp'
$env:TMP=$env:TEMP
npm.cmd test
npm.cmd run build
python pipeline/research.py
python -m unittest discover -s pipeline -p test_research.py -v
```

1. Open http://127.0.0.1:5190/#/atlas?id=BASS2-B1; inspect corrected22.2%, null pressure and CSVrow2 provenance. Close drawer; filters still work.
2. Open Research findings & coverage; verify3 investigations,131 records,16 findings,2 reports,8 selected artifacts and separate solid/droplet categories.
3. Search daily oxygen or NTRS-20210011385; verify report type, printed/PDF page, method status, raw/quantity qualification and NASA links. Search pressure subset; verify no row backfill.
4. Reset; select FLEX;8 findings. Filter liquid-droplet/investigation overview for platform/DOI; search contamination. Try topic/source/evidence filters and a nonsense query for empty state.
5. Read default BASS/FLEX compatibility explanation; choose BASS/Saffire and verify it still requires condition/method checks. Findings cannot enter numeric Compare as tests.
6. Download research/coverage JSON and compare to public snapshots. Visit Exports for unchanged131-row CSV, then Methodology for actual NASA sources and status-scoped coverage.
7. Optional original-page verification: install pipeline/requirements-research-verification.txt; run python pipeline/acquire_research_pdfs.py, then python pipeline/research.py --verify-pdfs tmp. Browser suite requires its expected executable. Review cross-PR report, leave this PR unmerged.
