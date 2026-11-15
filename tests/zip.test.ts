import { describe, expect, it } from 'vitest';
import { createZip, crc32, safeArchivePath, zipToBlob } from '../src/lib/zip';

const encoder = new TextEncoder();

describe('deterministic ZIP writer', () => {
  it('computes the standard CRC-32 check value', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes local headers, a central directory, and an end record', () => {
    const bytes = createZip([
      { path: 'manifest.json', content: '{"ok":true}' },
      { path: 'nested/report.md', content: '# report\n' },
    ]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...bytes.slice(-22, -18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('manifest.json');
    expect(text).toContain('nested/report.md');
  });

  it('is byte-identical for identical input', () => {
    const files = [{ path: 'a.txt', content: 'hello' }];
    expect([...createZip(files)]).toEqual([...createZip(files)]);
  });

  it('rejects duplicate, absolute, and traversal paths', () => {
    expect(() =>
      createZip([
        { path: 'a.txt', content: '1' },
        { path: 'a.txt', content: '2' },
      ]),
    ).toThrow(/Duplicate/);
    expect(() => safeArchivePath('C:/secret.txt')).toThrow(/relative/);
    expect(() => safeArchivePath('../escape.txt')).toThrow(/Unsafe/);
    expect(safeArchivePath('/absolute.txt')).toBe('absolute.txt');
  });

  it('produces a ZIP blob', () => {
    const blob = zipToBlob(createZip([{ path: 'a.txt', content: 'hello' }]));
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(0);
  });
});
