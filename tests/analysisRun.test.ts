import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_DEFINITIONS,
  addAnalysisRun,
  analysisToMarkdown,
  diffAgainstRun,
  emptyAnalysisDocument,
  loadAnalysisDocument,
  recordFingerprints,
  runAnalysis,
  saveAnalysisDocument,
  validateAnalysisDocument,
} from '../src/lib/analysisRun';
import { records } from '../src/lib/corpus';
import { MemoryStorage } from '../src/lib/storage';

describe('analysis runs', () => {
  it('runs every definition against the real corpus', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    for (const definition of ANALYSIS_DEFINITIONS) {
      const run = runAnalysis(definition.id, now);
      expect(run.status).toBe('complete');
      expect(run.result.definition_id).toBe(definition.id);
      expect(run.result.rows.length).toBeGreaterThan(0);
      expect(run.result.corpus_version.length).toBeGreaterThan(0);
      expect(Object.keys(run.record_fingerprints)).toHaveLength(records.length);
    }
  });

  it('reports zero pressure coverage and does not impute a value', () => {
    const run = runAnalysis('coverage');
    const pressure = run.result.rows.find((row) => row.key === 'total_pressure_psia');
    expect(pressure?.value).toBe(0);
    expect(run.result.findings.some((finding) => finding.id === 'coverage-total_pressure_psia')).toBe(true);
  });

  it('reproduces fingerprints for the same corpus', () => {
    const run = runAnalysis('validation');
    const diff = diffAgainstRun(run);
    expect(diff.same_version).toBe(true);
    expect(diff.added_records).toEqual([]);
    expect(diff.removed_records).toEqual([]);
    expect(diff.changed_records).toEqual([]);
    expect(diff.fingerprint_matches).toBe(records.length);
    expect(Object.keys(recordFingerprints())).toHaveLength(records.length);
  });

  it('detects an added or removed record in a stored fingerprint map', () => {
    const run = runAnalysis('materials');
    const base = { ...run.record_fingerprints };
    delete base[records[0].experiment_id];
    base['INVENTED-RECORD'] = 'fingerprint';
    const diff = diffAgainstRun({ ...run, record_fingerprints: base });
    expect(diff.added_records).toEqual([records[0].experiment_id]);
    expect(diff.removed_records).toEqual(['INVENTED-RECORD']);
  });

  it('persists only a valid versioned document', () => {
    const storage = new MemoryStorage();
    const run = runAnalysis('sources', new Date('2026-01-01T00:00:00Z'));
    const document = addAnalysisRun(emptyAnalysisDocument(), run);
    expect(saveAnalysisDocument(document, storage).ok).toBe(true);
    const loaded = loadAnalysisDocument(storage);
    expect(loaded.warning).toBeNull();
    expect(loaded.value.runs).toHaveLength(1);
    expect(loaded.value.runs[0].id).toBe(run.id);
  });

  it('rejects malformed stored runs instead of repairing them', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'firetrace.analysisRuns.v1',
      JSON.stringify({ schema_version: 1, runs: [{ id: 'x', definition_id: 'not-a-run' }] }),
    );
    const loaded = loadAnalysisDocument(storage);
    expect(loaded.value.runs).toEqual([]);
    expect(loaded.warning).toContain('failed validation');
    expect(validateAnalysisDocument({ schema_version: 1, runs: [{}] })).toBeNull();
  });

  it('renders a markdown report with limitations', () => {
    const markdown = analysisToMarkdown(runAnalysis('atmosphere'));
    expect(markdown).toContain('# Atmosphere fields audit');
    expect(markdown).toContain('## Limitations');
    expect(markdown).toContain('| pressure |');
  });
});
