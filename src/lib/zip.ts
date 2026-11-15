/**
 * Minimal deterministic ZIP writer (STORE method, no compression).
 *
 * A dependency-free archive keeps exports reproducible and avoids adding a
 * third-party compression library. Files are stored as UTF-8 with a fixed DOS
 * timestamp, so identical inputs produce identical bytes. Paths are sanitized:
 * absolute paths, drive letters, and `..` segments are rejected.
 */

export interface ZipEntry {
  path: string;
  content: string;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Reject archive paths that could escape the extraction directory. */
export function safeArchivePath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) throw new Error('Archive path is empty.');
  if (/^[a-zA-Z]:/.test(normalized)) throw new Error('Archive path must be relative.');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.' || segment === '')) {
    throw new Error(`Unsafe archive path: ${path}`);
  }
  return segments.join('/');
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (1 << 5) | 1; // 1980-01-01, deterministic

export function createZip(entries: ZipEntry[]): Uint8Array {
  if (!entries.length) throw new Error('A ZIP archive needs at least one file.');
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const seen = new Set<string>();

  for (const entry of entries) {
    const path = safeArchivePath(entry.path);
    if (seen.has(path)) throw new Error(`Duplicate archive path: ${path}`);
    seen.add(path);
    const name = encoder.encode(path);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);

    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800), // UTF-8 names
      u16(0), // store
      u16(DOS_TIME),
      u16(DOS_DATE),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    locals.push(local);

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(DOS_TIME),
      u16(DOS_DATE),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    centrals.push(central);
    offset += local.length;
  }

  const centralDirectory = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDirectory, end]);
}

export function zipToBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: 'application/zip' });
}
