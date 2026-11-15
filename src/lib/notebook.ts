/**
 * Local-first research notebook.
 *
 * Every item is explicitly classified. A hypothesis, AI interpretation, or
 * proposal can never silently become a source-backed observation. The store is
 * versioned and validated before use; malformed data is rejected, not repaired
 * by guessing.
 */

import { recordById, sourceManifest } from './corpus';
import type { ExperimentRecord } from './types';
import type { CalculationRun } from './calculation';
import { hashFiles, type HashedFile } from './hash';
import { loadVersioned, saveVersioned, type KeyValueStorage, type LoadResult, type SaveResult } from './storage';

export const NOTEBOOK_SCHEMA = 1;
export const NOTEBOOK_STORAGE_KEY = 'firetrace.notebook.v1';
export const NOTEBOOK_INVESTIGATION_LIMIT = 80;
export const NOTEBOOK_ITEM_LIMIT = 400;
export const NOTEBOOK_RECORD_LIMIT = 60;

export type NotebookItemType =
  | 'observation'
  | 'derived_calculation'
  | 'note'
  | 'hypothesis'
  | 'ai_interpretation'
  | 'proposal'
  | 'coverage_finding'
  | 'comparison_snapshot'
  | 'open_question';

export type InvestigationStatus =
  | 'draft'
  | 'evidence_gathering'
  | 'analysis_in_progress'
  | 'awaiting_review'
  | 'reviewed'
  | 'archived';

export const INVESTIGATION_STATUSES: InvestigationStatus[] = [
  'draft',
  'evidence_gathering',
  'analysis_in_progress',
  'awaiting_review',
  'reviewed',
  'archived',
];

export const statusLabels: Record<InvestigationStatus, string> = {
  draft: 'Draft',
  evidence_gathering: 'Evidence gathering',
  analysis_in_progress: 'Analysis in progress',
  awaiting_review: 'Awaiting review',
  reviewed: 'Reviewed by user',
  archived: 'Archived',
};

export const itemTypeLabels: Record<NotebookItemType, string> = {
  observation: 'Source-backed observation',
  derived_calculation: 'Derived calculation',
  note: 'User note',
  hypothesis: 'Hypothesis / assumption',
  ai_interpretation: 'AI interpretation',
  proposal: 'Proposed future investigation',
  coverage_finding: 'Coverage finding',
  comparison_snapshot: 'Comparison snapshot',
  open_question: 'Open research question',
};

export const itemTypeTones: Record<NotebookItemType, 'mint' | 'amber' | 'neutral' | 'red' | 'muted'> = {
  observation: 'mint',
  derived_calculation: 'amber',
  note: 'neutral',
  hypothesis: 'amber',
  ai_interpretation: 'neutral',
  proposal: 'muted',
  coverage_finding: 'mint',
  comparison_snapshot: 'neutral',
  open_question: 'muted',
};

export interface NotebookItem {
  id: string;
  type: NotebookItemType;
  text: string;
  created_at: string;
  record_ids: string[];
  source_ids: string[];
  field_keys: string[];
  calculation: CalculationRun | null;
}

export interface TimelineEvent {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface Investigation {
  id: string;
  title: string;
  question: string;
  hypothesis: string;
  status: InvestigationStatus;
  record_ids: string[];
  items: NotebookItem[];
  timeline: TimelineEvent[];
  created_at: string;
  updated_at: string;
  corpus_version: string;
}

export interface NotebookDocument {
  schema_version: number;
  investigations: Investigation[];
}

export function emptyNotebook(): NotebookDocument {
  return { schema_version: NOTEBOOK_SCHEMA, investigations: [] };
}

function iso(value: unknown): string {
  if (typeof value !== 'string') return new Date(0).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function strings(value: unknown, limit: number, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= maxLength))].slice(0, limit);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isCalculation(value: unknown): value is CalculationRun {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.calculation_id === 'string' &&
    typeof record.definition_id === 'string' &&
    typeof record.status === 'string' &&
    (record.result === null || typeof record.result === 'object')
  );
}

