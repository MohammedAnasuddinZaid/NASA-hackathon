# Evidence store dictionary (schema 1)

All JSON payloads are lossless copies of the current normalized contract. Database validation does not correct or reclassify science. Existing notes/flags and raw CSV rows remain authoritative for interpretation.

| Table / field | Meaning / type / unit |
|---|---|
| dataset.id | Singleton integer1 |
| dataset.fingerprint | SHA-256 identity of normalized corpus, manifest and validation files (LF-normalized) |
| dataset.payload / validation | Corpus metadata, claims, presets, source/context inventory and limitations / upstream validation JSON |
| investigations.source_id | PSI investigation primary key; payload retains family, title, DOI, hardware context, declared count |
| experiments.experiment_id | Stable normalized string key; no alias is stored as a new experiment |
| experiments.source_id | Foreign key to investigation context |
| experiments.family / material / quality | Existing family label, parsed material family, extraction quality status |
| experiments.oxygen | Initial oxygen scalar, % by volume, nullable; its status/basis/raw token lives in payload |
| experiments.flow | First normalized display/setting, cm/s, nullable; not assumed equivalent between instruments |
| experiments.search_text / sort_id / date | Internal keyword/natural-sort projections / unchanged reported date string; not additional scientific observations |
| experiments.payload | Complete record including every DataValue, raw source row, flags, missing fields, provenance notes and measurements |
| measurements.measurement_id | Stable measurement primary key; experiment_id foreign key; quantity and original status indexed with lossless payload |
| measurement payload.original_value / original_unit | Original token and unit label supplied by upstream pipeline; current main has metadata defects described in PR #1 integration notes |
| measurement payload.normalized_value / normalized_unit | Numeric, qualitative or null normalized value and normalized unit; never zero-filled |
| measurement payload.status / uncertainty | Unchanged upstream labels/text; legacy uncertainty text must not be interpreted as numeric uncertainty; optional future notes survive |
| measurement payload.source_locator | Original CSV row or passage locator; optional extra provenance survives |
| sources.artifact_id | Composite `source_id--original_filename`, or context-only source ID; source_id alone is not unique per artifact |
| sources.filename | Registered basename for an existing original; null for context-only links; never accepted as a client path |
| sources.payload | Title, source URL/DOI, license, hash, version, locator and limitation metadata; no absolute server path |
| claims.claim_id / payload | Stable existing claim ID / original claim text, type, supporting source IDs/locators and limitations |

Measurement statuses are open strings for forward compatibility. Main currently uses measured, derived, reported_qualitative, reported_flag, over_range, not_reported and investigation_level. Saffire approximate oxygen is currently reported_qualitative plus a note. New corrected/unverified statuses can be imported without edits. Basis `investigation_level` is honored even if the legacy status is qualitative.

Coverage fields: available counts non-null values of any status; missing counts nulls; per_test_measured counts non-null measured/corrected values whose basis is not investigation-level; context_only counts non-null investigation-level values by status or basis; statuses is a complete label histogram; units is the set of reported normalized unit labels. These are extraction-layer counts. In particular, qualitative outcome tokens are not standardized measured outcomes, and non-null microgravity context is not measured per-test gravity.

Sources remain registered in the existing `src/data/source_manifest.json`; this PR adds no source acquisitions or fabricated report passages. Raw/hash checks run against `data/raw/`. Download redistribution is limited to registered CC0 artifacts; other metadata carries authoritative external links.
