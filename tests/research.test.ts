import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASKET_KEY, editBasket, loadBasket, persistBasket, snapshot } from '../src/lib/basket';
import { researchSource, type ResearchSource } from '../src/lib/researchData';
import {
  buildBrief,
  coverageSummary,
  defaultBriefOptions,
  safeSourceUrl,
  validateBriefOptions,
} from '../src/lib/researchBrief';
import {
  briefCsv,
  briefHtml,
  briefMarkdown,
  csvCell,
  exportArtifact,
  exportFilename,
  researchCsvColumns,
} from '../src/lib/researchFormats';
import { downloadText, recordsToCsv } from '../src/lib/export';

const ids = ['BASS2-B1', 'SAFFIRE1-S1'];
const time = '2026-11-14T21:00:00.000Z';
const makeBrief = () => buildBrief(ids, researchSource, defaultBriefOptions, time);

/** Small real CSV parser for quoted/newline round-trip assertions. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('persistent evidence IDs', () => {
  it('reports write/quota failures while keeping the in-memory snapshot usable', () => {
    const state = snapshot(ids, researchSource);
    const storage = { setItem: vi.fn() };
    expect(persistBasket(state, storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(BASKET_KEY, JSON.stringify(state));
    expect(
      persistBasket(state, {
        setItem: () => {
          throw new Error('quota');
        },
      }),
    ).toBe(false);
    expect(state.ids).toEqual(ids);
  });
  it('adds genuine IDs, deduplicates, removes, and refuses unknown IDs', () => {
    let state = snapshot([], researchSource);
    for (const id of [ids[0], ids[0], 'NOT-REAL', ids[1]])
      state = editBasket(state, { type: 'add', id }, researchSource);
    expect(state.ids).toEqual(ids);
    expect(editBasket(state, { type: 'remove', id: ids[0] }, researchSource).ids).toEqual([ids[1]]);
    expect(editBasket(state, { type: 'clear' }, researchSource).ids).toEqual([]);
  });
  it('reorders without losing records or creating duplicates', () => {
    const state = snapshot(ids, researchSource);
    expect(editBasket(state, { type: 'up', id: ids[1] }, researchSource).ids).toEqual(
      [...ids].reverse(),
    );
    expect(editBasket(state, { type: 'down', id: ids[0] }, researchSource).ids).toEqual(
      [...ids].reverse(),
    );
    expect(editBasket(state, { type: 'up', id: ids[0] }, researchSource)).toEqual(state);
  });
  it('stores IDs/version/fingerprints only and reloads identical selection', () => {
    const state = snapshot(ids, researchSource);
    const raw = JSON.stringify(state);
    expect(loadBasket(raw, researchSource).snapshot).toEqual(state);
    expect(raw).not.toContain('oxygen_initial_pct');
    expect(raw).not.toContain('22.2');
    expect(BASKET_KEY).toBe('firetrace-evidence-basket-v1');
  });
  it.each(['{', 'null', '[]', '{}', JSON.stringify({ schema: 99, ids }), 'x'.repeat(100001)])(
    'handles corrupt/unsupported storage safely',
    (raw) => {
      const loaded = loadBasket(raw, researchSource);
      expect(loaded.snapshot.ids).toEqual([]);
      expect(loaded.notices.length).toBeGreaterThan(0);
    },
  );
  it('flags and removes stale IDs while retaining real IDs', () => {
    const state = { ...snapshot(ids, researchSource), ids: [...ids, 'REMOVED-RECORD'] };
    const loaded = loadBasket(JSON.stringify(state), researchSource);
    expect(loaded.snapshot.ids).toEqual(ids);
    expect(loaded.notices.join(' ')).toContain('REMOVED-RECORD');
  });
  it('version changes require review, survive reload, and never retain old values', () => {
    const state = snapshot(ids, researchSource);
    const next: ResearchSource = { ...researchSource, version: 'another-corpus-version' };
    const loaded = loadBasket(JSON.stringify(state), next);
    expect(loaded.snapshot.version).toBe(next.version);
    expect(loaded.snapshot.reviewRequired).toBe(true);
    expect(loadBasket(JSON.stringify(loaded.snapshot), next).snapshot.reviewRequired).toBe(true);
    expect(editBasket(loaded.snapshot, { type: 'review' }, next).reviewRequired).toBe(false);
  });
  it('changed fingerprints under the same version are conservatively flagged', () => {
    const state = snapshot(ids, researchSource);
    state.fingerprints[ids[0]] = 'wrong';
    expect(loadBasket(JSON.stringify(state), researchSource).snapshot.reviewRequired).toBe(true);
  });
});

describe('deterministic scientific brief', () => {
  it('handles a basket containing the complete real corpus without truncating scope', () => {
    const allIds=researchSource.all().map((record)=>record.experiment_id);
    const report=buildBrief(allIds,researchSource,defaultBriefOptions,time);
    expect(report.record_count).toBe(allIds.length);
    expect(JSON.parse(exportArtifact(report,'json').content).selected_ids).toEqual(allIds);
    expect(parseCsv(briefCsv(report)).length).toBeGreaterThan(allIds.length);
  });
  it('matches actual selected records, statuses, units and exact source rows', () => {
    const report = makeBrief();
    expect(report.record_count).toBe(2);
    expect(report.records[0].oxygen_initial_pct.value).toBe(22.2);
    expect(report.records[0].oxygen_initial_pct.status).toBe('corrected');
    expect(report.records[1].thickness_mm.value).toBe(3.7);
    const measurement = report.records[1].measurements.find(
      (m) => m.quantity === 'sample_thickness',
    )!;
    expect(measurement.original_unit).toBe('cm');
    expect(measurement.normalized_unit).toBe('mm');
    expect(report.citations[0].locator).toContain('CSV row 2');
    expect(report.citations[0].doi).toBe('10.60555/4qc4-de67');
    expect(report.citations[0].url).toContain('PSI-25');
  });
  it('uses only selected scope and distinguishes context/derived/approximate values', () => {
    const report = makeBrief();
    const get = (key: string) => report.summary.coverage.find((c) => c.field === key)!;
    expect(report.summary.investigations.map((i) => i.count)).toEqual([1, 1]);
    expect(get('total_pressure_psia')).toMatchObject({ available: 0, total: 2, missing_ids: ids });
    expect(get('gravity_regime')).toMatchObject({ context_only: 2, measured_or_corrected: 0 });
    expect(get('oxygen_initial_pct')).toMatchObject({
      measured_or_corrected: 1,
      approximate_or_qualitative: 1,
    });
    expect(get('thickness_mm')).toMatchObject({ derived: 1, measured_or_corrected: 1 });
    expect(report.summary.standardized_outcome_count).toBe(0);
  });
  it('does not fill missing measurements and reports method/cross-investigation limitations', () => {
    const report = makeBrief();
    expect(report.records.every((r) => r.total_pressure_psia.value === null)).toBe(true);
    expect(report.comparisons.find((c) => c.id === 'investigation')?.state).toBe('blocked');
    expect(report.comparisons.find((c) => c.id === 'flow')?.detail).toContain('differ');
    expect(report.disclaimer).toContain('Does not predict fire behavior');
    expect(report.limitations.join(' ')).toContain('normalized record layer');
  });
  it('single-family scope does not invent mixed-investigation limitations', () => {
    const report = buildBrief(
      ['SAFFIRE1-S1', 'SAFFIRE1-S2'],
      researchSource,
      defaultBriefOptions,
      time,
    );
    expect(report.summary.investigations).toHaveLength(1);
    expect(report.comparisons.find((c) => c.id === 'investigation')?.state).toBe('shared');
  });
  it('refuses empty/unknown selections, invalid metadata and invalid dates', () => {
    expect(() => buildBrief([], researchSource, defaultBriefOptions, time)).toThrow(
      'Select at least one',
    );
    expect(() => buildBrief(['unknown'], researchSource, defaultBriefOptions, time)).toThrow(
      'unavailable',
    );
    expect(() =>
      buildBrief(ids, researchSource, { ...defaultBriefOptions, title: ' ' }, time),
    ).toThrow('title');
    expect(() => buildBrief(ids, researchSource, defaultBriefOptions, 'bad date')).toThrow(
      'timestamp',
    );
    expect(
      validateBriefOptions({ ...defaultBriefOptions, question: 'x'.repeat(1001) }),
    ).toHaveLength(1);
  });
  it('deduplicates IDs and is byte-reproducible for fixed inputs and timestamp', () => {
    expect(
      buildBrief([...ids, ids[0]], researchSource, defaultBriefOptions, time).selected_ids,
    ).toEqual(ids);
    expect(JSON.stringify(makeBrief())).toBe(JSON.stringify(makeBrief()));
    expect(coverageSummary([]).every((c) => c.total === 0 && c.available === 0)).toBe(true);
  });
  it('does not manufacture a URL or title when source metadata is missing', () => {
    const report = buildBrief(
      ids,
      { ...researchSource, artifacts: () => [] },
      defaultBriefOptions,
      time,
    );
    expect(report.citations.every((c) => c.url === null && c.title === null && c.limitation)).toBe(
      true,
    );
    expect(briefMarkdown(report)).toContain('Source metadata unavailable');
  });
});

describe('secure, faithful formats', () => {
  it.each([
    '=HYPERLINK("evil")',
    '+cmd',
    '-cmd',
    '@SUM(A1)',
    ' \t=1+1',
    '\r=1',
    '\n@cmd',
    '\ufeff=cmd',
    '\u200b=cmd',
    '\u202a@cmd',
  ])('neutralizes spreadsheet formula text %j', (value) => {
    expect(parseCsv(csvCell(value))[0][0]).toBe(`'${value}`);
  });
  it('preserves legitimate zero/negative numbers and quoted/newline text', () => {
    expect(csvCell(0)).toBe('0');
    expect(csvCell(-1)).toBe('-1');
    expect(csvCell(null)).toBe('');
    const value = 'a,"b"\r\nc';
    expect(parseCsv(csvCell(value))[0][0]).toBe(value);
  });
  it('exports consistent long CSV rows with nulls, corrected values and original ledger units', () => {
    const rows = parseCsv(briefCsv(makeBrief()));
    expect(rows[0]).toEqual(researchCsvColumns);
    expect(rows.every((r) => r.length === researchCsvColumns.length)).toBe(true);
    const objectRows = rows
      .slice(1)
      .map((row) => Object.fromEntries(researchCsvColumns.map((key, index) => [key, row[index]])));
    expect(
      objectRows.find(
        (r) =>
          r.row_kind === 'record_field' &&
          r.experiment_id === 'BASS2-B1' &&
          r.quantity === 'oxygen_initial_pct',
      ),
    ).toMatchObject({ normalized_value: '22.2', normalized_unit: '% by vol', status: 'corrected' });
    expect(
      objectRows.find((r) => r.row_kind === 'record_field' && r.quantity === 'total_pressure_psia'),
    ).toMatchObject({ normalized_value: '', status: 'not_reported' });
    expect(
      objectRows.find(
        (r) =>
          r.row_kind === 'measurement_ledger' &&
          r.experiment_id === 'SAFFIRE1-S1' &&
          r.quantity === 'sample_thickness',
      ),
    ).toMatchObject({
      original_value: '0.37',
      original_unit: 'cm',
      normalized_value: '3.7',
      normalized_unit: 'mm',
    });
  });
  it('hardens existing CSV exports too (synthetic isolated text fixture)', () => {
    const fixture = { ...researchSource.resolve('BASS2-B1')!, material_raw: '=CMD()' };
    expect(recordsToCsv([fixture])).toContain("'=CMD()");
  });
  it('JSON preserves records, nulls, source metadata and corpus identity', () => {
    const report = makeBrief();
    const json = JSON.parse(exportArtifact(report, 'json').content);
    expect(json.schema_version).toBe('firetrace.research-brief/1');
    expect(json.dataset_version).toBe(researchSource.version);
    expect(json.records[0]).toEqual(researchSource.resolve(ids[0]));
    expect(json.records[0].total_pressure_psia.value).toBeNull();
    expect(json.citations[0].artifacts[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('Markdown/HTML escape user metadata without treating it as evidence', () => {
    const report = buildBrief(
      ids,
      researchSource,
      {
        ...defaultBriefOptions,
        title: '<script>alert(1)</script>',
        question: '[evil](javascript:alert(1))\n# fake finding',
      },
      time,
    );
    const html = briefHtml(report),
      md = briefMarkdown(report);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(md).not.toContain('<script>');
    expect(md).toContain('not verified');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('User-supplied purpose');
  });
  it('source URLs permit only verified-metadata HTTPS values, never arbitrary schemes', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      'http://example.test',
      'https://user:pass@example.test',
    ])
      expect(safeSourceUrl(url)).toBeNull();
    expect(safeSourceUrl('https://psi.nasa.gov/')).toBe('https://psi.nasa.gov/');
  });
  it('detail/missing/note customization never removes scientific disclaimer or JSON facts', () => {
    const report = buildBrief(
      ids,
      researchSource,
      { ...defaultBriefOptions, detailed: true, includeMissing: false, includeSourceNotes: false },
      time,
    );
    expect(briefMarkdown(report)).toContain('Detailed measurement fields');
    expect(briefMarkdown(report)).not.toContain('## Missing evidence');
    expect(briefHtml(report)).toContain('<table>');
    expect(briefHtml(report)).toContain('@media print');
    expect(briefMarkdown(report)).toContain('## Disclaimer');
    expect(report.records[0].oxygen_initial_pct.note).toBeTruthy();
  });
  it.each(['csv', 'json', 'md', 'html'] as const)(
    'returns real content, safe actual-date filename and MIME for %s',
    (format) => {
      const artifact = exportArtifact(makeBrief(), format);
      expect(artifact.filename).toBe(`firetrace-evidence-brief-2026-11-15.${format}`);
      expect(artifact.content.length).toBeGreaterThan(100);
      expect(artifact.mime).toBeTruthy();
      expect(exportArtifact(makeBrief(), format).content).toBe(artifact.content);
    },
  );
  it('rejects invalid filename dates rather than constructing unsafe paths', () => {
    expect(() => exportFilename('../bad', 'md')).toThrow('date');
  });
  it('creates a real Blob/download anchor and defers URL cleanup', async () => {
    vi.useFakeTimers();
    const click = vi.fn(),
      remove = vi.fn();
    const anchor = { href: '', download: '', click, remove };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    downloadText('test.csv', 'a,b', 'text/csv;charset=utf-8');
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('test.csv');
    const blob = create.mock.calls[0][0] as Blob;
    expect(await blob.text()).toBe('a,b');
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