function validItem(input: unknown): NotebookItem | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 120) return null;
  if (typeof raw.type !== 'string' || !(raw.type in itemTypeLabels)) return null;
  return {
    id: raw.id,
    type: raw.type as NotebookItemType,
    text: text(raw.text, 8000),
    created_at: iso(raw.created_at),
    record_ids: strings(raw.record_ids, NOTEBOOK_RECORD_LIMIT, 80),
    source_ids: strings(raw.source_ids, 40, 80),
    field_keys: strings(raw.field_keys, 40, 80),
    calculation: isCalculation(raw.calculation) ? raw.calculation : null,
  };
}

function validTimeline(input: unknown): TimelineEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 120) return null;
  return {
    id: raw.id,
    at: iso(raw.at),
    action: text(raw.action, 120),
    detail: text(raw.detail, 2000),
  };
}

function validInvestigation(input: unknown): Investigation | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 120) return null;
  if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 160) return null;
  if (typeof raw.status !== 'string' || !(INVESTIGATION_STATUSES as string[]).includes(raw.status)) return null;
  if (!Array.isArray(raw.items) || !Array.isArray(raw.timeline)) return null;
  const items = raw.items.slice(0, NOTEBOOK_ITEM_LIMIT).map(validItem);
  if (items.some((item) => item === null)) return null;
  const timeline = raw.timeline.slice(0, 600).map(validTimeline);
  if (timeline.some((event) => event === null)) return null;
  return {
    id: raw.id,
    title: raw.title.trim(),
    question: text(raw.question, 4000),
    hypothesis: text(raw.hypothesis, 8000),
    status: raw.status as InvestigationStatus,
    record_ids: strings(raw.record_ids, NOTEBOOK_RECORD_LIMIT, 80),
    items: items as NotebookItem[],
    timeline: timeline as TimelineEvent[],
    created_at: iso(raw.created_at),
    updated_at: iso(raw.updated_at),
    corpus_version: text(raw.corpus_version, 80),
  };
}

export function validateNotebookDocument(input: unknown): NotebookDocument | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.investigations)) return null;
  const investigations = raw.investigations.slice(0, NOTEBOOK_INVESTIGATION_LIMIT).map(validInvestigation);
  if (investigations.some((item) => item === null)) return null;
  return { schema_version: NOTEBOOK_SCHEMA, investigations: investigations as Investigation[] };
}

export function loadNotebook(
  storage?: KeyValueStorage | null,
): LoadResult<NotebookDocument> {
  return loadVersioned(
    NOTEBOOK_STORAGE_KEY,
    NOTEBOOK_SCHEMA,
    emptyNotebook,
    validateNotebookDocument,
    storage,
  );
}

export function saveNotebook(
  document: NotebookDocument,
  storage?: KeyValueStorage | null,
): SaveResult {
  return saveVersioned(NOTEBOOK_STORAGE_KEY, document, storage);
}

