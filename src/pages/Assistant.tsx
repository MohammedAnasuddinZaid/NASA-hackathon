import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ask, answerToText } from '../lib/assistant';
import type { AnswerGrade, AssistantAnswer } from '../lib/assistant';
import { Badge, PageHeader, Panel, SourceLink } from '../components/ui';

type Message =
  | { role: 'user'; text: string; id: number }
  | { role: 'assistant'; answer: AssistantAnswer; id: number };

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

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const counter = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  function submit(question: string) {
    const text = question.trim();
    if (!text) return;
    counter.current += 1;
    const user: Message = { role: 'user', text, id: counter.current };
    counter.current += 1;
    const assistant: Message = { role: 'assistant', answer: ask(text), id: counter.current };
    setMessages((current) => [...current, user, assistant]);
    setInput('');
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(input);
  }

  return (
    <div className="page page--assistant">
      <PageHeader
        index="05"
        eyebrow="Evidence Assistant"
        title={<>Ask the corpus. <em>It will tell you when it can’t answer.</em></>}
        lede="A deterministic retrieval and citation engine over the bundled records, claims and source manifest. No external language model, no API call, no generated scientific claims."
        actions={<Badge tone="mint">Abstention enabled</Badge>}
      />

      <div className="assistant-layout">
        <div className="assistant-main">
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
                    <button key={suggestion} className="suggestion" onClick={() => submit(suggestion)}>
                      <span>{suggestion}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) =>
                message.role === 'user' ? (
                  <div className="message message--user" key={message.id}>
                    <div className="message__role mono">YOU</div>
                    <div className="message__bubble">{message.text}</div>
                  </div>
                ) : (
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

                      <div className="answer__citations">
                        <div className="answer__section-label">Retrieved sources</div>
                        <ol>
                          {message.answer.citations.map((citation) => (
                            <li key={`${citation.sourceId}-${citation.locator}`}>
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
                        <p className="mono">No external model was called. Answer constructed from bundled fields.</p>
                      </details>

                      <div className="answer__foot">
                        {message.answer.page && (
                          <a className="text-link" href={message.answer.page.href}>{message.answer.page.label} →</a>
                        )}
                        <button
                          className="text-link"
                          onClick={() => navigator.clipboard?.writeText(answerToText(message.answer))}
                        >
                          Copy answer
                        </button>
                      </div>

                      {message.answer.followUps.length > 0 && (
                        <div className="follow-ups">
                          <span className="mono">Follow up</span>
                          {message.answer.followUps.map((followUp) => (
                            <button key={followUp} onClick={() => submit(followUp)}>{followUp}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ),
              )
            )}
            <div ref={endRef} />
          </div>

          <form className="ask-form" onSubmit={onSubmit}>
            <label htmlFor="assistant-input" className="sr-only">Ask the evidence assistant</label>
            <input
              id="assistant-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about a record, a measured field, or a gap…"
              autoComplete="off"
            />
            <button type="submit" className="button button--ember" disabled={!input.trim()}>
              Retrieve <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="ask-foot">
            <span>Deterministic · local · cites every answer</span>
            {messages.length > 0 && (
              <button className="text-link" onClick={() => setMessages([])}>Clear conversation</button>
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
              <li>Call an external AI model or API.</li>
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
    </div>
  );
}
