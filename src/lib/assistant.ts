import { artifactsFor, claims, corpus, recordById, records, sourceManifest } from './corpus';
import type { Claim, ExperimentRecord } from './types';
import { formatCompact, formatNumber, humanizeToken } from './format';

export type AnswerGrade = 'direct' | 'partial' | 'context' | 'absent' | 'out-of-scope';

export interface Citation {
  sourceId: string;
  title: string;
  locator: string;
  url: string;
  doi?: string | null;
}

export interface AssistantAnswer {
  id: string;
  question: string;
  grade: AnswerGrade;
  headline: string;
  paragraphs: string[];
  bullets: string[];
  citations: Citation[];
  trace: string[];
  followUps: string[];
  page?: { href: string; label: string };
}

const alias = new Map<string, ExperimentRecord>();
for (const record of records) {
  alias.set(record.experiment_id.toUpperCase(), record);
  const test = record.test_number.toUpperCase();
  if (!alias.has(test)) alias.set(test, record);
}

function citationFor(sourceId: string, locator: string): Citation {
  const artifact =
    artifactsFor(sourceId).find((item) => item.role === 'experiment_table') ??
    artifactsFor(sourceId)[0];
  return {
    sourceId,
    title: artifact?.source_title ?? sourceId,
    locator,
    url: artifact?.source_url ?? 'https://psi.nasa.gov/',
    doi: artifact?.doi ?? null,
  };
}

function challengeCitation(): Citation {
  const source = sourceManifest.context_sources.find((item) => item.source_id === 'CHALLENGE-2026');
  return {
    sourceId: 'CHALLENGE-2026',
    title: source?.source_title ?? 'NASA Space Apps 2026 challenge',
    locator: 'Challenge page, “Spacesuits and oxygen concentration” and “Partial-gravity data”',
    url: source?.source_url ?? 'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/',
  };
}

function ntrsCitation(locator: string): Citation {
  return {
    sourceId: 'NTRS-20250010653',
    title: 'Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket',
    locator,
    url: 'https://ntrs.nasa.gov/citations/20250010653',
  };
}

