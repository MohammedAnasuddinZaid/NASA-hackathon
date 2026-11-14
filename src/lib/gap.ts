import { records } from './corpus';
import { oxygenPartialPressure } from './atmosphere';

export type GravityTarget = 'microgravity' | 'lunar' | 'mars' | 'earth' | 'unspecified';

export interface GapTarget {
  pressurePsia: number;
  oxygenPct: number;
  gravity: GravityTarget;
  material: string;
  flowCmS: number | null;
  objective: string;
}

export type EvidenceState = 'direct' | 'partial' | 'context' | 'absent';

export interface GapEvidence {
  dimension: string;
  question: string;
  state: EvidenceState;
  finding: string;
  citation: string;
}

export interface RequiredField {
  field: string;
  unit: string;
  why: string;
}

export interface GapPlan {
  target: GapTarget;
  partialPressurePsi: number | null;
  evidence: GapEvidence[];
  requiredFields: RequiredField[];
  controls: string[];
  unsupportedClaims: string[];
  markdown: string;
}

export const gravityLabels: Record<GravityTarget, string> = {
  microgravity: 'Microgravity (investigation-level only in this corpus)',
  lunar: 'Lunar surface (~1/6 g)',
  mars: 'Mars surface (~3/8 g)',
  earth: 'Earth (1 g)',
  unspecified: 'Unspecified / compare across regimes',
};

