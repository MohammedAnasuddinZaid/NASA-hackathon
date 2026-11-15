import { artifactsFor, corpusVersion } from './corpus';
import type { Claim, ExperimentRecord } from './types';
import { formatNumber } from './format';
import { hashFiles, type HashedFile } from './hash';
import { createZip, zipToBlob } from './zip';

export const EXPORT_SCHEMA_VERSION = 1;

export const exportColumns = [
  'experiment_id',
  'family',
  'investigation',
  'test_number',
  'sample_number',
  'date_reported',
  'material_raw',
  'material_family',
  'geometry',
  'thickness_mm',
  'width_cm',
  'length_cm',
  'diameter_mm',
  'oxygen_initial_pct',
  'oxygen_initial_status',
  'oxygen_final_pct',
  'oxygen_final_status',
  'total_pressure_psia',
  'total_pressure_status',
  'oxygen_partial_pressure_psi',
  'flow_initial_cm_s',
  'flow_derived_cm_s',
  'flow_direction',
  'gravity_regime',
  'gravity_status',
  'ignition_method',
  'ignition_power_w',
  'ignition_time_s',
  'burn_time_s',
  'outcome_status',
  'outcome_note',
  'validation_status',
  'quality_flags',
  'missing_fields',
  'source_id',
  'source_locator',
  'source_url',
  'doi',
  'license',
] as const;

type ExportColumn = (typeof exportColumns)[number];

export const coreExportColumns = [
  'experiment_id',
  'family',
  'investigation',
  'test_number',
  'sample_number',
  'material_raw',
  'material_family',
  'geometry',
  'thickness_mm',
  'oxygen_initial_pct',
  'oxygen_final_pct',
  'total_pressure_psia',
  'flow_initial_cm_s',
  'flow_derived_cm_s',
  'flow_direction',
  'gravity_regime',
  'ignition_power_w',
  'ignition_time_s',
  'burn_time_s',
  'outcome_status',
  'validation_status',
  'source_id',
  'source_locator',
] as const satisfies readonly ExportColumn[];

function cellValue(record: ExperimentRecord, column: ExportColumn): string | number {
  const source = artifactsFor(record.source_id).find((item) => item.role === 'experiment_table');
  switch (column) {
    case 'quality_flags':
      return record.quality_flags.join('; ');
    case 'missing_fields':
      return record.missing_fields.join('; ');
    case 'source_url':
      return source?.source_url ?? '';
    case 'doi':
      return source?.doi ?? '';
    case 'license':
      return source?.license ?? '';
    case 'oxygen_initial_status':
      return record.oxygen_initial_pct.status;
    case 'oxygen_final_status':
      return record.oxygen_final_pct.status;
    case 'total_pressure_status':
      return record.total_pressure_psia.status;
    case 'gravity_status':
      return record.gravity_regime.status;
    case 'outcome_status':
      return record.outcome.status;
    case 'outcome_note':
      return record.outcome.note ?? '';
    case 'gravity_regime':
      return record.gravity_regime.value ?? '';
    case 'ignition_method':
      return record.ignition_method.value ?? '';
    case 'flow_direction':
      return record.flow_direction.value ?? '';
    case 'thickness_mm':
      return record.thickness_mm.value ?? '';
    case 'width_cm':
      return record.width_cm.value ?? '';
    case 'length_cm':
      return record.length_cm.value ?? '';
    case 'diameter_mm':
      return record.diameter_mm.value ?? '';
    case 'oxygen_initial_pct':
      return record.oxygen_initial_pct.value ?? '';
    case 'oxygen_final_pct':
      return record.oxygen_final_pct.value ?? '';
    case 'total_pressure_psia':
      return record.total_pressure_psia.value ?? '';
    case 'oxygen_partial_pressure_psi':
      return record.oxygen_partial_pressure_psi.value ?? '';
    case 'flow_initial_cm_s':
      return record.flow_initial_cm_s.value ?? '';
    case 'flow_derived_cm_s':
      return record.flow_derived_cm_s.value ?? '';
    case 'ignition_power_w':
      return record.ignition_power_w.value ?? '';
    case 'ignition_time_s':
      return record.ignition_time_s.value ?? '';
    case 'burn_time_s':
      return record.burn_time_s.value ?? '';
    default:
      return record[column] ?? '';
  }
}

/**
 * RFC 4180 quoting plus spreadsheet formula-injection mitigation.
 *
 * A text cell that begins with =, +, -, @, tab, or carriage return is prefixed
 * with an apostrophe so a spreadsheet treats it as text. Numeric values are
 * never prefixed. This is applied before quoting.
 */
