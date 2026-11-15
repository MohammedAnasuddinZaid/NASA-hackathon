import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ask, answerToText } from '../lib/assistant';
import type { AnswerGrade, AssistantAnswer } from '../lib/assistant';
import { ApiError } from '../lib/apiClient';
import type { ApiAnswer } from '../lib/apiClient';
import { Badge, PageHeader, Panel, SourceLink } from '../components/ui';
import { VoiceAgent } from '../components/VoiceAgent';
import { askTrace, resolveLocalQuestion, TraceUnavailable, TraceRejected } from '../lib/traceClient';
import type { TraceResult } from '../lib/traceClient';
import { useEvidenceSession } from '../lib/evidenceSession';

type Provenance =
  | { source: 'api'; corpusVersion: string; checked: number; validated: number }
  | { source: 'local' };

type Message =
  | { role: 'user'; text: string; id: number }
  | { role: 'assistant'; answer: AssistantAnswer; provenance: Provenance; trace?: TraceResult; id: number }
  | { role: 'error'; text: string; fieldPath: string | null; id: number };

const gradeLabel: Record<AnswerGrade, string> = {
  direct: 'Direct evidence',
  partial: 'Partial evidence',
  context: 'Context only',
  absent: 'Evidence absent',
  'out-of-scope': 'Outside scope',
};

const gradeTone: Record<AnswerGrade, 'mint' | 'amber' | 'neutral' | 'red'> = {
  direct: 'mint',
  partial: 'amber',
  context: 'neutral',
  absent: 'red',
  'out-of-scope': 'red',
};

const suggestions = [
  'What pressure was BASS-II run at?',
  'What oxygen did BASS2-B1 report?',
  'Does the corpus include partial-gravity data?',
  'Compare BASS-II and Saffire-I.',
  'What did LUCI find?',
  'What is missing from the corpus?',
  'Is PMMA safe in a lunar cabin?',
  'Which records are flagged suspect?',
];

/**
 * The evidence API and the bundled engine agree on the answer shape in spirit but
 * use different key casing (snake_case over HTTP, camelCase in the app). This
 * adapter is the only translation point, so the render path stays unchanged.
 */
function fromApiAnswer(answer: ApiAnswer): AssistantAnswer {
  return {
    id: answer.answer_id,
    question: answer.question,
    grade: answer.grade,
    headline: answer.headline,
    paragraphs: answer.paragraphs,
    bullets: answer.bullets,
    claims: answer.claims.map((claim) => ({
      text: claim.text,
      sourceId: claim.source_id,
      locator: claim.locator,
    })),
    citations: answer.citations.map((citation) => ({
      sourceId: citation.source_id,
      title: citation.title,
      locator: citation.locator,
      url: citation.url,
      doi: citation.doi,
    })),
    trace: answer.trace,
    followUps: answer.follow_ups,
  };
}

function provenanceLabel(provenance: Provenance): string {
  if (provenance.source === 'local') return 'local engine · offline';
  const hash = provenance.corpusVersion ? provenance.corpusVersion.slice(0, 12) : 'unknown';
  return `evidence API · corpus ${hash} · ${provenance.validated}/${provenance.checked} claims validated`;
}

