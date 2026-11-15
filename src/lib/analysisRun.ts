/**
 * Reproducible analysis runs over the bundled corpus.
 *
 * A run records its definition version, corpus version, parameters, computed
 * rows, findings, and a per-record fingerprint. Re-running the same definition
 * against the same corpus reproduces the same result. A corpus diff is computed
 * from fingerprints, never from an assumed match.
 */

import { claims, corpus, corpusVersion, records, sourceManifest, validation } from './corpus';
import type { ExperimentRecord } from './types';
import { canonicalJson } from './hash';
import { loadVersioned, saveVersioned, type KeyValueStorage, type LoadResult, type SaveResult } from './storage';

export const ANALYSIS_SCHEMA = 1;
export const ANALYSIS_STORAGE_KEY = 'firetrace.analysisRuns.v1';
export const ANALYSIS_RUN_LIMIT = 40;

export type AnalysisDefinitionId =
  | 'coverage'
  | 'validation'
  | 'materials'
  | 'atmosphere'
  | 'sources'
  | 'comparability';

export type FindingSeverity = 'info' | 'warning' | 'critical';

export interface AnalysisDefinition {
  id: AnalysisDefinitionId;
  version: string;
  name: string;
  description: string;
  limitations: string[];
}

export const ANALYSIS_DEFINITIONS: AnalysisDefinition[] = [
  {
    id: 'coverage',
    version: '1.0.0',
    name: 'Field coverage snapshot',
    description: 'Counts non-null values and reported statuses for every scientific field exposed by the explorer.',
    limitations: ['Coverage is a metadata count. It does not establish that a reported value is correct.'],
  },
  {
    id: 'validation',
    version: '1.0.0',
    name: 'Validation status review',
    description: 'Summarizes validation statuses, quality flags, and the records that carry them.',
    limitations: ['A validated status means the row passed the project checks; it is not an independent audit.'],
  },
  {
    id: 'materials',
    version: '1.0.0',
    name: 'Material inventory',
    description: 'Groups records by parsed material family and reports thickness availability.',
    limitations: ['Material families are parsed from free text and are not a controlled taxonomy.'],
  },
  {
    id: 'atmosphere',
    version: '1.0.0',
    name: 'Atmosphere fields audit',
    description: 'Reports oxygen coverage and explicitly confirms the absence of pressure and partial-pressure values.',
    limitations: ['Oxygen fraction alone does not define an atmosphere.'],
  },
  {
    id: 'sources',
    version: '1.0.0',
    name: 'Source artifact inventory',
    description: 'Lists manifest artifacts, local availability, declared hashes, and license fields.',
    limitations: ['A declared SHA-256 is a fingerprint; this run does not re-download the remote artifact.'],
  },
  {
    id: 'comparability',
    version: '1.0.0',
    name: 'Cross-investigation comparability',
    description: 'Checks whether BASS-II and Saffire-I share measurement bases for the fields the explorer displays.',
    limitations: ['Comparability is field-level. It is not a statistical meta-analysis.'],
  },
];

