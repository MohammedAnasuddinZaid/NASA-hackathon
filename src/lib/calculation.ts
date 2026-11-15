/**
 * Reproducible, unit-aware calculation engine.
 *
 * Every run is serializable: definition version, formula, inputs, units,
 * provenance, assumptions, rounding policy, validation status, and derivation
 * steps. Calculations are composition/geometry operations only. They never
 * predict ignition, extinction, flame spread, fire risk, or material safety.
 */

export type CalculationId =
  | 'ppo2-dalton'
  | 'flow-from-air-display'
  | 'pressure-psia-to-kpa'
  | 'oxygen-percent-to-fraction';

export interface CalculationInputDefinition {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  description: string;
}

export interface CalculationDefinition {
  id: CalculationId;
  version: string;
  name: string;
  formula: string;
  description: string;
  inputs: CalculationInputDefinition[];
  output: { label: string; unit: string };
  assumptions: string[];
  limitations: string[];
}

export const CALCULATIONS: CalculationDefinition[] = [
  {
    id: 'ppo2-dalton',
    version: '1.0.0',
    name: 'Oxygen partial pressure (Dalton composition)',
    formula: 'ppO2 = total_pressure × oxygen_fraction',
    description:
      'Composition calculation for an ideal gas mixture. It does not establish flammability, ignition, extinction, or material safety.',
    inputs: [
      {
        key: 'pressure_psia',
        label: 'Total pressure',
        unit: 'psia',
        min: 0.001,
        max: 500,
        step: 0.1,
        description: 'An independently supplied or reported total pressure. It is never inferred from oxygen fraction or flow.',
      },
      {
        key: 'oxygen_pct',
        label: 'Oxygen fraction',
        unit: '% by vol',
        min: 0,
        max: 100,
        step: 0.1,
        description: 'Oxygen percentage by volume.',
      },
    ],
    output: { label: 'Oxygen partial pressure', unit: 'psi' },
    assumptions: [
      'Total pressure and oxygen fraction describe the same gas sample.',
      'The mixture behaves as an ideal gas for this composition calculation.',
    ],
    limitations: [
      'No corpus record reports total pressure, so this calculation cannot be applied to a corpus record without a separate justified pressure input.',
      'A partial pressure is not a flammability threshold or a fire-risk result.',
    ],
  },
  {
    id: 'flow-from-air-display',
    version: '1.0.0',
    name: 'Derived flow from BASS-II air display',
    formula: 'U = 1.0066 × Air display',
    description:
      'Applies the single workbook factor recorded in the PSI-25 fan calibration sheet. It is not a per-test calibration.',
    inputs: [
      {
        key: 'air_display_cm_s',
        label: 'Air display',
        unit: 'cm/s',
        min: 0,
        max: 1000,
        step: 0.1,
        description: 'Instrument display value from the BASS-II experimental table.',
      },
    ],
    output: { label: 'Derived flow', unit: 'cm/s' },
    assumptions: [
      'The single workbook factor 1.0066 applies to this display value.',
    ],
    limitations: [
      'The factor comes from one SPICE calibration location; day- and restrictor-specific calibration was not applied.',
      'The display has a slow response and is not a per-test calibrated velocity.',
    ],
  },
  {
    id: 'pressure-psia-to-kpa',
    version: '1.0.0',
    name: 'Pressure conversion: psia to kPa',
    formula: 'kPa = psia × 6.894757293168',
    description: 'Exact unit conversion using the international inch definition of the psi.',
    inputs: [
      {
        key: 'pressure_psia',
        label: 'Pressure',
        unit: 'psia',
        min: 0,
        max: 100000,
        step: 0.1,
        description: 'Absolute pressure in pounds-force per square inch.',
      },
    ],
    output: { label: 'Pressure', unit: 'kPa' },
    assumptions: ['The input is an absolute pressure in psia, not a gauge pressure.'],
    limitations: ['Unit conversion does not validate the measurement itself.'],
  },
  {
    id: 'oxygen-percent-to-fraction',
    version: '1.0.0',
    name: 'Oxygen percent to fraction',
    formula: 'fraction = percent ÷ 100',
    description: 'Dimensionless oxygen fraction used by the Dalton calculation.',
    inputs: [
      {
        key: 'oxygen_pct',
        label: 'Oxygen fraction',
        unit: '% by vol',
        min: 0,
        max: 100,
        step: 0.1,
        description: 'Oxygen percentage by volume.',
      },
    ],
    output: { label: 'Oxygen fraction', unit: 'fraction' },
    assumptions: ['Percent by volume is being converted, not a mass fraction.'],
    limitations: ['A fraction alone does not define an atmosphere without pressure.'],
  },
];

