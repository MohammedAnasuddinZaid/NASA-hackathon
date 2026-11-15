/**
 * Deterministic verification of claims, answers, and notebook items.
 *
 * The engine never calls a model and never repairs missing data. It checks
 * whether cited sources exist, whether numeric statements are present in the
 * cited normalized evidence, and whether a statement asserts something the
 * corpus explicitly lacks. A failure is reported, not explained away.
 */

import { claims, corpus, corpusVersion, recordById, records, sourceManifest, validation } from './corpus';
import type { Claim, ExperimentRecord } from './types';
import type { AssistantAnswer } from './assistant';
import type { NotebookItem } from './notebook';

export type VerificationVerdict =
  | 'supported'
  | 'partial'
  | 'unsupported'
  | 'contradicted'
  | 'unverifiable';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface VerificationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface EvidenceReference {
  kind: 'record' | 'source' | 'claim';
  id: string;
  locator: string | null;
  exists: boolean;
}

export type VerificationTargetKind =
  | 'corpus_claim'
  | 'assistant_answer'
  | 'notebook_item';

export interface VerificationResult {
  id: string;
  target_kind: VerificationTargetKind;
  target_id: string;
  verdict: VerificationVerdict;
  checks: VerificationCheck[];
  evidence: EvidenceReference[];
  summary: string;
  created_at: string;
  corpus_version: string;
}

export const VERIFICATION_POLICY = 'deterministic-verification-1.0';

export const verdictLabels: Record<VerificationVerdict, string> = {
  supported: 'Supported by cited evidence',
  partial: 'Partially supported',
  unsupported: 'Unsupported',
  contradicted: 'Contradicted by the corpus',
  unverifiable: 'Not verifiable from the corpus',
};

export const verdictTones: Record<VerificationVerdict, 'mint' | 'amber' | 'red' | 'neutral'> = {
  supported: 'mint',
  partial: 'amber',
  unsupported: 'red',
  contradicted: 'red',
  unverifiable: 'neutral',
};

const sourceIds = new Set([
  ...sourceManifest.sources.map((source) => source.source_id),
  ...sourceManifest.context_sources.map((source) => source.source_id),
]);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function check(
  id: string,
  label: string,
  status: CheckStatus,
  detail: string,
): VerificationCheck {
  return { id, label, status, detail };
}

function verdictFromChecks(checks: VerificationCheck[], hasEvidence: boolean): VerificationVerdict {
  if (checks.some((item) => item.status === 'fail' && item.id.startsWith('conflict-'))) {
    return 'contradicted';
  }
  if (checks.some((item) => item.status === 'fail')) return 'unsupported';
  if (!hasEvidence) return 'unverifiable';
  if (checks.some((item) => item.status === 'warn')) return 'partial';
  return 'supported';
}

function summaryFor(verdict: VerificationVerdict): string {
  switch (verdict) {
    case 'supported':
      return 'Every required check passed against the normalized corpus. This is not an independent scientific validation.';
    case 'partial':
      return 'The statement is anchored to real evidence, but at least one check needs review.';
    case 'unsupported':
      return 'At least one required provenance check failed. Do not present this as supported.';
    case 'contradicted':
      return 'The corpus explicitly contradicts part of this statement.';
    case 'unverifiable':
      return 'This target is a working assumption or has no source-backed claim to verify.';
  }
}

/** Numbers in prose, excluding digits embedded in identifiers such as BASS2-B1. */
export function numericTokens(text: string): Array<{ raw: string; value: number }> {
  const result: Array<{ raw: string; value: number }> = [];
  const pattern = /(?<![\w.-])(-?\d+(?:\.\d+)?)(?![\w.-])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) result.push({ raw: match[1], value });
  }
  return result;
}

function dataValueNumbers(record: ExperimentRecord): number[] {
  const values: number[] = [];
  for (const value of Object.values(record)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'value' in value &&
      'status' in value
    ) {
      const raw = (value as { value: unknown }).value;
      if (typeof raw === 'number' && Number.isFinite(raw)) values.push(raw);
    }
  }
  for (const measurement of record.measurements) {
    if (typeof measurement.normalized_value === 'number' && Number.isFinite(measurement.normalized_value)) {
      values.push(measurement.normalized_value);
    }
  }
  if (record.flow_range_cm_s) values.push(...record.flow_range_cm_s.filter(Number.isFinite));
  return values;
}

