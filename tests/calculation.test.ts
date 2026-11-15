import { describe, expect, it } from 'vitest';
import {
  calculationToMarkdown,
  decimalDivide,
  decimalMultiply,
  rerunCalculation,
  roundDecimal,
  runCalculation,
} from '../src/lib/calculation';

describe('exact decimal helpers', () => {
  it('multiplies and divides without binary floating-point drift', () => {
    expect(decimalMultiply('1.0066', '5', 6)).toBe('5.033000');
    expect(decimalMultiply('0.1', '0.2', 4)).toBe('0.0200');
    expect(decimalDivide('1', '3', 6)).toBe('0.333333');
    expect(decimalDivide('2', '3', 6)).toBe('0.666667');
    expect(roundDecimal('5.033', 3)).toBe('5.033');
    expect(roundDecimal('5.0335', 3)).toBe('5.034');
    expect(decimalDivide('1', '0')).toBeNull();
  });
});

describe('calculation runs', () => {
  it('computes oxygen partial pressure from supplied pressure and fraction', () => {
    const run = runCalculation(
      'ppo2-dalton',
      { pressure_psia: 10.2, oxygen_pct: 30 },
      { now: new Date('2026-01-01T00:00:00Z'), corpusVersion: 'test' },
    );
    expect(run.status).toBe('ok');
    expect(run.result?.display).toBe('3.060');
    expect(run.result?.unit).toBe('psi');
    expect(run.inputs).toHaveLength(2);
    expect(run.steps).toHaveLength(3);
    expect(run.assumptions.length).toBeGreaterThan(0);
    expect(run.limitations.join(' ')).toContain('not a flammability threshold');
  });

  it('computes the workbook flow factor exactly', () => {
    const run = runCalculation('flow-from-air-display', { air_display_cm_s: 5 });
    expect(run.status).toBe('ok');
    expect(run.result?.display).toBe('5.033');
    expect(run.limitations.join(' ')).toContain('not a per-test calibrated velocity');
  });

  it('refuses an out-of-range or missing input', () => {
    expect(runCalculation('ppo2-dalton', { pressure_psia: 0, oxygen_pct: 30 }).status).toBe('invalid');
    expect(runCalculation('ppo2-dalton', { pressure_psia: '', oxygen_pct: 30 }).status).toBe('invalid');
    expect(runCalculation('ppo2-dalton', { pressure_psia: 10, oxygen_pct: 130 }).status).toBe('invalid');
  });

  it('keeps input provenance and never invents a corpus pressure', () => {
    const run = runCalculation('ppo2-dalton', { pressure_psia: 10, oxygen_pct: 22.2 }, {
      provenance: {
        pressure_psia: { provenance: 'user' },
        oxygen_pct: { provenance: 'corpus', record_id: 'BASS2-B1', field_key: 'oxygen_initial_pct' },
      },
    });
    expect(run.source).toBe('mixed');
    expect(run.inputs.find((input) => input.key === 'pressure_psia')?.record_id).toBeNull();
    expect(run.inputs.find((input) => input.key === 'oxygen_pct')?.record_id).toBe('BASS2-B1');
  });

  it('reruns against new inputs without mutating the previous run', () => {
    const first = runCalculation('flow-from-air-display', { air_display_cm_s: 5 }, {
      now: new Date('2026-01-01T00:00:00Z'),
      calculationId: 'calc-1',
    });
    const second = rerunCalculation(first, { air_display_cm_s: 10 }, {
      now: new Date('2026-01-02T00:00:00Z'),
      calculationId: 'calc-2',
    });
    expect(first.result?.display).toBe('5.033');
    expect(second.result?.display).toBe('10.066');
    expect(second.rerun_of).toBe('calc-1');
    expect(second.previous_result).toBe('5.033 cm/s');
  });

  it('renders a markdown derivation with provenance and limitations', () => {
    const markdown = calculationToMarkdown(runCalculation('pressure-psia-to-kpa', { pressure_psia: 14.7 }));
    expect(markdown).toContain('### Pressure conversion: psia to kPa');
    expect(markdown).toContain('6.894757293168');
    expect(markdown).toContain('Limitations:');
    expect(markdown).toContain('Unit conversion does not validate the measurement itself.');
  });
});