export function calculationDefinition(id: CalculationId): CalculationDefinition | undefined {
  return CALCULATIONS.find((definition) => definition.id === id);
}

interface DecimalParts {
  negative: boolean;
  digits: bigint;
  scale: number;
}

function parseDecimal(input: number | string): DecimalParts | null {
  const text = typeof input === 'number' ? String(input) : input.trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const [, sign, integer = '', fraction = '', exponentText] = match;
  if (!integer && !fraction) return null;
  const exponent = exponentText ? Number(exponentText) : 0;
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 30) return null;
  let digits = BigInt(`${integer || '0'}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    digits *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { negative: sign === '-', digits, scale };
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(Math.max(0, exponent));
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  const negative = (numerator < 0n) !== (denominator < 0n);
  const top = numerator < 0n ? -numerator : numerator;
  const bottom = denominator < 0n ? -denominator : denominator;
  const quotient = top / bottom;
  const remainder = top % bottom;
  const rounded = remainder * 2n >= bottom ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

function formatDecimal(parts: DecimalParts, resultScale: number): string {
  let digits = parts.digits;
  if (parts.scale < resultScale) digits *= pow10(resultScale - parts.scale);
  if (parts.scale > resultScale) digits = divideRounded(digits, pow10(parts.scale - resultScale));
  const negative = parts.negative && digits !== 0n;
  const text = digits.toString().padStart(resultScale + 1, '0');
  const integer = text.slice(0, text.length - resultScale);
  const fraction = resultScale ? `.${text.slice(text.length - resultScale)}` : '';
  return `${negative ? '-' : ''}${integer}${fraction}`;
}

export function decimalMultiply(a: number | string, b: number | string, scale = 8): string | null {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  if (!left || !right) return null;
  const result: DecimalParts = {
    negative: left.negative !== right.negative,
    digits: left.digits * right.digits,
    scale: left.scale + right.scale,
  };
  return formatDecimal(result, scale);
}

export function decimalDivide(a: number | string, b: number | string, scale = 8): string | null {
  const left = parseDecimal(a);
  const right = parseDecimal(b);
  if (!left || !right || right.digits === 0n) return null;
  const numerator = left.digits * pow10(scale + right.scale);
  const denominator = right.digits * pow10(left.scale);
  const digits = divideRounded(numerator, denominator);
  return formatDecimal({ negative: left.negative !== right.negative, digits: digits < 0n ? -digits : digits, scale }, scale);
}

export function roundDecimal(value: number | string, scale = 3): string | null {
  const parsed = parseDecimal(value);
  return parsed ? formatDecimal(parsed, scale) : null;
}

export interface CalculationInput {
  key: string;
  label: string;
  value: number;
  unit: string;
  provenance: 'user' | 'corpus';
  record_id: string | null;
  field_key: string | null;
}

export interface CalculationResult {
  value: number | null;
  display: string;
  unit: string;
}

export interface CalculationRun {
  calculation_id: string;
  definition_id: CalculationId;
  definition_version: string;
  name: string;
  formula: string;
  inputs: CalculationInput[];
  output_unit: string;
  result: CalculationResult | null;
  status: 'ok' | 'invalid';
  errors: string[];
  assumptions: string[];
  limitations: string[];
  rounding_policy: string;
  steps: string[];
  created_at: string;
  corpus_version: string;
  source: 'user' | 'corpus' | 'mixed';
  rerun_of: string | null;
  previous_result: string | null;
}

export interface InputProvenance {
  provenance: 'user' | 'corpus';
  record_id?: string | null;
  field_key?: string | null;
}

export interface CalculationOptions {
  provenance?: Record<string, InputProvenance>;
  corpusVersion?: string;
  now?: Date;
  calculationId?: string;
}

function makeId(definition: CalculationId, now: number): string {
  return `calc-${definition}-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseInput(
  definition: CalculationInputDefinition,
  raw: unknown,
): { value: number; error: string | null } {
  if (raw === null || raw === undefined || raw === '') {
    return { value: Number.NaN, error: `${definition.label} is required.` };
  }
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) return { value: Number.NaN, error: `${definition.label} must be a finite number.` };
  if (value < definition.min || value > definition.max) {
    return {
      value,
      error: `${definition.label} must be between ${definition.min} and ${definition.max} ${definition.unit}.`,
    };
  }
  return { value, error: null };
}