function id(prefix: string, now: number): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${now.toString(36)}-${random}`;
}

function touch(investigation: Investigation, now: number): Investigation {
  return { ...investigation, updated_at: new Date(now).toISOString() };
}

function event(action: string, detail: string, now: number): TimelineEvent {
  return { id: id('evt', now), at: new Date(now).toISOString(), action, detail };
}

export interface InvestigationMutation {
  document: NotebookDocument;
  investigation: Investigation | null;
  error: string | null;
}

export function createInvestigation(
  document: NotebookDocument,
  input: { title: string; question?: string; hypothesis?: string; corpus_version?: string },
  now = Date.now(),
): InvestigationMutation {
  const title = input.title.trim().slice(0, 160);
  if (!title) return { document, investigation: null, error: 'Give the investigation a title.' };
  if (document.investigations.length >= NOTEBOOK_INVESTIGATION_LIMIT) {
    return { document, investigation: null, error: `Investigation limit is ${NOTEBOOK_INVESTIGATION_LIMIT}.` };
  }
  const stamp = new Date(now).toISOString();
  const investigation: Investigation = {
    id: id('inv', now),
    title,
    question: (input.question ?? '').slice(0, 4000),
    hypothesis: (input.hypothesis ?? '').slice(0, 8000),
    status: 'draft',
    record_ids: [],
    items: [],
    timeline: [event('Investigation created', 'Local draft created. No source evidence attached yet.', now)],
    created_at: stamp,
    updated_at: stamp,
    corpus_version: (input.corpus_version ?? '').slice(0, 80),
  };
  return {
    document: { ...document, investigations: [investigation, ...document.investigations] },
    investigation,
    error: null,
  };
}

export function updateInvestigation(
  document: NotebookDocument,
  investigationId: string,
  patch: Partial<Pick<Investigation, 'title' | 'question' | 'hypothesis' | 'status'>>,
  now = Date.now(),
): InvestigationMutation {
  let updated: Investigation | null = null;
  const investigations = document.investigations.map((investigation) => {
    if (investigation.id !== investigationId) return investigation;
    const next: Investigation = { ...investigation };
    if (patch.title !== undefined) {
      const title = patch.title.trim().slice(0, 160);
      if (!title) return investigation;
      next.title = title;
    }
    if (patch.question !== undefined) next.question = patch.question.slice(0, 4000);
    if (patch.hypothesis !== undefined) next.hypothesis = patch.hypothesis.slice(0, 8000);
    if (patch.status !== undefined && (INVESTIGATION_STATUSES as string[]).includes(patch.status)) {
      if (patch.status !== investigation.status) {
        next.timeline = [
          ...investigation.timeline,
          event('Workflow status changed', `${statusLabels[investigation.status]} → ${statusLabels[patch.status]}. This is a workflow state, not a scientific validity claim.`, now),
        ].slice(-600);
      }
      next.status = patch.status;
    }
    updated = touch(next, now);
    return updated;
  });
  return updated
    ? { document: { ...document, investigations }, investigation: updated, error: null }
    : { document, investigation: null, error: 'Investigation not found.' };
}

export function deleteInvestigation(document: NotebookDocument, investigationId: string): NotebookDocument {
  return { ...document, investigations: document.investigations.filter((item) => item.id !== investigationId) };
}

export function addRecordsToInvestigation(
  document: NotebookDocument,
  investigationId: string,
  recordIds: string[],
  now = Date.now(),
): InvestigationMutation {
  const valid = [...new Set(recordIds.filter((recordId) => recordById.has(recordId)))];
  if (!valid.length) return { document, investigation: null, error: 'No known record IDs were supplied.' };
  let updated: Investigation | null = null;
  const investigations = document.investigations.map((investigation) => {
    if (investigation.id !== investigationId) return investigation;
    const merged = [...new Set([...investigation.record_ids, ...valid])].slice(0, NOTEBOOK_RECORD_LIMIT);
    updated = touch({
      ...investigation,
      record_ids: merged,
      timeline: [...investigation.timeline, event('Records attached', `${valid.join(', ')} added as referenced evidence.`, now)].slice(-600),
    }, now);
    return updated;
  });
  return updated
    ? { document: { ...document, investigations }, investigation: updated, error: null }
    : { document, investigation: null, error: 'Investigation not found.' };
}

export function removeRecordFromInvestigation(
  document: NotebookDocument,
  investigationId: string,
  recordId: string,
  now = Date.now(),
): InvestigationMutation {
  let updated: Investigation | null = null;
  const investigations = document.investigations.map((investigation) => {
    if (investigation.id !== investigationId) return investigation;
    updated = touch({
      ...investigation,
      record_ids: investigation.record_ids.filter((item) => item !== recordId),
      timeline: [...investigation.timeline, event('Record reference removed', `${recordId} removed from the investigation.`, now)].slice(-600),
    }, now);
    return updated;
  });
  return updated
    ? { document: { ...document, investigations }, investigation: updated, error: null }
    : { document, investigation: null, error: 'Investigation not found.' };
}

export interface DefaultInvestigationResult extends InvestigationMutation {
  created: boolean;
}

/**
 * Add a record to the most recently updated active investigation, creating a
 * visible draft if none exists. The UI reports the target investigation name;
 * it never claims the record was added silently.
 */
export function addRecordToDefaultInvestigation(
  document: NotebookDocument,
  recordId: string,
  options: { title?: string; corpusVersion?: string; now?: number } = {},
): DefaultInvestigationResult {
  const now = options.now ?? Date.now();
  const target = [...document.investigations]
    .filter((investigation) => investigation.status !== 'archived' && investigation.status !== 'reviewed')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (target) {
    const added = addRecordsToInvestigation(document, target.id, [recordId], now);
    return { ...added, created: false };
  }
  const created = createInvestigation(
    document,
    {
      title: options.title ?? `Atlas record ${recordId}`,
      question: `What does ${recordId} report, and what does it not report?`,
      corpus_version: options.corpusVersion ?? '',
    },
    now,
  );
  if (!created.investigation) return { ...created, created: false };
  const added = addRecordsToInvestigation(created.document, created.investigation.id, [recordId], now);
  return { ...added, created: true };
}

export interface ItemMutation extends InvestigationMutation {
  item: NotebookItem | null;
}

export interface NewNotebookItem {
  type: NotebookItemType;
  text: string;
  record_ids?: string[];
  source_ids?: string[];
  field_keys?: string[];
  calculation?: CalculationRun | null;
}

const sourceIds = new Set([
  ...sourceManifest.sources.map((source) => source.source_id),
  ...sourceManifest.context_sources.map((source) => source.source_id),
]);

export function addNotebookItem(
  document: NotebookDocument,
  investigationId: string,
  input: NewNotebookItem,
  now = Date.now(),
): ItemMutation {
  if (!(input.type in itemTypeLabels)) return { document, investigation: null, item: null, error: 'Unsupported item type.' };
  const recordIds = strings(input.record_ids, NOTEBOOK_RECORD_LIMIT, 80).filter((recordId) => recordById.has(recordId));
  const sourceIdsInput = strings(input.source_ids, 40, 80).filter((sourceId) => sourceIds.has(sourceId));
  if (input.type === 'observation' && (!recordIds.length || !input.field_keys?.length)) {
    return { document, investigation: null, item: null, error: 'An observation needs a real record and field.' };
  }
  if (input.type === 'observation') {
    const missing: string[] = [];
    for (const recordId of recordIds) {
      const record = recordById.get(recordId);
      if (!record) continue;
      for (const field of input.field_keys ?? []) {
        const value = (record as unknown as Record<string, { value?: unknown } | undefined>)[field];
        if (!value || value.value === null || value.value === undefined) missing.push(`${recordId}.${field}`);
      }
    }
    if (missing.length) {
      return {
        document,
        investigation: null,
        item: null,
        error: `The corpus reports no value for ${missing.join(', ')}. Record a coverage finding instead of an observation.`,
      };
    }
  }
  if (input.type === 'derived_calculation' && (!input.calculation || input.calculation.status !== 'ok')) {
    return { document, investigation: null, item: null, error: 'Only a completed calculation can be recorded.' };
  }
  if (input.type === 'ai_interpretation' && !sourceIdsInput.length && !recordIds.length) {
    return { document, investigation: null, item: null, error: 'An AI interpretation must cite retrieved evidence.' };
  }
  if (!input.text.trim() && input.type !== 'derived_calculation') {
    return { document, investigation: null, item: null, error: 'Add text to this item.' };
  }
  let updated: Investigation | null = null;
  let item: NotebookItem | null = null;
  const investigations = document.investigations.map((investigation) => {
    if (investigation.id !== investigationId) return investigation;
    if (investigation.items.length >= NOTEBOOK_ITEM_LIMIT) return investigation;
    item = {
      id: id('item', now),
      type: input.type,
      text: input.text.slice(0, 8000),
      created_at: new Date(now).toISOString(),
      record_ids: recordIds,
      source_ids: sourceIdsInput,
      field_keys: strings(input.field_keys, 40, 80),
      calculation: input.calculation ?? null,
    };
    updated = touch({
      ...investigation,
      items: [...investigation.items, item],
      timeline: [...investigation.timeline, event('Notebook item added', `${itemTypeLabels[item.type]}: ${item.text.slice(0, 140) || item.calculation?.definition_id || ''}`, now)].slice(-600),
    }, now);
    return updated;
  });
  if (!updated || !item) {
    return { document, investigation: null, item: null, error: 'Investigation not found or item limit reached.' };
  }
  return { document: { ...document, investigations }, investigation: updated, item, error: null };
}

export function removeNotebookItem(
  document: NotebookDocument,
  investigationId: string,
  itemId: string,
  now = Date.now(),
): InvestigationMutation {
  let updated: Investigation | null = null;
  const investigations = document.investigations.map((investigation) => {
    if (investigation.id !== investigationId) return investigation;
    const item = investigation.items.find((entry) => entry.id === itemId);
    if (!item) return investigation;
    updated = touch({
      ...investigation,
      items: investigation.items.filter((entry) => entry.id !== itemId),
      timeline: [...investigation.timeline, event('Notebook item removed', `${itemTypeLabels[item.type]} removed by the user.`, now)].slice(-600),
    }, now);
    return updated;
  });
  return updated
    ? { document: { ...document, investigations }, investigation: updated, error: null }
    : { document, investigation: null, error: 'Item not found.' };
}

export interface NotebookStats {
  records: number;
  observations: number;
  calculations: number;
  notes: number;
  hypotheses: number;
  aiInterpretations: number;
  proposals: number;
  openQuestions: number;
  unresolvedRecordIds: string[];
}

export function notebookStats(investigation: Investigation): NotebookStats {
  const count = (type: NotebookItemType) => investigation.items.filter((item) => item.type === type).length;
  return {
    records: investigation.record_ids.length,
    observations: count('observation'),
    calculations: count('derived_calculation'),
    notes: count('note'),
    hypotheses: count('hypothesis'),
    aiInterpretations: count('ai_interpretation'),
    proposals: count('proposal'),
    openQuestions: count('open_question'),
    unresolvedRecordIds: investigation.record_ids.filter((recordId) => !recordById.has(recordId)),
  };
}

export function investigationRecords(investigation: Investigation): ExperimentRecord[] {
  return investigation.record_ids
    .map((recordId) => recordById.get(recordId))
    .filter((record): record is ExperimentRecord => Boolean(record));
}

/** Markdown for a notebook. All user text is escaped for safe table/heading use. */
export function notebookToMarkdown(investigation: Investigation): string {
  const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = [
    `# ${escape(investigation.title)}`,
    '',
    `**Workflow state:** ${statusLabels[investigation.status]} — a workflow state, not a claim of scientific validity.`,
    '',
    '## Research question',
    '',
    escape(investigation.question) || '_Not written yet._',
    '',
    '## Hypothesis or working assumption',
    '',
    escape(investigation.hypothesis) || '_Not written yet._',
    '',
    '## Referenced records',
    '',
    ...(investigation.record_ids.length
      ? investigation.record_ids.map((recordId) => {
          const record = recordById.get(recordId);
          return record
            ? `- ${recordId} — ${escape(record.material_raw)} — ${escape(record.source_id)}, ${escape(record.source_locator)}`
            : `- ${recordId} — unresolved in this corpus version`;
        })
      : ['_No records attached._']),
    '',
    '## Notebook items',
    '',
    ...(investigation.items.length
      ? investigation.items.flatMap((item) => {
          const refs = item.record_ids.length ? ` Records: ${item.record_ids.join(', ')}.` : '';
          const sources = item.source_ids.length ? ` Sources: ${item.source_ids.join(', ')}.` : '';
          const calc = item.calculation
            ? ` Formula: ${item.calculation.formula}. Inputs: ${item.calculation.inputs.map((input) => `${input.key}=${input.value} ${input.unit}`).join(', ')}. Result: ${item.calculation.result?.value ?? 'invalid'} ${item.calculation.result?.unit ?? ''}.`
            : '';
          return [`### ${itemTypeLabels[item.type]}`, '', `${escape(item.text)}${refs}${sources}${calc}`, ''];
        })
      : ['_No items._']),
    '## Timeline',
    '',
    ...investigation.timeline.map((entry) => `- ${entry.at} — ${escape(entry.action)} — ${escape(entry.detail)}`),
    '',
    '## Scope',
    '',
    'This notebook is a local research workspace. User hypotheses and AI interpretations are not source-backed observations. It is not a NASA certification, a safety assessment, or a prediction of fire behavior.',
    '',
  ];
  return lines.join('\n');
}