export function buildGapPlan(target: GapTarget): GapPlan {
  const pressureKnown = records.filter((record) => record.total_pressure_psia.value !== null).length;
  const gravityMeasured = records.filter((record) => record.gravity_regime.status === 'measured').length;
  const o2Known = records.filter((record) => record.oxygen_initial_pct.value !== null).length;
  const finalKnown = records.filter((record) => record.oxygen_final_pct.value !== null).length;
  const flowKnown = records.filter((record) => record.flow_initial_cm_s.value !== null).length;
  const outcomeKnown = records.filter((record) => record.outcome.status === 'measured').length;
  const ignitionKnown = records.filter((record) => record.ignition_power_w.value !== null).length;
  const materialMatches = records.filter(
    (record) =>
      target.material !== 'any' &&
      record.material_family.toLowerCase() === target.material.toLowerCase(),
  );
  const partialGravityKnown = records.filter(
    (record) => record.gravity_regime.status === 'measured' && record.gravity_regime.value !== 'microgravity',
  ).length;

  const evidence: GapEvidence[] = [
    {
      dimension: 'Atmosphere · total pressure',
      question: 'At what total pressure was each test conducted?',
      state: pressureKnown === records.length ? 'direct' : pressureKnown === 0 ? 'absent' : 'partial',
      finding:
        pressureKnown === 0
          ? 'Both experimental tables lack a pressure column. The corpus cannot place any record at a pressure, and no cabin pressure was substituted.'
          : `${pressureKnown} of ${records.length} records report total pressure.`,
      citation: 'PSI-25 experimental table, columns A–Q; PSI-98 experimental table, columns A–M',
    },
    {
      dimension: 'Atmosphere · oxygen',
      question: 'What oxygen fraction was present, and how was it measured?',
      state: o2Known === records.length ? 'partial' : 'partial',
      finding: `${o2Known} of ${records.length} records report an initial O2 fraction; ${finalKnown} report a final value. BASS-II used a constant-offset calibration correction, and Saffire S1 uses a range midpoint; S2 retains an approximate single value.`,
      citation: 'PSI-25 ReadMe, calibrated initial and final O2; PSI-98 experimental table',
    },
    {
      dimension: 'Gravity · per test',
      question: 'What gravity level applied to this specific test?',
      state:
        target.gravity === 'unspecified'
          ? 'absent'
          : gravityMeasured === records.length
            ? 'direct'
            : 'absent',
      finding:
        gravityMeasured === 0
          ? `No record carries a measured per-test gravity value. Microgravity is an investigation-level assignment; the corpus contains ${partialGravityKnown} partial-gravity records.`
          : `${gravityMeasured} of ${records.length} records carry a measured gravity value.`,
      citation: 'PSI-25 metadata (ISS microgravity); PSI-98 metadata (Cygnus microgravity); challenge page on PSI partial-gravity coverage',
    },
    {
      dimension: 'Material · specification',
      question: 'Is the material and geometry specified well enough to reproduce the sample?',
      state: materialMatches.length > 0 ? 'partial' : 'absent',
      finding:
        target.material === 'any'
          ? `Material family and dimensions are parsed from free-text fields. Thickness is available for ${records.filter((record) => record.thickness_mm.value !== null).length} of ${records.length} records, and ${records.filter((record) => record.material_family === 'Unknown').length} records have no identifiable material family.`
          : materialMatches.length > 0
            ? `${materialMatches.length} records share the parsed material family "${target.material}", but the source text is not a controlled material specification and geometry still varies.`
            : `No record matches the parsed material family "${target.material}". No material-equivalent evidence is available in this corpus.`,
      citation: 'PSI-25 experimental table, Fuel Sample Material; PSI-98 experimental table, Material and dimensions',
    },
    {
      dimension: 'Flow · velocity and direction',
      question: 'What flow velocity and direction acted on the sample?',
      state: flowKnown === 0 ? 'absent' : flowKnown === records.length ? 'partial' : 'partial',
      finding: `${flowKnown} of ${records.length} records report an air-flow display or setting. BASS-II display values have a response time of about one minute and were not calibrated per test; BASS-II also lacks a per-test flow-direction field.`,
      citation: 'PSI-25 ReadMe, Air display and Fan display; PSI-25 fan calibration workbook; PSI-98 experimental table',
    },
    {
      dimension: 'Ignition · source and energy',
      question: 'How was ignition initiated, at what power, and for how long?',
      state: ignitionKnown === 0 ? 'absent' : ignitionKnown === records.length ? 'partial' : 'partial',
      finding: `${ignitionKnown} of ${records.length} records report ignition power and time (both Saffire-I samples). Neither table states an ignition method.`,
      citation: 'PSI-98 experimental table, Ignition Power and Ignition Time; PSI-25 experimental table (no ignition columns)',
    },
    {
      dimension: 'Outcome · standardized classification',
      question: 'Did the sample ignite, sustain burning, spread, or extinguish under a defined criterion?',
      state: outcomeKnown === 0 ? 'absent' : 'partial',
      finding:
        outcomeKnown === 0
          ? 'No standardized extinction or sustained-burning outcome is present. Burn duration and free-text notes are not equivalent to a flammability classification.'
          : `${outcomeKnown} of ${records.length} records carry a standardized outcome.`,
      citation: 'PSI-25 experimental table; PSI-98 experimental table; PSI-25 ReadMe, Test Matrix explanation',
    },
  ];

  if (target.gravity === 'lunar' || target.gravity === 'mars') {
    evidence.push({
      dimension: 'Gravity · partial-gravity context',
      question: 'Is there any partial-gravity combustion evidence in scope?',
      state: 'context',
      finding:
        'LUCI flew a rotating sounding-rocket experiment at 11 RPM (1.22 m effective radius) and reported SIBAL and PMMA spread rates in simulated lunar gravity. It is context, not a PSI experiment record, and its data are not included as structured per-test records.',
      citation: 'NTRS 20250010653, pages 12, 16, 19–22',
    });
  }

  const requiredFields: RequiredField[] = [
    { field: 'Total pressure', unit: 'psia', why: 'Required to compute oxygen partial pressure and to place the test on any atmosphere plane.' },
    { field: 'Oxygen fraction', unit: '% by volume', why: 'Defines the oxidizer concentration; must be paired with pressure to be interpretable.' },
    { field: 'Gravity level and direction', unit: 'g, vector', why: 'Buoyant flow and flame geometry depend on gravity; an investigation label is not a measurement.' },
    { field: 'Flow velocity and direction', unit: 'cm/s, vector', why: 'Forced-flow extinction and spread depend on the velocity field, not a fan setting.' },
    { field: 'Material specification', unit: 'composition, thickness, geometry', why: 'A family name is not a reproducible sample specification.' },
    { field: 'Ignition method, power and duration', unit: 'method, W, s', why: 'Ignition energy changes the initial flame and must be controlled or reported.' },
    { field: 'Outcome definition and classification', unit: 'criterion', why: 'Without a stated criterion, burn duration cannot be compared across tests.' },
    { field: 'Measurement uncertainty', unit: 'per quantity', why: 'A single calibration offset does not supply per-sample uncertainty.' },
  ];

  const controls = [
    'Report pressure and oxygen as independent measured variables for every test; do not derive one from a cabin assumption.',
    'Measure gravity at the sample, including direction, rather than assigning it from the investigation.',
    'Calibrate flow at the sample location for each restrictor and day; record response time and steady-state criteria.',
    'Define ignition method, power, duration and location in a controlled field, not free text.',
    'Pre-register the outcome criterion (ignition, sustained burning, extinction) before testing.',
    'Preserve raw sensor values alongside corrected values and state the correction applied.',
    'Use the same instrument basis when comparing investigations; otherwise label the comparison as contextual.',
  ];

  const unsupportedClaims = [
    'That any material is safe or unsafe at the target atmosphere.',
    'That the target condition has been tested by BASS-II or Saffire-I.',
    'That oxygen partial pressure alone predicts ignition, spread or extinction.',
    'That microgravity results transfer directly to lunar or Martian gravity.',
    'That the corpus can certify a material, procedure or habitat atmosphere.',
    'That missing pressure values can be replaced with a nominal cabin pressure.',
  ];

  const partialPressurePsi = oxygenPartialPressure(target);
  const plan: GapPlan = {
    target,
    partialPressurePsi,
    evidence,
    requiredFields,
    controls,
    unsupportedClaims,
    markdown: '',
  };
  plan.markdown = planToMarkdown(plan);
  return plan;
}

