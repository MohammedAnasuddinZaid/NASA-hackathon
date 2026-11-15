# Verified NASA research expansion

PR #6 is independent at main d7c53f4, branch feat/nasa-research-dataset-expansion.
It adds a separate research snapshot, not new measurements in the original corpus.
Current default main already includes earlier integrations; PR #5 remains separate/open.

## Before and after

| Scope | Before | After |
|---|---:|---:|
| Investigations represented in research discovery |2|3|
| Structured experiment records |131|131|
| BASS-II / Saffire-I / FLEX normalized rows |129 / 2 / 0|129 / 2 / 0|
| Typed curated report findings |0|16 (8 BASS-II, 8 FLEX)|
| Full research reports with curated findings |0|2|
| Linked artifacts in the new research collection |not present|8|

The legacy source inventory remains eight artifacts plus three context sources. BASS's
report was already a context reference: this PR adds structured findings, not a newly
discovered document. The new collection links existing BASS/Saffire tables, the BASS report,
the FLEX report, the three investigation metadata snapshots and the FLEX experimental CSV. Eight is this curated
collection's artifact count, not a replacement for the legacy inventory. Existing claims
are not retroactively counted as these typed report findings. No independent-burn count
is inferred from 131 table rows, and neither report's historical count increases that total.

## Actual sources and acquisition

| Source | Verified identity / access | Use and rights |
|---|---|---|
| PSI-25 table |BASS-II, DOI10.60555/4qc4-de67, existing locked original|Unchanged129 rows; CC0|
| PSI-98 table |Saffire-I, DOI10.60555/0t15-1z43, existing locked original|Unchanged2 sample rows; CC0|
| PSI-25 / PSI-98 metadata |Existing locked investigation metadata snapshots|Objectives/platforms are attributed context; two distinct artifacts; CC0|
| NTRS20210011385 |Burning and Suppression of Solids-II (BASS-II) Summary Report, NASA/TM-20210011385, October2021,144 PDF pages|Original cached in tmp from prior audit; exact same SHA verified; short attributed FIRETRACE paraphrases; NTRS says use by/on behalf of US government permitted, not CC0|
| NTRS20150023456 |Detailed Results From the Flame Extinguishment Experiment (FLEX) March2009 to December2011, NASA/TP-2015-216046, November2015,314 PDF pages|Full original acquired from NASA; NTRS Public Use Permitted; linked, not redistributed|
| PSI-69 metadata |Flame Extinguishment Experiment, DOI10.60555/mbq8-0451, metadata modified06-Jun-2025|Original public JSON preserved; CC0; objective/hypothesis text is not a verified finding|
| PSI-69 table |FLEX version1 experimental table,274 CSV rows|Original preserved, no normalized imports; CC0|

Official locations:

- https://ntrs.nasa.gov/citations/20210011385
- https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf
- https://ntrs.nasa.gov/citations/20150023456
- https://ntrs.nasa.gov/api/citations/20150023456/downloads/20150023456.pdf
- https://psi.nasa.gov/physci/repo/data/investigations/PSI-69
- https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-69
- https://sti.nasa.gov/disclaimers/

NASA pages/metadata verified2026-11-14 UTC (2026-11-15 IST). PSI portals are JS-driven;
readable metadata and download APIs work. /geode-py/ws/studies/PSI-69 is not the metadata
endpoint and returned a permission response; this is not evidence that FLEX is unavailable.
The web PDF reader rejected large content (about49MB BASS/43MB FLEX); originals were read
locally with pypdf and relevant pages rendered with Poppler. No search snippet was used as
the scientific source. Poppler reported missing Symbol/ArialUnicode font warnings; selected
rendered pages were visually checked and source text/page hashes checked independently.

Original small metadata/CSV files are in data/research/raw, with exact byte hashes,
acquisition time and explicit no-text-conversion Git attributes. NTRS metadata snapshots
preserve title/ID/distribution/copyright/download information. PDFs remain in ignored tmp
and are externally linked; no NASA figures or broad excerpts are republished. The BASS
original acquisition time was not reconstructed: acquired_at stays null, verified_at is
the present review time. NASA STI rights can differ for contributed/contractor material;
this implementation does not relabel all NASA content public domain or CC0.

## BASS-II findings and scientific scope

