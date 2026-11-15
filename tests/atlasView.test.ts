import { describe, expect, it } from 'vitest';
import {
  createSavedView,
  decodeAtlasView,
  defaultAtlasView,
  deleteSavedView,
  duplicateSavedView,
  emptySavedViewDocument,
  encodeAtlasView,
  loadSavedViews,
  renameSavedView,
  saveSavedViews,
  validateAtlasView,
  validateSavedViewDocument,
} from '../src/lib/atlasView';
import { MemoryStorage } from '../src/lib/storage';

describe('atlas view state', () => {
  it('round-trips a view through URL parameters', () => {
    const view = {
      ...defaultAtlasView,
      query: 'pmma 22.2',
      family: 'BASS-II',
      material: 'PMMA',
      o2Min: 15,
      o2Max: 25,
      flowOnly: true,
      hasThickness: true,
      sort: 'thickness-desc' as const,
      columns: ['experiment_id', 'oxygen_initial'] as const,
      pageSize: 48,
    };
    const decoded = decodeAtlasView(encodeAtlasView({ ...view, columns: [...view.columns] }));
    expect(decoded.query).toBe('pmma 22.2');
    expect(decoded.family).toBe('BASS-II');
    expect(decoded.o2Min).toBe(15);
    expect(decoded.o2Max).toBe(25);
    expect(decoded.flowOnly).toBe(true);
    expect(decoded.hasThickness).toBe(true);
    expect(decoded.sort).toBe('thickness-desc');
    expect(decoded.columns).toEqual(['experiment_id', 'oxygen_initial']);
    expect(decoded.pageSize).toBe(48);
  });

  it('falls back safely on malformed URL state', () => {
    expect(decodeAtlasView('o2min=80&o2max=20')).toEqual(defaultAtlasView);
    expect(decodeAtlasView('sort=not-a-sort&size=7')).toEqual(defaultAtlasView);
    expect(validateAtlasView({ o2Min: 80, o2Max: 20 })).toBeNull();
  });

  it('does not accept unknown columns', () => {
    const view = validateAtlasView({ columns: ['experiment_id', 'made_up_column'] });
    expect(view?.columns).toEqual(['experiment_id']);
  });
});

describe('saved views', () => {
  it('creates, renames, duplicates, and deletes a view', () => {
    let document = emptySavedViewDocument();
    const created = createSavedView(document, 'Low flow PMMA', defaultAtlasView, 1000);
    expect(created.error).toBeNull();
    document = created.document;
    expect(document.views).toHaveLength(1);
    expect(document.views[0].created_at).toBe(new Date(1000).toISOString());

    const duplicateName = createSavedView(document, 'Low flow PMMA', defaultAtlasView, 2000);
    expect(duplicateName.error).toContain('already exists');

    const renamed = renameSavedView(document, document.views[0].id, 'High oxygen', 3000);
    expect(renamed.view?.name).toBe('High oxygen');
    document = renamed.document;

    const duplicated = duplicateSavedView(document, document.views[0].id, 4000);
    expect(duplicated.document.views).toHaveLength(2);
    expect(duplicated.document.views[1].name).toBe('High oxygen copy');
    document = duplicated.document;

    document = deleteSavedView(document, document.views[0].id);
    expect(document.views).toHaveLength(1);
  });

  it('persists a versioned document and rejects mismatched schema', () => {
    const storage = new MemoryStorage();
    const document = createSavedView(emptySavedViewDocument(), 'View', defaultAtlasView, 1000).document;
    expect(saveSavedViews(document, storage).ok).toBe(true);
    const loaded = loadSavedViews(storage);
    expect(loaded.value.views).toHaveLength(1);
    expect(loaded.warning).toBeNull();

    storage.setItem('firetrace.savedViews.v1', JSON.stringify({ schema_version: 9, views: [] }));
    expect(loadSavedViews(storage).warning).toContain('schema 9');
  });

  it('rejects a malformed saved-view document instead of repairing it', () => {
    expect(validateSavedViewDocument({ schema_version: 1, views: [{ id: 'x' }] })).toBeNull();
    expect(
      validateSavedViewDocument({
        schema_version: 1,
        views: [{ id: 'x', name: 'x', created_at: 'bad', updated_at: 'bad', state: { o2Min: 90, o2Max: 10 } }],
      }),
    ).toBeNull();
  });
});
