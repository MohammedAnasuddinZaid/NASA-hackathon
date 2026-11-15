/**
 * Deterministic content hashing helpers.
 *
 * The application uses SHA-256 for evidence-bundle manifests and export
 * integrity. It is a content fingerprint, not a scientific validation.
 */

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SHA-256 is unavailable in this runtime.');
  }
  const data =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? (bytes.buffer as ArrayBuffer)
      : (bytes.slice().buffer as ArrayBuffer);
  const digest = await subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Stable JSON for hashing: object keys are sorted recursively. */
export function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

export interface HashedFile {
  path: string;
  content: string;
  sha256: string;
  bytes: number;
}

export async function hashFiles(
  files: Array<{ path: string; content: string }>,
): Promise<HashedFile[]> {
  const result: HashedFile[] = [];
  for (const file of files) {
    result.push({
      path: file.path,
      content: file.content,
      sha256: await sha256Hex(file.content),
      bytes: new TextEncoder().encode(file.content).byteLength,
    });
  }
  return result;
}
