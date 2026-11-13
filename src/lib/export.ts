import { artifactsFor } from './corpus';
import type { Claim, ExperimentRecord } from './types';
import { formatNumber } from './format';

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

function quote(value: string | number): string {
  const text = String(value);
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
