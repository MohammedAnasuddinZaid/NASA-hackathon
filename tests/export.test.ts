import { describe, expect, it } from 'vitest';
import { claims, records } from '../src/lib/corpus';
import {
  claimsToCsv,
  coreExportColumns,
  csvFieldCount,
  exportColumns,
  formatExportStamp,
  previewCsv,
  recordsToCsv,
  summaryLine,
} from '../src/lib/export';

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value);
  return cells;
}

describe('record CSV export', () => {
  it('uses the declared full and core column sets', () => {
    expect(exportColumns).toHaveLength(39);
    expect(coreExportColumns).toHaveLength(23);
    expect(csvFieldCount(recordsToCsv(records.slice(0, 1)))).toBe(39);
    expect(csvFieldCount(recordsToCsv(records.slice(0, 1), coreExportColumns))).toBe(23);
  });

  it('writes one header plus one row per record with parseable quoting', () => {
    const csv = recordsToCsv(records.slice(0, 10));
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(11);
    for (const line of lines) {
      expect(parseCsvLine(line)).toHaveLength(39);
    }
  });

  it('preserves missing pressure as an empty cell rather than zero', () => {
    const csv = recordsToCsv(records.slice(0, 1));
    const [header, row] = csv.split('\r\n');
    const cells = parseCsvLine(row);
    const pressureIndex = header.split(',').indexOf('total_pressure_psia');
    const ppo2Index = header.split(',').indexOf('oxygen_partial_pressure_psi');
    expect(cells[pressureIndex]).toBe('');
    expect(cells[ppo2Index]).toBe('');
    expect(cells[header.split(',').indexOf('experiment_id')]).toBe('BASS2-B1');
  });

  it('includes provenance and source locators', () => {
    const csv = recordsToCsv(records.slice(0, 1));
    const [header, row] = csv.split('\r\n');
    const cells = parseCsvLine(row);
    const get = (column: string) => cells[header.split(',').indexOf(column)];
    expect(get('source_id')).toBe('PSI-25');
    expect(get('source_url')).toMatch(/^https:\/\//);
    expect(get('doi')).toBe('10.60555/4qc4-de67');
    expect(get('license')).toBe('Creative Commons Zero v1.0 Universal');
    expect(get('source_locator')).toContain('row');
  });

  it('exports only requested rows and columns', () => {
    const selected = records.filter((record) => record.family === 'Saffire-I');
    const csv = recordsToCsv(selected, ['experiment_id', 'oxygen_initial_pct', 'total_pressure_psia']);
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('SAFFIRE1-S1');
    expect(csv).toContain('SAFFIRE1-S2');
    expect(csv).not.toContain('BASS2-B1');
  });

  it('summarizes coverage without inventing pressure or gravity', () => {
    expect(summaryLine(records)).toBe(
      '131 records · 0 with pressure · 0 with per-test gravity · generated from the bundled corpus',
    );
  });
});

describe('claim CSV export', () => {
  it('writes a header and every registered claim', () => {
    const csv = claimsToCsv(claims);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(claims.length + 1);
    expect(lines[0].split(',')).toHaveLength(7);
    expect(csv).toContain('CL-BASS2-OBJ');
    expect(csv).toContain('CL-LUCI-FEAS');
  });

  it('quotes claim text containing commas and preserves array joins', () => {
    const csv = claimsToCsv([claims[0]]);
    const [header, row] = csv.split('\r\n');
    expect(header.split(',')).toHaveLength(7);
    const cells = parseCsvLine(row);
    expect(cells).toHaveLength(7);
    expect(cells[0]).toBe(claims[0].claim_id);
    expect(cells[3]).toContain('PSI-25');
  });
});

describe('export helpers', () => {
  it('previews a bounded number of lines', () => {
    const csv = recordsToCsv(records.slice(0, 20));
    expect(previewCsv(csv, 5)).toHaveLength(5);
    expect(previewCsv(csv, 5)[0]).toContain('experiment_id');
  });

  it('formats a deterministic date stamp', () => {
    expect(formatExportStamp(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatExportStamp(new Date(2026, 10, 13))).toBe('2026-11-13');
  });
});
