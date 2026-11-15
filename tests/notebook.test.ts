import { describe, expect, it } from 'vitest';
import {
  addNotebookItem,
  addRecordsToInvestigation,
  buildNotebookBundle,
  createInvestigation,
  emptyNotebook,
  loadNotebook,
  notebookStats,
  notebookToMarkdown,
  removeNotebookItem,
  saveNotebook,
  updateInvestigation,
  validateNotebookDocument,
} from '../src/lib/notebook';
import { MemoryStorage } from '../src/lib/storage';
import { runCalculation } from '../src/lib/calculation';

function investigation() {
  const created = createInvestigation(
    emptyNotebook(),
    { title: 'PMMA in low flow', question: 'Does flow change spread?', corpus_version: 'test-version' },
    1,
  );
  return created.investigation!;
}

describe('research notebook', () => {
  it('creates a versioned investigation and records a timeline', () => {
    const created = createInvestigation(emptyNotebook(), { title: 'Test' }, 1);
    expect(created.error).toBeNull();
    expect(created.investigation?.status).toBe('draft');
    expect(created.investigation?.timeline).toHaveLength(1);
    expect(created.document.schema_version).toBe(1);
  });

  it('requires a title and rejects empty titles', () => {
    const created = createInvestigation(emptyNotebook(), { title: '   ' });
    expect(created.investigation).toBeNull();
    expect(created.error).toContain('title');
  });

  it('attaches only known records', () => {
    const inv = investigation();
    const attached = addRecordsToInvestigation(emptyNotebookWith(inv), inv.id, ['BASS2-B1', 'NOT-A-RECORD'], 2);
    expect(attached.investigation?.record_ids).toEqual(['BASS2-B1']);
  });

  it('accepts an observation of a reported value', () => {
    const inv = investigation();
    const result = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      {
        type: 'observation',
        text: 'Initial oxygen was 22.2%.',
        record_ids: ['BASS2-B1'],
        source_ids: ['PSI-25'],
        field_keys: ['oxygen_initial_pct'],
      },
      3,
    );
    expect(result.error).toBeNull();
    expect(result.item?.type).toBe('observation');
    expect(result.investigation?.items).toHaveLength(1);
  });

  it('rejects an observation of a field the corpus does not report', () => {
    const inv = investigation();
    const result = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      {
        type: 'observation',
        text: 'Pressure was 14.7 psia.',
        record_ids: ['BASS2-B1'],
        field_keys: ['total_pressure_psia'],
      },
      3,
    );
    expect(result.item).toBeNull();
    expect(result.error).toContain('reports no value');
  });

  it('rejects an AI interpretation without retrieved evidence', () => {
    const inv = investigation();
    const result = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      { type: 'ai_interpretation', text: 'It will not burn.', record_ids: [], source_ids: [] },
      3,
    );
    expect(result.item).toBeNull();
    expect(result.error).toContain('cite retrieved evidence');
  });

  it('records a completed calculation but not an invalid one', () => {
    const inv = investigation();
    const run = runCalculation('ppo2-dalton', { pressure_psia: 10, oxygen_pct: 21 }, { now: new Date(0) });
    const accepted = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      { type: 'derived_calculation', text: '', calculation: run, record_ids: [] },
      3,
    );
    expect(accepted.error).toBeNull();
    const invalid = runCalculation('ppo2-dalton', { pressure_psia: '', oxygen_pct: 21 }, { now: new Date(0) });
    const rejected = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      { type: 'derived_calculation', text: '', calculation: invalid },
      3,
    );
    expect(rejected.error).toContain('completed calculation');
  });

  it('updates workflow status without calling it scientific validity', () => {
    const inv = investigation();
    const updated = updateInvestigation(emptyNotebookWith(inv), inv.id, { status: 'awaiting_review' }, 5);
    expect(updated.investigation?.status).toBe('awaiting_review');
    expect(updated.investigation?.timeline.at(-1)?.detail).toContain('not a scientific validity claim');
  });

  it('computes stats and renders markdown with explicit scope', () => {
    const inv = investigation();
    const withObservation = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      {
        type: 'observation',
        text: 'Initial oxygen was 22.2%.',
        record_ids: ['BASS2-B1'],
        field_keys: ['oxygen_initial_pct'],
      },
      3,
    );
    const updated = addRecordsToInvestigation(withObservation.document, inv.id, ['BASS2-B1'], 4);
    const final = updated.investigation!;
    expect(notebookStats(final).observations).toBe(1);
    expect(notebookStats(final).records).toBe(1);
    const markdown = notebookToMarkdown(final);
    expect(markdown).toContain('# PMMA in low flow');
    expect(markdown).toContain('not a NASA certification');
    expect(markdown).toContain('BASS2-B1');
  });

  it('persists and rejects malformed or mismatched data', () => {
    const storage = new MemoryStorage();
    const inv = investigation();
    expect(saveNotebook({ schema_version: 1, investigations: [inv] }, storage).ok).toBe(true);
    const loaded = loadNotebook(storage);
    expect(loaded.value.investigations).toHaveLength(1);
    expect(loaded.warning).toBeNull();

    storage.setItem('firetrace.notebook.v1', JSON.stringify({ schema_version: 2, investigations: [] }));
    expect(loadNotebook(storage).warning).toContain('schema 2');
    storage.setItem('firetrace.notebook.v1', '{bad json');
    expect(loadNotebook(storage).warning).toContain('malformed');
    expect(validateNotebookDocument({ schema_version: 1, investigations: [{ id: 'x' }] })).toBeNull();
  });

  it('builds a hashed bundle with copied records and missing references listed', async () => {
    const inv = investigation();
    const attached = addRecordsToInvestigation(emptyNotebookWith(inv), inv.id, ['BASS2-B1'], 2);
    const bundle = await buildNotebookBundle(attached.investigation!, {
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(bundle.files).toHaveLength(5);
    expect(bundle.manifest.file_count).toBe(4);
    for (const file of bundle.manifest.files) expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.files.find((file) => file.path === 'records.json')?.content).toContain('BASS2-B1');
    expect(bundle.manifest.notes.join(' ')).toContain('does not prove a scientific conclusion');
  });

  it('removes an item and records the removal', () => {
    const inv = investigation();
    const added = addNotebookItem(
      emptyNotebookWith(inv),
      inv.id,
      { type: 'note', text: 'A note.' },
      3,
    );
    const removed = removeNotebookItem(added.document, inv.id, added.item!.id, 4);
    expect(removed.investigation?.items).toHaveLength(0);
    expect(removed.investigation?.timeline.at(-1)?.action).toBe('Notebook item removed');
  });
});

function emptyNotebookWith(inv: ReturnType<typeof investigation>) {
  return { schema_version: 1, investigations: [inv] };
}
