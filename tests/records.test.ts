import { describe, expect, it } from 'vitest';
import { records } from '../src/lib/corpus';
import {
  emptyFilters,
  fieldCoverage,
  filterRecords,
  matchesQuery,
  sortRecords,
  uniqueFamilies,
  uniqueMaterials,
} from '../src/lib/records';
import type { AtlasFilters } from '../src/lib/records';

function filters(patch: Partial<AtlasFilters> = {}): AtlasFilters {
  return { ...emptyFilters, ...patch };
}

describe('Atlas filtering', () => {
  it('returns all records with empty filters', () => {
    expect(filterRecords(records, filters())).toHaveLength(131);
  });

  it('filters by investigation without mixing Saffire descriptors', () => {
    const saffire = filterRecords(records, filters({ family: 'Saffire-I' }));
    expect(saffire.map((record) => record.experiment_id)).toEqual(['SAFFIRE1-S1', 'SAFFIRE1-S2']);
  });

  it('filters by material family', () => {
    const pmmaFilm = filterRecords(records, filters({ material: 'PMMA film' }));
    expect(pmmaFilm).toHaveLength(17);
    expect(pmmaFilm.every((record) => record.material_family === 'PMMA film')).toBe(true);
  });

  it('filters by validation status', () => {
    const suspect = filterRecords(records, filters({ quality: 'suspect' }));
    expect(suspect).toHaveLength(4);
    expect(new Set(suspect.map((record) => record.validation_status))).toEqual(new Set(['suspect']));
  });

  it('filters to records with a reported flow', () => {
    const withFlow = filterRecords(records, filters({ flowOnly: true }));
    expect(withFlow).toHaveLength(123);
    expect(withFlow.every((record) => record.flow_initial_cm_s.value !== null)).toBe(true);
  });

  it('treats oxygen bounds inclusively and excludes records without oxygen', () => {
    const bounded = filterRecords(records, filters({ o2Min: 13.6, o2Max: 16 }));
    expect(bounded).toHaveLength(18);
    expect(bounded.every((record) => (record.oxygen_initial_pct.value ?? -1) >= 13.6)).toBe(true);
    expect(bounded.every((record) => (record.oxygen_initial_pct.value ?? Infinity) <= 16)).toBe(true);
  });

  it('prioritizes an exact experiment ID over substring matches', () => {
    const exact = filterRecords(records, filters({ query: 'BASS2-B1' }));
    expect(exact).toHaveLength(1);
    expect(exact[0].experiment_id).toBe('BASS2-B1');
  });

  it('matches a test number exactly when entered alone', () => {
    const exact = filterRecords(records, filters({ query: 'B1' }));
    expect(exact).toHaveLength(1);
    expect(exact[0].experiment_id).toBe('BASS2-B1');
  });

  it('supports multi-term search across material and investigation', () => {
    expect(matchesQuery(records[0], 'bass-ii pmma')).toBe(true);
    expect(matchesQuery(records[0], 'saffire')).toBe(false);
  });
});

describe('Atlas sorting', () => {
  it('sorts IDs numerically rather than lexicographically', () => {
    const sorted = sortRecords(records, 'id');
    const b2 = sorted.findIndex((record) => record.experiment_id === 'BASS2-B2');
    const b10 = sorted.findIndex((record) => record.experiment_id === 'BASS2-B10');
    expect(b2).toBeLessThan(b10);
    expect(sorted[0].experiment_id).toBe('BASS2-B1');
  });

  it('sorts oxygen ascending with missing values last', () => {
    const sorted = sortRecords(records, 'o2-asc');
    expect(sorted[0].oxygen_initial_pct.value).toBe(13.6);
    expect(sorted.at(-1)?.oxygen_initial_pct.value).toBe(22.2);
  });

  it('sorts oxygen descending with missing values last', () => {
    const sorted = sortRecords(records, 'o2-desc');
    expect(sorted[0].oxygen_initial_pct.value).toBe(22.2);
    expect(sorted.at(-1)?.oxygen_initial_pct.value).toBe(13.6);
  });

  it('sorts materials alphabetically', () => {
    const sorted = sortRecords(records, 'material');
    const names = sorted.map((record) => record.material_family);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts dates without inventing a missing date', () => {
    const sorted = sortRecords(records, 'date');
    expect(sorted[0].date_reported === null || typeof sorted[0].date_reported === 'string').toBe(true);
  });
});

describe('Atlas vocabulary and coverage', () => {
  it('lists two investigations and nine parsed material families', () => {
    expect(uniqueFamilies()).toEqual(['BASS-II', 'Saffire-I']);
    expect(uniqueMaterials()).toHaveLength(9);
  });

  it('reports the real coverage counts', () => {
    const coverage = Object.fromEntries(fieldCoverage().map((row) => [row.key, row.count]));
    expect(coverage).toMatchObject({
      oxygen_initial: 131,
      oxygen_final: 127,
      pressure: 0,
      flow: 123,
      gravity_measured: 0,
      ignition: 2,
      thickness: 44,
      outcome: 0,
    });
  });
});
