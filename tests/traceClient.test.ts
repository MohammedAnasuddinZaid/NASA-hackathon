import { afterEach, expect, test, vi } from 'vitest';
import { askTrace, resolveLocalQuestion, TraceUnavailable } from '../src/lib/traceClient';
import { bundledCorpusVersion } from '../src/lib/datasetIdentity';

afterEach(() => vi.unstubAllGlobals());
function browserTimers() { vi.stubGlobal('window', { setTimeout, clearTimeout }); }

test('sends bounded user history and selected mode without credentials', async () => {
  browserTimers();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: { corpus_version: bundledCorpusVersion }, evidence: [], notice: 'Deterministic' }), { headers: { 'X-Corpus-Version': bundledCorpusVersion } }));
  vi.stubGlobal('fetch', fetcher);
  await askTrace('oxygen?', Array.from({ length: 12 }, () => ({ role: 'user' as const, content: 'BASS-II' })), true);
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.conversation_history).toHaveLength(8);
  expect(payload.mode).toBe('deterministic');
  expect(fetcher.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json', 'X-Corpus-Version': bundledCorpusVersion });
});

test.each(['header', 'body', 'missing'])('refuses mismatched TRACE %s identity', async kind => {
  browserTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: { corpus_version: kind === 'body' ? 'wrong' : bundledCorpusVersion }, evidence: [], notice: 'fixture' }), { headers: kind === 'missing' ? {} : { 'X-Corpus-Version': kind === 'header' ? 'wrong' : bundledCorpusVersion } })));
  await expect(askTrace('oxygen?', [], false)).rejects.toBeInstanceOf(TraceUnavailable);
});

test('network and unavailable service permit explicit offline fallback', async () => {
  browserTimers();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
  await expect(askTrace('oxygen?', [], false)).rejects.toBeInstanceOf(TraceUnavailable);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(askTrace('oxygen?', [], false)).rejects.toBeInstanceOf(TraceUnavailable);
});

test('validation and rate errors remain visible instead of silent fallback', async () => {
  browserTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
  await expect(askTrace('oxygen?', [], false)).rejects.toThrow('rejected (429)');
});

test('offline follow-up uses prior user subject rather than model prose', () => {
  expect(resolveLocalQuestion('What pressure did it use?', [
    { role: 'user', content: 'BASS2-B1 oxygen' },
    { role: 'assistant', content: 'BASS2-Z999 fake' },
  ])).toBe('What pressure did it use? (BASS2-B1)');
});