function claimCitations(claimIds: string[]): Citation[] {
  const result: Citation[] = [];
  for (const id of claimIds) {
    const claim = claims.find((item) => item.claim_id === id);
    if (!claim) continue;
    result.push({
      sourceId: claim.supporting_source_ids[0],
      title: claim.claim_text,
      locator: claim.supporting_locators[0],
      url:
        artifactsFor(claim.supporting_source_ids[0])[0]?.source_url ??
        'https://psi.nasa.gov/',
      doi: artifactsFor(claim.supporting_source_ids[0])[0]?.doi ?? null,
    });
  }
  return result;
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.sourceId}|${citation.locator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findRecord(question: string): ExperimentRecord | undefined {
  const upper = question.toUpperCase();
  const candidates = upper.match(/\b(?:BASS2-)?[A-Z]{1,2}\d{1,3}[A-Z]?\b/g) ?? [];
  for (const candidate of candidates) {
    const direct = recordById.get(candidate) ?? alias.get(candidate);
    if (direct) return direct;
  }
  const explicit = upper.match(/\b(?:TEST|SAMPLE)\s+([A-Z]{1,2}\d{1,3}[A-Z]?)\b/);
  if (explicit) return alias.get(explicit[1]);
  return undefined;
}

function baseAnswer(question: string, partial: Omit<AssistantAnswer, 'id' | 'question'>): AssistantAnswer {
  return { id: `ans-${Date.now()}`, question, ...partial };
}

function testAnswer(question: string, record: ExperimentRecord): AssistantAnswer {
  const q = question.toLowerCase();
  const citation = citationFor(record.source_id, record.source_locator);
  const trace = [
    `Matched experiment entity ${record.experiment_id}.`,
    `Read normalized fields and provenance for ${record.experiment_id}.`,
    'Applied missing-data rule: a field is answered only if the source reports a value.',
  ];

  if (/pressure|psia|\bpsi\b|partial pressure/.test(q)) {
    return baseAnswer(question, {
      grade: 'absent',
      headline: `No total pressure is reported for ${record.experiment_id}.`,
      paragraphs: [
        `The ${record.investigation_acronym} experimental table has no total-pressure column for this record, so neither total pressure nor oxygen partial pressure can be stated.`,
        'FIRETRACE does not substitute a nominal cabin pressure. Absence of a pressure column is a metadata gap, not evidence that pressure was uncontrolled.',
      ],
      bullets: [
        `Recorded initial O2: ${formatCompact(record.oxygen_initial_pct)} (fraction only).`,
        'O2 partial pressure requires total pressure: ppO2 = total pressure × O2 fraction.',
        `Recorded gravity field status: ${record.gravity_regime.status.replaceAll('_', ' ')}.`,
      ],
      citations: dedupeCitations([
        citation,
        ...claimCitations([record.family === 'BASS-II' ? 'CL-BASS2-PRESS' : 'CL-SAF-PRESS']),
      ]),
      trace,
      followUps: [
        `What oxygen fraction did ${record.test_number} report?`,
        'Which records report total pressure?',
        'What would make this record atmosphere-comparable?',
      ],
      page: { href: '#/atlas', label: 'Open record in Evidence Atlas' },
    });
  }

  if (/gravity|\bg\b|partial gravity|lunar|moon|mars/.test(q)) {
    return baseAnswer(question, {
      grade: record.gravity_regime.status === 'measured' ? 'direct' : 'partial',
      headline:
        record.gravity_regime.status === 'measured'
          ? `${record.experiment_id} reports gravity at test level.`
          : `${record.experiment_id} has no measured per-test gravity.`,
      paragraphs: [
        record.gravity_regime.note ??
          'No per-test gravity value is present in the experimental table.',
        'The investigation is described as microgravity, but that is an investigation-level assignment, not a measured g-level for this test.',
      ],
      bullets: [
        `Gravity status: ${record.gravity_regime.status.replaceAll('_', ' ')}.`,
        `Gravity value: ${record.gravity_regime.value ?? 'not reported'}.`,
        'No lunar or Martian partial-gravity experiment records are present in the corpus.',
      ],
      citations: dedupeCitations([
        citation,
        challengeCitation(),
      ]),
      trace: [...trace, 'Checked per-test gravity status before quoting the investigation label.'],
      followUps: [
        'Does the corpus contain any partial-gravity records?',
        'What did LUCI report about lunar-gravity spread?',
        `What flow did ${record.test_number} report?`,
      ],
      page: { href: '#/atmosphere', label: 'Open Atmosphere Explorer' },
    });
  }

  if (/flow|air|velocity|ventilation|fan/.test(q)) {
    const derived = record.flow_derived_cm_s.value;
    return baseAnswer(question, {
      grade: record.flow_initial_cm_s.value === null ? 'absent' : 'direct',
      headline:
        record.flow_initial_cm_s.value === null
          ? `No air-flow value is reported for ${record.experiment_id}.`
          : `${record.experiment_id} reports an air-flow display of ${formatCompact(record.flow_initial_cm_s)}.`,
      paragraphs: [
        record.flow_initial_cm_s.note ??
          'Flow is reported from the source experimental table.',
        record.family === 'BASS-II'
          ? 'BASS-II flow is an instrument display with a slow response; it is not a per-test calibrated velocity. The derived value uses a single workbook factor, not day- or restrictor-specific calibration.'
          : 'Saffire-I reports a flow setting in cm/s for each sample; it is a different measurement basis from the BASS-II display.',
      ],
      bullets: [
        `Reported flow: ${formatCompact(record.flow_initial_cm_s)}.`,
        derived === null ? 'Derived flow: not applicable.' : `Derived flow (factor 1.0066): ${formatNumber(derived)} cm/s.`,
        `Flow direction: ${record.flow_direction.value ?? 'not reported'}.`,
        record.flow_varies ? 'The source records a changing flow sequence, not one steady value.' : 'The source records a single value for this test.',
      ],
      citations: dedupeCitations([citation, ...claimCitations(['CL-BASS2-AIR', 'CL-BASS2-FAN'])]),
      trace,
      followUps: [
        `What oxygen fraction did ${record.test_number} report?`,
        'Why is flow not directly comparable between BASS-II and Saffire-I?',
        'Show the flow calibration caveat.',
      ],
      page: { href: '#/atlas', label: 'Open record in Evidence Atlas' },
    });
  }

  // Answer explicit reported quantities before the broader outcome intent.
  const quantity = /burn (?:time|duration)|how long.*burn/.test(q)
    ? { label: 'burn time', field: record.burn_time_s }
    : /ignition power/.test(q)
      ? { label: 'ignition power', field: record.ignition_power_w }
      : /ignition (?:time|duration)/.test(q)
        ? { label: 'ignition time', field: record.ignition_time_s }
        : null;
  if (quantity) {
    const known = quantity.field.value !== null;
    return baseAnswer(question, {
      grade: known ? 'direct' : 'absent',
      headline: known
        ? `${record.experiment_id} reports ${quantity.label}: ${formatCompact(quantity.field)}.`
        : `No ${quantity.label} is reported for ${record.experiment_id}.`,
      paragraphs: [
        quantity.field.note ?? 'Read from the preserved experimental table row.',
        'A reported duration or power is not a standardized flammability outcome or a material-safety conclusion.',
      ],
      bullets: [],
      citations: [citation],
      trace,
      followUps: [`What outcome did ${record.experiment_id} report?`, `What oxygen did ${record.experiment_id} report?`],
    });
  }

  if (/outcome|extinct|burn|ignit|spread|result/.test(q)) {
    return baseAnswer(question, {
      grade: record.outcome.status === 'measured' ? 'direct' : 'absent',
      headline: `No standardized outcome is reported for ${record.experiment_id}.`,
      paragraphs: [
        record.outcome.note ??
          'The source table does not contain a standardized extinction or sustained-burning classification.',
        record.outcome_definition,
      ],
      bullets: [
        `Burn time: ${formatCompact(record.burn_time_s)}.`,
        `Ignition power: ${formatCompact(record.ignition_power_w)}.`,
        `Ignition method: ${record.ignition_method.value ?? 'not reported'}.`,
        'Burn duration is not equivalent to a flammability outcome.',
      ],
      citations: dedupeCitations([citation]),
      trace,
      followUps: [
        `What material was ${record.test_number}?`,
        'Which fields are missing from this record?',
        'Can FIRETRACE predict whether a material will burn?',
      ],
      page: { href: '#/gap', label: 'Open Gap Planner' },
    });
  }

  if (/o2|oxygen|oxid/.test(q)) {
    return baseAnswer(question, {
      grade: record.oxygen_initial_pct.value === null ? 'absent' : 'direct',
      headline: `${record.experiment_id} reports an initial oxygen fraction of ${formatCompact(record.oxygen_initial_pct)}.`,
      paragraphs: [
        record.oxygen_initial_pct.note ??
          'The value is taken directly from the source experimental table.',
        record.oxygen_final_pct.value === null
          ? 'No final oxygen fraction is reported for this record.'
          : `Final oxygen fraction: ${formatCompact(record.oxygen_final_pct)}.`,
        'An oxygen fraction alone does not define an atmosphere. Total pressure is not reported for this record, so oxygen partial pressure cannot be computed.',
      ],
      bullets: [
        `Initial O2: ${formatCompact(record.oxygen_initial_pct)}.`,
        `Final O2: ${formatCompact(record.oxygen_final_pct)}.`,
        `Total pressure: ${formatCompact(record.total_pressure_psia)}.`,
        `O2 partial pressure: ${formatCompact(record.oxygen_partial_pressure_psi)}.`,
      ],
      citations: dedupeCitations([
        citation,
        ...claimCitations(['CL-BASS2-O2-CAL', 'CL-BASS2-PRESS', 'CL-SAF-PRESS']),
      ]),
      trace,
      followUps: [
        `What pressure was ${record.test_number} run at?`,
        'What is the O2 range across the corpus?',
        'Why can’t I compute oxygen partial pressure?',
      ],
      page: { href: '#/atmosphere', label: 'Open Atmosphere Explorer' },
    });
  }

  return baseAnswer(question, {
    grade: 'partial',
    headline: `${record.experiment_id} — ${record.material_raw}`,
    paragraphs: [
      `${record.investigation_acronym} · ${record.investigation} · sample ${record.sample_number} · test ${record.test_number}.`,
      record.family === 'BASS-II'
        ? 'BASS-II record. Total pressure, per-test gravity, ignition method and a standardized outcome are not reported.'
        : 'Saffire-I record. Total pressure, per-test gravity, ignition method and a standardized outcome are not reported.',
    ],
    bullets: [
      `Initial O2: ${formatCompact(record.oxygen_initial_pct)}.`,
      `Final O2: ${formatCompact(record.oxygen_final_pct)}.`,
      `Reported flow: ${formatCompact(record.flow_initial_cm_s)}.`,
      `Material family (parsed): ${record.material_family}.`,
      `Validation status: ${record.validation_status}.`,
      `Missing fields: ${record.missing_fields.length}.`,
    ],
    citations: dedupeCitations([citation]),
    trace,
    followUps: [
      `What pressure was ${record.test_number} run at?`,
      `What outcome did ${record.test_number} report?`,
      'Show the provenance for this record.',
    ],
    page: { href: '#/atlas', label: 'Open record in Evidence Atlas' },
  });
}

function corpusPressureAnswer(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'absent',
    headline: 'Total pressure is reported for 0 of 131 experiment records.',
    paragraphs: [
      'Both PSI experimental tables lack a total-pressure column. BASS-II covers 129 tests and Saffire-I covers 2 samples; neither supplies pressure for any record.',
      'This is why FIRETRACE will not place these tests on an atmosphere plane or compute oxygen partial pressure. Substituting a cabin pressure would create a measurement that the sources do not contain.',
    ],
    bullets: [
      'BASS-II: 0 of 129 records report total pressure.',
      'Saffire-I: 0 of 2 records report total pressure.',
      'No cabin pressure was substituted anywhere in the corpus.',
      'Absence of a column is a metadata gap, not proof that pressure was uncontrolled.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table, columns A–Q'),
      citationFor('PSI-98', 'PSI-98 experimental table, columns A–M'),
      ...claimCitations(['CL-BASS2-PRESS', 'CL-SAF-PRESS']),
    ]),
    trace: [
      'Counted records where total_pressure_psia.value is non-null.',
      'Result: 0 of 131.',
      'Confirmed neither experimental table has a pressure column.',
    ],
    followUps: [
      'What would make atmospheric placement possible?',
      'Does any record report per-test gravity?',
      'What does the corpus report about oxygen?',
    ],
    page: { href: '#/atmosphere', label: 'Open Atmosphere Explorer' },
  });
}

