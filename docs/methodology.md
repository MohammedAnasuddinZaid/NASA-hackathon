# Methodology

## Pipeline

`pipeline/ingest.py` reads the preserved PSI CSV tables and metadata, normalizes each row into an
`ExperimentRecord`, computes derived fields where a documented rule exists, validates the corpus,
and writes:

- `src/data/corpus.json` (bundled into the application)
- `public/data/corpus.json` (downloadable copy)
- `public/data/source_manifest.json`
- `public/data/validation_report.json`
- `data/processed/validation_report.json`

Run it with:

```bash
npm run ingest
```

Python is invoked as `python`; activate a virtual environment and install `pipeline/requirements.txt` first. The pipeline runs on Python 3.10 or newer. Run `npm run validate:data` for offline source and reproducibility checks.

## Normalization rules

- Missing values are stored as `null` with status `not_reported`. They are never zero-filled.
- Derived values are stored separately from measured values and labeled `derived`.
  - BASS-II derived flow uses `U = 1.0066 × Air display`, a single workbook factor, not a
    per-test calibration.
- Approximate source values are retained as approximate:
  - Saffire-I initial O2 values are midpoints or approximate single values, with the raw range
    preserved in `raw` and `note`.
- Free-text notes are not treated as standardized outcomes.
- Material family, geometry and dimensions are parsed from free text and marked derived.
- Gravity is assigned at investigation level only (`investigation_level`), never as a measurement.
- Total pressure and oxygen partial pressure are left null because no pressure column exists.

## Quality statuses

- `validated` — all required checks passed.
- `partial` — some fields are missing or approximate.
- `suspect` — an internal inconsistency was detected and is retained, not corrected.

Quality counts: 71 validated, 56 partial, 4 suspect.

## Validation gates

The pipeline records the following checks in `validation_report.json`:

- unique experiment IDs
- test-ID match against the six-sheet matrix workbook
- initial O2 numeric match against the matrix
- material and air-display formatting differences
- absence of initial-O2 conflicts only
- pressure coverage
- per-test gravity coverage
- standardized outcome coverage
- fan calibration factor presence

## Assistant

The Evidence Assistant is deterministic retrieval over the bundled corpus, claims and source
manifest. It performs no external model or API call. It answers only from reported values and
abstains otherwise. The 30-question benchmark in `data/processed/benchmark.json` records its
current behavior.

## Evidence API

`backend/app/v1/` exposes the same retrieval logic over HTTP. Its scientific rules are versioned in
`policy.py`:

- each field carries a status from a fixed vocabulary, and only value-bearing statuses may be
  quoted; `null` never becomes zero;
- each claim carries a `source_id` and a `locator`, and is re-validated against the cited records
  before it is returned; a claim whose numbers are not in its evidence is rejected;
- comparisons use the published `matching-1.0` tolerances and classify each field as `matched`,
  `mismatched` or `unknown`, with no fused score;
- scenario evaluation reports applicability and coverage gaps instead of a probability;
- questions that ask for safety, certification, risk or operational advice return
  `out-of-scope` with zero claims.

`corpus_version` is the SHA-256 of the raw corpus bytes and appears in every response, so an
answer or export can be tied to the exact dataset it came from. Field-level semantics are in
`docs/data_dictionary.md`.

## Exports

CSV and JSON exports are generated locally from the bundled corpus. Empty cells mean “not
reported,” not zero. Raw source locators, validation status and quality flags are included.

Pipeline v0.2.0 changes and schema notes are detailed in [scientific-audit.md](scientific-audit.md) and [data-dictionary.md](data-dictionary.md). Output generation uses acquisition-manifest timestamps; unknown acquisition dates stay null. Measurement notes are not uncertainty.
