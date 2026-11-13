import { describe, expect, it } from 'vitest';
import { corpus, records, sourceManifest, validation } from '../src/lib/corpus';

describe('bundled corpus integrity', () => {
  it('contains the two investigations and 131 experiment records', () => {
    expect(records).toHaveLength(131);
    expect(records.filter((record) => record.family === 'BASS-II')).toHaveLength(129);
    expect(records.filter((record) => record.family === 'Saffire-I')).toHaveLength(2);
    expect(corpus.meta.record_count).toBe(131);
    expect(corpus.meta.investigation_count).toBe(2);
  });

  it('has unique experiment IDs while retaining reused sample numbers', () => {
    expect(new Set(records.map((record) => record.experiment_id)).size).toBe(records.length);
    expect(validation.duplicate_record_ids).toEqual([]);
    // The same physical sample number can appear in more than one test; the
    // validation report keeps that observation instead of deleting records.
    expect(validation.duplicate_sample_numbers.length).toBeGreaterThan(0);
  });

  it('preserves the central metadata gaps instead of zero-filling them', () => {
    expect(records.filter((record) => record.total_pressure_psia.value !== null)).toHaveLength(0);
    expect(records.filter((record) => record.gravity_regime.status === 'measured')).toHaveLength(0);
    expect(records.filter((record) => record.outcome.status === 'measured')).toHaveLength(0);
    expect(records.filter((record) => record.ignition_method.value !== null)).toHaveLength(0);
    expect(corpus.meta.coverage.pressure_reported).toBe(0);
    expect(corpus.meta.coverage.gravity_per_record_reported).toBe(0);
    expect(corpus.meta.coverage.standardized_outcome_reported).toBe(0);
    expect(corpus.meta.coverage.partial_gravity_records).toBe(0);
  });

  it('labels all gravity as investigation-level microgravity, not a measured g-level', () => {
    for (const record of records) {
      expect(record.gravity_regime.status).toBe('investigation_level');
      expect(record.gravity_regime.value).toBe('microgravity');
      expect(record.total_pressure_psia.value).toBeNull();
    }
  });

  it('reports oxygen and flow broadly but not uniformly', () => {
    expect(records.filter((record) => record.oxygen_initial_pct.value !== null)).toHaveLength(131);
    expect(records.filter((record) => record.oxygen_final_pct.value !== null)).toHaveLength(127);
    expect(records.filter((record) => record.flow_initial_cm_s.value !== null)).toHaveLength(123);
    expect(records.filter((record) => record.oxygen_initial_pct.status === 'reported_qualitative')).toHaveLength(2);
  });

  it('retains the four suspect records and their flags', () => {
    const suspect = records.filter((record) => record.validation_status === 'suspect');
    expect(suspect.map((record) => record.experiment_id).sort()).toEqual([
      'BASS2-P22b',
      'BASS2-T18',
      'BASS2-T28b',
      'BASS2-T9',
    ]);
    expect(suspect.filter((record) => record.quality_flags.includes('final_o2_exceeds_initial_by_more_than_2pp'))).toHaveLength(2);
    expect(suspect.filter((record) => record.quality_flags.includes('date_year_unexpected_2018_in_2014_campaign'))).toHaveLength(2);
  });

  it('matches the published quality distribution', () => {
    const counts = records.reduce<Record<string, number>>((result, record) => {
      result[record.validation_status] = (result[record.validation_status] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual({ validated: 71, partial: 56, suspect: 4 });
    expect(corpus.meta.quality_counts).toEqual(counts);
  });

  it('keeps the Saffire-I experimental table to two instrumented samples', () => {
    const saffire = records.filter((record) => record.family === 'Saffire-I');
    expect(saffire.map((record) => record.experiment_id)).toEqual(['SAFFIRE1-S1', 'SAFFIRE1-S2']);
    expect(validation.excluded_non_experiment_rows).toHaveLength(2);
    for (const record of saffire) {
      expect(record.thickness_mm.value).toBe(3.7);
      expect(record.oxygen_initial_pct.status).toBe('reported_qualitative');
      expect(record.ignition_power_w.value).toBe(182);
    }
  });

  it('records the matrix cross-check without inventing conflicts', () => {
    expect(validation.matrix_cross_check.test_ids_matched).toBe(129);
    expect(validation.matrix_cross_check.o2_initial_exact_matches).toBe(129);
    expect(validation.matrix_cross_check.substantive_numeric_conflicts).toEqual([]);
  });

  it('retains verified source artifacts and their provenance fields', () => {
    expect(sourceManifest.sources).toHaveLength(8);
    expect(sourceManifest.context_sources.length).toBeGreaterThanOrEqual(2);
    for (const source of sourceManifest.sources) {
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.source_url).toMatch(/^https:\/\//);
      expect(source.source_locator.length).toBeGreaterThan(0);
      expect(source.license.length).toBeGreaterThan(0);
    }
    expect(sourceManifest.sources.some((source) => source.source_id === 'PSI-25' && source.doi === '10.60555/4qc4-de67')).toBe(true);
    expect(sourceManifest.sources.some((source) => source.source_id === 'PSI-98' && source.doi === '10.60555/0t15-1z43')).toBe(true);
  });

  it('publishes claims with source locators and limitations', () => {
    expect(corpus.claims.length).toBeGreaterThanOrEqual(10);
    for (const claim of corpus.claims) {
      expect(claim.supporting_source_ids.length).toBeGreaterThan(0);
      expect(claim.supporting_locators.length).toBeGreaterThan(0);
      expect(claim.limitation.length).toBeGreaterThan(0);
    }
  });
});