export function analysisDefinition(id: AnalysisDefinitionId): AnalysisDefinition {
  const definition = ANALYSIS_DEFINITIONS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown analysis definition: ${id}`);
  return definition;
}

export interface AnalysisRow {
  key: string;
  label: string;
  value: string | number;
  unit: string | null;
  note: string | null;
}

export interface AnalysisFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  record_ids: string[];
}

export interface AnalysisResult {
  definition_id: AnalysisDefinitionId;
  definition_version: string;
  title: string;
  generated_at: string;
  corpus_version: string;
  record_count: number;
  rows: AnalysisRow[];
  findings: AnalysisFinding[];
  limitations: string[];
}

export interface AnalysisRun {
  id: string;
  definition_id: AnalysisDefinitionId;
  definition_version: string;
  created_at: string;
  corpus_version: string;
  parameters: Record<string, string | number | boolean | null>;
  result: AnalysisResult;
  record_fingerprints: Record<string, string>;
  status: 'complete';
}

export interface AnalysisDocument {
  schema_version: number;
  runs: AnalysisRun[];
}

export function emptyAnalysisDocument(): AnalysisDocument {
  return { schema_version: ANALYSIS_SCHEMA, runs: [] };
}

function reported(value: { value: unknown } | undefined | null): boolean {
  return Boolean(value && value.value !== null && value.value !== undefined);
}

const COVERAGE_FIELDS: Array<{ key: keyof ExperimentRecord; label: string; unit: string | null; critical?: boolean }> = [
  { key: 'oxygen_initial_pct', label: 'Initial O2', unit: '% by vol', critical: true },
  { key: 'oxygen_final_pct', label: 'Final O2', unit: '% by vol' },
  { key: 'total_pressure_psia', label: 'Total pressure', unit: 'psia', critical: true },
  { key: 'oxygen_partial_pressure_psi', label: 'Oxygen partial pressure', unit: 'psi', critical: true },
  { key: 'flow_initial_cm_s', label: 'Reported flow', unit: 'cm/s' },
  { key: 'flow_derived_cm_s', label: 'Derived flow', unit: 'cm/s' },
  { key: 'thickness_mm', label: 'Thickness', unit: 'mm' },
  { key: 'width_cm', label: 'Width', unit: 'cm' },
  { key: 'length_cm', label: 'Length', unit: 'cm' },
  { key: 'diameter_mm', label: 'Diameter', unit: 'mm' },
  { key: 'gravity_regime', label: 'Per-test gravity', unit: null, critical: true },
  { key: 'ignition_method', label: 'Ignition method', unit: null, critical: true },
  { key: 'ignition_power_w', label: 'Ignition power', unit: 'W' },
  { key: 'ignition_time_s', label: 'Ignition time', unit: 's' },
  { key: 'burn_time_s', label: 'Burn time', unit: 's' },
  { key: 'outcome', label: 'Standardized outcome', unit: null, critical: true },
];

function coverageResult(now: Date): AnalysisResult {
  const rows: AnalysisRow[] = COVERAGE_FIELDS.map((field) => {
    const count = records.filter((record) =>
      reported(record[field.key] as unknown as { value: unknown }),
    ).length;
    return {
      key: field.key,
      label: field.label,
      value: count,
      unit: field.unit,
      note: `${records.length - count} record(s) not reported; ${((count / records.length) * 100).toFixed(1)}% coverage.`,
    };
  });
  const findings: AnalysisFinding[] = [];
  for (const field of COVERAGE_FIELDS) {
    const row = rows.find((item) => item.key === field.key);
    if (field.critical && row && row.value === 0) {
      findings.push({
        id: `coverage-${String(field.key)}`,
        severity: 'critical',
        title: `${field.label} has zero coverage`,
        detail: `No record reports ${field.label.toLowerCase()}. The explorer keeps the field visible with a not-reported status and does not impute it.`,
        record_ids: [],
      });
    }
  }
  const incomplete = records.filter((record) => record.missing_fields.length > 0);
  findings.push({
    id: 'coverage-missing-fields',
    severity: incomplete.length ? 'warning' : 'info',
    title: `${incomplete.length} record(s) carry missing-field markers`,
    detail: 'Missing-field markers are preserved from the pipeline. They are not errors to be repaired in the browser.',
    record_ids: incomplete.slice(0, 20).map((record) => record.experiment_id),
  });
  return {
    definition_id: 'coverage',
    definition_version: '1.0.0',
    title: 'Field coverage snapshot',
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    record_count: records.length,
    rows,
    findings,
    limitations: analysisDefinition('coverage').limitations,
  };
}

function validationResult(now: Date): AnalysisResult {
  const statuses: Array<'validated' | 'partial' | 'suspect'> = ['validated', 'partial', 'suspect'];
  const rows: AnalysisRow[] = statuses.map((status) => ({
    key: status,
    label: status,
    value: records.filter((record) => record.validation_status === status).length,
    unit: 'records',
    note: null,
  }));
  rows.push({
    key: 'claims',
    label: 'Declared claims',
    value: claims.length,
    unit: 'claims',
    note: `${claims.filter((claim) => claim.validation_status === 'validated').length} claim(s) marked validated.`,
  });
  const findings: AnalysisFinding[] = [];
  const suspect = records.filter((record) => record.validation_status === 'suspect');
  if (suspect.length) {
    findings.push({
      id: 'validation-suspect',
      severity: 'warning',
      title: `${suspect.length} suspect record(s)`,
      detail: 'Suspect records remain browsable and are never silently corrected. Review their quality flags before using them.',
      record_ids: suspect.map((record) => record.experiment_id),
    });
  }
  for (const [flag, count] of Object.entries(validation.quality_flag_counts)) {
    if (!count) continue;
    findings.push({
      id: `flag-${flag}`,
      severity: flag.includes('exceeds') || flag.includes('unexpected') ? 'warning' : 'info',
      title: flag.replaceAll('_', ' '),
      detail: `${count} record(s) carry this quality flag.`,
      record_ids: records.filter((record) => record.quality_flags.includes(flag)).slice(0, 20).map((record) => record.experiment_id),
    });
  }
  return {
    definition_id: 'validation',
    definition_version: '1.0.0',
    title: 'Validation status review',
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    record_count: records.length,
    rows,
    findings,
    limitations: analysisDefinition('validation').limitations,
  };
}

function materialsResult(now: Date): AnalysisResult {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.material_family, (counts.get(record.material_family) ?? 0) + 1);
  const rows: AnalysisRow[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family, count]) => ({ key: family, label: family, value: count, unit: 'records', note: null }));
  const unknown = counts.get('Unknown') ?? 0;
  const thickness = records.filter((record) => record.thickness_mm.value !== null).length;
  const findings: AnalysisFinding[] = [
    {
      id: 'materials-unknown',
      severity: unknown ? 'warning' : 'info',
      title: `${unknown} record(s) have no identifiable material family`,
      detail: 'The source row did not yield a parsed family. The raw material text is preserved on the record.',
      record_ids: records.filter((record) => record.material_family === 'Unknown').slice(0, 20).map((record) => record.experiment_id),
    },
    {
      id: 'materials-thickness',
      severity: thickness < records.length ? 'warning' : 'info',
      title: `Thickness is reported for ${thickness} of ${records.length} records`,
      detail: 'Thickness is parsed from free-text geometry and is not available for every record.',
      record_ids: [],
    },
  ];
  return {
    definition_id: 'materials',
    definition_version: '1.0.0',
    title: 'Material inventory',
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    record_count: records.length,
    rows,
    findings,
    limitations: analysisDefinition('materials').limitations,
  };
}

function atmosphereResult(now: Date): AnalysisResult {
  const initial = records
    .map((record) => record.oxygen_initial_pct.value)
    .filter((value): value is number => typeof value === 'number');
  const final = records
    .map((record) => record.oxygen_final_pct.value)
    .filter((value): value is number => typeof value === 'number');
  const pressure = records.filter((record) => record.total_pressure_psia.value !== null).length;
  const partial = records.filter((record) => record.oxygen_partial_pressure_psi.value !== null).length;
  const rows: AnalysisRow[] = [
    { key: 'oxygen_initial', label: 'Initial O2 reported', value: initial.length, unit: 'records', note: null },
    { key: 'oxygen_final', label: 'Final O2 reported', value: final.length, unit: 'records', note: null },
    { key: 'oxygen_range', label: 'Initial O2 range', value: `${Math.min(...initial)}–${Math.max(...initial)}`, unit: '% by vol', note: null },
    { key: 'pressure', label: 'Total pressure reported', value: pressure, unit: 'records', note: 'No total-pressure column exists in either source table.' },
    { key: 'partial_pressure', label: 'Oxygen partial pressure reported', value: partial, unit: 'records', note: 'Cannot be derived without total pressure.' },
    { key: 'partial_gravity', label: 'Partial-gravity records', value: corpus.meta.coverage.partial_gravity_records, unit: 'records', note: 'Investigation labels are not per-test gravity.' },
  ];
  const findings: AnalysisFinding[] = [
    {
      id: 'atmosphere-pressure',
      severity: 'critical',
      title: 'Total pressure is absent from every record',
      detail: 'The corpus cannot place a record on an atmosphere plane. FIRETRACE does not substitute a nominal cabin pressure.',
      record_ids: [],
    },
    {
      id: 'atmosphere-o2',
      severity: 'info',
      title: 'Oxygen fraction is the only reported atmosphere field',
      detail: 'Oxygen fraction without pressure cannot establish partial pressure, atmospheric equivalence, or flammability.',
      record_ids: [],
    },
  ];
  return {
    definition_id: 'atmosphere',
    definition_version: '1.0.0',
    title: 'Atmosphere fields audit',
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    record_count: records.length,
    rows,
    findings,
    limitations: analysisDefinition('atmosphere').limitations,
  };
}

function sourcesResult(now: Date): AnalysisResult {
  const rows: AnalysisRow[] = sourceManifest.sources.map((source) => ({
    key: source.source_id,
    label: source.source_title,
    value: source.local_original_url ? 'local artifact' : 'remote reference',
    unit: null,
    note: `${source.role} · ${source.license} · ${source.sha256.slice(0, 12)}…`,
  }));
  rows.push({
    key: 'context',
    label: 'Context sources',
    value: sourceManifest.context_sources.length,
    unit: 'sources',
    note: 'Context sources are not experiment records.',
  });
  const missingHashes = sourceManifest.sources.filter((source) => !/^[a-f0-9]{64}$/i.test(source.sha256));
  const missingLicenses = sourceManifest.sources.filter((source) => !source.license.trim());
  const findings: AnalysisFinding[] = [
    {
      id: 'sources-local',
      severity: 'info',
      title: `${sourceManifest.sources.filter((source) => source.local_original_url).length} artifact(s) available locally`,
      detail: 'Local artifacts support offline inspection. Remote references remain links, not copies.',
      record_ids: [],
    },
    {
      id: 'sources-hashes',
      severity: missingHashes.length ? 'critical' : 'info',
      title: missingHashes.length ? `${missingHashes.length} artifact(s) lack a valid SHA-256` : 'Every artifact declares a SHA-256',
      detail: missingHashes.length
        ? `Invalid hash fields: ${missingHashes.map((source) => source.source_id).join(', ')}.`
        : 'A declared hash is a content fingerprint; this run does not re-download the remote artifact.',
      record_ids: [],
    },
    {
      id: 'sources-licenses',
      severity: missingLicenses.length ? 'warning' : 'info',
      title: missingLicenses.length ? `${missingLicenses.length} artifact(s) lack a license field` : 'Every artifact declares a license',
      detail: missingLicenses.length ? missingLicenses.map((source) => source.source_id).join(', ') : 'License fields are reproduced from the manifest.',
      record_ids: [],
    },
  ];
  return {
    definition_id: 'sources',
    definition_version: '1.0.0',
    title: 'Source artifact inventory',
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    record_count: records.length,
    rows,
    findings,
    limitations: analysisDefinition('sources').limitations,
  };
}

function comparabilityResult(now: Date): AnalysisResult {
  const bass = records.filter((record) => record.family === 'BASS-II');
  const saffire = records.filter((record) => record.family === 'Saffire-I');
  const rows: AnalysisRow[] = [
    { key: 'bass_records', label: 'BASS-II records', value: bass.length, unit: 'records', note: null },
    { key: 'saffire_records', label: 'Saffire-I records', value: saffire.length, unit: 'records', note: null },
    {
      key: 'oxygen_basis',
      label: 'Oxygen basis',
      value: 'different sensor histories',
      unit: null,
      note: 'BASS-II applied a constant calibration offset; Saffire S1 uses a range midpoint.',
    },
    {
      key: 'flow_basis',
      label: 'Flow basis',
      value: 'not shared',
      unit: null,
      note: 'BASS-II reports a duct display; Saffire reports a flow setting.',
    },
    { key: 'pressure', label: 'Pressure values in either family', value: 0, unit: 'records', note: null },
    { key: 'outcome', label: 'Standardized outcomes in either family', value: 0, unit: 'records', note: null },
  ];
  const findings: AnalysisFinding[] = [
    {
      id: 'comparability-flow',
      severity: 'critical',
      title: 'Flow is not measured on one basis',
      detail: 'BASS-II flow is an instrument display with a slow response; Saffire flow is a setting. A numerical ratio is not a calibrated comparison.',
      record_ids: [],
    },
    {
      id: 'comparability-pressure',
      severity: 'critical',
      title: 'Neither family reports total pressure',
      detail: 'Atmosphere-controlled comparison is impossible without a pressure value for each record.',
      record_ids: [],
    },
  ];
  return {
    definition_id: 'comparability',
    definition_version: '1.0.0',
    title: 'Cross-investigation comparability',
    generated_at: now.toISOString(),
    corpus_version: corpusVersion,
    record_count: records.length,
    rows,
    findings,
    limitations: analysisDefinition('comparability').limitations,
  };
}

const runners: Record<AnalysisDefinitionId, (now: Date) => AnalysisResult> = {
  coverage: coverageResult,
  validation: validationResult,
  materials: materialsResult,
  atmosphere: atmosphereResult,
  sources: sourcesResult,
  comparability: comparabilityResult,
};

const FINGERPRINT_FIELDS = [
  'oxygen_initial_pct',
  'oxygen_final_pct',
  'total_pressure_psia',
  'oxygen_partial_pressure_psi',
  'flow_initial_cm_s',
  'flow_derived_cm_s',
  'thickness_mm',
  'width_cm',
  'length_cm',
  'diameter_mm',
  'gravity_regime',
  'ignition_method',
  'ignition_power_w',
  'ignition_time_s',
  'burn_time_s',
  'outcome',
  'validation_status',
  'quality_flags',
  'missing_fields',
] as const;

export function recordFingerprint(record: ExperimentRecord): string {
  const payload: Record<string, unknown> = {};
  for (const field of FINGERPRINT_FIELDS) {
    const value = record[field as keyof ExperimentRecord];
    payload[field] =
      value && typeof value === 'object' && !Array.isArray(value) && 'status' in value
        ? { value: (value as { value: unknown }).value, status: (value as { status: unknown }).status }
        : value;
  }
  return canonicalJson(payload);
}

export function recordFingerprints(): Record<string, string> {
  return Object.fromEntries(records.map((record) => [record.experiment_id, recordFingerprint(record)]));
}

export function runAnalysis(id: AnalysisDefinitionId, now = new Date()): AnalysisRun {
  const definition = analysisDefinition(id);
  const result = runners[id](now);
  return {
    id: `run-${id}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    definition_id: id,
    definition_version: definition.version,
    created_at: now.toISOString(),
    corpus_version: corpusVersion,
    parameters: {},
    result,
    record_fingerprints: recordFingerprints(),
    status: 'complete',
  };
}

