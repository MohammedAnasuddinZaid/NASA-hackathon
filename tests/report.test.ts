import { describe, expect, it } from 'vitest';
import { buildResearchReport } from '../src/lib/report';
import { runBenchmark } from '../src/lib/benchmark';
import { runAnalysis } from '../src/lib/analysisRun';

describe('research report', () => {
  it('builds deterministic files with a SHA-256 manifest', async () => {
    const report = await buildResearchReport({
      title: 'Test report',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(report.files).toHaveLength(6);
    expect(report.manifest.file_count).toBe(5);
    expect(report.manifest.files).toHaveLength(5);
    for (const file of report.manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.bytes).toBeGreaterThan(0);
    }
    expect(report.markdown).toContain('Test report');
    expect(report.markdown).toContain('not a NASA certification');
    expect(report.markdown).toContain('## Claim verification');
    expect(report.markdown).toContain('## Evidence graph');
    expect(report.json).toContain('report_schema_version');
  });

  it('does not leak secrets or environment values', async () => {
    const report = await buildResearchReport({ generatedAt: '2026-01-01T00:00:00.000Z' });
    for (const file of report.files) {
      expect(file.content).not.toMatch(/api[_-]?key\s*[:=]/i);
      expect(file.content).not.toMatch(/bearer\s+[a-z0-9]/i);
      expect(file.content).not.toMatch(/GITHUB_TOKEN|OPENAI_API_KEY|OLLAMA_HOST/);
    }
  });

  it('includes a benchmark and analysis run when supplied', async () => {
    const benchmark = await runBenchmark({ now: new Date('2026-01-01T00:00:00.000Z') });
    const run = runAnalysis('coverage', new Date('2026-01-01T00:00:00.000Z'));
    const report = await buildResearchReport({
      generatedAt: '2026-01-01T00:00:00.000Z',
      benchmark,
      analysisRuns: [run],
    });
    expect(report.markdown).toContain('Deterministic assistant benchmark');
    expect(report.markdown).toContain(`Cases: ${benchmark.total}`);
    expect(report.markdown).toContain('Analysis runs');
    expect(report.markdown).toContain('Field coverage snapshot');
  });

  it('records the corpus version and verification summary', async () => {
    const report = await buildResearchReport({ generatedAt: '2026-01-01T00:00:00.000Z' });
    expect(report.markdown).toContain(report.integrity.corpus_version);
    expect(report.verifications.length).toBeGreaterThan(0);
    expect(report.graph.stats.node_count).toBeGreaterThan(0);
  });
});