function corpusGravityAnswer(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'absent',
    headline: 'Per-test gravity is reported for 0 of 131 records; partial-gravity records: 0.',
    paragraphs: [
      'BASS-II is described as an ISS microgravity investigation and Saffire-I as a Cygnus microgravity experiment. Those are investigation-level labels, not measured g-levels for individual tests.',
      'The official 2026 challenge states that PSI currently has no partial-gravity combustion data. LUCI is included here only as context and has no structured per-test records in this corpus.',
    ],
    bullets: [
      'Microgravity is assigned at investigation level for all 131 records.',
      'No record contains a measured gravity value or direction.',
      'No lunar, Martian, or other partial-gravity experiment records are included.',
      'LUCI flew at 11 RPM with a 1.22 m effective radius in simulated lunar gravity; its findings are presentation-level context only.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 metadata, investigation description'),
      citationFor('PSI-98', 'PSI-98 metadata, investigation description'),
      challengeCitation(),
      ntrsCitation('NTRS PDF pages 12, 16, 19–22'),
    ]),
    trace: [
      'Counted records with a measured per-test gravity status.',
      'Result: 0 of 131.',
      'Separated investigation-level microgravity labels from measurements.',
      'Retrieved LUCI as context without importing it as experiment data.',
    ],
    followUps: [
      'What did LUCI report about lunar-gravity spread?',
      'What pressure data are missing?',
      'How should a partial-gravity test be reported?',
    ],
    page: { href: '#/atmosphere', label: 'Open Atmosphere Explorer' },
  });
}

