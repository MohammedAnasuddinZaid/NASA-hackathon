import type { DataValue, ExperimentRecord } from './types';

export const SCENARIO_POLICY = 'scenario-retrieval-1.0';
export type ConditionKey =
  | 'material'
  | 'geometry'
  | 'oxygen'
  | 'pressure'
  | 'gravity'
  | 'flow'
  | 'method'
  | 'investigation'
  | 'direction'
  | 'thickness';
export interface Scenario {
  material: string;
  geometry: string;
  oxygen: number | null;
  pressure: number | null;
  gravity: string;
  flow: number | null;
  method: string;
  investigation: string;
  direction: string;
  thickness: number | null;
}
export const defaultScenario: Scenario = {
  material: '',
  geometry: '',
  oxygen: 30,
  pressure: 10.2,
  gravity: 'lunar',
  flow: 20,
  method: '',
  investigation: '',
  direction: '',
  thickness: null,
};
export const weights: Record<ConditionKey, number> = {
  material: 3,
  geometry: 2,
  oxygen: 3,
  pressure: 3,
  gravity: 3,
  flow: 2,
  method: 2,
  investigation: 1,
  direction: 2,
  thickness: 2,
};
export const labels: Record<ConditionKey, string> = {
  material: 'Material family',
  geometry: 'Geometry',
  oxygen: 'Initial oxygen',
  pressure: 'Total pressure',
  gravity: 'Gravity regime',
  flow: 'Reported flow',
  method: 'Measurement method',
  investigation: 'Investigation',
  direction: 'Flow direction',
  thickness: 'Thickness',
};
export type Relation =
  | 'exact'
  | 'tolerance'
  | 'approximate'
  | 'different'
  | 'missing'
  | 'ambiguous'
  | 'context'
  | 'not_comparable'
  | 'not_requested';