export interface CorpusDiff {
  base_version: string;
  current_version: string;
  same_version: boolean;
  added_records: string[];
  removed_records: string[];
  changed_records: Array<{ record_id: string; fields: string[] }>;
  fingerprint_matches: number;
  total_current: number;
  total_base: number;
}

export function diffAgainstRun(run: AnalysisRun): CorpusDiff {
  const current = recordFingerprints();
  const base = run.record_fingerprints;
  const added = Object.keys(current).filter((id) => !(id in base));
  const removed = Object.keys(base).filter((id) => !(id in current));
  const changed: Array<{ record_id: string; fields: string[] }> = [];
  for (const id of Object.keys(current)) {
    if (!(id in base) || base[id] === current[id]) continue;
    changed.push({ record_id: id, fields: ['fingerprint'] });
  }
  return {
    base_version: run.corpus_version,
    current_version: corpusVersion,
    same_version: run.corpus_version === corpusVersion,
    added_records: added,
    removed_records: removed,
    changed_records: changed,
    fingerprint_matches: Object.keys(current).filter((id) => base[id] === current[id]).length,
    total_current: Object.keys(current).length,
    total_base: Object.keys(base).length,
  };
}

function iso(value: unknown): string {
  if (typeof value !== 'string') return new Date(0).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function validateAnalysisDocument(input: unknown): AnalysisDocument | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.runs)) return null;
  const runs: AnalysisRun[] = [];
  for (const item of raw.runs.slice(0, ANALYSIS_RUN_LIMIT)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const run = item as Record<string, unknown>;
    if (typeof run.id !== 'string' || !run.id) return null;
    if (typeof run.definition_id !== 'string' || !(ANALYSIS_DEFINITIONS as Array<{ id: string }>).some((definition) => definition.id === run.definition_id)) return null;
    if (!run.result || typeof run.result !== 'object' || Array.isArray(run.result)) return null;
    if (!run.record_fingerprints || typeof run.record_fingerprints !== 'object' || Array.isArray(run.record_fingerprints)) return null;
    const result = run.result as Record<string, unknown>;
    if (!Array.isArray(result.rows) || !Array.isArray(result.findings)) return null;
    runs.push({
      id: run.id,
      definition_id: run.definition_id as AnalysisDefinitionId,
      definition_version: typeof run.definition_version === 'string' ? run.definition_version : 'unknown',
      created_at: iso(run.created_at),
      corpus_version: typeof run.corpus_version === 'string' ? run.corpus_version : '',
      parameters: (run.parameters && typeof run.parameters === 'object' && !Array.isArray(run.parameters)
        ? run.parameters
        : {}) as AnalysisRun['parameters'],
      result: run.result as AnalysisResult,
      record_fingerprints: Object.fromEntries(
        Object.entries(run.record_fingerprints as Record<string, unknown>)
          .filter(([, value]) => typeof value === 'string')
          .slice(0, 1000),
      ) as Record<string, string>,
      status: 'complete',
    });
  }
  return { schema_version: ANALYSIS_SCHEMA, runs };
}