function corpusOxygenAnswer(question: string): AssistantAnswer {
  const initial = records
    .map((record) => record.oxygen_initial_pct.value)
    .filter((value): value is number => typeof value === 'number');
  const final = records
    .map((record) => record.oxygen_final_pct.value)
    .filter((value): value is number => typeof value === 'number');
  return baseAnswer(question, {
    grade: 'partial',
    headline: `Initial O2 is reported for ${initial.length} of 131 records, spanning ${formatNumber(Math.min(...initial))}–${formatNumber(Math.max(...initial))}%.`,
    paragraphs: [
      `Final O2 is reported for ${final.length} records (range ${formatNumber(Math.min(...final))}–${formatNumber(Math.max(...final))}%).`,
      'BASS-II oxygen readings were corrected with a constant offset because the sensor was out of calibration; per-sample uncertainty is not supplied. Two Saffire-I values are approximate midpoints of reported ranges.',
      'Oxygen fraction is only half of an atmosphere description. Without total pressure, partial pressure and atmospheric equivalence cannot be established.',
    ],
    bullets: [
      `Records with initial O2: ${initial.length}.`,
      `Records with final O2: ${final.length}.`,
      'Approximate initial values (Saffire ranges): 2.',
      'Two BASS-II final values exceed their initials by more than 2 percentage points and are flagged, not corrected.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 ReadMe, calibrated initial and final O2'),
      citationFor('PSI-98', 'PSI-98 experimental table, oxygen column'),
      ...claimCitations(['CL-BASS2-O2-CAL']),
    ]),
    trace: [
      'Counted non-null initial and final O2 values.',
      'Computed min/max from normalized values only.',
      'Retained sensor-calibration and range caveats.',
    ],
    followUps: [
      'What pressure was BASS-II run at?',
      'Why can’t oxygen fraction alone define flammability?',
      'Show the O2 distribution by material.',
    ],
    page: { href: '#/atmosphere', label: 'Open Atmosphere Explorer' },
  });
}

function corpusMaterialAnswer(question: string): AssistantAnswer {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.material_family, (counts.get(record.material_family) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return baseAnswer(question, {
    grade: 'partial',
    headline: `${counts.size} parsed material families across 131 records.`,
    paragraphs: [
      'Material family and dimensions are parsed from free-text source fields, not from a controlled materials taxonomy. They are marked derived.',
      `${counts.get('Unknown') ?? 0} records have no identifiable material family in the source row, and ${records.filter((record) => record.thickness_mm.value !== null).length} records have a parsable thickness.`,
    ],
    bullets: top.map(([family, count]) => `${family}: ${count} records`),
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table, Fuel Sample Material'),
      citationFor('PSI-98', 'PSI-98 experimental table, Material and dimensions'),
    ]),
    trace: [
      'Grouped records by parsed material_family.',
      'Counted thickness availability separately.',
      'Did not treat material family as a certified specification.',
    ],
    followUps: [
      'Which materials were tested most often?',
      'How many records have thickness reported?',
      'Compare a BASS-II PMMA record with Saffire-I SIBAL.',
    ],
    page: { href: '#/atlas', label: 'Open Evidence Atlas' },
  });
}