Eight semantic IDs cover solid sample geometry/flow/ignition, daily oxygen offset and
sensor resolution, dilution model assumptions, oxygen-consumption calorimetry constant,
qualified heat-release aggregate, pressure for a specific report subset, ideal-gas inputs,
and configuration-dependent CO/CO2 behavior. Findings link to investigation PSI-25, not to
individual test IDs. Printed page = one-based PDF page minus8 in this report.

Examples: sensor resolution0.1% is not per-value uncertainty;13.1kJ/gO2 is a calculation
factor; “most well below100W” is a qualified aggregate, not a100W test result or safe limit;
99.2–99.5kPa on printedp.38/PDF46 is subset context;1atm/300K on printedp.11/PDF19
are calculation assumptions. Original pressure fields remain null. No new oxygen correction
is applied to already-corrected PSI values. Gravity labels remain investigation context.

## FLEX findings and deferred test normalization

FLEX is explicitly liquid-fuel droplet combustion: methanol/n-heptane in MDCA/CIR on ISS.
Eight findings cover scope/hardware, fuel/atmosphere range, supported/free/translated droplets,
extinction behavior, method-level diameter uncertainty, unavailable radiometric output,
camera field-of-view gaps, and needle-contamination qualifications. Printed page = PDFpage
minus6. Report names/locators are preserved even where historical wording varies internally.
Cool-flame evidence was not curated here; this does not assert its absence from FLEX research.

The actual version1 CSV was inspected, not just the report abstract. It contains274 rows,
whereas the report describes284 historical tests. Its burning-rate header gives “mm,” and
gas headings omit molecular subscripts. Test1 initial diameter is1.69mm in the CSV and1.80mm
in report TableI (printed10/PDF16). These are source differences, not values to average or
silently repair. The CSV is Windows-1252 (0x96 en dash), retained byte-for-byte. No FLEX row
was normalized, even if some fields are individually clear: a later importer must establish
version/measurement definitions, unit semantics, report/test correspondence and qualifications.
This is an explicit scientific scope decision rather than a claim that row extraction is
technically impossible. The original CSV remains linked for independent inspection.

Report5.2 discusses coating contamination; probable methanol disruption and unresolved heptane
disruption must retain those qualifications. A disappearing camera trace is not necessarily
extinction. Instrument presence does not establish usable quantitative radiometric output.
The ±50µm imaging estimate is methodological, not assigned to every source measurement.

## Schema / dictionary

Canonical authored input: data/research/curation.json, schema firetrace.research/1.
Typed frontend contract: src/lib/researchLibrary.ts. Ingestion validator: pipeline/research.py.

| Structure/field | Meaning |
|---|---|
|investigations[].id|Existing PSI investigation ID, distinct from source artifact/finding IDs|
|combustion_type / fuel_category|solid_fuel/solid vs liquid_droplet/liquid; no equivalent numerical comparison|
|sources[].id / investigation_id|Stable artifact key and its investigation association|
|kind|research_report, experimental_table, investigation_metadata|
|url / download_url / doi / nasa_id|Actual NASA location/identifier; absent report DOI stays null|
|version / sha256 / bytes / acquired_at|Published/snapshot identity and original byte provenance; unknown date null|
|findings[].id|Semantic stable key, not array position or legacy experiment ID|
|content_origin / summary|Explicit FIRETRACE-authored attributed paraphrase, not original NASA quotation|
|finding_type|methodology, report_aggregate, qualitative_observation, research_limitation|
|quantitative / quantities|Whether typed report quantities exist; never normalized test values|
|quantity.raw / value / unit|Original token/wording and literal numeric reference with source unit; null retained|
|quantity.status / qualifier|method_specification, calculation_constant, qualified_aggregate, reported_range_bound, calculation_assumption, report_scope, method_uncertainty; mandatory explanation|
|uncertainty|Only actual documented estimate, otherwise null; resolution is not uncertainty|
|locator|Section, printed page string, one-based PDF page; actual PDF link fragment|
|experiment_ids|Empty for all16 findings: no verified legacy row mappings|
|verification|Short page anchor plus normalized extracted-page SHA; not an LLM proof of entailment|
|limitations / topics|Qualifications and deterministic discovery tags|
|dataset_version / base_corpus_sha256|SHA of canonical research input plus separate exact legacy corpus SHA; both identify the combined research view|

The raw/normalized numeric reference in a report aggregate may be a bound or calculation input,
not an observed scalar: always read status/qualifier. No derived solid/droplet averages, outcome
labels, partial-gravity inference, safety probability, engineering certification or endorsement.

