import { describe, expect, it } from 'vitest';
import { records, recordById, recordCitation } from '../src/lib/corpus';
import {
  comparisonRows,
  convertUnit,
  defaultScenario,
  evaluateCondition,
  rankCandidates,
  researchGaps,
  scenarioFromRecord,
  validateScenario,
  weights,
} from '../src/lib/scenario';
import type { Scenario } from '../src/lib/scenario';
import { decodePlannerState } from '../src/lib/scenarioState';
const b1 = recordById.get('BASS2-B1')!;
const s1 = recordById.get('SAFFIRE1-S1')!;
const s2 = recordById.get('SAFFIRE1-S2')!;
const empty: Scenario = {
  material: '',
  geometry: '',
  oxygen: null,
  pressure: null,
  gravity: '',
  flow: null,
  method: '',
  investigation: '',
  direction: '',
  thickness: null,
};

describe('scenario validation', () => {
  it('validates a meaningful target and refuses empty conditions', () => {
    expect(validateScenario(defaultScenario)).toEqual([]);
    expect(validateScenario(empty)).toHaveLength(1);
  });
  it.each([
    ['oxygen', -1],
    ['oxygen', 101],
    ['oxygen', NaN],
    ['pressure', 0],
    ['pressure', Infinity],
    ['pressure', 501],
    ['flow', -1],
    ['thickness', 0],
    ['thickness', 1001],
  ] as const)('rejects invalid %s=%s', (key, value) => {
    expect(validateScenario({ ...defaultScenario, [key]: value }).length).toBeGreaterThan(0);
  });
  it('rejects unsupported gravity and allows hypothetical material', () => {
    expect(validateScenario({ ...defaultScenario, gravity: 'made-up' })).not.toHaveLength(0);
    expect(validateScenario({ ...empty, material: 'Cotton' })).toEqual([]);
  });
});

