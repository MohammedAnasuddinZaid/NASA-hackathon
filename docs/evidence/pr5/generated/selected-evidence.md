# FIRETRACE — BASS\-II and Saffire\-I selected evidence

Generated: 2026\-11\-14T20:03:33\.991Z · Records: 2
Dataset SHA-256: 89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9

## Research scope
- BASS\-II: 1 records (BASS2\-B1)
- Saffire\-I: 1 records (SAFFIRE1\-S1)

User-supplied research question (not verified): Which conditions are reported, and what prevents a direct comparison?

## Selected experiments
| Record | Investigation | Material | O2 | Pressure | Flow | Gravity |
|---|---|---|---|---|---|---|
| BASS2\-B1 | BASS\-II | 100 micron PMMA film   2 cm wide | 22\.2 % by vol (corrected) | Unknown psia (not\_reported) | 5 cm/s (measured) | microgravity (investigation\_level) |
| SAFFIRE1\-S1 | Saffire\-I | SIBAL Fabric | 21\.6 % by vol (reported\_qualitative) | Unknown psia (not\_reported) | 20 cm/s (measured) | microgravity (investigation\_level) |

## Evidence observations
- Initial oxygen: 2/2 available; 1 measured/corrected, 0 derived, 1 approximate/qualitative, 0 context-only. Records: BASS2\-B1, SAFFIRE1\-S1.
- Reported flow: 2/2 available; 2 measured/corrected, 0 derived, 0 approximate/qualitative, 0 context-only. Records: BASS2\-B1, SAFFIRE1\-S1.
- Total pressure: 0/2 available; 0 measured/corrected, 0 derived, 0 approximate/qualitative, 0 context-only. Records: none.
- Gravity regime: 2/2 available; 0 measured/corrected, 0 derived, 0 approximate/qualitative, 2 context-only. Records: BASS2\-B1, SAFFIRE1\-S1.
- Thickness: 2/2 available; 1 measured/corrected, 1 derived, 0 approximate/qualitative, 0 context-only. Records: BASS2\-B1, SAFFIRE1\-S1.
- Outcome annotations: 0/2 available; 0 measured/corrected, 0 derived, 0 approximate/qualitative, 0 context-only. Records: none.
- Standardized measured outcomes: 0/2. Qualitative annotations and burn durations are not standardized outcomes.

## Comparison limitations
- Thickness \(mm\) (blocked): Reported sample dimensions differ\. Inspect the values and units below before interpreting any outcome difference\.
- Width \(cm\) (blocked): Reported sample dimensions differ\. Inspect the values and units below before interpreting any outcome difference\.
- Length \(cm\) (partial): 1 of 2 selected records report this dimension\. Missing values do not establish a match; relevance depends on sample geometry\.
- Diameter \(mm\) (partial): 0 of 2 selected records report this dimension\. Missing values do not establish a match; relevance depends on sample geometry\.
- Flow direction (partial): 1 of 2 records report flow direction\. Missing directions cannot be assumed equal\.
- Investigation context (blocked): 2 investigations selected: hardware, environment and reporting conventions differ\.
- Material and geometry (partial): 2 material families and 2 geometries selected\. Parsed from free text; not a controlled material specification\.
- Total pressure (unknown): No selected record reports total pressure\. Oxygen partial pressure cannot be computed, and atmospheric equivalence cannot be established\.
- Gravity at test level (unknown): Gravity is investigation\-level context only\. No selected record has a measured g\-level, so gravity cannot be treated as a controlled comparison variable\.
- Oxygen measurement basis (shared): 2 of 2 selected records report an initial O2 value\. BASS\-II uses a constant\-offset sensor correction\. Saffire\-I retains a reported range midpoint or approximate single value\.
- Flow measurement basis (blocked): Flow bases differ: BASS\-II uses a slow\-response duct display; Saffire\-I reports a flow setting\. The two are not the same instrument quantity\.
- Ignition reporting (partial): 1 of 2 selected records report ignition power\. Ignition method is not stated in either table\.
- Standardized outcome (unknown): Neither table contains a standardized extinction or sustained\-burning classification\. Burn duration is not equivalent to a flammability outcome\.

## Missing evidence
- Initial oxygen unavailable/unverified in: none.
- Reported flow unavailable/unverified in: none.
- Total pressure unavailable/unverified in: BASS2\-B1, SAFFIRE1\-S1.
- Gravity regime unavailable/unverified in: none.
- Thickness unavailable/unverified in: none.
- Outcome annotations unavailable/unverified in: BASS2\-B1, SAFFIRE1\-S1.
These are record-layer gaps; additional reports may contain unmapped context.