export function planToMarkdown(plan: GapPlan): string {
  const { target } = plan;
  const lines: string[] = [
    '# FIRETRACE evidence-gap plan',
    '',
    '> Planning aid only. This is not a fire-risk prediction, a material certification, or a test protocol approved by NASA.',
    '',
    '## Target condition',
    '',
    `- Total pressure: ${target.pressurePsia} psia`,
    `- Oxygen fraction: ${target.oxygenPct}% by volume`,
    `- Oxygen partial pressure (Dalton calculation): ${plan.partialPressurePsi === null ? 'not calculable' : `${plan.partialPressurePsi.toFixed(2)} psi`}`,
    `- Gravity: ${gravityLabels[target.gravity]}`,
    `- Material of interest: ${target.material === 'any' ? 'any / not specified' : target.material}`,
    `- Flow: ${target.flowCmS === null ? 'not specified' : `${target.flowCmS} cm/s`}`,
    `- Objective: ${target.objective}`,
    '',
    '## What the current corpus can and cannot support',
    '',
    '| Dimension | State | Finding | Citation |',
    '| --- | --- | --- | --- |',
    ...plan.evidence.map(
      (row) =>
        `| ${row.dimension} | ${row.state} | ${row.finding.replaceAll('|', '/')} | ${row.citation.replaceAll('|', '/')} |`,
    ),
    '',
    '## Measurements to record for every test',
    '',
    ...plan.requiredFields.map((field) => `- **${field.field}** (${field.unit}) — ${field.why}`),
    '',
    '## Comparability controls',
    '',
    ...plan.controls.map((control) => `- ${control}`),
    '',
    '## Claims this plan does not support',
    '',
    ...plan.unsupportedClaims.map((claim) => `- ${claim}`),
    '',
    '## Provenance',
    '',
    'Corpus: BASS-II (PSI-25, 129 records, DOI 10.60555/4qc4-de67) and Saffire-I (PSI-98, 2 records, DOI 10.60555/0t15-1z43).',
    'Pressure and per-test gravity are absent from both experimental tables (0/131 each).',
    'Generated locally by FIRETRACE from the bundled evidence corpus; no external model was called.',
    '',
  ];
  return lines.join('\n');
}
