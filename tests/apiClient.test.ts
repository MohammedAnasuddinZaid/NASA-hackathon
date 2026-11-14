import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { evidenceApi, ServiceUnavailable } from '../src/lib/apiClient';
declare const __BUNDLED_CORPUS_VERSION__: string;
const version = __BUNDLED_CORPUS_VERSION__;
beforeEach(() => vi.stubGlobal('window', { setTimeout, clearTimeout }));
afterEach(() => vi.unstubAllGlobals());
it('pins the bundled version and retains a zero-valued numeric filter', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"items":[],"total":0}', { headers: { 'X-Corpus-Version': version } }));
  vi.stubGlobal('fetch', fetcher);
  await evidenceApi.experiments({ min_o2: 0, offset: 24 });
  expect(fetcher.mock.calls[0][0]).toContain('min_o2=0');
  expect(fetcher.mock.calls[0][1].headers['X-Corpus-Version']).toBe(version);
});
it('refuses successful responses without matching corpus identity', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'X-Corpus-Version': 'wrong' } })));
  await expect(evidenceApi.coverage()).rejects.toBeInstanceOf(ServiceUnavailable);
});
it('treats a server version conflict as explicit bundled-fallback behavior', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
  await expect(evidenceApi.coverage()).rejects.toMatchObject({ code: 'corpus_mismatch' });
});