## Source references
- BASS2\-B1 / PSI\-25: BASS\-II experimental table \(PSI\-25\); PSI\-25 experimental table, CSV row 2, test B1; DOI 10\.60555/4qc4\-de67. [NASA source](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)
  - Original PSI CSV row preserved in record\.raw; no raw file was overwritten\.
  - Material family/geometry/dimensions are parsed from the free\-text Material field and marked derived\.
  - Pressure remains not reported; no cabin pressure was substituted\.
  - thickness\_mm (derived): Parsed from free\-text material description\.
  - width\_cm (derived): Parsed from free\-text material description\.
  - length\_cm (not\_reported): No length is reported for this sample in the experimental table\.
  - oxygen\_initial\_pct (corrected): Calibrated oxygen reading; sensor was out of calibration and corrected with the MCA ISS reading via a constant offset \(PSI\-25 ReadMe\)\.
  - oxygen\_final\_pct (corrected): Calibrated oxygen reading; sensor was out of calibration and corrected with the MCA ISS reading via a constant offset \(PSI\-25 ReadMe\)\.
  - oxygen\_partial\_pressure\_psi (not\_reported): Total pressure is not reported for this record, so oxygen partial pressure cannot be calculated\.
  - total\_pressure\_psia (not\_reported): The PSI experimental table has no total\-pressure column\. ISS cabin pressure is not substituted\.
  - flow\_initial\_cm\_s (measured): First parsed duct air\-speed display token; not a verified time\-resolved series\. Parenthetical numeric annotations are retained in raw text but not used as flow readings\. Response time is slow \(~1 min\); steady only at a fixed setting \(PSI\-25 ReadMe\)\.
  - flow\_derived\_cm\_s (derived): U = 1\.0066 x Air display\. Single workbook factor based on SPICE calibration at one location; not a per\-test calibration\.
  - flow\_direction (not\_reported): No per\-test flow direction is recorded in the experimental table\.
  - gravity\_regime (investigation\_level): Not a per\-test measurement\. Assigned from investigation\-level metadata, not from a recorded g\-level\.
  - ignition\_method (not\_reported): No ignition method is recorded in the experimental table\.
  - hardware (investigation\_level): Investigation\-level hardware; not verified per test\.
  - outcome (not\_reported): Free\-text note exists, but it does not state a standardized outcome\.
  - co2\_initial\_pct (measured): CDM CO2 sensor reading as reported in the PSI experimental table\.
  - co2\_final\_pct (measured): CDM CO2 sensor reading as reported in the PSI experimental table\.
  - co\_initial\_ppm (measured): CSA\-CP CO sensor reading as reported in the PSI experimental table\.
  - co\_final\_ppm (measured): CSA\-CP CO sensor reading as reported in the PSI experimental table\.
- SAFFIRE1\-S1 / PSI\-98: Saffire\-I experimental table \(PSI\-98\); PSI\-98 experimental table, CSV row 2, sample S1; DOI 10\.60555/0t15\-1z43. [NASA source](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98)
  - Original PSI\-98 CSV row preserved in record\.raw\.
  - Two Saffire samples only; pre/post\-flow image descriptors were excluded from experiment records\.
  - Pressure remains not reported; no cabin pressure was substituted\.
  - thickness\_mm (measured): Source field in cm; converted to mm\.
  - width\_cm (measured): As reported\.
  - length\_cm (measured): As reported\.
  - diameter\_mm (not\_reported): Sheet sample; diameter not applicable\.
  - oxygen\_initial\_pct (reported\_qualitative): Source reports a range \(21\.5 \- 21\.7\); midpoint retained as an approximate value, raw range preserved\.
  - oxygen\_final\_pct (not\_reported): Not reported as a final value for this sample in the table\.
  - oxygen\_partial\_pressure\_psi (not\_reported): Total pressure is not reported for this record, so oxygen partial pressure cannot be calculated\.
  - total\_pressure\_psia (not\_reported): The PSI\-98 experimental table has no total\-pressure column\. Cygnus cabin pressure is not substituted\.
  - flow\_initial\_cm\_s (measured): As reported\.
  - flow\_derived\_cm\_s (not\_reported): No conversion was applied; the source reports air flow in cm/s\.
  - flow\_direction (measured): Flow direction as recorded in the Saffire\-I experimental table\.
  - gravity\_regime (investigation\_level): Not a per\-test measurement\. Assigned from investigation\-level metadata\.
  - ignition\_method (not\_reported): Ignition power and time are reported; ignition method is not stated in the table\.
  - ignition\_power\_w (measured): As reported\.
  - ignition\_time\_s (measured): As reported\.
  - burn\_time\_s (measured): Reported burn time; not a standardized extinction outcome\.
  - hardware (investigation\_level): Investigation\-level hardware\.
  - outcome (not\_reported): Burn time is reported, but no extinction or sustained\-burning classification is stated\.

## Scientific limitations
- The current corpus contains BASS\-II \(129 records\) and Saffire\-I \(2 records\)\. It is not the whole of NASA combustion research\.
- Total pressure is absent from both PSI experimental tables; no cabin pressure was substituted\.
- Gravity is investigation\-level only \(ISS/Cygnus microgravity\), not a per\-test measured g\-level\.
- Neither table contains a standardized extinction/sustained\-burning outcome\.
- BASS\-II flow values are slow\-response displays; Saffire\-I reports a setting\. The BASS\-II derived velocity uses one factor, not a per\-test calibration\.
- O2 readings were corrected by a constant offset because the sensor was out of calibration; per\-sample uncertainty is not supplied\.
- Material family, geometry and dimensions are parsed from free\-text fields and marked derived\.
- Two BASS\-II final\-O2 values exceed their initial values by more than 2 percentage points and are flagged suspect, not corrected\.
- No partial\-gravity experiment records are included\. The official challenge states PSI currently has none; LUCI is included only as context\.
- No AI\-generated scientific claims are presented\. The evidence assistant is a deterministic retrieval and citation engine\.
- Collection membership does not establish experimental equivalence\. Descriptive coverage counts do not average unlike quantities\.
- Missing fields refer to the normalized record layer; reports elsewhere may contain context not linked to individual rows\. Review original notes and unreported per\-value uncertainty\.

## Disclaimer
FIRETRACE-generated research product from selected corpus records, not an untouched NASA original. Not a comprehensive review of NASA combustion research. Does not predict fire behavior, certify material safety, establish spacecraft fire-safety compliance, or imply NASA endorsement.
