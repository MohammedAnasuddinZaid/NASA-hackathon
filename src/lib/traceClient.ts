import { API_BASE } from './apiClient';
import { bundledCorpusVersion } from './datasetIdentity';
import type { ApiAnswer } from './apiClient';

export interface TraceHistory { role: 'user' | 'assistant'; content: string }
export class TraceUnavailable extends Error {}
export class TraceRejected extends Error {}
export function resolveLocalQuestion(question: string, history: TraceHistory[]): string {
  if (/BASS|SAFFIRE|PSI-|LUCI/i.test(question) || !/\b(it|its|they|their|them|those|these|one|ones|which|that)\b/i.test(question)) return question;
  for (const message of [...history].reverse()) {
    if (message.role !== 'user') continue;
    const subjects = message.content.match(/BASS2-[A-Z]\d+[a-z]?|SAFFIRE1-S\d+|BASS-II|Saffire-I|LUCI/gi);
    if (subjects?.length) return `${question} (${[...new Set(subjects)].join(', ').slice(0, 120)})`;
  }
  return question;
}
export interface TraceResult {
  answer: ApiAnswer;
  answer_type: 'ai_powered' | 'deterministic' | 'insufficient_evidence';
  ai_status: string;
  model_used: string | null;
  interpretation: string | null;
  interpretation_evidence_ids: string[];
  evidence: Array<{ evidence_id: string; source_id: string; locator: string; text: string }>;
  notice: string;
  resolved_question: string;
}

export async function askTrace(question: string, history: TraceHistory[], deterministic: boolean): Promise<TraceResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(`${API_BASE}/api/v1/assistant/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Corpus-Version': bundledCorpusVersion },
      body: JSON.stringify({ question, conversation_history: history.slice(-8), mode: deterministic ? 'deterministic' : 'auto' }),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status >= 500 || response.status === 404 || response.status === 409) throw new TraceUnavailable('TRACE unavailable or dataset incompatible.');
      throw new TraceRejected(`TRACE request rejected (${response.status}). Retry later or revise the question.`);
    }
    const result = await response.json() as TraceResult;
    if (response.headers.get('X-Corpus-Version') !== bundledCorpusVersion || result.answer?.corpus_version !== bundledCorpusVersion)
      throw new TraceUnavailable('TRACE dataset differs from the bundled evidence.');
    if (!result.answer || !Array.isArray(result.evidence) || !result.notice) throw new TraceRejected('Invalid TRACE response. Retry the request.');
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) throw new TraceRejected('TRACE returned an unreadable response. Retry the request.');
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) throw new TraceUnavailable('TRACE unreachable.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}
