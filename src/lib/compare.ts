import type { DataValue, ExperimentRecord } from './types';
import { formatCompact, isMissing, statusLabel } from './format';

export type CompareValue = DataValue<number> | DataValue<string> | string | null;

export interface CompareField {
  key: string;
  label: string;
  group: 'Sample' | 'Atmosphere' | 'Flow & gravity' | 'Ignition & outcome';
  value: (record: ExperimentRecord) => CompareValue;
  unit?: string;
  note?: string;
}

export const compareFields: CompareField[] = [
  { key: 'investigation', label: 'Investigation', group: 'Sample', value: (r) => r.investigation_acronym },
  { key: 'sample', label: 'Sample', group: 'Sample', value: (r) => r.sample_number },
  { key: 'material', label: 'Material (as reported)', group: 'Sample', value: (r) => r.material_raw },
  { key: 'material_family', label: 'Material family (parsed)', group: 'Sample', value: (r) => r.material_family },
  { key: 'geometry', label: 'Geometry', group: 'Sample', value: (r) => r.geometry },
  { key: 'thickness', label: 'Thickness', group: 'Sample', value: (r) => r.thickness_mm },
  { key: 'width', label: 'Width', group: 'Sample', value: (r) => r.width_cm },
  { key: 'length', label: 'Length', group: 'Sample', value: (r) => r.length_cm },
  { key: 'diameter', label: 'Diameter', group: 'Sample', value: (r) => r.diameter_mm },
  { key: 'o2_initial', label: 'Initial O2', group: 'Atmosphere', value: (r) => r.oxygen_initial_pct },
  { key: 'o2_final', label: 'Final O2', group: 'Atmosphere', value: (r) => r.oxygen_final_pct },
  {
    key: 'pressure',
    label: 'Total pressure',
    group: 'Atmosphere',
    value: (r) => r.total_pressure_psia,
    note: 'Absent from both experimental tables.',
  },
  {
    key: 'ppo2',
    label: 'O2 partial pressure',
    group: 'Atmosphere',
    value: (r) => r.oxygen_partial_pressure_psi,
    note: 'Cannot be calculated without total pressure.',
  },
  { key: 'flow', label: 'Air flow (reported)', group: 'Flow & gravity', value: (r) => r.flow_initial_cm_s },
  {
    key: 'flow_derived',
    label: 'Air flow (derived)',
    group: 'Flow & gravity',
    value: (r) => r.flow_derived_cm_s,
    note: 'BASS-II only; single workbook factor, not a per-test calibration.',
  },
  { key: 'flow_direction', label: 'Flow direction', group: 'Flow & gravity', value: (r) => r.flow_direction },
  { key: 'gravity', label: 'Gravity regime', group: 'Flow & gravity', value: (r) => r.gravity_regime },
  { key: 'ignition_power', label: 'Ignition power', group: 'Ignition & outcome', value: (r) => r.ignition_power_w },
  { key: 'ignition_time', label: 'Ignition time', group: 'Ignition & outcome', value: (r) => r.ignition_time_s },
  { key: 'burn_time', label: 'Burn time', group: 'Ignition & outcome', value: (r) => r.burn_time_s },
  { key: 'outcome', label: 'Standardized outcome', group: 'Ignition & outcome', value: (r) => r.outcome },
];

export function fieldDisplay(field: CompareField, record: ExperimentRecord): string {
  const value = field.value(record);
  if (value === null || value === undefined) return 'Not reported';
  if (typeof value === 'string') return value;
  if (isMissing(value)) return 'Not reported';
  return formatCompact(value);
}

export function fieldStatus(field: CompareField, record: ExperimentRecord): string {
  const value = field.value(record);
  if (!value || typeof value === 'string') return 'reported';
  return statusLabel(value.status);
}

export type CheckState = 'shared' | 'partial' | 'blocked' | 'unknown';

export interface ComparabilityCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