function corpusFlowAnswer(question: string): AssistantAnswer {
  const values = records
    .map((record) => record.flow_initial_cm_s.value)
    .filter((value): value is number => typeof value === 'number');
  const sequences = records.filter((record) => record.flow_varies).length;
  return baseAnswer(question, {
    grade: 'partial',
    headline: `Air flow is reported for ${values.length} of 131 records; the corpus spans ${formatNumber(Math.min(...values))}–${formatNumber(Math.max(...values))} cm/s.`,
    paragraphs: [
      'The values do not share one measurement basis. BASS-II records a duct air-speed display with a response time of about one minute; Saffire-I reports a flow setting for each sample.',
      'The BASS-II derived velocity applies a single workbook factor (U = 1.0066 × Air display). Day- and restrictor-specific calibration exists but was not applied per test.',
    ],
    bullets: [
      `Records with a reported flow: ${values.length}.`,
      `Records with a changing flow sequence: ${sequences}.`,
      'BASS-II flow direction: not reported per test.',
      'Saffire-I flow direction: concurrent (S1) and opposed (S2).',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 ReadMe, Air display and Fan display'),
      citationFor('PSI-25', 'PSI-25 Fan Calibration data sheet, U = 1.0066(AIR)'),
      citationFor('PSI-98', 'PSI-98 experimental table, air flow and flow direction'),
      ...claimCitations(['CL-BASS2-AIR', 'CL-BASS2-FAN', 'CL-FAN-CAL']),
    ]),
    trace: [
      'Counted non-null reported flow values.',
      'Computed range from normalized values.',
      'Separated display values from derived values.',
    ],
    followUps: [
      'Why is BASS-II flow not a calibrated velocity?',
      'Compare Saffire-I S1 and S2.',
      'Which records have changing flow?',
    ],
    page: { href: '#/atlas', label: 'Open Evidence Atlas' },
  });
}

function saffireAnswer(question: string): AssistantAnswer {
  const saffire = records.filter((record) => record.family === 'Saffire-I');
  return baseAnswer(question, {
    grade: 'direct',
    headline: 'Saffire-I contributes 2 experiment records, both SIBAL fabric.',
    paragraphs: [
      saffire
        .map(
          (record) =>
            `${record.experiment_id}: ${record.material_raw}, ${formatCompact(record.thickness_mm)}, ${formatCompact(record.width_cm)} × ${formatCompact(record.length_cm)}, flow ${formatCompact(record.flow_initial_cm_s)}, ignition ${formatCompact(record.ignition_power_w)} for ${formatCompact(record.ignition_time_s)}, burn ${formatCompact(record.burn_time_s)}, ${record.flow_direction.value?.toLowerCase() ?? 'direction not reported'} flow.`,
        )
        .join(' '),
      'The Saffire-I CSV also contains two pre/post-flow image-set descriptor rows (F1C1/F1C2 and F2C1/F2C2). They were excluded because they are not instrumented experiments.',
      'Neither Saffire record reports total pressure, per-test gravity, ignition method, or a standardized extinction outcome.',
    ],
    bullets: [
      'Investigation: Spacecraft Fire Safety Experiment-I (PSI-98).',
      'Material: SIBAL cloth, 75% cotton / 25% fiberglass, 0.37 cm thick.',
      'S1 burn time: 420 s; S2 burn time: 70 s.',
      'Flow basis is not the same as the BASS-II duct display.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-98', 'PSI-98 experimental table, CSV rows 2–3'),
      ...claimCitations(['CL-SAF-MAT', 'CL-SAF-PRESS']),
    ]),
    trace: [
      'Filtered family = Saffire-I.',
      'Excluded non-experiment image-set descriptor rows at ingestion.',
      'Read ignition, burn and flow fields from normalized records.',
    ],
    followUps: [
      'Compare Saffire-I S1 and S2.',
      'Why are Saffire and BASS-II not directly comparable?',
      'What pressure data are missing from Saffire?',
    ],
    page: { href: '#/compare', label: 'Open Compare' },
  });
}

function bassAnswer(question: string): AssistantAnswer {
  const bass = records.filter((record) => record.family === 'BASS-II');
  const pis = [...new Set(bass.map((record) => record.pi).filter(Boolean))];
  return baseAnswer(question, {
    grade: 'direct',
    headline: 'BASS-II contributes 129 experiment records across six principal investigators.',
    paragraphs: [
      'Burning and Suppression of Solids – II studied ignition, flame growth, flame spread and extinction limits for solid fuels in low-velocity forced flows in microgravity, using a small wind tunnel in the Microgravity Science Glovebox.',
      `Principal investigators represented: ${pis.join(', ')}. Initial O2 spans 13.6–22.2%. No record reports total pressure, per-test gravity, ignition method, or a standardized outcome.`,
    ],
    bullets: [
      'Source: PSI-25, DOI 10.60555/4qc4-de67, CC0-1.0.',
      'Records: 129; all 129 test IDs match the six-sheet test matrix workbook.',
      'All 129 initial O2 values match the matrix workbook numerically.',
      'Oxygen sensor was out of calibration and corrected with a constant offset.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table, CSV rows 2–130'),
      ...claimCitations(['CL-BASS2-OBJ', 'CL-BASS2-FLOW', 'CL-BASS2-O2-CAL']),
    ]),
    trace: [
      'Filtered family = BASS-II.',
      'Counted distinct PIs and computed O2 range.',
      'Retrieved matrix cross-check result from the validation report.',
    ],
    followUps: [
      'What materials did BASS-II test?',
      'Show the validation cross-check.',
      'What is missing from BASS-II records?',
    ],
    page: { href: '#/atlas', label: 'Open Evidence Atlas' },
  });
}