export const relationLabels: Record<Relation, string> = {
  exact: 'Same reported value',
  tolerance: 'Within retrieval tolerance',
  approximate: 'Approximate / parsed similarity',
  different: 'Different',
  missing: 'Missing experimental value',
  ambiguous: 'Unverified / ambiguous',
  context: 'Investigation context only',
  not_comparable: 'Not comparable',
  not_requested: 'Not requested',
};
export interface ConditionEvaluation {
  key: ConditionKey;
  target: string | number | null;
  experimental: string | number | null;
  unit: string | null;
  targetUnit: string | null;
  relation: Relation;
  explanation: string;
  sourceId: string;
  locator: string;
  status: string;
  note: string | null;
  raw: string | null;
  credit: number;
}
export interface Candidate {
  record: ExperimentRecord;
  conditions: ConditionEvaluation[];
  earned: number;
  requestedWeight: number;
  comparableWeight: number;
  unknownCount: number;
  differingCount: number;
  explanation: string;
}
export interface RecordAccess {
  all(): readonly ExperimentRecord[];
  find(id: string): ExperimentRecord | undefined;
}
export function validateScenario(s: Scenario): string[] {
  const errors: string[] = [];
  for (const [key, min, max] of [
    ['oxygen', 0, 100],
    ['pressure', Number.MIN_VALUE, 500],
    ['flow', 0, 1000],
    ['thickness', Number.MIN_VALUE, 1000],
  ] as const) {
    const value = s[key];
    if (
      value !== null &&
      (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    )
      errors.push(
        `${labels[key]} must be a finite number ${key === 'pressure' || key === 'thickness' ? 'greater than zero' : `at least ${min}`} and at most ${max}.`,
      );
  }
  if (!Object.values(s).some((v) => v !== null && (typeof v !== 'string' || v.trim() !== '')))
    errors.push('Specify at least one target condition.');
  for (const key of [
    'material',
    'geometry',
    'gravity',
    'method',
    'investigation',
    'direction',
  ] as const) {
    if (typeof s[key] !== 'string' || s[key].length > 200)
      errors.push(`${labels[key]} is invalid.`);
  }
  if (!['', 'microgravity', 'lunar', 'mars', 'earth'].includes(s.gravity))
    errors.push('Unsupported gravity target.');
  return errors;
}

/** Units are explicit; no implicit conversion of arbitrary strings or incompatible quantities. */
export function convertUnit(value: number, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  const groups: Array<Record<string, number>> = [
    { psia: 1, kPa: 1 / 6.894757293168 },
    { 'cm/s': 1, 'm/s': 100 },
    { mm: 1, cm: 10, micron: 0.001 },
    { '% by vol': 1, fraction: 100 },
  ];
  const group = groups.find((g) => from in g && to in g);
  return group ? (value * group[from]) / group[to] : null;
}
const numeric = {
  oxygen: { field: 'oxygen_initial_pct', unit: '% by vol', abs: 0.5, rel: 0.05 },
  pressure: { field: 'total_pressure_psia', unit: 'psia', abs: 0.5, rel: 0.03 },
  flow: { field: 'flow_initial_cm_s', unit: 'cm/s', abs: 0.5, rel: 0.1 },
  thickness: { field: 'thickness_mm', unit: 'mm', abs: 0.02, rel: 0.1 },
} as const;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export function evaluateCondition(
  record: ExperimentRecord,
  s: Scenario,
  key: ConditionKey,
): ConditionEvaluation {
  const base: ConditionEvaluation = {
    key,
    target: s[key],
    experimental: null,
    unit: null,
    targetUnit: null,
    relation: 'not_requested',
    explanation: 'No target specified; no ranking contribution.',
    sourceId: record.source_id,
    locator: record.source_locator,
    status: 'not_reported',
    note: null,
    raw: null,
    credit: 0,
  };
  if (s[key] === null || (typeof s[key] === 'string' && !(s[key] as string).trim())) return base;
  const set = (relation: Relation, explanation: string, credit = 0): ConditionEvaluation => ({
    ...base,
    relation,
    explanation,
    credit,
  });
  if (key in numeric) {
    const rule = numeric[key as keyof typeof numeric];
    base.targetUnit = rule.unit;
    const data = record[rule.field] as DataValue<number>;
    Object.assign(base, {
      experimental: data.value,
      unit: data.unit,
      status: data.status,
      note: data.note,
      raw: data.raw,
      locator: data.source_locator || record.source_locator,
    });
    if (data.value === null)
      return set(
        'missing',
        `Target ${s[key]} ${rule.unit}; this normalized record supplies no usable value. No assumption substituted.`,
      );
    if (
      !['measured', 'corrected', 'derived', 'reported_qualitative'].includes(data.status) ||
      record.validation_status === 'suspect'
    )
      return set(
        'ambiguous',
        'Source status or record quality is unresolved; inspect raw values and flags. No match credit.',
      );
    if (!data.unit) return set('not_comparable', 'The experimental unit is unknown.');
    const actual = convertUnit(data.value, data.unit, rule.unit);
    if (actual === null)
      return set(
        'not_comparable',
        `Experimental unit ${data.unit} cannot be converted to ${rule.unit}.`,
      );
    base.experimental = actual;
    base.unit = rule.unit;
    if (key === 'flow' && s.method && norm(s.method) !== norm(record.measurement_method))
      return set(
        'not_comparable',
        'Requested measurement method differs; a duct display and a flow setting are not interchangeable.',
      );
    if (key === 'flow' && record.flow_varies)
      return set(
        'ambiguous',
        'Source contains varying display tokens. The first token is not a steady-state match; the token range is not uncertainty.',
      );
    const target = s[key] as number;
    const tolerance = Math.max(rule.abs, rule.rel * Math.max(Math.abs(actual), Math.abs(target)));
    const close = Math.abs(actual - target) <= tolerance + Number.EPSILON * 16;
    if (data.status === 'reported_qualitative') {
      const range = data.raw?.match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*$/);
      if (range) {
        const lo = convertUnit(Number(range[1]), data.unit, rule.unit)!;
        const hi = convertUnit(Number(range[2]), data.unit, rule.unit)!;
        if (lo > hi) return set('ambiguous', 'Source range is reversed; no match credit.');
        return target >= lo && target <= hi
          ? set(
              'approximate',
              `Target overlaps reported range ${data.raw} ${data.unit}; midpoint is not an exact measurement or uncertainty interval.`,
              0.5,
            )
          : set(
              'different',
              `Target lies outside the reported range ${data.raw} ${data.unit}; no midpoint precision assumed.`,
            );
      }
      return close
        ? set(
            'approximate',
            'Approximate source value is nearby; no exact match or increased precision asserted.',
            0.5,
          )
        : set('different', 'Approximate source value differs beyond retrieval tolerance.');
    }
    if (!close)
      return set(
        'different',
        `Difference exceeds retrieval tolerance max(${rule.abs} ${rule.unit}, ${rule.rel * 100}% of larger magnitude).`,
      );
    if (data.status === 'derived')
      return set(
        'approximate',
        'Parsed/derived value is nearby; transformation is not a direct measurement.',
        0.5,
      );
    return actual === target
      ? set(
          'exact',
          `Same reported numeric value; status ${data.status}. This does not establish experimental equivalence.`,
          1,
        )
      : set(
          'tolerance',
          `Within max(${rule.abs} ${rule.unit}, ${rule.rel * 100}% of larger magnitude). Retrieval heuristic, not scientific equivalence.`,
          0.75,
        );
  }
  const data =
    key === 'gravity' ? record.gravity_regime : key === 'direction' ? record.flow_direction : null;
  const value = data
    ? data.value
    : (
        {
          material: record.material_family,
          geometry: record.geometry,
          method: record.measurement_method,
          investigation: record.family,
        } as Partial<Record<ConditionKey, string>>
      )[key];
  Object.assign(base, {
    experimental: value ?? null,
    status:
      data?.status ??
      (key === 'material' || key === 'geometry' ? 'parsed_from_text' : 'reported_metadata'),
    raw: data?.raw ?? null,
    note: data?.note ?? null,
    locator: data?.source_locator || record.source_locator,
  });
  if (value == null || !value.trim() || norm(value) === 'unknown')
    return set(
      'missing',
      'No usable experimental value; missing information earns no match credit.',
    );
  const same = norm(String(s[key])) === norm(value);
  if (data?.status === 'investigation_level')
    return set(
      'context',
      `Investigation-level ${value}; ${same ? 'shared label' : 'different target label'}, not a measured per-test condition. No match credit.`,
    );
  if (data && !['measured', 'corrected', 'reported_qualitative'].includes(data.status))
    return set('ambiguous', 'Unverified categorical source status; inspect the record.');
  if (!same)
    return set(
      'different',
      'Reported categories differ; unlike materials, geometries and methods are not aliases.',
    );
  return set(
    'exact',
    key === 'material' || key === 'geometry'
      ? 'Same parsed category only, not a controlled sample specification.'
      : 'Same reported category; other experimental conditions still require review.',
    1,
  );
}

