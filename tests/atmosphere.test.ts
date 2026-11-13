import { describe, expect, it } from 'vitest';
import {
  SEA_LEVEL_PPO2_PSI,
  clampAtmosphere,
  corpusOxygenProfile,
  nearestReference,
  nitrogenPartialPressure,
  oxygenHistogram,
  oxygenPartialPressure,
  pressurePlacement,
  references,
} from '../src/lib/atmosphere';
import { records } from '../src/lib/corpus';

describe('Dalton-law atmosphere calculator', () => {
  it('computes oxygen partial pressure from total pressure and oxygen fraction', () => {
    expect(oxygenPartialPressure({ pressurePsia: 10.2, oxygenPct: 30 })).toBeCloseTo(3.06, 6);
    expect(oxygenPartialPressure({ pressurePsia: 4.3, oxygenPct: 100 })).toBeCloseTo(4.3, 6);
    expect(oxygenPartialPressure({ pressurePsia: 14.7, oxygenPct: 20.95 })).toBeCloseTo(SEA_LEVEL_PPO2_PSI, 6);
  });

  it('rejects physically invalid or non-finite inputs instead of clamping silently', () => {
    expect(oxygenPartialPressure({ pressurePsia: -1, oxygenPct: 21 })).toBeNull();
    expect(oxygenPartialPressure({ pressurePsia: 10, oxygenPct: -1 })).toBeNull();
    expect(oxygenPartialPressure({ pressurePsia: 10, oxygenPct: 101 })).toBeNull();
    expect(oxygenPartialPressure({ pressurePsia: Number.NaN, oxygenPct: 21 })).toBeNull();
    expect(oxygenPartialPressure({ pressurePsia: 10, oxygenPct: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it('derives nitrogen by difference and never returns a negative balance', () => {
    expect(nitrogenPartialPressure({ pressurePsia: 10, oxygenPct: 30 })).toBeCloseTo(7, 6);
    expect(nitrogenPartialPressure({ pressurePsia: 10, oxygenPct: 120 })).toBeNull();
    expect(nitrogenPartialPressure({ pressurePsia: 10, oxygenPct: 100 })).toBe(0);
  });

  it('clamps UI input to the declared display domain', () => {
    expect(clampAtmosphere({ pressurePsia: 1, oxygenPct: 1 })).toEqual({ pressurePsia: 2, oxygenPct: 5 });
    expect(clampAtmosphere({ pressurePsia: 99, oxygenPct: 200 })).toEqual({ pressurePsia: 16, oxygenPct: 100 });
    expect(clampAtmosphere({ pressurePsia: 10.2, oxygenPct: 30 })).toEqual({ pressurePsia: 10.2, oxygenPct: 30 });
  });
});

describe('reference atmospheres', () => {
  it('includes exactly the three challenge-derived references', () => {
    const refs = references();
    expect(refs.map((reference) => reference.id)).toEqual(['earth-sea-level', 'spacesuit', 'lunar-cabin']);
    expect(refs.find((reference) => reference.id === 'spacesuit')?.partialPressurePsi).toBeCloseTo(4.3, 6);
    expect(refs.find((reference) => reference.id === 'lunar-cabin')?.partialPressurePsi).toBeCloseTo(3.06, 6);
  });

  it('finds the nearest reference by oxygen partial pressure only', () => {
    expect(nearestReference({ pressurePsia: 4.3, oxygenPct: 100 })?.id).toBe('spacesuit');
    expect(nearestReference({ pressurePsia: 14.7, oxygenPct: 20.95 })?.id).toBe('earth-sea-level');
    expect(nearestReference({ pressurePsia: 10.2, oxygenPct: 30 })?.id).toBe('lunar-cabin');
    expect(nearestReference({ pressurePsia: -1, oxygenPct: 30 })).toBeNull();
  });
});

describe('corpus oxygen profile', () => {
  it('keeps pressure, gravity and outcome counts at zero', () => {
    const profile = corpusOxygenProfile(records);
    expect(profile.total).toBe(131);
    expect(profile.pressureKnown).toBe(0);
    expect(profile.gravityPerTestKnown).toBe(0);
    expect(profile.initialReported).toBe(131);
    expect(profile.finalReported).toBe(127);
    expect(profile.approximateInitial).toBe(2);
  });

  it('computes reported oxygen ranges without filling absent final values', () => {
    const profile = corpusOxygenProfile(records);
    expect(profile.minInitial).toBe(13.6);
    expect(profile.maxInitial).toBe(22.2);
    expect(profile.minFinal).toBe(0.6);
    expect(profile.maxFinal).toBe(40.4);
  });

  it('groups initial oxygen by parsed material family', () => {
    const profile = corpusOxygenProfile(records);
    expect(profile.byFamily.reduce((sum, row) => sum + row.count, 0)).toBe(131);
    expect(profile.byFamily[0]).toEqual({ family: 'Unknown', count: 51, min: 13.6, max: 22.2 });
    expect(profile.byFamily.find((row) => row.family === 'PMMA film')).toEqual({
      family: 'PMMA film',
      count: 17,
      min: 15,
      max: 22.2,
    });
  });
});

describe('oxygen histogram and pressure placement', () => {
  it('assigns every reported initial value to exactly one bin', () => {
    const bins = oxygenHistogram(records, 1);
    expect(bins).toHaveLength(10);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(131);
    expect(bins.flatMap((bin) => bin.ids)).toHaveLength(131);
    expect(new Set(bins.flatMap((bin) => bin.ids)).size).toBe(131);
    expect(bins.find((bin) => bin.from === 13)?.ids).toContain('BASS2-O12');
  });

  it('places every corpus record on the unknown pressure axis', () => {
    expect(records.every((record) => pressurePlacement(record) === 'unknown')).toBe(true);
  });
});
