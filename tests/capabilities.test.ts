import { describe, expect, it } from 'vitest';
import { probeCapabilities } from '../src/lib/capabilities';
import { records } from '../src/lib/corpus';

describe('capability health', () => {
  it('probes bundled capabilities without claiming an API is connected', async () => {
    const report = await probeCapabilities({ checkApi: false, now: new Date('2026-01-01T00:00:00Z') });
    expect(report.mode).toBe('bundled');
    expect(report.capabilities.length).toBe(10);
    expect(report.capabilities.find((capability) => capability.id === 'bundled_corpus')?.status).toBe('available');
    expect(report.capabilities.find((capability) => capability.id === 'deterministic_assistant')?.status).toBe('available');
    expect(report.capabilities.find((capability) => capability.id === 'claim_verification')?.status).toBe('available');
    expect(report.capabilities.find((capability) => capability.id === 'evidence_graph')?.status).toBe('available');
    expect(report.capabilities.find((capability) => capability.id === 'evidence_api')?.status).toBe('not_configured');
    expect(report.capabilities.find((capability) => capability.id === 'local_storage')?.status).toBe('unavailable');
    expect(report.summary.not_configured).toBeGreaterThanOrEqual(2);
  });

  it('reports an unreachable API as unavailable rather than ready', async () => {
    const report = await probeCapabilities({
      checkApi: true,
      apiBase: 'http://127.0.0.1:1',
      timeoutMs: 200,
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const api = report.capabilities.find((capability) => capability.id === 'evidence_api');
    expect(api?.status).toBe('unavailable');
    expect(report.mode).toBe('api-probed');
  });

  it('ties the corpus probe to the actual record count', async () => {
    const report = await probeCapabilities({ checkApi: false });
    const corpusCapability = report.capabilities.find((capability) => capability.id === 'bundled_corpus');
    expect(corpusCapability?.detail).toContain(String(records.length));
  });
});