export function rankCandidates(
  source: readonly ExperimentRecord[],
  scenario: Scenario,
  options: {
    sort?: 'relevance' | 'coverage';
    mandatory?: ConditionKey[];
    investigation?: string;
    material?: string;
    showAll?: boolean;
  } = {},
): Candidate[] {
  if (validateScenario(scenario).length) return [];
  return source
    .filter(
      (r) =>
        (!options.investigation || r.family === options.investigation) &&
        (!options.material || r.material_family === options.material),
    )
    .map((record): Candidate => {
      const conditions = (Object.keys(weights) as ConditionKey[]).map((key) =>
        evaluateCondition(record, scenario, key),
      );
      const requested = conditions.filter((c) => c.relation !== 'not_requested');
      const earned = requested.reduce((sum, c) => sum + weights[c.key] * c.credit, 0);
      const comparable = requested.filter((c) =>
        ['exact', 'tolerance', 'approximate', 'different'].includes(c.relation),
      );
      const unknownCount = requested.length - comparable.length;
      const matched = requested.filter((c) => c.credit > 0).map((c) => labels[c.key]);
      const differingCount = requested.filter(
        (c) => c.relation === 'different' || c.relation === 'not_comparable',
      ).length;
      return {
        record,
        conditions,
        earned,
        requestedWeight: requested.reduce((sum, c) => sum + weights[c.key], 0),
        comparableWeight: comparable.reduce((sum, c) => sum + weights[c.key], 0),
        unknownCount,
        differingCount,
        explanation: `${matched.length ? `Retrieval support: ${matched.join(', ')}.` : 'No requested condition earns retrieval credit.'} ${unknownCount} requested conditions unresolved/context-only; ${differingCount} differing/incompatible. Relevance is not scientific comparability or material safety.`,
      };
    })
    .filter(
      (c) =>
        (options.showAll !== false || c.earned > 0) &&
        !(options.mandatory ?? []).some((key) =>
          c.conditions.some(
            (e) => e.key === key && ['different', 'not_comparable'].includes(e.relation),
          ),
        ),
    )
    .sort(
      (a, b) =>
        (options.sort === 'coverage'
          ? b.comparableWeight - a.comparableWeight
          : b.earned - a.earned) ||
        (options.sort === 'coverage'
          ? b.earned - a.earned
          : b.comparableWeight - a.comparableWeight) ||
        a.differingCount - b.differingCount ||
        (a.record.experiment_id < b.record.experiment_id
          ? -1
          : a.record.experiment_id > b.record.experiment_id
            ? 1
            : 0),
    );
}

