import { describe, expect, it } from 'vitest';
import { buildGapPlan, gravityLabels, planToMarkdown } from '../src/lib/gap';
import type { GapTarget } from '../src/lib/gap';

const lunarTarget: GapTarget = {
  pressurePsia: 10.2,
  oxygenPct: 30,
  gravity: 'lunar',
  material: 'PMMA film',
  flowCmS: 20,
  objective: 'Flame spread measurement',
};

describe('evidence-gap plan', () => {
  it('computes the target partial pressure with Dalton’s law', () => {
    const plan = buildGapPlan(lunarTarget);
    expect(plan.partialPressurePsi).toBeCloseTo(3.06, 6);
  });

  it('marks pressure, per-test gravity and standardized outcome as absent', () => {
    const plan = buildGapPlan(lunarTarget);
    const byDimension = Object.fromEntries(plan.evidence.map((row) => [row.dimension, row]));
    expect(byDimension['Atmosphere · total pressure'].state).toBe('absent');
    expect(byDimension['Gravity · per test'].state).toBe('absent');
    expect(byDimension['Outcome · standardized classification'].state).toBe('absent');
    expect(byDimension['Atmosphere · total pressure'].finding).toContain('lack a pressure column');
  });

  it('does not claim the target condition has been tested', () => {
    const plan = buildGapPlan(lunarTarget);
    expect(plan.unsupportedClaims).toContain('That the target condition has been tested by BASS-II or Saffire-I.');
    expect(plan.unsupportedClaims).toContain('That any material is safe or unsafe at the target atmosphere.');
    expect(plan.unsupportedClaims).toContain('That the corpus can certify a material, procedure or habitat atmosphere.');
  });

  it('adds LUCI only as partial-gravity context for lunar or Mars targets', () => {
    const lunar = buildGapPlan(lunarTarget);
    const context = lunar.evidence.find((row) => row.dimension === 'Gravity · partial-gravity context');
    expect(context?.state).toBe('context');
    expect(context?.finding).toContain('11 RPM');
    expect(context?.citation).toContain('NTRS 20250010653');

    const microgravity = buildGapPlan({ ...lunarTarget, gravity: 'microgravity' });
    expect(microgravity.evidence.some((row) => row.dimension === 'Gravity · partial-gravity context')).toBe(false);
  });

  it('reports an unmatched material as absent without substituting a family', () => {
    const plan = buildGapPlan({ ...lunarTarget, material: 'Unobtainium' });
    const material = plan.evidence.find((row) => row.dimension === 'Material · specification');
    expect(material?.state).toBe('absent');
    expect(material?.finding).toContain('No record matches the parsed material family "Unobtainium"');
  });

  it('requires the fields needed for a comparable test', () => {
    const plan = buildGapPlan(lunarTarget);
    const fields = plan.requiredFields.map((field) => field.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'Total pressure',
        'Oxygen fraction',
        'Gravity level and direction',
        'Flow velocity and direction',
        'Material specification',
        'Ignition method, power and duration',
        'Outcome definition and classification',
        'Measurement uncertainty',
      ]),
    );
  });

  it('keeps controls and unsupported claims separate', () => {
    const plan = buildGapPlan(lunarTarget);
    expect(plan.controls).toContain(
      'Measure gravity at the sample, including direction, rather than assigning it from the investigation.',
    );
    expect(plan.controls.some((control) => control.includes('Pre-register the outcome criterion'))).toBe(true);
    expect(plan.unsupportedClaims.every((claim) => claim.startsWith('That '))).toBe(true);
  });

  it('labels the gravity regimes and preserves an unspecified target', () => {
    expect(gravityLabels.lunar).toContain('1/6 g');
    expect(gravityLabels.mars).toContain('3/8 g');
    expect(gravityLabels.unspecified).toContain('Unspecified');
    const plan = buildGapPlan({ ...lunarTarget, gravity: 'unspecified' });
    expect(plan.evidence.find((row) => row.dimension === 'Gravity · per test')?.state).toBe('absent');
  });
});

describe('Markdown plan export', () => {
  it('contains the planning disclaimer, target and citations', () => {
    const plan = buildGapPlan(lunarTarget);
    const markdown = plan.markdown;
    expect(markdown).toContain('# FIRETRACE evidence-gap plan');
    expect(markdown).toContain('Planning aid only. This is not a fire-risk prediction');
    expect(markdown).toContain('- Total pressure: 10.2 psia');
    expect(markdown).toContain('Oxygen partial pressure (Dalton calculation): 3.06 psi');
    expect(markdown).toContain('NTRS 20250010653');
    expect(markdown).toContain('Pressure and per-test gravity are absent from both experimental tables (0/131 each).');
    expect(markdown).toContain('no external model was called');
  });

  it('keeps every evidence table row at four columns', () => {
    const plan = buildGapPlan({ ...lunarTarget, objective: 'A | B' });
    const markdown = planToMarkdown(plan);
    expect(markdown).toContain('- Objective: A | B');
    const tableRows = markdown.split('\n').filter((line) => line.startsWith('| Atmosphere') || line.startsWith('| Gravity'));
    expect(tableRows.length).toBeGreaterThan(0);
    for (const line of tableRows) {
      expect(line.split('|')).toHaveLength(6);
    }
  });

  it('states when partial pressure is not calculable', () => {
    const plan = buildGapPlan({ ...lunarTarget, pressurePsia: -1 });
    expect(plan.partialPressurePsi).toBeNull();
    expect(plan.markdown).toContain('Oxygen partial pressure (Dalton calculation): not calculable');
  });
});
