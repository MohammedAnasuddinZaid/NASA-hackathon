/**
 * Typed client for the FIRETRACE evidence API (`/api/v1`).
 *
 * Three properties matter for a provenance-first UI:
 *
 * 1. A request that cannot reach the service throws `ServiceUnavailable`, which
 *    the caller resolves by falling back to the bundled deterministic engine.
 * 2. A request the service rejected throws `ApiError` carrying the server's own
 *    message and field path. That is *not* a reason to fall back silently: the
 *    user must see the validation message.
 * 3. Every successful call exposes `corpusVersion`, so the UI can print the
 *    exact dataset hash an answer was produced from.
 */
import { API_BASE } from './api';

export type AnswerGrade = 'direct' | 'partial' | 'context' | 'absent' | 'out-of-scope';

export type ValueStatus =
  | 'measured'
  | 'derived'
  | 'investigation_level'
  | 'not_reported'
  | 'not_extracted'
  | 'over_range'
  | 'reported_flag'
  | 'reported_qualitative';

export interface ApiCitation {
  source_id: string;
  title: string;
  locator: string;
  url: string;
  doi: string | null;
}

export interface ApiClaim {
  text: string;
  source_id: string;
  locator: string;
  evidence_type: string;
  evidence_ids: string[];
  unit: string | null;
}

export interface ApiRetrieval {
  mode: string;
  query_terms: string[];
  hits: Array<{ kind: string; ref_id: string; score: number }>;
  record_hits: string[];
}

export interface ApiValidation {
  ok: boolean;
  checked: number;
  rejected: number;
  issues: string[];
}

export interface ApiAnswer {
  answer_id: string;
  corpus_version: string;
  question: string;
  grade: AnswerGrade;
  headline: string;
  claims: ApiClaim[];
  paragraphs: string[];
  bullets: string[];
  limitations: string[];
  contradictions: string[];
  missing_conditions: string[];
  citations: ApiCitation[];
  trace: string[];
  retrieval: ApiRetrieval;
  validation: ApiValidation;
  follow_ups: string[];
  policy_version: string;
  answer_schema_version: string;
  disclaimer: string;
  out_of_scope_reason: string | null;
}

export interface ValueField {
  value: unknown;
  unit: string | null;
  status: ValueStatus;
  note?: string | null;
  basis?: string | null;
  raw?: unknown;
}

export interface ExperimentBrief {
  experiment_id: string;
  test_number: string | null;
  family: string | null;
  material_raw: string | null;
  material_family: string | null;
  material_species: string | null;
  geometry: string | null;
  validation_status: string | null;
  source_id: string | null;
  source_locator: string | null;
  oxygen_initial_pct: ValueField | null;
  total_pressure_psia: ValueField | null;
  flow_initial_cm_s: ValueField | null;
  gravity_regime: ValueField | null;
  corpus_version: string;
}

export interface ExperimentPage {
  corpus_version: string;
  items: ExperimentBrief[];
  total: number;
  limit: number;
  offset: number;
  filters: Record<string, unknown>;
}

export interface ExperimentDetail {
  corpus_version: string;
  experiment_id: string;
  source_id: string;
  source_locator: string;
  fields: Record<string, ValueField>;
  validation_status: string | null;
  quality_flags: string[];
  missing_fields: string[];
  limitations: string[];
  [key: string]: unknown;
}

export interface Coverage {
  corpus_version: string;
  record_count: number;
  family_counts: Record<string, number>;
  validation_status_counts: Record<string, number>;
  recomputed: Record<string, number>;
  field_coverage: Record<
    string,
    { label: string; reported: number; missing: number; statuses: Record<string, number>; units: string[] }
  >;
  gaps: string[];
}

export type FieldOutcome = 'matched' | 'mismatched' | 'unknown';

export interface ComparisonField {
  field: string;
  label: string;
  category: 'consequential' | 'contextual';
  unit: string | null;
  values: Record<string, ValueField>;
  outcome: FieldOutcome;
  tolerance: { abs: number | null; rel: number | null } | null;
  explanation: string;
}

export interface Comparison {
  corpus_version: string;
  matching_policy: string;
  experiments: Array<Record<string, unknown>>;
  fields: ComparisonField[];
  summary: Record<FieldOutcome, number>;
  blockers: Array<{ field: string; label: string; explanation: string }>;
  unknowns: Array<{ field: string; label: string; explanation: string }>;
  confounders: Array<{ field: string; label: string; explanation: string }>;
  applicability: 'Matched conditions' | 'Partial match' | 'Mechanistic context' | 'No applicable record';
  applicability_reason: string;
  fused_score: null;
  score_note: string;
}

export interface ScenarioBody {
  material?: string;
  gravity?: string;
  oxygen_pct?: number;
  pressure_psia?: number;
  flow?: number;
}