function quote(value: string | number): string {
  const raw = String(value);
  const text = typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function recordsToCsv(source: ExperimentRecord[], columns: readonly ExportColumn[] = exportColumns): string {
  const header = columns.join(',');
  const rows = source.map((record) => columns.map((column) => quote(cellValue(record, column))).join(','));
  return [header, ...rows].join('\r\n');
}

export function claimsToCsv(source: Claim[]): string {
  const columns = [
    'claim_id',
    'claim_text',
    'claim_type',
    'supporting_source_ids',
    'supporting_locators',
    'limitation',
    'validation_status',
  ];
  return [
    columns.join(','),
    ...source.map((claim) =>
      columns
        .map((column) => {
          const value = claim[column as keyof Claim];
          return quote(Array.isArray(value) ? value.join('; ') : value ?? '');
        })
        .join(','),
    ),
  ].join('\r\n');
}

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function previewCsv(csv: string, maxLines = 8): string[] {
  return csv.split(/\r?\n/).slice(0, maxLines);
}

export function summaryLine(source: ExperimentRecord[]): string {
  const pressure = source.filter((record) => record.total_pressure_psia.value !== null).length;
  const gravity = source.filter((record) => record.gravity_regime.status === 'measured').length;
  return `${source.length} records · ${pressure} with pressure · ${gravity} with per-test gravity · generated from the bundled corpus`;
}

export function csvFieldCount(csv: string): number {
  const first = csv.split(/\r?\n/)[0] ?? '';
  return first.split(',').length;
}

export function formatExportStamp(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function countLabel(value: number): string {
  return formatNumber(value, 0);
}

/** Generic CSV writer with the same RFC 4180 and injection protections. */
export function rowsToCsv(
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, string | number | null | undefined>>,
): string {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => quote(row[column] ?? '')).join(',')),
  ].join('\r\n');
}

export function verificationToCsv(
  results: ReadonlyArray<{
    target_kind: string;
    target_id: string;
    verdict: string;
    summary: string;
    checks: Array<{ status: string }>;
    created_at: string;
    corpus_version: string;
  }>,
): string {
  return rowsToCsv(
    ['target_kind', 'target_id', 'verdict', 'summary', 'passed_checks', 'warnings', 'failures', 'created_at', 'corpus_version'],
    results.map((result) => ({
      target_kind: result.target_kind,
      target_id: result.target_id,
      verdict: result.verdict,
      summary: result.summary,
      passed_checks: result.checks.filter((check) => check.status === 'pass').length,
      warnings: result.checks.filter((check) => check.status === 'warn').length,
      failures: result.checks.filter((check) => check.status === 'fail').length,
      created_at: result.created_at,
      corpus_version: result.corpus_version,
    })),
  );
}

export function analysisRowsToCsv(
  run: {
    id: string;
    definition_id: string;
    created_at: string;
    corpus_version: string;
    result: { rows: Array<{ key: string; label: string; value: string | number; unit: string | null; note: string | null }> };
  },
): string {
  return rowsToCsv(
    ['run_id', 'definition_id', 'created_at', 'corpus_version', 'key', 'label', 'value', 'unit', 'note'],
    run.result.rows.map((row) => ({
      run_id: run.id,
      definition_id: run.definition_id,
      created_at: run.created_at,
      corpus_version: run.corpus_version,
      key: row.key,
      label: row.label,
      value: row.value,
      unit: row.unit,
      note: row.note,
    })),
  );
}

export interface ExportManifest {
  schema_version: number;
  generated_at: string;
  corpus_version: string;
  file_count: number;
  files: Array<{ path: string; sha256: string; bytes: number }>;
  notes: string[];
}

/**
 * Hash every export file. The manifest itself is not included in its own file
 * list, so a consumer can recompute the hashes without a circular dependency.
 */
export async function buildExportManifest(
  files: Array<{ path: string; content: string }>,
  options: { generatedAt?: string } = {},
): Promise<{ manifest: ExportManifest; hashed: HashedFile[] }> {
  const hashed = await hashFiles(files);
  return {
    hashed,
    manifest: {
      schema_version: EXPORT_SCHEMA_VERSION,
      generated_at: options.generatedAt ?? new Date().toISOString(),
      corpus_version: corpusVersion,
      file_count: hashed.length,
      files: hashed.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
      notes: [
        'Hashes prove file identity, not scientific validity.',
        'Missing values are exported as empty cells; no value is imputed.',
        'Spreadsheet formula prefixes are neutralized with a leading apostrophe.',
      ],
    },
  };
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Download a deterministic ZIP with a manifest included. */
export async function downloadZip(
  filename: string,
  files: Array<{ path: string; content: string }>,
  options: { generatedAt?: string } = {},
): Promise<ExportManifest> {
  const { manifest } = await buildExportManifest(files, options);
  const bytes = createZip([
    ...files,
    { path: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
  ]);
  downloadBlob(filename, zipToBlob(bytes));
  return manifest;
}
