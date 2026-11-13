import { corpus, records } from './corpus';
import type { AtmospherePreset, ExperimentRecord } from './types';

export interface AtmosphereInput {
  pressurePsia: number;
  oxygenPct: number;
}

export interface AtmosphereReference extends AtmospherePreset {
  partialPressurePsi: number;
}

export const SEA_LEVEL_PPO2_PSI = 14.7 * 0.2095;

/**
 * Dalton's law for an ideal gas mixture. This is a composition calculation only:
 * it says nothing about ignition, flammability, spread rate or material safety.
 */
export function oxygenPartialPressure({ pressurePsia, oxygenPct }: AtmosphereInput): number | null {
  if (!Number.isFinite(pressurePsia) || !Number.isFinite(oxygenPct)) return null;
  if (pressurePsia < 0 || oxygenPct < 0 || oxygenPct > 100) return null;
  return (pressurePsia * oxygenPct) / 100;
}

export function nitrogenPartialPressure(input: AtmosphereInput): number | null {
  const oxygen = oxygenPartialPressure(input);
  if (oxygen === null) return null;
  return Math.max(0, input.pressurePsia - oxygen);
}

export function references(): AtmosphereReference[] {
  return corpus.presets.map((preset) => ({
    ...preset,
    partialPressurePsi: (preset.pressure_psia * preset.oxygen_pct) / 100,
  }));
}

export function nearestReference(input: AtmosphereInput): AtmosphereReference | null {
  const target = oxygenPartialPressure(input);
  if (target === null) return null;
  return references().reduce((best, reference) =>
    Math.abs(reference.partialPressurePsi - target) < Math.abs(best.partialPressurePsi - target)
      ? reference
      : best,
  );
}

export function clampAtmosphere(input: AtmosphereInput): AtmosphereInput {
  return {
    pressurePsia: Math.min(16, Math.max(2, input.pressurePsia)),
    oxygenPct: Math.min(100, Math.max(5, input.oxygenPct)),
  };
}

export interface CorpusOxygenProfile {
  total: number;
  pressureKnown: number;
  gravityPerTestKnown: number;
  initialReported: number;
  finalReported: number;
  minInitial: number | null;
  maxInitial: number | null;
  minFinal: number | null;
  maxFinal: number | null;
  approximateInitial: number;
  byFamily: Array<{ family: string; count: number; min: number; max: number }>;
}

export function corpusOxygenProfile(source: ExperimentRecord[] = records): CorpusOxygenProfile {
  const initial = source
    .map((record) => record.oxygen_initial_pct.value)
    .filter((value): value is number => typeof value === 'number');
  const final = source
    .map((record) => record.oxygen_final_pct.value)
    .filter((value): value is number => typeof value === 'number');

  const families = new Map<string, number[]>();
  for (const record of source) {
    const value = record.oxygen_initial_pct.value;
    if (typeof value !== 'number') continue;
    const list = families.get(record.material_family) ?? [];
    list.push(value);
    families.set(record.material_family, list);
  }

  return {
    total: source.length,
    pressureKnown: source.filter((record) => record.total_pressure_psia.value !== null).length,
    gravityPerTestKnown: source.filter(
      (record) => record.gravity_regime.status === 'measured' && record.gravity_regime.value !== null,
    ).length,
    initialReported: initial.length,
    finalReported: final.length,
    minInitial: initial.length ? Math.min(...initial) : null,
    maxInitial: initial.length ? Math.max(...initial) : null,
    minFinal: final.length ? Math.min(...final) : null,
    maxFinal: final.length ? Math.max(...final) : null,
    approximateInitial: source.filter(
      (record) => record.oxygen_initial_pct.status === 'reported_qualitative',
    ).length,
    byFamily: [...families.entries()]
      .map(([family, values]) => ({
        family,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  ids: string[];
}

export function oxygenHistogram(source: ExperimentRecord[] = records, width = 1): HistogramBin[] {
  const values = source.filter((record) => typeof record.oxygen_initial_pct.value === 'number');
  if (!values.length) return [];
  const min = Math.floor(Math.min(...values.map((record) => record.oxygen_initial_pct.value as number)));
  const max = Math.ceil(Math.max(...values.map((record) => record.oxygen_initial_pct.value as number)));
  const bins: HistogramBin[] = [];
  for (let from = min; from < max; from += width) {
    const to = Math.min(max, from + width);
    const inBin = values.filter((record) => {
      const value = record.oxygen_initial_pct.value as number;
      return value >= from && (value < to || (to === max && value === max));
    });
    bins.push({
      from,
      to,
      count: inBin.length,
      ids: inBin.map((record) => record.experiment_id),
    });
  }
  return bins;
}

/**
 * The recorded corpus cannot be placed on a pressure axis: every record has a null
 * total-pressure value. This function exists to make that absence explicit rather
 * than letting the UI invent a y-coordinate.
 */
export function pressurePlacement(record: ExperimentRecord): 'known' | 'unknown' {
  return record.total_pressure_psia.value === null ? 'unknown' : 'known';
}