export function runCalculation(
  id: CalculationId,
  rawInputs: Record<string, unknown>,
  options: CalculationOptions = {},
): CalculationRun {
  const now = options.now ?? new Date();
  const definition = calculationDefinition(id);
  if (!definition) {
    return {
      calculation_id: options.calculationId ?? makeId(id, now.getTime()),
      definition_id: id,
      definition_version: 'unknown',
      name: 'Unknown calculation',
      formula: '',
      inputs: [],
      output_unit: '',
      result: null,
      status: 'invalid',
      errors: ['Unknown calculation definition.'],
      assumptions: [],
      limitations: [],
      rounding_policy: 'n/a',
      steps: [],
      created_at: now.toISOString(),
      corpus_version: options.corpusVersion ?? '',
      source: 'user',
      rerun_of: null,
      previous_result: null,
    };
  }

  const errors: string[] = [];
  const inputs: CalculationInput[] = definition.inputs.map((input) => {
    const parsed = parseInput(input, rawInputs[input.key]);
    if (parsed.error) errors.push(parsed.error);
    const provenance = options.provenance?.[input.key] ?? { provenance: 'user' as const };
    return {
      key: input.key,
      label: input.label,
      value: parsed.value,
      unit: input.unit,
      provenance: provenance.provenance,
      record_id: provenance.record_id ?? null,
      field_key: provenance.field_key ?? null,
    };
  });

  const values = Object.fromEntries(inputs.map((input) => [input.key, input.value]));
  let exact: string | null = null;
  let steps: string[] = [];
  if (!errors.length) {
    switch (id) {
      case 'ppo2-dalton': {
        const product = decimalMultiply(values.pressure_psia, values.oxygen_pct, 10);
        exact = product === null ? null : decimalDivide(product, '100', 6);
        steps = [
          `Start from reported or user-supplied total pressure: ${values.pressure_psia} psia.`,
          `Convert oxygen percentage to a fraction: ${values.oxygen_pct}% ÷ 100 = ${decimalDivide(values.oxygen_pct, '100', 8)}.`,
          `Multiply pressure by fraction: ${values.pressure_psia} × ${decimalDivide(values.oxygen_pct, '100', 8)} = ${exact} psi.`,
        ];
        break;
      }
      case 'flow-from-air-display': {
        exact = decimalMultiply(values.air_display_cm_s, '1.0066', 6);
        steps = [
          `Read the reported air display: ${values.air_display_cm_s} cm/s.`,
          'Apply the single PSI-25 workbook factor 1.0066.',
          `${values.air_display_cm_s} × 1.0066 = ${exact} cm/s.`,
        ];
        break;
      }
      case 'pressure-psia-to-kpa': {
        exact = decimalMultiply(values.pressure_psia, '6.894757293168', 9);
        steps = [
          `Start from ${values.pressure_psia} psia.`,
          'Apply 1 psia = 6.894757293168 kPa.',
          `${values.pressure_psia} × 6.894757293168 = ${exact} kPa.`,
        ];
        break;
      }
      case 'oxygen-percent-to-fraction': {
        exact = decimalDivide(values.oxygen_pct, '100', 8);
        steps = [`Divide ${values.oxygen_pct}% by 100: ${exact} fraction.`];
        break;
      }
      default:
        errors.push('Calculation is not implemented.');
    }
  }
  if (exact === null && !errors.length) errors.push('The calculation could not produce a finite result.');

  const numeric = exact === null ? null : Number(exact);
  const display =
    exact === null || numeric === null || !Number.isFinite(numeric)
      ? 'invalid'
      : (roundDecimal(exact, 3) ?? 'invalid');
  const sources = new Set(inputs.map((input) => input.provenance));
  const source: CalculationRun['source'] = sources.size > 1 ? 'mixed' : sources.has('corpus') ? 'corpus' : 'user';

  return {
    calculation_id: options.calculationId ?? makeId(id, now.getTime()),
    definition_id: id,
    definition_version: definition.version,
    name: definition.name,
    formula: definition.formula,
    inputs,
    output_unit: definition.output.unit,
    result:
      numeric === null || !Number.isFinite(numeric)
        ? null
        : { value: numeric, display, unit: definition.output.unit },
    status: errors.length || numeric === null || !Number.isFinite(numeric) ? 'invalid' : 'ok',
    errors,
    assumptions: [...definition.assumptions],
    limitations: [...definition.limitations],
    rounding_policy: 'Exact decimal arithmetic; internal result 6–9 decimal places; display rounded half-up to 3 decimal places.',
    steps,
    created_at: now.toISOString(),
    corpus_version: options.corpusVersion ?? '',
    source,
    rerun_of: null,
    previous_result: null,
  };
}

