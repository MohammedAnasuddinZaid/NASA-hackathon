import { afterEach, expect, it, vi } from 'vitest';
import { bundledDatasetId, evidenceRequest, searchEvidence } from '../src/lib/evidenceApi';
import { emptyFilters } from '../src/lib/records';
afterEach(() => vi.unstubAllGlobals());

it('sends a bounded server search and pins the exact bundled dataset', async () => {
  const id = await bundledDatasetId();
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, dataset_id: id }), { headers: { 'X-Firetrace-Dataset': id } }));
  vi.stubGlobal('fetch', mock);
  await searchEvidence({ ...emptyFilters, query: 'B1', o2Min: 0, family: 'BASS-II' }, 2);
  expect(mock.mock.calls[0][0]).toContain('offset=48');
  expect(mock.mock.calls[0][0]).toContain('o2_min=0');
  expect(mock.mock.calls[0][1].headers['X-Firetrace-Dataset']).toBe(id);
});

it('rejects an apparently successful response from another dataset', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'X-Firetrace-Dataset': 'different' } })));
  await expect(evidenceRequest('/coverage')).rejects.toThrow('Unverified API dataset');
});

it('reports a dataset conflict distinctly from a failed service', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
  await expect(evidenceRequest('/coverage')).rejects.toThrow('Dataset mismatch');
});