export interface NotebookBundle {
  investigation: Investigation;
  files: HashedFile[];
  manifest: {
    bundle_schema_version: number;
    generated_at: string;
    corpus_version: string;
    investigation_id: string;
    investigation_title: string;
    file_count: number;
    files: Array<{ path: string; sha256: string; bytes: number }>;
    notes: string[];
  };
}

/**
 * A self-contained JSON bundle. It separates copied source records from derived
 * notebook content and records missing artifacts instead of omitting them.
 */
export async function buildNotebookBundle(
  investigation: Investigation,
  options: { generatedAt?: string; appVersion?: string } = {},
): Promise<NotebookBundle> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const records = investigationRecords(investigation);
  const missingRecordIds = investigation.record_ids.filter((recordId) => !recordById.has(recordId));
  const sourceIds = new Set(investigation.items.flatMap((item) => item.source_ids));
  const sources = sourceManifest.sources
    .filter((source) => sourceIds.has(source.source_id))
    .map((source) => ({
      ...source,
      artifact_available_locally: Boolean(source.local_original_url),
    }));
  const missingSources = [...sourceIds].filter(
    (sourceId) =>
      !sourceManifest.sources.some((source) => source.source_id === sourceId) &&
      !sourceManifest.context_sources.some((source) => source.source_id === sourceId),
  );

  const investigationJson = JSON.stringify(
    {
      schema_version: NOTEBOOK_SCHEMA,
      generated_at: generatedAt,
      corpus_version: investigation.corpus_version,
      app_version: options.appVersion ?? null,
      investigation,
    },
    null,
    2,
  );
  const recordsJson = JSON.stringify(
    {
      note: 'Copied normalized records. Missing values remain null; status fields are preserved.',
      record_ids: investigation.record_ids,
      missing_record_ids: missingRecordIds,
      records,
    },
    null,
    2,
  );
  const notesMarkdown = notebookToMarkdown(investigation);
  const provenanceJson = JSON.stringify(
    {
      note: 'Source references and artifact availability. A hash is a content fingerprint, not scientific validation.',
      sources,
      missing_source_ids: missingSources,
    },
    null,
    2,
  );

  const hashed = await hashFiles([
    { path: 'investigation.json', content: investigationJson },
    { path: 'records.json', content: recordsJson },
    { path: 'notes.md', content: notesMarkdown },
    { path: 'provenance.json', content: provenanceJson },
  ]);
  const manifest = {
    bundle_schema_version: 1,
    generated_at: generatedAt,
    corpus_version: investigation.corpus_version,
    investigation_id: investigation.id,
    investigation_title: investigation.title,
    file_count: hashed.length,
    files: hashed.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
    notes: [
      'Copied source records and derived notebook content are separate files.',
      'Missing record or source references are listed explicitly.',
      'A SHA-256 value proves content identity only; it does not prove a scientific conclusion.',
    ],
  };
  const manifestFile = await hashFiles([
    { path: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
  ]);
  return {
    investigation,
    files: [...hashed, manifestFile[0]],
    manifest,
  };
}