export interface ScenarioResult {
  corpus_version: string;
  requested: Record<string, unknown>;
  applicability: Comparison['applicability'];
  applicability_reason: string;
  coverage_gaps: string[];
  candidates: Array<Record<string, unknown>>;
  class_counts: Record<string, number>;
  matching_policy: string;
  not_provided: string[];
  disclaimer: string;
}

export interface ExportBody {
  kind: 'evidence_brief' | 'records_csv' | 'claims_csv';
  ids?: string[];
  question?: string;
  family?: string;
  limit?: number;
}

export interface ExportResult {
  corpus_version: string;
  kind: ExportBody['kind'];
  content_type: string;
  filename: string;
  content: string;
  row_count: number;
  generated_at: string;
}

export interface AskBody {
  question: string;
  filters?: {
    family?: string;
    material?: string;
    gravity?: string;
    min_o2?: number;
    max_o2?: number;
    flow_only?: boolean;
    validation_status?: string;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldPath: string | null;
  readonly details: Array<Record<string, unknown>>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldPath: string | null = null,
    details: Array<Record<string, unknown>> = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldPath = fieldPath;
    this.details = details;
  }
}

/** The service could not be reached, timed out, or reported itself unavailable. */
export class ServiceUnavailable extends ApiError {
  constructor(message: string, code = 'service_unavailable', status = 0) {
    super(status, code, message);
    this.name = 'ServiceUnavailable';
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; corpusVersion: string }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ServiceUnavailable(
      isTimeout(error)
        ? 'The evidence API did not respond in time.'
        : 'The evidence API is not reachable.',
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const corpusVersion = response.headers.get('X-Corpus-Version') ?? '';
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new ServiceUnavailable(
        extractMessage(payload) ?? 'The evidence API is temporarily unavailable.',
        'service_unavailable',
        response.status,
      );
    }
    throw new ApiError(
      response.status,
      extractCode(payload, response.status),
      extractMessage(payload) ?? `Request failed with status ${response.status}.`,
      extractFieldPath(payload),
      extractDetails(payload),
    );
  }

  return { data: payload as T, corpusVersion };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractMessage(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const message = record.message ?? record.detail;
  return typeof message === 'string' ? message : null;
}

function extractCode(payload: unknown, status: number): string {
  const record = asRecord(payload);
  const code = record?.error;
  return typeof code === 'string' ? code : `http_${status}`;
}

function extractFieldPath(payload: unknown): string | null {
  const record = asRecord(payload);
  const path = record?.field_path;
  return typeof path === 'string' ? path : null;
}

function extractDetails(payload: unknown): Array<Record<string, unknown>> {
  const record = asRecord(payload);
  const details = record?.details;
  return Array.isArray(details) ? (details as Array<Record<string, unknown>>) : [];
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface ExperimentQuery {
  q?: string;
  family?: string;
  material?: string;
  gravity?: string;
  min_o2?: number;
  max_o2?: number;
  flow_only?: boolean;
  validation_status?: string;
  limit?: number;
  offset?: number;
}

export const evidenceApi = {
  async ask(body: AskBody, signal?: AbortSignal): Promise<ApiAnswer> {
    const { data } = await request<ApiAnswer>('/api/v1/ask', {
      method: 'POST',
      body,
      signal,
    });
    return data;
  },

  async experiments(query: ExperimentQuery = {}): Promise<ExperimentPage> {
    const { data } = await request<ExperimentPage>(
      `/api/v1/experiments${toQuery(query as Record<string, string | number | boolean | undefined>)}`,
    );
    return data;
  },

  async experiment(experimentId: string): Promise<ExperimentDetail> {
    const { data } = await request<ExperimentDetail>(
      `/api/v1/experiments/${encodeURIComponent(experimentId)}`,
    );
    return data;
  },

  async source(sourceId: string): Promise<Record<string, unknown>> {
    const { data } = await request<Record<string, unknown>>(
      `/api/v1/sources/${encodeURIComponent(sourceId)}`,
    );
    return data;
  },

  async coverage(): Promise<Coverage> {
    const { data } = await request<Coverage>('/api/v1/coverage');
    return data;
  },

  async compare(ids: string[]): Promise<Comparison> {
    const { data } = await request<Comparison>('/api/v1/compare', {
      method: 'POST',
      body: { ids },
    });
    return data;
  },

  async evaluateScenario(body: ScenarioBody): Promise<ScenarioResult> {
    const { data } = await request<ScenarioResult>('/api/v1/scenarios/evaluate', {
      method: 'POST',
      body,
    });
    return data;
  },

  async export(body: ExportBody): Promise<ExportResult> {
    const { data } = await request<ExportResult>('/api/v1/exports', {
      method: 'POST',
      body,
    });
    return data;
  },
};

export { API_BASE };