export function researchGaps(candidates: Candidate[]): string[] {
  if (!candidates.length)
    return [
      'No records remain under these filters. Relax filters or report which material/configuration is absent; no equivalent evidence is established.',
    ];
  const gaps = (Object.keys(weights) as ConditionKey[]).filter((key) =>
    candidates.some((c) =>
      c.conditions.some(
        (e) =>
          e.key === key &&
          ['missing', 'context', 'ambiguous', 'not_comparable', 'different'].includes(e.relation),
      ),
    ),
  );
  return [
    ...gaps.map((key) => {
      const field = candidates.map((candidate) => candidate.conditions.find((e) => e.key === key)!);
      const different = field.filter((e) => e.relation === 'different').length;
      const unresolved = field.filter((e) =>
        ['missing', 'context', 'ambiguous', 'not_comparable'].includes(e.relation),
      ).length;
      return `${labels[key]}: ${unresolved} of ${candidates.length} candidate records unresolved/context-only/incompatible; ${different} known differences. A target-matched per-test value, method, units, uncertainty and source locator are required for a defensible comparison.`;
    }),
    'Report controlled material specifications, dimensions, airflow direction, ignition method and standardized outcomes. These are reporting requirements, not experimental procedures.',
    'The reviewed tables are not all NASA combustion research. Review unlinked report context separately; do not assign it to experimental rows.',
  ];
}

export function scenarioFromRecord(r: ExperimentRecord): Scenario {
  return {
    material: r.material_family === 'Unknown' ? '' : r.material_family,
    geometry: r.geometry === 'Unknown' ? '' : r.geometry,
    oxygen: r.oxygen_initial_pct.value,
    pressure: r.total_pressure_psia.value,
    gravity: r.gravity_regime.value === 'microgravity' ? 'microgravity' : '',
    flow: r.flow_initial_cm_s.value,
    method: r.measurement_method,
    investigation: r.family,
    direction: r.flow_direction.value ?? '',
    thickness: r.thickness_mm.value,
  };
}
export function comparisonRows(
  source: ExperimentRecord[],
): { key: ConditionKey; values: ConditionEvaluation[]; summary: string }[] {
  if (!source.length) return [];
  const target = scenarioFromRecord(source[0]);
  return (Object.keys(weights) as ConditionKey[]).map((key) => {
    const values = source.map((record) => {
      const evaluation = evaluateCondition(record, target, key);
      if (target[key] === '' || target[key] === null)
        return {
          ...evaluation,
          relation: 'missing' as Relation,
          explanation: 'Reference condition missing; no shared-condition claim can be made.',
          credit: 0,
        };
      if (
        (key === 'gravity' || key === 'direction') &&
        source[0][key === 'gravity' ? 'gravity_regime' : 'flow_direction'].status ===
          'investigation_level'
      ) {
        return {
          ...evaluation,
          relation: 'context' as Relation,
          explanation:
            'Reference condition is investigation-level context. No per-test equality or difference is inferred.',
          credit: 0,
        };
      }
      if (key in numeric) {
        const reference = source[0][numeric[key as keyof typeof numeric].field];
        if (key === 'flow' && source[0].flow_varies)
          return {
            ...evaluation,
            relation: 'ambiguous' as Relation,
            explanation:
              'Reference flow varies; its first token cannot establish a steady-state comparison.',
            credit: 0,
          };
        if (source[0].validation_status === 'suspect')
          return {
            ...evaluation,
            relation: 'ambiguous' as Relation,
            explanation: 'Reference record is suspect; no numeric equivalence claim.',
            credit: 0,
          };
        if (
          ['derived', 'reported_qualitative'].includes(reference.status) &&
          ['exact', 'tolerance'].includes(evaluation.relation)
        )
          return {
            ...evaluation,
            relation: 'approximate' as Relation,
            explanation:
              'Reference value is approximate/derived; similar point values do not establish exact equality.',
            credit: 0.5,
          };
      }
      return evaluation;
    });
    const states = [...new Set(values.map((v) => v.relation))];
    return {
      key,
      values,
      summary:
        target[key] === '' || target[key] === null
          ? 'Reference value missing/unspecified; no equivalence established.'
          : states.map((s) => relationLabels[s]).join(' · '),
    };
  });
}