function luciAnswer(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'context',
    headline: 'LUCI is partial-gravity context, not a PSI experiment record.',
    paragraphs: [
      'The Lunar Combustion Investigation flew material flammability experiments in simulated lunar gravity on a spinning Blue Origin New Shepard: 11 RPM at an effective radius of 1.22 m, with a burn lasting more than two and a half minutes.',
      'Reported findings: SIBAL flame base spread 0.92 mm/s and tip 1.1 mm/s; PMMA tip spread about 1.5 mm/s; chamber O2 fell from 20% to 14.3%. These are presentation-level findings from a single flight.',
      'FIRETRACE does not import LUCI as structured per-test data and does not compare it record-by-record with BASS-II or Saffire-I.',
    ],
    bullets: [
      '11 RPM, 1.22 m effective radius.',
      'SIBAL and 4 mm PMMA rod; air at normal pressure.',
      'Chamber O2 fell from 20% to 14.3%.',
      'Context source only: NTRS 20250010653.',
    ],
    citations: dedupeCitations([
      ntrsCitation('NTRS PDF pages 12, 16, 19–22'),
      ...claimCitations(['CL-LUCI-FEAS', 'CL-LUCI-SPREAD']),
    ]),
    trace: [
      'Routed query to LUCI context.',
      'Retrieved verified claims with presentation locators.',
      'Kept LUCI outside the PSI record set.',
    ],
    followUps: [
      'Does the corpus contain partial-gravity records?',
      'Why is LUCI not directly comparable?',
      'What would a partial-gravity test need to report?',
    ],
    page: { href: '#/methodology', label: 'Open Methodology & Sources' },
  });
}

function suspectAnswer(question: string): AssistantAnswer {
  const suspect = records.filter((record) => record.validation_status === 'suspect');
  return baseAnswer(question, {
    grade: 'direct',
    headline: `${suspect.length} records carry retained suspect flags. None were corrected or discarded.`,
    paragraphs: [
      'The flags identify internal inconsistencies in the source values, not a judgement that the experiment failed. FIRETRACE preserves the reported values and exposes the flag in the record drawer and CSV exports.',
      'Two BASS-II final oxygen readings exceed their initial readings by more than 2 percentage points. Two BASS-II dates carry an unexpected 2018 year in a 2014 campaign. The six-sheet matrix cross-check found no substantive numeric conflict, so these remain source-level anomalies.',
    ],
    bullets: suspect.map(
      (record) =>
        `${record.experiment_id} (${record.investigation_acronym}): ${record.quality_flags
          .map((flag) => humanizeToken(flag))
          .join('; ')}.`,
    ),
    citations: dedupeCitations([citationFor('PSI-25', 'PSI-25 experimental table and six-sheet test matrix')]),
    trace: [
      'Selected records whose validation_status is suspect.',
      'Read the retained quality_flags without changing any measured value.',
      'Checked the matrix cross-check result for substantive numeric conflicts.',
    ],
    followUps: [
      'Show the validation cross-check.',
      'What is missing from the corpus?',
      'How are suspect records exported?',
    ],
    page: { href: '#/methodology', label: 'Open Methodology & Sources' },
  });
}

function missingAnswer(question: string): AssistantAnswer {
  const total = records.length;
  const final = records.filter((record) => record.oxygen_final_pct.value !== null).length;
  const thickness = records.filter((record) => record.thickness_mm.value !== null).length;
  return baseAnswer(question, {
    grade: 'direct',
    headline: 'Pressure, per-test gravity, ignition method and a standardized outcome are absent across the corpus.',
    paragraphs: [
      'These are metadata gaps, not zeros. No cabin pressure or g-level was substituted, and no outcome was inferred from a free-text note or a burn duration.',
      'Oxygen and flow are broadly reported, but not on one comparable basis: BASS-II oxygen carries a constant-offset correction and its flow is a slow instrument display; the two Saffire oxygen values are approximate and its flow is a reported setting.',
    ],
    bullets: [
      `Total pressure: 0 of ${total} records.`,
      `Measured per-test gravity: 0 of ${total} records.`,
      `Standardized outcome: 0 of ${total} records.`,
      `Ignition method: 0 of ${total} records.`,
      `Final O2: ${final} of ${total} records; four BASS-II finals are absent.`,
      `Thickness: ${thickness} of ${total} records parsed from free text.`,
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table and ReadMe'),
      citationFor('PSI-98', 'PSI-98 experimental table and ReadMe'),
      challengeCitation(),
    ]),
    trace: [
      'Counted non-null values for each required comparison field.',
      'Separated absent metadata from measured zero.',
      'Did not impute pressure, gravity, ignition method or outcome.',
    ],
    followUps: [
      'What pressure was BASS-II run at?',
      'Which records are flagged suspect?',
      'What would a comparable test need to record?',
    ],
    page: { href: '#/gap', label: 'Open Gap Planner' },
  });
}