describe('units and scientific condition semantics', () => {
  it.each([
    [1, 'kPa', 'psia', 1 / 6.894757293168],
    [0.2, 'm/s', 'cm/s', 20],
    [0.37, 'cm', 'mm', 3.7],
    [0.215, 'fraction', '% by vol', 21.5],
  ] as const)('converts %s %s to %s', (value, from, to, expected) => {
    expect(convertUnit(value, from, to)).toBeCloseTo(expected, 10);
  });
  it('refuses incompatible or nonfinite quantities', () => {
    expect(convertUnit(1, 'kPa', 'cm/s')).toBeNull();
    expect(convertUnit(NaN, 'mm', 'mm')).toBeNull();
  });
  it('retains real corrected B1 oxygen and its source row', () => {
    const e = evaluateCondition(b1, { ...empty, oxygen: 22.2 }, 'oxygen');
    expect(e.relation).toBe('exact');
    expect(e.status).toBe('corrected');
    expect(e.experimental).toBe(22.2);
    expect(e.locator).toContain('CSV row 2');
    expect(e.note).toContain('corrected');
  });
  it('separates nearby retrieval tolerance from a difference', () => {
    expect(evaluateCondition(b1, { ...empty, oxygen: 22.3 }, 'oxygen').relation).toBe('tolerance');
    expect(evaluateCondition(b1, { ...empty, oxygen: 30 }, 'oxygen').relation).toBe('different');
  });
  it('never grants pressure or contextual gravity match credit', () => {
    expect(evaluateCondition(b1, defaultScenario, 'pressure')).toMatchObject({
      relation: 'missing',
      experimental: null,
      credit: 0,
    });
    expect(evaluateCondition(b1, { ...empty, gravity: 'microgravity' }, 'gravity')).toMatchObject({
      relation: 'context',
      credit: 0,
    });
  });
  it('preserves Saffire range bounds rather than matching its midpoint exactly', () => {
    expect(evaluateCondition(s1, { ...empty, oxygen: 21.6 }, 'oxygen')).toMatchObject({
      relation: 'approximate',
      credit: 0.5,
      raw: '21.5 - 21.7',
    });
    expect(evaluateCondition(s1, { ...empty, oxygen: 21.8 }, 'oxygen').relation).toBe('different');
    expect(evaluateCondition(s2, { ...empty, oxygen: 21.5 }, 'oxygen').relation).toBe(
      'approximate',
    );
  });
  it('keeps parsed sample thickness distinct from reported measurements', () => {
    expect(evaluateCondition(b1, { ...empty, thickness: 0.1 }, 'thickness').relation).toBe(
      'approximate',
    );
    expect(evaluateCondition(s1, { ...empty, thickness: 3.7 }, 'thickness').relation).toBe('exact');
  });
  it('does not equate PMMA geometries or unlike materials', () => {
    expect(evaluateCondition(b1, { ...empty, material: 'PMMA rod' }, 'material').relation).toBe(
      'different',
    );
    expect(evaluateCondition(b1, { ...empty, geometry: 'Rod/cylinder' }, 'geometry').relation).toBe(
      'different',
    );
  });
  it('marks differing flow methods incompatible and varying tokens ambiguous', () => {
    expect(
      evaluateCondition(b1, { ...empty, flow: 5, method: s1.measurement_method }, 'flow').relation,
    ).toBe('not_comparable');
    const varying = records.find(
      (r) =>
        r.flow_varies && r.flow_initial_cm_s.value !== null && r.validation_status !== 'suspect',
    )!;
    expect(
      evaluateCondition(varying, { ...empty, flow: varying.flow_initial_cm_s.value }, 'flow')
        .relation,
    ).toBe('ambiguous');
  });
  it('keeps authentic suspect numeric values unverified', () => {
    const suspect = records.find((r) => r.validation_status === 'suspect')!;
    expect(
      evaluateCondition(suspect, { ...empty, oxygen: suspect.oxygen_initial_pct.value }, 'oxygen')
        .relation,
    ).toBe('ambiguous');
  });
  it('synthetic isolated unit fixture: unknown units earn no credit', () => {
    const synthetic = { ...b1, oxygen_initial_pct: { ...b1.oxygen_initial_pct, unit: 'kelvin' } };
    expect(evaluateCondition(synthetic, { ...empty, oxygen: 22.2 }, 'oxygen').relation).toBe(
      'not_comparable',
    );
  });
});

