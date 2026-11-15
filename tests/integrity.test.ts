import { describe, expect, it } from 'vitest';
import { buildIntegrityReport, integrityToMarkdown } from '../src/lib/integrity';
import { records } from '../src/lib/corpus';

describe('corpus integrity', () => {
  it('passes the real corpus checks with no failures', () => {
    const report = buildIntegrityReport(new Date('2026-01-01T00:00:00Z'));
    expect(report.status).toBe('pass');
    expect(report.summary.fail).toBe(0);
    expect(report.summary.total).toBe(19);
    expect(report.corpus_version.length).toBeGreaterThan(0);
  });

  it('enforces the four scientific constraints', () => {
    const report = buildIntegrityReport();
    for (const id of ['constraint-pressure', 'constraint-gravity', 'constraint-outcome', 'constraint-ignition-method']) {
      expect(report.checks.find((check) => check.id === id)?.status).toBe('pass');
    }
    expect(records.every((record) => record.total_pressure_psia.value === null)).toBe(true);
    expect(records.every((record) => record.gravity_regime.status !== 'measured')).toBe(true);
    expect(records.every((record) => record.outcome.status !== 'measured')).toBe(true);
    expect(records.every((record) => record.ignition_method.status !== 'measured')).toBe(true);
  });

  it('reproduces coverage counts from records', () => {
    const report = buildIntegrityReport();
    const coverage = report.checks.find((check) => check.id === 'coverage-counts');
    expect(coverage?.status).toBe('pass');
    expect(coverage?.detail).toContain('pressure_reported=0');
  });

  it('renders a markdown report', () => {
    const markdown = integrityToMarkdown(buildIntegrityReport());
    expect(markdown).toContain('# Corpus integrity report');
    expect(markdown).toContain('Overall status');
    expect(markdown).toContain('not that the source experiment is scientifically valid');
  });
});
