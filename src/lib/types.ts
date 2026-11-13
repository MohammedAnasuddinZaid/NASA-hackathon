export type ValueStatus =
  | 'measured'
  | 'derived'
  | 'reported_qualitative'
  | 'reported_flag'
  | 'over_range'
  | 'not_reported'
  | 'investigation_level'
  | string;

export interface DataValue<T = number> {
  value: T | null;
  status: ValueStatus;
  unit: string | null;
  raw: string | null;
  note: string | null;
  basis: string | null;
  tokens?: string[];
}

export interface Measurement {
  measurement_id: string;
  quantity: string;
  original_value: string | null;
  original_unit: string | null;
  normalized_value: number | string | null;
  normalized_unit: string | null;
  status: ValueStatus;
  uncertainty: string | null;
  measurement_phase: string;
  measurement_method: string | null;
  source_locator: string;
}

export type ValidationStatus = 'validated' | 'partial' | 'suspect';

export interface ExperimentRecord {
  experiment_id: string;
  source_id: string;
  source_locator: string;
  investigation: string;
  investigation_acronym: string;
  family: 'BASS-II' | 'Saffire-I' | string;
  pi: string | null;
  test_number: string;
  sample_number: string;
  date_reported: string | null;
  gmt_day: string | null;
  material_raw: string;
  material_family: string;
  material_species: string | null;
  geometry: string;
  thickness_mm: DataValue;
  width_cm: DataValue;
  length_cm: DataValue;
  diameter_mm: DataValue;
  oxygen_initial_pct: DataValue;
  oxygen_final_pct: DataValue;
  oxygen_partial_pressure_psi: DataValue;
  total_pressure_psia: DataValue;
  flow_initial_cm_s: DataValue;
  flow_derived_cm_s: DataValue;
  flow_range_cm_s: number[] | null;
  flow_varies: boolean;
  flow_direction: DataValue<string>;
  fan_display_raw: string | null;
  air_display_raw: string | null;
  flow_restrictor: string | null;
  gravity_regime: DataValue<string>;
  ignition_method: DataValue<string>;
  ignition_power_w: DataValue;
  ignition_time_s: DataValue;
  burn_time_s: DataValue;
  hardware: DataValue<string>;
  measurement_method: string;
  outcome: DataValue<string>;
  outcome_definition: string;
  source_note: string | null;
  co2_initial_pct: DataValue;
  co2_final_pct: DataValue;
  co_initial_ppm: DataValue;
  co_final_ppm: DataValue;
  radiometer_gain: string | null;
  total_frames: string | null;
  quality_flags: string[];
  missing_fields: string[];
  provenance_notes: string[];
  validation_status: ValidationStatus;
  raw: Record<string, string | null>;
  measurements: Measurement[];
}

export interface Claim {
  claim_id: string;
  claim_text: string;
  claim_type: string;
  supporting_source_ids: string[];
  supporting_locators: string[];
  limitation: string;
  validation_status: string;
}

export interface SourceArtifact {
  source_id: string;
  investigation_id: string;
  source_title: string;
  source_url: string;
  doi: string | null;
  version: string;
  original_filename: string;
  file_size_bytes: number;
  sha256: string;
  download_timestamp: string;
  license: string;
  license_url: string | null;
  content_type: string;
  processing_status: string;
  role: string;
  source_locator: string;
  limitations: string[];
}

export interface ContextSource {
  source_id: string;
  source_title: string;
  source_url: string;
  role: string;
  license: string;
  retrieved: string;
  limitations: string[];
}

export interface AtmospherePreset {
  id: string;
  label: string;
  pressure_psia: number;
  oxygen_pct: number;
  kind: string;
  description: string;
  source: string;
  source_url: string;
  caveat: string;
}

export interface CorpusMeta {
  name: string;
  tagline: string;
  generated_at: string;
  pipeline_version: string;
  record_count: number;
  experiment_record_count: number;
  source_artifact_count: number;
  investigation_count: number;
  investigations: Array<{
    family: string;
    psi: string;
    doi: string;
    records: number;
    hardware: string;
    title: string;
  }>;
  quality_counts: Record<ValidationStatus, number>;
  coverage: Record<string, number>;
  disclaimer: string;
}

export interface Corpus {
  meta: CorpusMeta;
  sources: SourceArtifact[];
  context_sources: ContextSource[];
  records: ExperimentRecord[];
  claims: Claim[];
  presets: AtmospherePreset[];
  limitations: string[];
}

export interface SourceManifest {
  generated_at: string;
  sources: SourceArtifact[];
  context_sources: ContextSource[];
}

export interface ValidationReport {
  pipeline_version: string;
  generated_at: string;
  input_rows: Record<string, number>;
  accepted_records: Record<string, number>;
  rejected_rows: unknown[];
  excluded_non_experiment_rows: Array<Record<string, string>>;
  duplicate_record_ids: string[];
  duplicate_sample_numbers: string[];
  quality_counts: Record<ValidationStatus, number>;
  coverage: Record<string, number>;
  quality_flag_counts: Record<string, number>;
  matrix_cross_check: {
    test_ids_in_csv: number;
    test_ids_in_matrix: number;
    test_ids_matched: number;
    o2_initial_exact_matches: number;
    o2_initial_mismatches: unknown[];
    material_text_formatting_differences: number;
    air_display_formatting_differences: number;
    substantive_numeric_conflicts: unknown[];
    interpretation: string;
  };
  fan_calibration: {
    factor: number;
    formula: string;
    source_locator: string;
    caveat: string;
    workbook_note_present: boolean;
  };
  checks: Array<{ check: string; result: string; detail: string }>;
}