function factNumbers(): Set<number> {
  const values = new Set<number>([
    records.length,
    claims.length,
    sourceManifest.sources.length,
    sourceManifest.context_sources.length,
    corpus.meta.investigation_count,
  ]);
  for (const count of Object.values(corpus.meta.quality_counts)) values.add(count);
  for (const count of Object.values(corpus.meta.coverage)) values.add(count);
  for (const count of Object.values(validation.quality_counts)) values.add(count);
  for (const count of Object.values(validation.coverage)) values.add(count);
  for (const count of Object.values(validation.quality_flag_counts)) values.add(count);
  for (const count of Object.values(validation.input_rows)) values.add(count);
  for (const count of Object.values(validation.accepted_records)) values.add(count);
  return values;
}

const facts = factNumbers();

export interface NumericFinding {
  token: string;
  found: boolean;
  where: string | null;
}

/**
 * Resolve numbers against a set of cited records. A token passes when it equals
 * a normalized value, a raw-table value, a record identifier component, or a
 * corpus-level fact. A miss is a warning, never silent success.
 */
export function checkNumbers(
  text: string,
  recordIds: string[],
  extraClaims: Claim[] = [],
): NumericFinding[] {
  const recordValues = new Map<number, string>();
  for (const recordId of recordIds) {
    const record = recordById.get(recordId);
    if (!record) continue;
    for (const value of dataValueNumbers(record)) {
      if (!recordValues.has(value)) recordValues.set(value, recordId);
    }
    for (const measurement of record.measurements) {
      const parsed = typeof measurement.normalized_value === 'string'
        ? Number(measurement.normalized_value)
        : measurement.normalized_value;
      if (typeof parsed === 'number' && Number.isFinite(parsed) && !recordValues.has(parsed)) {
        recordValues.set(parsed, recordId);
      }
    }
    for (const raw of Object.values(record.raw)) {
      if (!raw) continue;
      for (const token of numericTokens(raw)) {
        if (!recordValues.has(token.value)) recordValues.set(token.value, recordId);
      }
    }
    for (const token of numericTokens(record.experiment_id)) {
      if (!recordValues.has(token.value)) recordValues.set(token.value, record.experiment_id);
    }
    for (const token of numericTokens(record.test_number)) {
      if (!recordValues.has(token.value)) recordValues.set(token.value, record.test_number);
    }
    for (const token of numericTokens(record.sample_number)) {
      if (!recordValues.has(token.value)) recordValues.set(token.value, record.sample_number);
    }
    if (record.date_reported) {
      for (const token of numericTokens(record.date_reported)) {
        if (!recordValues.has(token.value)) recordValues.set(token.value, record.date_reported);
      }
    }
  }
  for (const claim of extraClaims) {
    for (const token of numericTokens(claim.claim_text)) {
      if (!recordValues.has(token.value)) recordValues.set(token.value, claim.claim_id);
    }
  }

  return numericTokens(text).map((token) => {
    const recordId = recordValues.get(token.value);
    if (recordId) return { token: token.raw, found: true, where: recordId };
    if (facts.has(token.value)) return { token: token.raw, found: true, where: 'corpus aggregate' };
    return { token: token.raw, found: false, where: null };
  });
}

function numericCheck(id: string, label: string, findings: NumericFinding[]): VerificationCheck {
  const missing = findings.filter((finding) => !finding.found);
  if (!findings.length) {
    return check(id, label, 'skip', 'No numeric statement to check.');
  }
  if (!missing.length) {
    return check(id, label, 'pass', `${findings.length} numeric token(s) resolved to cited evidence or corpus aggregates.`);
  }
  return check(
    id,
    label,
    'warn',
    `Not found in the normalized evidence: ${missing.map((finding) => finding.token).join(', ')}. The source document may contain them, but this build cannot confirm that.`,
  );
}

function evidenceFor(sourceId: string, locator: string | null): EvidenceReference {
  return { kind: 'source', id: sourceId, locator, exists: sourceIds.has(sourceId) };
}

function finalize(
  targetKind: VerificationTargetKind,
  targetId: string,
  checks: VerificationCheck[],
  evidence: EvidenceReference[],
  now = new Date(),
): VerificationResult {
  const hasEvidence = evidence.some((item) => item.exists && (item.kind !== 'source' || item.locator));
  const verdict = verdictFromChecks(checks, hasEvidence);
  return {
    id: makeId('verify'),
    target_kind: targetKind,
    target_id: targetId,
    verdict,
    checks,
    evidence,
    summary: summaryFor(verdict),
    created_at: now.toISOString(),
    corpus_version: corpusVersion,
  };
}

