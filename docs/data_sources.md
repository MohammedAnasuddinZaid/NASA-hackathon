# Data sources and provenance

FIRETRACE uses only the artifacts below. No measurement, citation, benchmark result or deployment
URL has been fabricated. Original artifacts are preserved under `data/raw/`. Eight small PSI originals are available under `public/data/original/`; large NTRS documents use authoritative external links. Normalized exports are clearly separate.

## Experiment data

| Source ID | PSI ID | Artifact | Role | Records used | DOI | License |
|---|---|---|---|---:|---|---|
| PSI-25 | PSI-25 | BASS-II experimental table CSV | experiment table | 129 | 10.60555/4qc4-de67 | CC0 1.0 Universal |
| PSI-25 | PSI-25 | BASS-II ReadMe | documentation | — | 10.60555/4qc4-de67 | CC0 1.0 Universal |
| PSI-25 | PSI-25 | BASS-II six-sheet test matrix workbook | cross-check | 129 test IDs | 10.60555/4qc4-de67 | CC0 1.0 Universal |
| PSI-25 | PSI-25 | BASS-II fan calibration workbook | calibration caveat | — | 10.60555/4qc4-de67 | CC0 1.0 Universal |
| PSI-25 | PSI-25 | BASS-II metadata | investigation context | — | 10.60555/4qc4-de67 | CC0 1.0 Universal |
| PSI-98 | PSI-98 | Saffire-I experimental table CSV | experiment table | 2 | 10.60555/0t15-1z43 | CC0 1.0 Universal |
| PSI-98 | PSI-98 | Saffire-I ReadMe | documentation | — | 10.60555/0t15-1z43 | CC0 1.0 Universal |
| PSI-98 | PSI-98 | Saffire-I metadata | investigation context | — | 10.60555/0t15-1z43 | CC0 1.0 Universal |

## Context sources

| Source ID | Title | Role | Used for |
|---|---|---|---|
| NTRS-20250010653 | Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket | context only | Partial-gravity spread rates and O2 consumption |
| CHALLENGE-2026 | NASA Space Apps 2026 “Flame in Freefall” challenge page | context only | Spacesuit 4.3 psi / 100% O2; lunar cabin planning values; PSI partial-gravity coverage statement |

## BASS-II

- 129 test records from the PSI-25 experimental table.
- Initial O2 range: 13.6–22.2 % by volume.
- Flow is a duct air-speed display with a slow response; a derived velocity uses a single
  workbook factor (U = 1.0066 × Air display).
- Oxygen readings were corrected with a constant offset because the sensor was out of
  calibration.
- These imported table rows do not report pressure, measured per-test gravity, ignition method or a standardized outcome. Reports can supply additional context.

## Saffire-I

- 2 instrumented samples (S1, S2), both SIBAL fabric, 0.37 cm thick.
- Initial O2 reported as 21.5–21.7 % (S1) and ~21.5 % (S2); S1 is a midpoint and S2 an approximate single value.
- Flow 20 cm/s; ignition 182 W for 8 s; burn times 420 s (S1) and 70 s (S2).
- Two CSV rows (F1C1/F1C2 and F2C1/F2C2) are pre/post-flow image-set descriptors and were
  excluded because they are not instrumented experiments.
- These imported table rows do not report pressure, measured per-test gravity, ignition method or a standardized outcome. Reports can supply additional context.

## LUCI (context only)

- Rotating sounding-rocket experiment: 11 RPM, 1.22 m effective radius.
- SIBAL flame base spread 0.92 mm/s, tip 1.1 mm/s; PMMA tip spread about 1.5 mm/s.
- Chamber O2 fell from 20 % to 14.3 %.
- LUCI is not imported as structured per-test data and is not compared record-by-record.

## Validation results

- 131 unique experiment IDs; 0 duplicates.
- 129/129 BASS-II test IDs present in the six-sheet matrix workbook.
- 129/129 initial O2 values match numerically.
- 0 initial-O2 conflicts; other numeric columns were not exhaustively checked.
- 34 material text-formatting differences and 86 air-display formatting differences, counted but not proven to be formatting-only.
- 4 suspect records retained and disclosed:
  - `BASS2-P22b` and `BASS2-T28b`: final O2 exceeds initial by more than 2 percentage points.
  - `BASS2-T9` and `BASS2-T18`: dates carry an unexpected 2018 year in a 2014 campaign.

## SHA-256 hashes

The source manifest at `src/data/source_manifest.json` and `public/data/source_manifest.json`
records SHA-256 hashes, download timestamps, versions, file sizes, licenses and limitations for
every artifact. The ingestion pipeline verifies these against the preserved raw files.

See [scientific audit](scientific-audit.md), [field dictionary](data-dictionary.md), and source-verification.json for the report review and acquisition limits.
