import { describe, expect, it } from 'vitest';
import { claims } from '../src/lib/corpus';
import { ask } from '../src/lib/assistant';
import type { AssistantAnswer } from '../src/lib/assistant';
import type { NotebookItem } from '../src/lib/notebook';
import {
  checkNumbers,
  numericTokens,
  summarizeVerifications,
  verifyAllClaims,
  verifyAnswer,
  verifyClaim,
  verifyNotebookItem,
} from '../src/lib/verification';

function fabricatedAnswer(overrides: Partial<AssistantAnswer> = {}): AssistantAnswer {
  return {
    id: 'ans-test',
    question: 'test',
    grade: 'direct',
    headline: 'BASS2-B1 ran at 14.7 psia.',
    paragraphs: [],
    bullets: [],
    citations: [
      {
        sourceId: 'PSI-25',
        title: 'PSI-25',
        locator: 'CSV row 2',
        url: 'https://psi.nasa.gov/',
      },
    ],
    trace: ['Matched a record.', 'Read a value.'],
    followUps: [],
    ...overrides,
  };
}

function observation(overrides: Partial<NotebookItem> = {}): NotebookItem {
  return {
    id: 'item-test',
    type: 'observation',
    text: 'Initial oxygen was 22.2%.',
    created_at: new Date(0).toISOString(),
    record_ids: ['BASS2-B1'],
    source_ids: ['PSI-25'],
    field_keys: ['oxygen_initial_pct'],
    calculation: null,
    ...overrides,
  };
}

describe('numeric verification', () => {
  it('does not treat digits inside identifiers as numeric claims', () => {
    expect(numericTokens('BASS2-B1 at 22.2% and 131 records')).toEqual([
      { raw: '22.2', value: 22.2 },
      { raw: '131', value: 131 },
    ]);
  });

  it('resolves a reported value and flags an absent one', () => {
    const findings = checkNumbers('22.2% and 14.7 psia', ['BASS2-B1']);
    expect(findings.find((finding) => finding.token === '22.2')?.found).toBe(true);
    expect(findings.find((finding) => finding.token === '14.7')?.found).toBe(false);
  });
});

describe('corpus claim verification', () => {
  it('does not fail a required check for any declared claim', () => {
    const results = verifyAllClaims(new Date('2026-01-01T00:00:00Z'));
    expect(results).toHaveLength(claims.length);
    const summary = summarizeVerifications(results);
    expect(summary.unsupported).toBe(0);
    expect(summary.contradicted).toBe(0);
    expect(summary.supported + summary.partial).toBe(claims.length);
    for (const result of results) {
      expect(result.evidence.some((evidence) => evidence.exists)).toBe(true);
      expect(result.checks.some((check) => check.id === 'support-exists' && check.status === 'pass')).toBe(true);
    }
  });

  it('marks an unknown source as unsupported', () => {
    const claim = { ...claims[0], supporting_source_ids: ['NOT-A-SOURCE'] };
    const result = verifyClaim(claim);
    expect(result.verdict).toBe('unsupported');
  });
});

describe('assistant answer verification', () => {
  it('accepts a real pressure abstention', () => {
    const result = verifyAnswer(ask('What pressure was BASS-II run at?'));
    expect(result.verdict).not.toBe('contradicted');
    expect(result.verdict).not.toBe('unsupported');
  });

  it('contradicts a fabricated pressure value', () => {
    const result = verifyAnswer(fabricatedAnswer());
    expect(result.verdict).toBe('contradicted');
    expect(result.checks.find((check) => check.id === 'conflict-pressure')?.status).toBe('fail');
  });

  it('rejects a citation to a source that is not in the manifest', () => {
    const result = verifyAnswer(
      fabricatedAnswer({
        headline: 'BASS2-B1 reports initial oxygen.',
        citations: [{ sourceId: 'MADE-UP', title: 'x', locator: 'x', url: 'https://example.com' }],
      }),
    );
    expect(result.verdict).toBe('unsupported');
  });
});

describe('notebook item verification', () => {
  it('supports an observation of a reported field', () => {
    const result = verifyNotebookItem(observation());
    expect(result.verdict).toBe('supported');
  });

  it('contradicts an observation of an unreported pressure', () => {
    const result = verifyNotebookItem(
      observation({ text: 'Total pressure was 14.7 psia.', field_keys: ['total_pressure_psia'] }),
    );
    expect(result.verdict).toBe('contradicted');
    expect(result.checks.find((check) => check.id === 'conflict-observation-value')?.status).toBe('fail');
  });

  it('marks an uncited AI interpretation as unsupported', () => {
    const result = verifyNotebookItem(
      observation({ type: 'ai_interpretation', text: 'The material will not burn.', record_ids: [], source_ids: [], field_keys: [] }),
    );
    expect(result.verdict).toBe('unsupported');
  });

  it('treats a hypothesis as a working item, not evidence', () => {
    const result = verifyNotebookItem(
      observation({ type: 'hypothesis', text: 'Oxygen may dominate.', record_ids: [], source_ids: [], field_keys: [] }),
    );
    expect(result.verdict).toBe('unverifiable');
  });
});
