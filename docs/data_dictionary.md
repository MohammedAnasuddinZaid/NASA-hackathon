# FIRETRACE data dictionary

This document describes the curated corpus that the evidence API and the web application both
read. The single source of truth is `src/data/corpus.json`, mirrored byte-for-byte to
`public/data/corpus.json` for offline builds. The API never modifies either file.

Every statement below was read from the shipped corpus and the shipped policy module
(`backend/app/v1/policy.py`). Counts are for the current corpus version:

```
corpus_version = 467bc6ba85e94d3b11a950a361ff69d8865c3ee65c5c5149ceebaeaa0f55566c
```

`corpus_version` is the SHA-256 of the raw `corpus.json` bytes. It appears in every API response
body and in the `X-Corpus-Version` header, so an exported answer can always be tied to the exact
dataset it came from.

## Corpus envelope

| Top-level key | What it holds |
|---|---|
| `meta` | Pipeline version, timestamps, record/investigation counts, declared coverage and quality counts, disclaimer. |
| `records` | 131 experiment records. 129 BASS-II (PSI-25), 2 Saffire-I (PSI-98). |
| `claims` | 12 curated, source-located investigation and corpus-level claims. Not per-test measurements. |
| `sources` | 8 source artifacts across the two PSI investigations. Several artifacts share one `source_id`. |
| `context_sources` | 2 context-only entries: the 2026 challenge page and NTRS 20250010653 (LUCI). They are not structured records. |
| `presets` | 3 reference atmospheres used by the Atmosphere Explorer (`earth-sea-level`, `spacesuit`, `lunar-cabin`). |
| `limitations` | 10 corpus-level limitation statements. |

## Value status vocabulary

Most numeric fields are objects with `value`, `status`, `unit`, `raw`, `note` and `basis`. The
`status` says what kind of statement the corpus is making. It is the only thing that decides
whether a value may be quoted.

| Status | Has a usable value? | Meaning |
|---|---:|---|
| `measured` | yes | The source reports this number directly for this record. |
| `derived` | yes | Computed from a reported source value by a documented rule (parsed text, or a published workbook factor). |
| `investigation_level` | yes (qualitative/nominal) | Documented for the investigation, not measured per test. Example: ISS/Cygnus microgravity. |
| `reported_qualitative` | yes (text) | The source reports a qualitative token rather than a number. |
| `not_reported` | **no** | The source table has no such column, or leaves it blank. `value` is `null`, never `0`. |
| `not_extracted` | **no** | A source document may contain it, but it is not in the structured corpus. Never inferred. |
| `over_range` | **no** | The source reports an out-of-range marker such as `>500`. No numeric value is established. |
| `reported_flag` | **no** | The source reports a code such as `-1` that is a flag, not a concentration. |

Rules the API enforces mechanically:

- `null` is missing, not zero. A zero value is only ever `measured` or `derived` with `value: 0`.
- Aggregate answers count only value-bearing records and always print the denominator.
- Comparisons treat two missing values as `unknown`, never as `matched`.
- No field is imputed, interpolated or replaced with a reference atmosphere.

## Identity and text fields

These are plain strings on every record (131/131 unless noted).