export function verifyClaim(claim: Claim, now = new Date()): VerificationResult {
  const checks: VerificationCheck[] = [];
  const evidence: EvidenceReference[] = [];
  checks.push(
    check(
      'claim-text',
      'Claim text is present',
      claim.claim_text.trim().length >= 10 ? 'pass' : 'fail',
      claim.claim_text.trim() ? `${claim.claim_text.trim().length} characters.` : 'The claim has no text.',
    ),
  );
  checks.push(
    check(
      'claim-type',
      'Claim type is declared',
      claim.claim_type.trim() ? 'pass' : 'warn',
      claim.claim_type || 'No claim type.',
    ),
  );
  checks.push(
    check(
      'support-count',
      'At least one supporting source is declared',
      claim.supporting_source_ids.length > 0 ? 'pass' : 'fail',
      `${claim.supporting_source_ids.length} supporting source ID(s).`,
    ),
  );

  const missingSources = claim.supporting_source_ids.filter((sourceId) => !sourceIds.has(sourceId));
  checks.push(
    check(
      'support-exists',
      'Every supporting source exists in the manifest',
      missingSources.length === 0 && claim.supporting_source_ids.length > 0 ? 'pass' : 'fail',
      missingSources.length ? `Missing: ${missingSources.join(', ')}.` : 'All supporting sources resolve.',
    ),
  );

  const locators = claim.supporting_locators.filter((locator) => locator.trim().length > 0);
  checks.push(
    check(
      'locators',
      'A locator is recorded',
      locators.length > 0 ? 'pass' : 'fail',
      locators.length ? locators.join(' · ') : 'No locator was recorded for this claim.',
    ),
  );

  checks.push(
    check(
      'limitation',
      'A limitation is recorded',
      claim.limitation.trim().length > 0 ? 'pass' : 'warn',
      claim.limitation || 'No limitation is recorded.',
    ),
  );

  const claimRecordIds = records
    .filter((record) => claim.supporting_source_ids.includes(record.source_id))
    .map((record) => record.experiment_id);
  checks.push(numericCheck('numbers', 'Numeric statements resolve', checkNumbers(claim.claim_text, claimRecordIds)));

  for (const sourceId of claim.supporting_source_ids) {
    evidence.push(evidenceFor(sourceId, claim.supporting_locators[0] ?? null));
  }

  return finalize('corpus_claim', claim.claim_id, checks, evidence, now);
}

function citedRecordIds(answer: AssistantAnswer): string[] {
  const ids = new Set<string>();
  const pattern = /\b(?:BASS2-[A-Z]\d+[a-z]?|SAFFIRE1-S\d+)\b/gi;
  const text = [answer.headline, ...answer.paragraphs, ...answer.bullets, ...answer.trace].join(' ');
  for (const match of text.matchAll(pattern)) ids.add(match[0].toUpperCase());
  return [...ids];
}

