# Record and measurement dictionary

The record layer contains source-table rows, not a claim that all rows are independent flight burns. Current counts: 129 BASS-II test rows and two Saffire sample rows. Reused sample numbers are preserved.

| Field | Meaning / units | Provenance and transformation |
|---|---|---|
| experiment_id | Investigation-prefixed test/sample ID | BASS2- + source Test #; SAFFIRE1- + source Sample Number |
| source_id, source_locator | NASA investigation, CSV row and test/sample | Header is row 1; original CSV filenames in each value and measurement |
| raw | Original CSV strings, including blanks | No correction, trimming or imputation in this audit layer |
| oxygen_initial_pct / oxygen_final_pct | Percent by volume | BASS values are already MCA-offset-corrected in the source; no additional correction applied. Saffire S1 is range midpoint 21.6 from 21.5–21.7; S2 is ~21.5, an approximate single value |
| total_pressure_psia | Per-record absolute pressure, psia | Null: neither imported CSV has the column. Report pressure context is not assigned to rows |
| oxygen_partial_pressure_psi | Total pressure × oxygen fraction / 100 | Null when per-record pressure is unknown; reference calculators operate on user inputs only |
| gravity_regime | Investigation-level orbital microgravity context | Not a measured g-level or vector; LUCI simulated lunar gravity remains context |
| flow_initial_cm_s | First parsed BASS air-display token / Saffire setting, cm/s | Not a verified time-resolved series. Parenthetical numbers have unverified basis and are excluded. Ambiguous leading values above 45 are unresolved extraction cases, not a physical maximum |
| flow_range_cm_s / flow_varies | Extrema / variation of parsed display tokens | Descriptive token summary; not measurement uncertainty. Parenthetical annotations and pot settings excluded; raw text retained |
| flow_derived_cm_s | BASS display × 1.0066, cm/s | Derived approximation from one workbook note, not test-specific calibration |
| flow_direction | Per-table Saffire direction or PI-level BASS ReadMe description | BASS context marked investigation_level and not used as a per-test match |
| thickness_mm, diameter_mm, width_cm, length_cm | Dimensions with explicit normalized units | BASS parsed from text. 100 micron → 0.1 mm; fractional inch → ×25.4 mm; Saffire 0.37 cm → 3.7 mm |
| ignition_power_w, ignition_time_s, burn_time_s | W, s, s | Direct table values when supplied. Duration is not a standardized extinction classification |
| outcome | Qualitative text token or null | Never promoted to a standardized measured outcome; missing outcomes are scoped to this record layer |
| co2_*_pct / co_*_ppm | Sensor readings, % by vol / ppm | OR is over-range (ReadMe states CO >1000 ppm). -1 is an unresolved source flag, not a verified below-detection result |
| measurements[].original_value / original_unit | Original token and source unit | Corrected Saffire thickness source unit is cm, normalized unit mm |
| measurements[].normalized_value / normalized_unit | Parsed/converted result | Conversion and correction notes kept separately |
| measurements[].uncertainty | Per-value uncertainty estimate | Null: explanatory notes are not uncertainty estimates |
| quality_flags / validation_status | Extraction checks and internal anomalies | Four suspect records preserved. “validated” means pipeline checks passed, not engineering or scientific certification |

Value objects retain value, raw, unit, status, note, basis, source_file, source_locator. Statuses: measured = directly reported (legacy schema name); corrected = already corrected in source; derived = parsed/calculated; reported_qualitative = approximate range/single value or a qualitative outcome token (inspect quantity and note); investigation_level = context; not_reported = absent in this record layer; reported_flag / over_range / unverified = unresolved or bounded source tokens. These statuses are not interchangeable.

Source manifest dates come only from the acquisition manifest. Missing original acquisition times remain null. generated_at is the latest preserved acquisition timestamp, not the wall-clock build time; pipeline_version identifies the transformation revision. Hash lock checks establish local artifact integrity, not independent authenticity. The two table downloads were separately reverified against NASA; see source-verification.json.