## Reproduce and validate

```powershell
cd C:\Users\novaz\OneDrive\Documents\ChatGPT\NASA\FIRETRACE-research-expansion
python pipeline/research.py
python -m unittest discover -s pipeline -p test_research.py -v
# Optional online acquisition of exact reviewed PDFs; no corpus mutation:
python pipeline/acquire_research_pdfs.py
# Optional parser; page hashes were generated with pypdf6.14.2:
python -m pip install -r pipeline/requirements-research-verification.txt
python pipeline/research.py --verify-pdfs tmp
```

Default ingestion/tests are offline, standard-library only; optional PDF verification needs
pypdf. Repeating publication is byte-identical; generated_at/wall-clock is not a version.
Changed original hashes, duplicate IDs, wrong source association, missing locators, invalid
units/statuses or test-level mappings fail closed before publication. Python checks compare
committed outputs and mirrors, raw hashes, unchanged corpus SHA and scientific missingness.
Source review is human/agent-assisted: page-anchor verification proves location/integrity,
not automatic semantic truth. New summaries require scientific review and a new fingerprint.

Outputs: public/data/research.json; src/data/research_coverage.json and its public mirror;
data/research/validation_report.json. No legacy corpus/manifest/ingest.py is rewritten.
Optional --output-root DIR supports isolated regeneration. acquire_research_pdfs.py accepts
only registered NASA download URLs and rejects revisions instead of silently updating hashes.

## UI and coverage methodology

Atlas retains existing experiments/filters/drawer/export behavior. Its Research findings &
coverage button opens a lazy subview at #/atlas?view=research. Methodology shows compact
coverage, actual NASA links and the same discovery link. Eight application routes remain.
Records/findings/source documents/investigation overviews have distinct labels. Search is
deterministic token-AND, case-insensitive, with exact-ID precedence and filters for
investigation, combustion category, evidence type, scientific topic and source document.
Results are paginated24 at a time; no embeddings, external model, backend or ranking added.

Coverage is generated from real legacy records and typed new findings, grouped by PSI ID.
Available values are counted separately from their status histogram. Measured gravity excludes
investigation_level labels; outcome annotations are qualitative, not standardized outcomes.
FLEX has no normalized-row denominator; droplet fields are not counted as missing solid-fuel
requirements. Solid-fuel droplet fields are not applicable. Source-artifact/report/finding/test
totals remain separate. Original records carry0 pressure/0 measuredg/0 standardized outcomes.

Research JSON is about34kB and loads only on the research view; the PDFs never enter the
bundle. The small generated coverage snapshot supports Methodology without fetching reports.
Loading has a retry/error state and refuses a snapshot with mismatched research/base identity,
invalid source URLs/locators or unsupported test mappings. Existing API coverage refers only
to the original experiment corpus; the research panel explicitly owns its separate snapshot.

## Manual acceptance cases

1. Open http://127.0.0.1:5190/#/atlas?id=BASS2-B1. Check corrected22.2%, null pressure,
   original row2 provenance and unchanged detail. Close; record filters still work.
2. Open Research findings & coverage. Count3 investigations/131 records/16 findings/2 reports.
3. Search “daily oxygen”: BASS report method, printed6/PDF14, resolution≠uncertainty.
4. Search “pressure subset”: printed38/PDF46;99.2–99.5kPa not assigned to B1.
5. Reset; investigation FLEX gives8 findings; liquid-droplet + investigation overview gives
   FLEX metadata/DOI/source links, not a solid-fuel record. Search “contamination”.
6. Test evidence/source/topic filters; nonexistent query gives no-result message. Switch
   to Experimental records and search BASS2-B1 for its original drawer link.
7. Check BASS/FLEX compatibility explanation; choosing BASS/Saffire still requires conditions,
   method and scale checks. No numeric report comparison is generated.
8. Download research JSON/coverage; compare counts, locators and original corpus SHA. Existing
   Exports still emits131 record rows, not findings. Check Methodology's new report section.

Setup: npm.cmd ci; $env:VITE_EVIDENCE_API='off'; npm.cmd run dev -- --host 127.0.0.1 --port 5190.
Run npm.cmd test and npm.cmd run build. Restricted Windows temp environments may need
TEMP/TMP set to workspace/tmp.
Full cross-PR reconciliation and post-integration tests: cross-pr-compatibility.md.