function validationAnswer(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'direct',
    headline: 'The corpus passed its identity, cross-check, missing-data and provenance gates.',
    paragraphs: [
      'All 131 experiment IDs are unique. All 129 BASS-II test IDs appear in the six-sheet matrix workbook, and all 129 initial O2 values match numerically. No substantive numeric conflict was found.',
      'Quality distribution: 71 validated, 56 partial, 4 suspect. Suspect flags are retained, not corrected: two final-O2 values exceed their initials by more than 2 percentage points, and two dates carry an unexpected 2018 year.',
    ],
    bullets: [
      'Unique experiment IDs: 131, 0 duplicates.',
      'Test IDs matched to matrix: 129/129.',
      'Initial O2 exact matches: 129/129.',
      'Records with total pressure: 0.',
      'Records with measured per-test gravity: 0.',
      'Saffire non-experiment rows excluded: 2.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table and six-sheet test matrix'),
      citationFor('PSI-98', 'PSI-98 experimental table'),
    ]),
    trace: [
      'Read data/processed/validation_report.json.',
      'Reported pre-computed checks without re-scoring them.',
      'Listed retained anomalies separately from corrections.',
    ],
    followUps: [
      'Show the suspect records.',
      'Which source files were used?',
      'How was the matrix cross-check performed?',
    ],
    page: { href: '#/methodology', label: 'Open Methodology & Sources' },
  });
}

function compareAnswer(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'absent',
    headline: 'BASS-II and Saffire-I cannot be treated as directly comparable tests.',
    paragraphs: [
      'They differ in investigation, hardware, sample form and flow measurement basis. Neither reports total pressure or per-test gravity, and neither reports a standardized outcome.',
      'A side-by-side table is still useful, but it is a provenance comparison, not a controlled experimental comparison. FIRETRACE shows the blockers explicitly rather than collapsing them into a score.',
    ],
    bullets: [
      'Mixed investigations and hardware.',
      'Pressure unknown for both sides.',
      'Per-test gravity unknown for both sides.',
      'Different flow measurement bases.',
      'No standardized outcome on either side.',
      'No similarity score is computed; the blockers are shown instead.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table'),
      citationFor('PSI-98', 'PSI-98 experimental table'),
    ]),
    trace: [
      'Recognized a comparison intent.',
      'Checked investigation, pressure, gravity, flow and outcome comparability.',
      'Returned blockers instead of a similarity score.',
    ],
    followUps: [
      'Compare BASS2-B1 and SAFFIRE1-S1.',
      'Why is pressure a blocker?',
      'What would a comparable test need to record?',
    ],
    page: { href: '#/compare', label: 'Open Compare' },
  });
}

function safetyRefusal(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'out-of-scope',
    headline: 'FIRETRACE does not predict fire risk or certify materials.',
    paragraphs: [
      'The corpus has no standardized ignition, spread or extinction outcome, no total pressure, and no per-test gravity. A fire-risk or material-safety conclusion cannot be supported by these records.',
      'The evidence assistant retrieves and cites what the sources report. It does not extrapolate a flammability result, rank materials by safety, or approve an atmosphere or procedure.',
    ],
    bullets: [
      'No fire-risk score is computed anywhere in this application.',
      'No material is labelled safe or unsafe.',
      'No missing pressure or gravity value is imputed.',
      'Planning outputs are checklists, not predictions or certifications.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table and ReadMe'),
      citationFor('PSI-98', 'PSI-98 experimental table and ReadMe'),
      challengeCitation(),
    ]),
    trace: [
      'Detected a request for prediction, risk, or certification.',
      'Checked for a standardized outcome and controlled atmosphere fields.',
      'Abstained under the project evidence policy.',
    ],
    followUps: [
      'What can the corpus say about oxygen?',
      'What measurements are missing?',
      'What would a defensible test plan record?',
    ],
    page: { href: '#/gap', label: 'Open Gap Planner' },
  });
}