export function verifyAnswer(answer: AssistantAnswer, now = new Date()): VerificationResult {
  const checks: VerificationCheck[] = [];
  const evidence: EvidenceReference[] = [];
  const recordIds = citedRecordIds(answer);
  const citedClaims = (answer.claims ?? [])
    .map((claim) => claims.find((item) => item.claim_text === claim.text))
    .filter((claim): claim is Claim => Boolean(claim));

  checks.push(
    check(
      'headline',
      'Answer has a direct headline',
      answer.headline.trim().length > 0 ? 'pass' : 'fail',
      answer.headline || 'No headline.',
    ),
  );

  checks.push(
    check(
      'citations',
      'Answer cites at least one source',
      answer.citations.length > 0 ? 'pass' : 'fail',
      `${answer.citations.length} citation(s).`,
    ),
  );

  const missing = answer.citations.filter((citation) => !sourceIds.has(citation.sourceId));
  checks.push(
    check(
      'citation-sources',
      'Every cited source exists in the manifest',
      missing.length === 0 && answer.citations.length > 0 ? 'pass' : 'fail',
      missing.length ? `Unknown source(s): ${missing.map((citation) => citation.sourceId).join(', ')}.` : 'All citations resolve.',
    ),
  );

  const missingLocators = answer.citations.filter((citation) => !citation.locator.trim());
  checks.push(
    check(
      'citation-locators',
      'Every citation has a locator',
      missingLocators.length === 0 ? 'pass' : 'warn',
      missingLocators.length ? `${missingLocators.length} citation(s) lack a locator.` : 'All citations carry a locator.',
    ),
  );

  const badClaim = (answer.claims ?? []).find((claim) => !sourceIds.has(claim.sourceId) || !claim.locator.trim());
  checks.push(
    check(
      'answer-claims',
      'Each answer claim resolves to a cited source',
      (answer.claims?.length ?? 0) === 0 ? 'skip' : badClaim ? 'fail' : 'pass',
      badClaim ? `Unresolved claim: ${badClaim.text.slice(0, 80)}` : `${answer.claims?.length ?? 0} claim(s) resolved.`,
    ),
  );

  const body = [answer.headline, ...answer.paragraphs, ...answer.bullets].join(' ');
  checks.push(numericCheck('numbers', 'Body numbers resolve', checkNumbers(body, recordIds, citedClaims)));

  const traceText = answer.trace.join(' ').toLowerCase();
  checks.push(
    check(
      'trace',
      'Retrieval trace is recorded',
      answer.trace.length >= 2 ? 'pass' : 'warn',
      `${answer.trace.length} trace step(s).`,
    ),
  );

  // Explicit conflict checks. These are the only conditions that produce a
  // "contradicted" verdict, so they must be narrow and defensible.
  const pressureClaim = /(\d+(?:\.\d+)?)\s*(?:psi|psia)\b/i.test(body);
  const pressureAvailable = recordIds.some((recordId) => {
    const record = recordById.get(recordId);
    return Boolean(record && record.total_pressure_psia.value !== null);
  });
  const pressureRefusal = /no (?:total )?pressure|pressure is not reported|pressure.*not (?:reported|present)/i.test(body);
  checks.push(
    check(
      'conflict-pressure',
      'Pressure statements agree with the corpus',
      pressureClaim && !pressureAvailable && !pressureRefusal
        ? 'fail'
        : 'pass',
      pressureClaim && !pressureAvailable && !pressureRefusal
        ? 'The answer states a pressure value, but the cited records report no total pressure.'
        : 'No unsupported pressure value detected.',
    ),
  );

  const unsafePattern = /\b(?:this|the)\s+(?:material|sample|polymer)\s+is\s+(?:safe|unsafe)\b/i;
  checks.push(
    check(
      'conflict-safety',
      'No safety certification is asserted',
      unsafePattern.test(body) && answer.grade !== 'out-of-scope' ? 'fail' : 'pass',
      unsafePattern.test(body) && answer.grade !== 'out-of-scope'
        ? 'The answer labels a material safe or unsafe.'
        : 'No material-safety assertion detected.',
    ),
  );

  checks.push(
    check(
      'trace-honesty',
      'Trace does not claim an external model call',
      /openai|gpt-|claude|gemini|external model called/i.test(traceText) && answer.grade !== 'out-of-scope'
        ? 'warn'
        : 'pass',
      'Bundled mode is deterministic and makes no external model call.',
    ),
  );
  for (const citation of answer.citations) {
    evidence.push(evidenceFor(citation.sourceId, citation.locator));
  }
  for (const recordId of recordIds) {
    evidence.push({ kind: 'record', id: recordId, locator: recordById.get(recordId)?.source_locator ?? null, exists: recordById.has(recordId) });
  }

  return finalize('assistant_answer', answer.id, checks, evidence, now);
}

const observationFields = new Set([
  'oxygen_initial_pct',
  'oxygen_final_pct',
  'total_pressure_psia',
  'oxygen_partial_pressure_psi',
  'flow_initial_cm_s',
  'flow_derived_cm_s',
  'thickness_mm',
  'width_cm',
  'length_cm',
  'diameter_mm',
  'ignition_power_w',
  'ignition_time_s',
  'burn_time_s',
  'gravity_regime',
  'ignition_method',
  'outcome',
  'flow_direction',
  'hardware',
]);