| Field | Meaning |
|---|---|
| `experiment_id` | Stable API identifier, e.g. `BASS2-B1`, `SAFFIRE1-S1`. The API also resolves short test numbers such as `B1`. |
| `source_id` | Source artifact identifier: `PSI-25` or `PSI-98`. |
| `source_locator` | Human-readable locator into the source, e.g. `PSI-25 experimental table, CSV row 2, test B1`. Every claim must carry one. |
| `investigation`, `investigation_acronym`, `family` | Investigation names. `family` is the grouping used by filters and comparisons. |
| `pi` | Principal investigator as recorded in the source. |
| `test_number`, `sample_number`, `date_reported`, `gmt_day` | Source-reported identifiers and timestamps. Kept as strings; no date arithmetic is performed. |
| `material_raw` | Verbatim material description from the source row. |
| `material_family`, `material_species`, `geometry` | Curated normalisation of `material_raw`. Unnamed materials stay `Unknown`. |
| `flow_range_cm_s` | Two-element list `[min, max]` of the reported flow for the record. |
| `flow_varies` | Boolean: whether the source indicates the flow changed during the test. |
| `fan_display_raw`, `air_display_raw`, `flow_restrictor`, `radiometer_gain`, `total_frames`, `source_note` | Instrument-display and source-row values preserved verbatim. Not normalised into physical units beyond the notes below. |
| `measurement_method` | Instrument list as described by the source. |
| `outcome_definition` | Explains why `outcome` is qualitative and not a standardised flammability result. |
| `quality_flags` | List of curation flags. |
| `missing_fields` | List of fields known to be absent for this record. |
| `provenance_notes` | List of provenance notes. |
| `validation_status` | One of `validated` (71), `partial` (56), `suspect` (4). |
| `raw` | The original source row, unmodified. |
| `measurements` | Exploded measurement entries for consumers that prefer a long table. |

## Numeric and categorical fields

Legend: **unit** is the `unit` value in the corpus (`null` means the field is categorical and
carries no physical unit). **Reported** is the number of records whose `status` is value-bearing.
Denominator is 131.

| Field | Unit | Reported | Statuses observed | Notes |
|---|---|---:|---|---|
| `thickness_mm` | `mm` | 44 | derived 42, measured 2, not_reported 87 | Mostly parsed from free-text material descriptions. |
| `width_cm` | `cm` | 73 | derived 71, measured 2, not_reported 58 | Same parsing rule as thickness. |
| `length_cm` | `cm` | 2 | measured 2, not_reported 129 | Only the two Saffire-I records report a length. |
| `diameter_mm` | `mm` | 46 | derived 46, not_reported 85 | Parsed for rod/cylinder and spherical geometries. |
| `oxygen_initial_pct` | `% by vol` | 131 | measured 129, reported_qualitative 2 | Calibrated reading; see the per-record note about the sensor offset. |
| `oxygen_final_pct` | `% by vol` | 127 | measured 127, not_reported 4 | |
| `oxygen_partial_pressure_psi` | `psi` | 0 | not_reported 131 | Cannot be computed because total pressure is absent. Not substituted with cabin pressure. |
| `total_pressure_psia` | `psia` | 0 | not_reported 131 | **Structural gap: the PSI tables have no total-pressure column.** |
| `flow_initial_cm_s` | `cm/s` | 123 | measured 123, not_reported 8 | Duct air-speed display as recorded. Slow response; steady only at a fixed setting. |
| `flow_derived_cm_s` | `cm/s` | 121 | derived 121, not_reported 10 | `U = 1.0066 × air display`. One workbook factor from a single-location SPICE calibration, not a per-test calibration. |
| `flow_direction` | `null` (categorical) | 56 | reported_qualitative 54, measured 2, not_reported 75 | Concurrent/opposed flow. Most values are investigation-level geometry descriptions. |
| `gravity_regime` | `null` (categorical) | 131 | investigation_level 131 | `microgravity` for every record. **No per-test measured g-level exists.** |
| `ignition_method` | `null` (categorical) | 0 | not_reported 131 | Absent from the source tables. |
| `ignition_power_w` | `W` | 2 | measured 2, not_reported 129 | Only Saffire-I records. |
| `ignition_time_s` | `s` | 2 | measured 2, not_reported 129 | Only Saffire-I records. |
| `burn_time_s` | `s` | 2 | measured 2, not_reported 129 | A reported duration, not a flammability outcome. |
| `hardware` | `null` (categorical) | 131 | investigation_level 131 | MSG flow duct (BASS-II) or Saffire I enclosure (Saffire-I). |
| `outcome` | `null` (categorical) | 24 | reported_qualitative 24, not_reported 107 | Free-text tokens: extinguishment, blowoff, no ignition, did not remain lit. **Not a standardised outcome.** |
| `co2_initial_pct` | `% by vol` | 127 | measured 127, not_reported 4 | |
| `co2_final_pct` | `% by vol` | 123 | measured 123, not_reported 8 | |
| `co_initial_ppm` | `ppm` | 115 | measured 115, reported_flag 11, over_range 1, not_reported 4 | `reported_flag` and `over_range` are explicitly not numbers. |
| `co_final_ppm` | `ppm` | 120 | measured 120, over_range 4, not_reported 7 | |