export function comparabilityAudit(source: ExperimentRecord[]): ComparabilityCheck[] {
  if (!source.length) return [];
  const families = new Set(source.map((record) => record.family));
  const materials = new Set(source.map((record) => record.material_family));
  const geometries = new Set(source.map((record) => record.geometry));
  const pressureKnown = source.filter((record) => record.total_pressure_psia.value !== null).length;
  const gravityMeasured = source.filter((record) => record.gravity_regime.status === 'measured').length;
  const outcomeMeasured = source.filter((record) => record.outcome.status === 'measured').length;
  const o2Known = source.filter((record) => record.oxygen_initial_pct.value !== null).length;
  const ignitionKnown = source.filter((record) => record.ignition_power_w.value !== null).length;
  const flowMethods = new Set(
    source.map((record) => (record.family === 'BASS-II' ? 'instrument display' : 'reported flow')),
  );

  return [
    {
      id: 'investigation',
      label: 'Investigation context',
      state: families.size === 1 ? 'shared' : 'blocked',
      detail:
        families.size === 1
          ? `All selected records belong to ${[...families][0]}.`
          : `${families.size} investigations selected: hardware, environment and reporting conventions differ.`,
    },
    {
      id: 'material',
      label: 'Material and geometry',
      state: materials.size === 1 && geometries.size === 1 ? 'shared' : 'partial',
      detail:
        materials.size === 1 && geometries.size === 1
          ? 'All selected records share the same parsed material family and geometry.'
          : `${materials.size} material families and ${geometries.size} geometries selected. Parsed from free text; not a controlled material specification.`,
    },
    {
      id: 'pressure',
      label: 'Total pressure',
      state: pressureKnown === source.length ? 'shared' : pressureKnown === 0 ? 'unknown' : 'partial',
      detail:
        pressureKnown === 0
          ? 'No selected record reports total pressure. Oxygen partial pressure cannot be computed, and atmospheric equivalence cannot be established.'
          : `${pressureKnown} of ${source.length} selected records report total pressure.`,
    },
    {
      id: 'gravity',
      label: 'Gravity at test level',
      state: gravityMeasured === source.length ? 'shared' : gravityMeasured === 0 ? 'unknown' : 'partial',
      detail:
        gravityMeasured === 0
          ? 'Gravity is investigation-level context only. No selected record has a measured g-level, so gravity cannot be treated as a controlled comparison variable.'
          : `${gravityMeasured} of ${source.length} selected records have a measured per-test gravity value.`,
    },
    {
      id: 'oxygen',
      label: 'Oxygen measurement basis',
      state: o2Known === source.length ? 'shared' : 'partial',
      detail: `${o2Known} of ${source.length} selected records report an initial O2 value. BASS-II O2 was corrected with a constant offset; two Saffire values are approximate midpoints of ranges.`,
    },
    {
      id: 'flow',
      label: 'Flow measurement basis',
      state: flowMethods.size === 1 ? 'partial' : 'blocked',
      detail:
        flowMethods.size === 1
          ? 'Flow shares one reporting basis, but BASS-II display values have a slow response and are not calibrated per test.'
          : 'Flow bases differ: BASS-II uses a slow-response duct display; Saffire-I reports a flow setting. The two are not the same instrument quantity.',
    },
    {
      id: 'ignition',
      label: 'Ignition reporting',
      state: ignitionKnown === source.length ? 'shared' : ignitionKnown === 0 ? 'unknown' : 'partial',
      detail:
        ignitionKnown === 0
          ? 'No selected record reports ignition power or time.'
          : `${ignitionKnown} of ${source.length} selected records report ignition power. Ignition method is not stated in either table.`,
    },
    {
      id: 'outcome',
      label: 'Standardized outcome',
      state: outcomeMeasured === source.length ? 'shared' : 'unknown',
      detail:
        outcomeMeasured === 0
          ? 'Neither table contains a standardized extinction or sustained-burning classification. Burn duration is not equivalent to a flammability outcome.'
          : `${outcomeMeasured} of ${source.length} selected records have a standardized outcome.`,
    },
  ];
}

export function comparisonBlockerCount(checks: ComparabilityCheck[]): number {
  return checks.filter((check) => check.state === 'blocked' || check.state === 'unknown').length;
}
