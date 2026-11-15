import { afterEach, describe, expect, it, vi } from 'vitest';
import { atlasServerQuery, fetchAtlasEvidence } from '../src/lib/atlasEvidence';
import { evidenceApi, ServiceUnavailable, type ExperimentPage } from '../src/lib/apiClient';
import { records } from '../src/lib/corpus';
import { emptyFilters } from '../src/lib/records';
const page = (ids: string[], total = ids.length) => ({ items: ids.map(experiment_id => ({ experiment_id })), total } as ExperimentPage);
afterEach(() => vi.restoreAllMocks());
describe('workbench evidence adapter', () => {
  it('retains exact-ID backend lookup', () => {
    expect(atlasServerQuery({ ...emptyFilters, query: ' BASS2-B1 ' }).q).toBe('BASS2-B1');
  });
  it('preserves extended workbench text search by fetching the complete filtered candidate pool', () => {
    const query = atlasServerQuery({ ...emptyFilters, query: 'calibration', family: 'BASS-II', hasThickness: true, sort: 'thickness-desc' });
    expect(query.q).toBe(''); expect(query.family).toBe('BASS-II'); expect(query.sort).toBe('id');
    expect(query).not.toHaveProperty('hasThickness');
  });
  it('passes the supported search contract and resolves source-identical records', async () => {
    const api = vi.spyOn(evidenceApi, 'experiments').mockResolvedValue(page(['BASS2-B1']));
    const result = await fetchAtlasEvidence({ q: 'BASS2-B1', atlas_search: true, material_exact: true });
    expect(api).toHaveBeenCalledWith({ q: 'BASS2-B1', atlas_search: true, material_exact: true, limit: 200, offset: 0 });
    expect(result[0]).toBe(records.find(record => record.experiment_id === 'BASS2-B1'));
    expect(result[0].total_pressure_psia.value).toBeNull();
  });
  it('retrieves every result when the service splits a matching set into pages', async () => {
    const api = vi.spyOn(evidenceApi, 'experiments').mockResolvedValueOnce(page(['BASS2-B1'], 2)).mockResolvedValueOnce(page(['BASS2-B2'], 2));
    expect((await fetchAtlasEvidence({})).map(record => record.experiment_id)).toEqual(['BASS2-B1', 'BASS2-B2']);
    expect(api.mock.calls[1][0]?.offset).toBe(1);
  });
  it.each([page(['NOT-A-RECORD']), page(['BASS2-B1', 'BASS2-B1']), page([], 1)])('rejects incompatible or incomplete IDs without inventing a substitute', async response => {
    vi.spyOn(evidenceApi, 'experiments').mockResolvedValue(response);
    await expect(fetchAtlasEvidence({})).rejects.toBeInstanceOf(ServiceUnavailable);
  });
  it('preserves actual unavailability for the whole-session fallback handler', async () => {
    const failure = new ServiceUnavailable('offline');
    vi.spyOn(evidenceApi, 'experiments').mockRejectedValue(failure);
    await expect(fetchAtlasEvidence({})).rejects.toBe(failure);
  });
});
