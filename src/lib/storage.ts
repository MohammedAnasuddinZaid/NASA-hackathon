/**
 * Safe, versioned browser-storage helpers.
 *
 * Every locally persisted document carries an explicit schema version. A
 * malformed, foreign, or newer document is rejected with a visible warning
 * instead of being partially trusted. Storage failures (private mode, quota)
 * are reported to the caller; they never throw into a render path.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult<T> {
  value: T;
  warning: string | null;
  recovered: boolean;
}

export interface SaveResult {
  ok: boolean;
  error: string | null;
}

export function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__firetrace_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function loadVersioned<T>(
  key: string,
  schemaVersion: number,
  fallback: () => T,
  validate: (input: unknown) => T | null,
  storage?: KeyValueStorage | null,
): LoadResult<T> {
  const resolved = storage === undefined ? browserStorage() : storage;
  if (!resolved) {
    return { value: fallback(), warning: 'Browser storage is unavailable.', recovered: false };
  }
  let raw: string | null;
  try {
    raw = resolved.getItem(key);
  } catch {
    return { value: fallback(), warning: 'Browser storage could not be read.', recovered: false };
  }
  if (!raw) return { value: fallback(), warning: null, recovered: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      value: fallback(),
      warning: 'Stored data was malformed and was not loaded. Nothing was overwritten.',
      recovered: false,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      value: fallback(),
      warning: 'Stored data had an unexpected shape and was not loaded.',
      recovered: false,
    };
  }

  const version = (parsed as { schema_version?: unknown }).schema_version;
  if (version !== schemaVersion) {
    return {
      value: fallback(),
      warning: `Stored data uses schema ${String(version)}; this build expects ${schemaVersion}. It was not loaded.`,
      recovered: false,
    };
  }

  const validated = validate(parsed);
  if (!validated) {
    return {
      value: fallback(),
      warning: 'Stored data failed validation and was not loaded.',
      recovered: false,
    };
  }
  return { value: validated, warning: null, recovered: true };
}

export function saveVersioned<T>(
  key: string,
  value: T,
  storage?: KeyValueStorage | null,
): SaveResult {
  const resolved = storage === undefined ? browserStorage() : storage;
  if (!resolved) return { ok: false, error: 'Browser storage is unavailable.' };
  try {
    resolved.setItem(key, JSON.stringify(value));
    return { ok: true, error: null };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'Browser storage quota is full. Export your work before deleting anything.'
        : 'Browser storage rejected the write.';
    return { ok: false, error: message };
  }
}

export function clearVersioned(
  key: string,
  storage?: KeyValueStorage | null,
): SaveResult {
  const resolved = storage === undefined ? browserStorage() : storage;
  if (!resolved) return { ok: false, error: 'Browser storage is unavailable.' };
  try {
    resolved.removeItem(key);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'Browser storage rejected the delete.' };
  }
}
