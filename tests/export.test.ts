import { describe, expect, it } from 'vitest';
import { claims, records } from '../src/lib/corpus';
import {
  analysisRowsToCsv,
  buildExportManifest,
  claimsToCsv,
  coreExportColumns,
  csvFieldCount,
  exportColumns,
  formatExportStamp,
  previewCsv,
  recordsToCsv,
  rowsToCsv,
  summaryLine,
  verificationToCsv,
} from '../src/lib/export';
import { runAnalysis } from '../src/lib/analysisRun';
import { verifyAllClaims } from '../src/lib/verification';

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

  it('neutralizes spreadsheet formula injection in text cells', () => {
    const record = { ...records[0], material_raw: '=SUM(1,1)' };
    const csv = recordsToCsv([record], ['material_raw']);
    const [, row] = csv.split('\r\n');
    expect(parseCsvLine(row)[0]).toBe("'=SUM(1,1)");
    const plus = rowsToCsv(['value'], [{ value: '+1+1' }]);
    expect(plus.split('\r\n')[1]).toBe("'+1+1");
    const at = rowsToCsv(['value'], [{ value: '@cmd' }]);
    expect(at.split('\r\n')[1]).toBe("'@cmd");
  });

  it('does not prefix ordinary negative numbers', () => {
    const csv = rowsToCsv(['value'], [{ value: -1.5 }]);
    expect(csv.split('\r\n')[1]).toBe('-1.5');
  });

  it('writes verification results and analysis rows', () => {
    const verification = verificationToCsv(verifyAllClaims());
    const verificationLines = verification.split('\r\n');
    expect(verificationLines).toHaveLength(claims.length + 1);
    expect(verificationLines[0]).toContain('verdict');
    const run = runAnalysis('coverage');
    const analysis = analysisRowsToCsv(run);
    expect(analysis.split('\r\n')).toHaveLength(run.result.rows.length + 1);
    expect(analysis).toContain(run.id);
  });

  it('builds a SHA-256 manifest for exported files', async () => {
    const { manifest, hashed } = await buildExportManifest(
      [
        { path: 'records.csv', content: recordsToCsv(records.slice(0, 2)) },
        { path: 'notes.md', content: '# Notes\n' },
      ],
      { generatedAt: '2026-01-01T00:00:00.000Z' },
    );
    expect(hashed).toHaveLength(2);
    expect(manifest.schema_version).toBe(1);
    expect(manifest.file_count).toBe(2);
    expect(manifest.corpus_version.length).toBeGreaterThan(0);
    for (const file of manifest.files) expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.notes.join(' ')).toContain('not scientific validity');
  });
});