## Observed categorical values

Read from the corpus, not from a wish list.

| Field | Observed values (count) |
|---|---|
| `family` | `BASS-II` (129), `Saffire-I` (2) |
| `material_species` | `Unknown` (51), `PMMA` (43), `SIBAL` (29), `Unknown polymer` (4), `Nomex` (3), `Wax` (1) |
| `material_family` | `Unknown` (51), `SIBAL fabric` (29), `PMMA sheet/slab` (20), `PMMA film` (17), `Unnamed polymer film` (4), `PMMA rod` (4), `Nomex fabric` (3), `PMMA spherical section` (2), `Japan wax candle` (1) |
| `geometry` | `Unknown` (51), `Flat sheet/film` (41), `Fabric sheet` (32), `Rod/cylinder` (4), `Spherical section` (2), `Candle` (1) |
| `outcome` | absent (107), `Extinguishment reported` (15), `Blowoff reported` (7), `No ignition reported` (1), `Did not remain lit` (1) |
| `validation_status` | `validated` (71), `partial` (56), `suspect` (4) |

## Claims, sources and context

- **Claims (12)** are investigation- or corpus-level statements with `supporting_source_ids` and
  `supporting_locators`. They are not per-test measurements and the API labels them as such.
- **Sources (8 artifacts)** resolve by `source_id`. Because several artifacts share an id, the
  source endpoint returns the artifact list for that id plus experiment counts.
- **Context sources (2)** are never mixed into experiment counts. `NTRS-20250010653` (LUCI) is
  cited as context, with `evidence_type: source_metadata`, and the assistant says it is not stored
  as structured per-test data.

## Validation flags

Four records are marked `suspect`: `BASS2-P22b`, `BASS2-T9`, `BASS2-T18`, `BASS2-T28b`. They remain
in the corpus and in counts, and every surface that shows them also shows the flag. Suspect
records are not silently dropped, because dropping them would hide a curation finding.

## Known gaps

These are properties of the source tables, not defects introduced by this project.

1. **Total pressure is absent from both PSI experimental tables** — 0 of 131 records. Oxygen
   partial pressure therefore cannot be computed for any record.
2. **No per-test gravity measurement** — 0 of 131. Gravity is investigation-level microgravity.
   Partial-gravity coverage is 0 records, so lunar and Mars-gravity scenarios have no applicable
   record.
3. **No standardised ignition/extinction outcome** — 0 of 131. `outcome` holds free-text tokens
   for 24 records.
4. **No ignition method** — 0 of 131.
5. **Material species unknown for 51 records** — the source describes the sample without naming
   the polymer.
6. **Thickness parsed for 44 records**, width for 73, length for 2. Parsed values are `derived`
   and carry the original text in `raw`.
7. **Flow derived from a single calibration factor**, not per-test calibration.
8. **The corpus is not all of NASA combustion research**: 129 BASS-II plus 2 Saffire-I records.

## What this dictionary does not claim

- It does not certify any material, atmosphere or procedure.
- It does not convert missingness into a score, a probability or a confidence value.
- It does not state that a record is safe, unsafe or flight-qualified.
- It does not claim NASA endorsement. FIRETRACE is independent.

If a field is not listed here, it is not part of the curated contract. Missing data stays `null`.