export function verifyNotebookItem(item: NotebookItem, now = new Date()): VerificationResult {
  const checks: VerificationCheck[] = [];
  const evidence: EvidenceReference[] = [];

  for (const recordId of item.record_ids) {
    evidence.push({
      kind: 'record',
      id: recordId,
      locator: recordById.get(recordId)?.source_locator ?? null,
      exists: recordById.has(recordId),
    });
  }
  for (const sourceId of item.source_ids) {
    evidence.push({ kind: 'source', id: sourceId, locator: null, exists: sourceIds.has(sourceId) });
  }

  if (item.type === 'observation') {
    const recordsResolve = item.record_ids.length > 0 && item.record_ids.every((recordId) => recordById.has(recordId));
    checks.push(
      check(
        'observation-record',
        'Observation references a real record',
        recordsResolve ? 'pass' : 'fail',
        recordsResolve ? item.record_ids.join(', ') : 'No known record is referenced.',
      ),
    );
    checks.push(
      check(
        'observation-field',
        'Observation names a supported field',
        item.field_keys.length > 0 && item.field_keys.every((field) => observationFields.has(field)) ? 'pass' : 'fail',
        item.field_keys.join(', ') || 'No field is named.',
      ),
    );
    const missingValues: string[] = [];
    for (const recordId of item.record_ids) {
      const record = recordById.get(recordId);
      if (!record) continue;
      for (const field of item.field_keys) {
        const value = (record as unknown as Record<string, { value?: unknown } | undefined>)[field];
        if (!value || value.value === null || value.value === undefined) missingValues.push(`${recordId}.${field}`);
      }
    }
    checks.push(
      check(
        'conflict-observation-value',
        'The cited field actually reports a value',
        missingValues.length ? 'fail' : 'pass',
        missingValues.length
          ? `The corpus reports no value for: ${missingValues.join(', ')}.`
          : 'Every cited field reports a value.',
      ),
    );
    checks.push(
      check(
        'observation-text',
        'Observation text is present',
        item.text.trim().length > 0 ? 'pass' : 'fail',
        item.text.trim() ? `${item.text.trim().length} characters.` : 'No observation text.',
      ),
    );
  } else if (item.type === 'derived_calculation') {
    const run = item.calculation;
    checks.push(
      check(
        'calculation-complete',
        'Calculation has a completed run',
        run && run.status === 'ok' && run.result !== null ? 'pass' : 'fail',
        run ? `${run.definition_id} v${run.definition_version} — ${run.result?.display ?? 'invalid'} ${run.output_unit}` : 'No calculation run is attached.',
      ),
    );
    checks.push(
      check(
        'calculation-inputs',
        'Calculation inputs are finite',
        run && run.inputs.every((input) => Number.isFinite(input.value)) ? 'pass' : 'fail',
        run ? `${run.inputs.length} input(s).` : 'No inputs.',
      ),
    );
  } else if (item.type === 'ai_interpretation') {
    checks.push(
      check(
        'interpretation-evidence',
        'Interpretation cites retrieved evidence',
        item.record_ids.length > 0 || item.source_ids.length > 0 ? 'pass' : 'fail',
        `${item.record_ids.length} record(s), ${item.source_ids.length} source(s).`,
      ),
    );
    checks.push(
      check(
        'interpretation-label',
        'Interpretation is labelled as an interpretation',
        item.type === 'ai_interpretation' ? 'pass' : 'warn',
        'This item is not a source-backed observation.',
      ),
    );
  } else if (item.type === 'comparison_snapshot') {
    checks.push(
      check(
        'comparison-records',
        'Comparison references at least two records',
        item.record_ids.length >= 2 ? 'pass' : 'warn',
        `${item.record_ids.length} record(s).`,
      ),
    );
  } else {
    checks.push(
      check(
        'working-item',
        'Working item is not a source-backed claim',
        'skip',
        'Hypotheses, notes, proposals, and questions are user-authored. They are not verified against the corpus.',
      ),
    );
  }

  if (item.type === 'observation' || item.type === 'derived_calculation') {
    checks.push(numericCheck('numbers', 'Item numbers resolve', checkNumbers(item.text, item.record_ids)));
  }

  return finalize('notebook_item', item.id, checks, evidence, now);
}

export interface VerificationSummary {
  supported: number;
  partial: number;
  unsupported: number;
  contradicted: number;
  unverifiable: number;
  total: number;
}

export function summarizeVerifications(results: VerificationResult[]): VerificationSummary {
  const summary: VerificationSummary = {
    supported: 0,
    partial: 0,
    unsupported: 0,
    contradicted: 0,
    unverifiable: 0,
    total: results.length,
  };
  for (const result of results) summary[result.verdict] += 1;
  return summary;
}

/** Verify every declared corpus claim. Used by the verification center. */
export function verifyAllClaims(now = new Date()): VerificationResult[] {
  return claims.map((claim) => verifyClaim(claim, now));
}