describe('deterministic retrieval ordering and genuine evaluation scenarios', () => {
  it('A/B: B1 is partially relevant but its required pressure is unknown', () => {
    const target = { ...scenarioFromRecord(b1), pressure: 10.2 };
    const ranked = rankCandidates(records, target);
    const b = ranked.find((c) => c.record.experiment_id === b1.experiment_id)!;
    expect(b.earned).toBeGreaterThan(0);
    expect(b.earned).toBeLessThan(b.requestedWeight);
    expect(b.conditions.find((e) => e.key === 'pressure')?.relation).toBe('missing');
    expect(b.explanation).toContain('not scientific comparability');
  });
  it('C: material differences affect ranking even at a shared oxygen target', () => {
    const ranked = rankCandidates(records, {
      ...empty,
      material: b1.material_family,
      oxygen: 22.2,
    });
    expect(ranked[0].record.material_family).toBe(b1.material_family);
    expect(
      ranked
        .find((r) => r.record.experiment_id === s1.experiment_id)
        ?.conditions.find((e) => e.key === 'material')?.relation,
    ).toBe('different');
  });
  it('D: actual BASS/Saffire comparison preserves incompatible methods/context', () => {
    const rows = comparisonRows([b1, s1]);
    expect(rows.find((r) => r.key === 'method')?.values[1].relation).toBe('different');
    expect(rows.find((r) => r.key === 'flow')?.values[1].relation).toBe('not_comparable');
    expect(
      rows.find((r) => r.key === 'pressure')?.values.every((v) => v.relation === 'missing'),
    ).toBe(true);
    expect(rows.find((r) => r.key === 'gravity')?.values[0].relation).toBe('context');
  });
  it('E: pressure-only scenario earns no credit and can yield useful empty results', () => {
    const all = rankCandidates(records, { ...empty, pressure: 10.2 });
    expect(all).toHaveLength(131);
    expect(all.every((c) => c.earned === 0)).toBe(true);
    expect(rankCandidates(records, { ...empty, pressure: 10.2 }, { showAll: false })).toEqual([]);
    expect(researchGaps([])[0]).toContain('No records remain');
  });
  it('F: actual missingness-heavy candidate cannot acquire full target credit', () => {
    const r = records.find((r) => r.material_family === 'Unknown')!;
    const candidate = rankCandidates([r], {
      ...defaultScenario,
      material: 'PMMA film',
      geometry: 'Flat sheet/film',
      thickness: 0.1,
    })[0];
    expect(candidate.earned).toBeLessThan(candidate.requestedWeight / 2);
    expect(candidate.unknownCount).toBeGreaterThan(2);
  });
  it('does not redistribute missing weights and has deterministic ties', () => {
    const target = { ...empty, pressure: 10.2 };
    const a = rankCandidates(records, target),
      b = rankCandidates([...records].reverse(), target);
    expect(a.map((c) => c.record.experiment_id)).toEqual(b.map((c) => c.record.experiment_id));
    expect(a.every((c) => c.requestedWeight === weights.pressure && c.earned === 0)).toBe(true);
    expect(JSON.stringify(rankCandidates(records, defaultScenario))).toBe(
      JSON.stringify(rankCandidates(records, defaultScenario)),
    );
  });
  it('excludes mandatory differences but does not turn unknowns into matches', () => {
    const ranked = rankCandidates(
      records,
      { ...empty, material: 'PMMA film' },
      { mandatory: ['material'] },
    );
    expect(ranked.every((c) => ['PMMA film', 'Unknown'].includes(c.record.material_family))).toBe(
      true,
    );
    expect(ranked.find((c) => c.record.material_family === 'Unknown')?.earned).toBe(0);
  });
  it('supports source/material filters and coverage ordering', () => {
    const ranked = rankCandidates(records, defaultScenario, {
      investigation: 'Saffire-I',
      material: 'SIBAL fabric',
      sort: 'coverage',
    });
    expect(ranked).toHaveLength(2);
    expect(ranked.every((c) => recordCitation(c.record).url.includes('PSI-98'))).toBe(true);
    expect(researchGaps(ranked).join(' ')).toContain('Total pressure');
    expect(rankCandidates(records, defaultScenario, { investigation: 'unknown' })).toEqual([]);
  });
  it('reference approximate oxygen cannot establish exact equality', () => {
    expect(
      comparisonRows([s1, s2])
        .find((r) => r.key === 'oxygen')
        ?.values.every((v) => v.relation !== 'exact'),
    ).toBe(true);
    expect(comparisonRows([])).toEqual([]);
  });
  it('does not promote reference context or a varying flow token into per-test differences', () => {
    const context = records.find((r) => r.flow_direction.status === 'investigation_level')!;
    expect(
      comparisonRows([context, s1])
        .find((r) => r.key === 'direction')
        ?.values.every((v) => v.relation === 'context'),
    ).toBe(true);
    const varying = records.find((r) => r.flow_varies && r.flow_initial_cm_s.value !== null)!;
    expect(
      comparisonRows([varying, b1])
        .find((r) => r.key === 'flow')
        ?.values.every((v) => v.relation === 'ambiguous'),
    ).toBe(true);
  });
});

describe('bounded scenario persistence', () => {
  it('restores valid state and rejects corrupt/untrusted values', () => {
    const state = {
      scenario: defaultScenario,
      selected: ['BASS2-B1', 'BASS2-B1', 'bad/id', 'SAFFIRE1-S1'],
    };
    expect(decodePlannerState(JSON.stringify(state)).selected).toEqual(['BASS2-B1', 'SAFFIRE1-S1']);
    for (const raw of [
      '{',
      'null',
      '{}',
      JSON.stringify({ scenario: { ...defaultScenario, oxygen: 1000 } }),
    ])
      expect(decodePlannerState(raw).scenario).toEqual(defaultScenario);
  });
});