export function Assistant() {
  const session = useEvidenceSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [deterministic, setDeterministic] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const counter = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  function nextId(): number {
    counter.current += 1;
    return counter.current;
  }

  function push(message: Message) {
    setMessages((current) => [...current, message].slice(-60));
  }

  async function submit(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    push({ role: 'user', text, id: nextId() });
    setInput('');
    setPending(true);
    setLastQuestion(text);

    try {
      const history = messages.filter((message) => message.role === 'user').slice(-8)
        .map((message) => ({ role: 'user' as const, content: message.role === 'user' ? message.text.slice(0, 1000) : '' }));
      if (session.mode === 'bundled') throw new TraceUnavailable(session.reason);
      const trace = await askTrace(text, history, deterministic);
      const answer = trace.answer;
      push({
        role: 'assistant',
        answer: fromApiAnswer(answer),
        trace,
        provenance: {
          source: 'api',
          corpusVersion: answer.corpus_version,
          checked: answer.validation.checked,
          validated: answer.claims.length,
        },
        id: nextId(),
      });
    } catch (error) {
      if (error instanceof TraceUnavailable) {
        if (session.mode !== 'bundled') session.fallback('TRACE unavailable or dataset mismatch; using bundled evidence.');
        // The service is down: keep working with the bundled deterministic engine
        // and say so under the answer instead of pretending nothing changed.
        push({
          role: 'assistant',
          answer: ask(resolveLocalQuestion(text, messages.filter((m) => m.role === 'user').map((m) => ({ role: 'user', content: m.role === 'user' ? m.text : '' })))),
          provenance: { source: 'local' },
          id: nextId(),
        });
      } else {
        const message =
          error instanceof ApiError || error instanceof TraceRejected
            ? error.message
            : 'The request could not be completed.';
        const fieldPath = error instanceof ApiError ? error.fieldPath : null;
        push({ role: 'error', text: message, fieldPath, id: nextId() });
      }
    } finally {
      setPending(false);
      window.setTimeout(
        () => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
        50,
      );
    }
  }

  async function copyAnswer(message: Extract<Message, { role: 'assistant' }>) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(answerToText(message.answer, message.trace ? {
        notice: message.trace.notice, interpretation: message.trace.interpretation, model: message.trace.model_used,
      } : undefined));
      setCopyStatus('Answer copied.');
    } catch { setCopyStatus('Clipboard unavailable. Select and copy the answer text manually.'); }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(input);
  }

  return (
    <div className="page page--assistant">
      <PageHeader
        index="05"
        eyebrow="Evidence Assistant"
        title={<>Ask the corpus. <em>It will tell you when it can’t answer.</em></>}
        lede="TRACE retrieves verified evidence and can explain it with a server-configured AI model. Exact claims and calculations remain deterministic. Every answer identifies its mode and limitations."
        actions={<Badge tone="mint">Abstention enabled</Badge>}
      />

      <div className="assistant-layout">
        <div className="assistant-main">
          <label className="ask-foot" style={{ justifyContent: 'flex-start', gap: 8 }}><input type="checkbox" checked={deterministic} onChange={(event) => setDeterministic(event.target.checked)} /> Use deterministic evidence only</label>
          <div className="conversation" aria-live="polite">
            {messages.length === 0 ? (
              <div className="assistant-intro">
                <div className="assistant-intro__mark">?</div>
                <h2>Start with a question the sources can settle.</h2>
                <p>
                  Try a record ID, an investigation, a measured quantity, or a deliberate
                  out-of-scope question. Every answer shows its retrieval trace and cites the source
                  locator. If the corpus lacks the field, the assistant abstains.
                </p>
                <div className="suggestion-grid">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} className="suggestion" onClick={() => void submit(suggestion)}>
                      <span>{suggestion}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                if (message.role === 'user') {
                  return (
                    <div className="message message--user" key={message.id}>
                      <div className="message__role mono">YOU</div>
                      <div className="message__bubble">{message.text}</div>
                    </div>
                  );
                }
                if (message.role === 'error') {
                  return (
                    <article className="message message--assistant" key={message.id}>
                      <div className="message__role mono">FIRETRACE / REQUEST REJECTED</div>
                      <div className="answer">
                        <div className="answer__top">
                          <Badge tone="red" dot>
                            Not answered
                          </Badge>
                          {message.fieldPath && (
                            <span className="mono muted">{message.fieldPath}</span>
                          )}
                        </div>
                        <h3>The evidence API rejected this request.</h3>
                        <p>{message.text}</p>
                        <p className="mono muted">
                          The request was not retried against the offline engine, so the server
                          message above is the whole story.
                        </p>
                      </div>
                    </article>
                  );
                }
                return (
                  <article className="message message--assistant" key={message.id}>
                    <div className="message__role mono">FIRETRACE / RETRIEVAL</div>
                    <div className="answer">
                      <div className="answer__top">
                        <Badge tone={gradeTone[message.answer.grade]} dot>
                          {gradeLabel[message.answer.grade]}
                        </Badge>
                        <span className="mono muted">{message.answer.citations.length} citation{message.answer.citations.length === 1 ? '' : 's'}</span>
                      </div>
                      <h3>{message.answer.headline}</h3>
                      <p className="mono muted">{provenanceLabel(message.provenance)}</p>
                      <p role="status">{message.trace?.notice ?? 'Backend unavailable. Bundled deterministic evidence answer; no external model called.'}</p>
                      {message.trace?.interpretation && <section className="answer__citations" aria-label="AI interpretation">
                        <div className="answer__section-label">AI interpretation · {message.trace.model_used}</div>
                        <p>{message.trace.interpretation}</p>
                        <ul>{message.trace.interpretation_evidence_ids.map((id) => {
                          const evidence = message.trace?.evidence.find((item) => item.evidence_id === id);
                          const citationIndex = message.answer.citations.findIndex((citation) => citation.sourceId === evidence?.source_id);
                          return <li key={id}><button className="text-link" onClick={() => document.getElementById(`${message.id}-citation-${citationIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{evidence?.source_id} · {evidence?.locator}</button></li>;
                        })}</ul>
                      </section>}
                      {message.trace && message.trace.ai_status !== 'generated' && message.trace.ai_status !== 'not_applicable' &&
                        <button className="text-link" disabled={pending} onClick={() => void submit(message.answer.question)}>Retry question</button>}
                      {message.answer.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {message.answer.bullets.length > 0 && (
                        <ul className="answer__bullets">
                          {message.answer.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      )}

                      {message.answer.claims && message.answer.claims.length > 0 && (
                        <div className="answer__citations">
                          <div className="answer__section-label">Validated claims</div>
                          <ol>
                            {message.answer.claims.map((claim, index) => (
                              <li key={`${claim.sourceId}-${claim.locator}-${index}`}>
                                <div className="citation__title">{claim.text}</div>
                                <div className="citation__head">
                                  <span className="mono">{claim.sourceId}</span>
                                  <span>{claim.locator}</span>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div className="answer__citations">
                        <div className="answer__section-label">Retrieved sources</div>
                        <ol>
                          {message.answer.citations.map((citation, citationIndex) => (
                            <li id={`${message.id}-citation-${citationIndex}`} key={`${citation.sourceId}-${citation.locator}`}>
                              <div className="citation__head">
                                <span className="mono">{citation.sourceId}</span>
                                <span>{citation.locator}</span>
                              </div>
                              <div className="citation__title">{citation.title}</div>
                              <div className="citation__links">
                                <SourceLink href={citation.url}>Source</SourceLink>
                                {citation.doi && <span className="mono">DOI {citation.doi}</span>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <details className="answer__trace">
                        <summary>Retrieval trace</summary>
                        <ol>
                          {message.answer.trace.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <p className="mono">{message.trace?.ai_status === 'generated' ? 'AI explained the retrieved evidence. Exact claims below were validated independently; citation membership does not prove semantic support.' : 'No external model generated this answer. Evidence constructed deterministically.'}</p>
                        {message.trace && <p className="mono">Resolved query: {message.trace.resolved_question}</p>}
                        {message.trace?.answer.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}
                      </details>

                      <div className="answer__foot">
                        {message.answer.page && (
                          <a className="text-link" href={message.answer.page.href}>{message.answer.page.label} →</a>
                        )}
                        <button
                          className="text-link"
                          onClick={() => void copyAnswer(message)}
                        >
                          Copy answer
                        </button>
                      </div>

                      {message.answer.followUps.length > 0 && (
                        <div className="follow-ups">
                          <span className="mono">Follow up</span>
                          {message.answer.followUps.map((followUp) => (
                            <button key={followUp} onClick={() => void submit(followUp)}>{followUp}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {copyStatus && <p role="status">{copyStatus}</p>}
          <form className="ask-form" onSubmit={onSubmit}>
            <label htmlFor="assistant-input" className="sr-only">Ask the evidence assistant</label>
            <input
              id="assistant-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about a record, a measured field, or a gap…"
              autoComplete="off"
              maxLength={500}
            />
            <button type="submit" className="button button--ember" disabled={!input.trim() || pending}>
              {pending ? 'Retrieving…' : 'Retrieve'} <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="ask-foot">
            <span role="status">{pending ? 'TRACE is retrieving and verifying evidence…' : 'Evidence first · answer mode shown per response'}</span>
            {!pending && lastQuestion && <button className="text-link" onClick={() => void submit(lastQuestion)}>Retry last question</button>}
            {messages.length > 0 && (
              <button className="text-link" disabled={pending} onClick={() => setMessages([])}>Clear conversation</button>
            )}
          </div>
        </div>

        <aside className="assistant-rail">
          <Panel kicker="Policy" title="How an answer is built">
            <ol className="rail-list">
              <li><strong>Match</strong> a record, investigation or supported intent.</li>
              <li><strong>Retrieve</strong> normalized fields, verified claims and source locators.</li>
              <li><strong>Check</strong> whether the field is actually reported.</li>
              <li><strong>Abstain</strong> if the source does not support an answer.</li>
              <li><strong>Cite</strong> the table, page or workbook locator.</li>
            </ol>
          </Panel>

          <Panel kicker="Guarantees" title="What it will never do">
            <ul className="refusal-list">
              <li>Expose model credentials to your browser.</li>
              <li>Fill a missing pressure or gravity value.</li>
              <li>Predict fire risk or certify a material.</li>
              <li>Combine BASS-II and Saffire into one score.</li>
              <li>Present a claim without a source locator.</li>
            </ul>
          </Panel>

          <div className="rail-note">
            <span className="kicker">Why abstention is a feature</span>
            <p>
              A confident sentence is not evidence. The most important answer this corpus can give is
              “the table does not report that field.”
            </p>
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 24 }}>
        <VoiceAgent />
      </div>
    </div>
  );
}