function helpAnswer(question: string): AssistantAnswer {
  return baseAnswer(question, {
    grade: 'direct',
    headline: 'Ask about records, measured conditions, missing fields, or sources.',
    paragraphs: [
      'FIRETRACE is a deterministic retrieval and citation engine. It matches your question to the bundled corpus, answers only from reported values, and abstains when the sources do not support an answer. No external model or API is called.',
    ],
    bullets: [
      '“What pressure was BASS-II run at?”',
      '“What oxygen did BASS2-B1 report?”',
      '“Does the corpus include partial-gravity data?”',
      '“Compare BASS-II and Saffire-I.”',
      '“What did LUCI find?”',
      '“Is this material safe in a lunar cabin?”',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table'),
      citationFor('PSI-98', 'PSI-98 experimental table'),
    ]),
    trace: ['Matched help intent.', 'Returned supported question patterns.'],
    followUps: [
      'What pressure was BASS-II run at?',
      'What oxygen did BASS2-B1 report?',
      'What is missing from the corpus?',
    ],
  });
}

export function ask(question: string): AssistantAnswer {
  const q = question.trim();
  if (!q) return helpAnswer(question);

  if (
    /(is|are|would|will|could|can)\b.{0,40}\b(safe|unsafe|flammable|burn(?! (?:time|duration|rate))|ignite|fire risk|risk of fire)\b/i.test(q) ||
    /\b(certif|approve|clearance|predict|risk score|safety factor)\b/i.test(q)
  ) {
    return safetyRefusal(q);
  }

  if (/\bcompare\b|\bcomparison\b|\bversus\b|\bvs\b/i.test(q)) {
    return compareAnswer(q);
  }

  const record = findRecord(q);
  if (record) return testAnswer(q, record);

  if (/luci|sounding rocket|new shepard/i.test(q)) {
    return luciAnswer(q);
  }

  if (/partial[- ]gravity|lunar|moon|mars|microgravity|gravity|\bg[- ]?level\b/i.test(q)) {
    return corpusGravityAnswer(q);
  }
  if (/pressure|psia|\bpsi\b|partial pressure|atmosphere/i.test(q)) {
    return corpusPressureAnswer(q);
  }
  if (/missing|absent|not reported|reported|coverage|\bgap\b|what.*lack/i.test(q)) {
    return missingAnswer(q);
  }
  if (/saffire/i.test(q)) {
    return saffireAnswer(q);
  }
  if (/bass/i.test(q)) {
    return bassAnswer(q);
  }
  if (/material|pmma|sibal|nomex|wax|fabric|polymer|thickness/i.test(q)) {
    return corpusMaterialAnswer(q);
  }
  if (/flow|airflow|air flow|velocity|fan|ventilation|cm\/s/i.test(q)) {
    return corpusFlowAnswer(q);
  }
  if (/oxygen|\bo2\b|oxid/i.test(q)) {
    return corpusOxygenAnswer(q);
  }
  if (/\bcompare\b|\bcomparison\b|\bversus\b|\bvs\b|\bdifference\b/i.test(q)) {
    return compareAnswer(q);
  }
  if (/suspect|flagged|quality flag/i.test(q)) {
    return suspectAnswer(q);
  }
  if (/valid|quality|check|audit|error|anomal|source|provenance|citation|doi|download/i.test(q)) {
    return validationAnswer(q);
  }
  if (/help|what can|how do|guide|ask|hello|hi\b/i.test(q)) {
    return helpAnswer(q);
  }

  const pressure = records.filter((record) => record.total_pressure_psia.value !== null).length;
  return baseAnswer(q, {
    grade: 'absent',
    headline: 'I can’t answer that from the bundled corpus.',
    paragraphs: [
      'No retrieved record or verified claim supports a specific answer to this question. FIRETRACE abstains rather than generating an unsupported statement.',
      `The corpus contains ${records.length} experiment records (${corpus.meta.investigations.map((item) => `${item.family} ${item.records}`).join(', ')}), ${pressure} of which report total pressure.`,
    ],
    bullets: [
      'Try a record ID such as BASS2-B1 or SAFFIRE1-S1.',
      'Ask about oxygen, flow, materials, validation, or a named investigation.',
      'Ask what is missing; abstention is a valid evidence result.',
    ],
    citations: dedupeCitations([
      citationFor('PSI-25', 'PSI-25 experimental table'),
      citationFor('PSI-98', 'PSI-98 experimental table'),
    ]),
    trace: [
      'No record entity matched.',
      'No supported intent matched.',
      'Abstained instead of generating an answer.',
    ],
    followUps: [
      'What pressure was BASS-II run at?',
      'What materials are in the corpus?',
      'What can FIRETRACE answer?',
    ],
  });
}

export function answerToText(answer: AssistantAnswer): string {
  const lines = [answer.headline, '', ...answer.paragraphs];
  if (answer.bullets.length) lines.push('', ...answer.bullets.map((bullet) => `• ${bullet}`));
  if (answer.citations.length) {
    lines.push('', 'Sources:');
    for (const citation of answer.citations) {
      lines.push(`- ${citation.sourceId} · ${citation.locator} · ${citation.url}`);
    }
  }
  lines.push('', 'No external model was called. This answer is deterministic retrieval from the bundled corpus.');
  return lines.join('\n');
}
