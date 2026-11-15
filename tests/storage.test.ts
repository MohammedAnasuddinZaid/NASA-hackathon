import { describe, expect, it } from 'vitest';
import {
  browserStorage,
  clearVersioned,
  loadVersioned,
  MemoryStorage,
  saveVersioned,
} from '../src/lib/storage';

interface Document {
  schema_version: number;
  value: number;
}

function validate(input: unknown): Document | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  return typeof raw.value === 'number' ? { schema_version: 1, value: raw.value } : null;
}

describe('versioned storage', () => {
  it('round-trips a valid document', () => {
    const storage = new MemoryStorage();
    expect(saveVersioned('key', { schema_version: 1, value: 7 }, storage).ok).toBe(true);
    const loaded = loadVersioned('key', 1, () => ({ schema_version: 1, value: 0 }), validate, storage);
    expect(loaded.value.value).toBe(7);
    expect(loaded.warning).toBeNull();
    expect(loaded.recovered).toBe(true);
  });

  it('rejects malformed JSON and leaves the original in place', () => {
    const storage = new MemoryStorage();
    storage.setItem('key', '{not json');
    const loaded = loadVersioned('key', 1, () => ({ schema_version: 1, value: 0 }), validate, storage);
    expect(loaded.value.value).toBe(0);
    expect(loaded.warning).toContain('malformed');
    expect(storage.getItem('key')).toBe('{not json');
  });

  it('rejects a schema mismatch', () => {
    const storage = new MemoryStorage();
    storage.setItem('key', JSON.stringify({ schema_version: 2, value: 7 }));
    const loaded = loadVersioned('key', 1, () => ({ schema_version: 1, value: 0 }), validate, storage);
    expect(loaded.value.value).toBe(0);
    expect(loaded.warning).toContain('schema 2');
  });

  it('rejects a document that fails validation', () => {
    const storage = new MemoryStorage();
    storage.setItem('key', JSON.stringify({ schema_version: 1, value: 'seven' }));
    const loaded = loadVersioned('key', 1, () => ({ schema_version: 1, value: 0 }), validate, storage);
    expect(loaded.warning).toContain('failed validation');
  });

  it('reports an unavailable storage backend instead of throwing', () => {
    const loaded = loadVersioned('key', 1, () => ({ schema_version: 1, value: 0 }), validate, null);
    expect(loaded.warning).toContain('unavailable');
    expect(saveVersioned('key', { schema_version: 1, value: 1 }, null).ok).toBe(false);
    expect(clearVersioned('key', null).ok).toBe(false);
  });

  it('reports a quota failure instead of throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const result = saveVersioned('key', { schema_version: 1, value: 1 }, storage);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('quota');
  });

  it('returns null when browser storage is unavailable in this runtime', () => {
    expect(browserStorage()).toBeNull();
  });
});
