import { useMemo, useState } from 'react';
import { claims, records } from '../lib/corpus';
import { PageHeader, Panel, Badge, EmptyState } from '../components/ui';
import { ask } from '../lib/assistant';
import type { AssistantAnswer } from '../lib/assistant';
import { loadNotebook } from '../lib/notebook';
import type { NotebookItem } from '../lib/notebook';
import {
  summarizeVerifications,
  verdictLabels,
  verdictTones,
  verifyAllClaims,
  verifyAnswer,
  verifyNotebookItem,
} from '../lib/verification';
import type { VerificationResult, VerificationVerdict } from '../lib/verification';
import { downloadText, verificationToCsv } from '../lib/export';

const VERDICTS: VerificationVerdict[] = ['supported', 'partial', 'unsupported', 'contradicted', 'unverifiable'];

function CheckList({ result }: { result: VerificationResult }) {
  return (
    <ul className="wb-check-list wb-check-list--compact">
      {result.checks.map((check) => (
        <li key={check.id}>
          <Badge
            tone={
              check.status === 'pass'
                ? 'mint'
                : check.status === 'warn'
                  ? 'amber'
                  : check.status === 'fail'
                    ? 'red'
                    : 'muted'
            }
          >
            {check.status}
          </Badge>
          <span>{check.label}</span>
          <span className="muted">{check.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function Verification() {
  const [claimResults] = useState(() => verifyAllClaims());
  const [filter, setFilter] = useState<VerificationVerdict | 'all'>('all');
  const [question, setQuestion] = useState('What pressure was BASS-II run at?');
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [answerResult, setAnswerResult] = useState<VerificationResult | null>(null);
  const notebook = useMemo(() => loadNotebook().value, []);
  const notebookItems = useMemo(
    () =>
      notebook.investigations.flatMap((investigation) =>
        investigation.items.map((item: NotebookItem) => ({
          investigation,
          item,
          result: verifyNotebookItem(item),
        })),
      ),
    [notebook],
  );

  const summary = summarizeVerifications(claimResults);
  const filtered = filter === 'all' ? claimResults : claimResults.filter((result) => result.verdict === filter);

  function verifyQuestion() {
    const next = ask(question);
    setAnswer(next);
    setAnswerResult(verifyAnswer(next));
  }

  return (
    <div className="page page--verification">
      <PageHeader
        index="11"
        eyebrow="Verification Center"
        title={
          <>
            Check the statement, <em>not the tone.</em>
          </>
        }
        lede="Deterministic provenance checks over declared claims, assistant answers, and notebook items. A pass means the cited evidence resolves; it is not an independent scientific validation."
        actions={
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() =>
              downloadText(
                'firertrace-claim-verification.csv',
                verificationToCsv(claimResults),
                'text/csv;charset=utf-8',
              )
            }
          >
            Export verification CSV
          </button>
        }
      />

      <div className="wb-stat-grid">
        <div className="wb-mini-stat">
          <strong>{summary.total}</strong>
          <span>declared claims</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{summary.supported}</strong>
          <span>supported</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{summary.partial}</strong>
          <span>partial</span>
        </div>
        <div className="wb-mini-stat">
          <strong>{summary.unsupported + summary.contradicted}</strong>
          <span>failed checks</span>
        </div>
      </div>

      <Panel kicker="Corpus claims" title={`${claims.length} declared claims`}>
        <div className="wb-chip-row">
          <button
            type="button"
            className={`wb-chip ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({claimResults.length})
          </button>
          {VERDICTS.map((verdict) => (
            <button
              key={verdict}
              type="button"
              className={`wb-chip ${filter === verdict ? 'is-active' : ''}`}
              onClick={() => setFilter(verdict)}
            >
              {verdictLabels[verdict]} ({summary[verdict]})
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No claim has this verdict">
            The filter is valid; no declared claim currently falls into it.
          </EmptyState>
        ) : (
          <ul className="wb-verification-list">
            {filtered.map((result) => {
              const claim = claims.find((item) => item.claim_id === result.target_id);
              return (
                <li key={result.target_id} className="wb-verification">
                  <div className="wb-verification__head">
                    <span className="mono">{result.target_id}</span>
                    <Badge tone={verdictTones[result.verdict]}>{verdictLabels[result.verdict]}</Badge>
                    <span className="muted">{claim?.claim_type}</span>
                  </div>
                  <p className="wb-verification__text">{claim?.claim_text}</p>
                  <p className="panel-caption">{result.summary}</p>
                  <details>
                    <summary>
                      {result.checks.filter((check) => check.status === 'pass').length} pass ·{' '}
                      {result.checks.filter((check) => check.status === 'warn').length} warn ·{' '}
                      {result.checks.filter((check) => check.status === 'fail').length} fail
                    </summary>
                    <CheckList result={result} />
                    <p className="panel-caption">
                      Evidence: {result.evidence.map((item) => `${item.kind}:${item.id}`).join(', ') || 'none'}
                    </p>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel kicker="Answer audit" title="Verify an assistant answer">
        <div className="wb-inline-form">
          <label className="field field--wide">
            <span>Question</span>
            <input type="text" value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          <button type="button" className="button button--ember button--small" onClick={verifyQuestion}>
            Ask and verify
          </button>
        </div>
        {!answer || !answerResult ? (
          <p className="muted">
            The answer is produced by the bundled deterministic engine, then checked for citation resolution, numeric
            support, and explicit conflicts. No model is called.
          </p>
        ) : (
          <div className="wb-answer-audit">
            <div className="wb-verification__head">
              <Badge tone={answer.grade === 'direct' ? 'mint' : answer.grade === 'absent' ? 'muted' : 'amber'}>
                grade: {answer.grade}
              </Badge>
              <Badge tone={verdictTones[answerResult.verdict]}>{verdictLabels[answerResult.verdict]}</Badge>
              <span className="mono muted">{answer.id}</span>
            </div>
            <h3>{answer.headline}</h3>
            {answer.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <ul>
              {answer.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <CheckList result={answerResult} />
            <div className="drawer-section__sub">Citations</div>
            <ul className="wb-citation-list">
              {answer.citations.map((citation) => (
                <li key={`${citation.sourceId}-${citation.locator}`}>
                  <span className="mono">{citation.sourceId}</span> · {citation.locator}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel kicker="Local notebook" title={`${notebookItems.length} item(s) in local investigations`}>
        {notebookItems.length === 0 ? (
          <p className="muted">
            No notebook items are stored in this browser. Open the Research Notebook to record a typed observation or
            calculation.
          </p>
        ) : (
          <ul className="wb-verification-list">
            {notebookItems.map(({ investigation, item, result }) => (
              <li key={item.id} className="wb-verification">
                <div className="wb-verification__head">
                  <span className="mono">{item.type.replaceAll('_', ' ')}</span>
                  <Badge tone={verdictTones[result.verdict]}>{verdictLabels[result.verdict]}</Badge>
                  <span className="muted">{investigation.title}</span>
                </div>
                <p className="wb-verification__text">{item.text || '(calculation only)'}</p>
                <CheckList result={result} />
              </li>
            ))}
          </ul>
        )}
        <p className="panel-caption">
          Hypotheses, notes, proposals, and questions are user-authored working items. They are not verified as
          source-backed claims, and they are never counted as evidence.
        </p>
      </Panel>

      <Panel kicker="Scope" title="What verification can and cannot prove">
        <ul className="wb-check-list">
          <li>
            <Badge tone="mint">checks</Badge>
            <span>Cited source IDs exist in the manifest.</span>
            <span className="muted">Provenance resolution.</span>
          </li>
          <li>
            <Badge tone="mint">checks</Badge>
            <span>Numeric tokens resolve to cited normalized values or corpus aggregates.</span>
            <span className="muted">A miss is a warning, never silent success.</span>
          </li>
          <li>
            <Badge tone="amber">does not</Badge>
            <span>Prove the source experiment is correct or reproducible.</span>
            <span className="muted">Not a peer review.</span>
          </li>
          <li>
            <Badge tone="amber">does not</Badge>
            <span>Re-download or re-hash remote artifacts.</span>
            <span className="muted">Hashes in the manifest are declared fingerprints.</span>
          </li>
        </ul>
        <p className="panel-caption">
          The corpus contains {records.length} records and {claims.length} claims. A verdict applies to the statement
          and its citations, not to the underlying NASA research.
        </p>
      </Panel>
    </div>
  );
}