/**
 * Rerun a stored calculation against new inputs. The original run is not
 * modified; the new run records its parent and the previous displayed result.
 */
export function rerunCalculation(
  previous: CalculationRun,
  rawInputs: Record<string, unknown>,
  options: CalculationOptions = {},
): CalculationRun {
  const next = runCalculation(previous.definition_id, rawInputs, options);
  return {
    ...next,
    rerun_of: previous.calculation_id,
    previous_result: previous.result ? `${previous.result.display} ${previous.result.unit}` : 'invalid',
  };
}

export function calculationToMarkdown(run: CalculationRun): string {
  const lines = [
    `### ${run.name}`,
    '',
    `- Calculation ID: ${run.calculation_id}`,
    `- Definition: ${run.definition_id} v${run.definition_version}`,
    `- Formula: ${run.formula}`,
    `- Status: ${run.status}`,
    `- Source: ${run.source}`,
    `- Corpus version: ${run.corpus_version || 'not recorded'}`,
    '',
    '| Input | Value | Unit | Provenance | Record | Field |',
    '| --- | ---: | --- | --- | --- | --- |',
    ...run.inputs.map(
      (input) =>
        `| ${input.label} | ${Number.isFinite(input.value) ? input.value : 'invalid'} | ${input.unit} | ${input.provenance} | ${input.record_id ?? '—'} | ${input.field_key ?? '—'} |`,
    ),
    '',
    `**Result:** ${run.result ? `${run.result.display} ${run.result.unit}` : 'invalid'}`,
    '',
    'Assumptions:',
    ...run.assumptions.map((assumption) => `- ${assumption}`),
    '',
    'Limitations:',
    ...run.limitations.map((limitation) => `- ${limitation}`),
    '',
    'Derivation:',
    ...run.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
  ];
  return lines.join('\n');
}