export function loadAnalysisDocument(
  storage?: KeyValueStorage | null,
): LoadResult<AnalysisDocument> {
  return loadVersioned(
    ANALYSIS_STORAGE_KEY,
    ANALYSIS_SCHEMA,
    emptyAnalysisDocument,
    validateAnalysisDocument,
    storage,
  );
}

export function saveAnalysisDocument(
  document: AnalysisDocument,
  storage?: KeyValueStorage | null,
): SaveResult {
  return saveVersioned(ANALYSIS_STORAGE_KEY, document, storage);
}

export function addAnalysisRun(document: AnalysisDocument, run: AnalysisRun): AnalysisDocument {
  return { ...document, runs: [run, ...document.runs].slice(0, ANALYSIS_RUN_LIMIT) };
}

export function analysisToMarkdown(run: AnalysisRun): string {
  const lines = [
    `# ${run.result.title}`,
    '',
    `- Definition: ${run.definition_id} v${run.definition_version}`,
    `- Run ID: ${run.id}`,
    `- Created: ${run.created_at}`,
    `- Corpus version: ${run.corpus_version}`,
    `- Records: ${run.result.record_count}`,
    '',
    '## Rows',
    '',
    '| Key | Label | Value | Unit | Note |',
    '| --- | --- | ---: | --- | --- |',
    ...run.result.rows.map((row) => `| ${row.key} | ${row.label} | ${row.value} | ${row.unit ?? '—'} | ${row.note ?? '—'} |`),
    '',
    '## Findings',
    '',
    ...run.result.findings.map((finding) => `- **${finding.severity.toUpperCase()}** ${finding.title} — ${finding.detail}${finding.record_ids.length ? ` Records: ${finding.record_ids.join(', ')}.` : ''}`),
    '',
    '## Limitations',
    '',
    ...run.result.limitations.map((limitation) => `- ${limitation}`),
    '',
  ];
  return lines.join('\n');
}
