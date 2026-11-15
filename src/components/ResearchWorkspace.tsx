import { useState } from 'react';
import { useBasket } from '../lib/basketContext';
import { researchSource } from '../lib/researchData';
import {
  buildBrief,
  citationFor,
  defaultBriefOptions,
  validateBriefOptions,
  type ResearchBrief,
} from '../lib/researchBrief';
import { exportArtifact } from '../lib/researchFormats';
import { downloadText } from '../lib/export';
import { formatCompact } from '../lib/format';
import { Panel, EmptyState, SourceLink } from './ui';
import { RecordDrawer } from './RecordDrawer';
import { ResearchBriefPreview } from './ResearchBriefPreview';

export function ResearchWorkspace() {
  const { state, notices, storageError, dispatch } = useBasket();
  const [confirmClear, setConfirmClear] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [options, setOptions] = useState(defaultBriefOptions);
  const [generated, setGenerated] = useState<{ brief: ResearchBrief; signature: string } | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const signature = JSON.stringify([state.ids, options, researchSource.version]);
  const report =
    generated?.signature === signature && !state.reviewRequired ? generated.brief : null;
  const selected = state.ids.map((id) => researchSource.resolve(id)!).filter(Boolean);
  const compareIds = compare.filter((id) => state.ids.includes(id));
  const errors = validateBriefOptions(options);
  function generate() {
    try {
      setGenerated({
        brief: buildBrief(state.ids, researchSource, options, new Date().toISOString()),
        signature,
      });
      setMessage('Research brief generated from the current basket and dataset.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Brief generation failed.');
    }
  }
  function download(format: 'csv' | 'json' | 'md' | 'html') {
    if (!report) return;
    try {
      const artifact = exportArtifact(report, format);
      downloadText(artifact.filename, artifact.content, artifact.mime);
      setMessage(`Download requested: ${artifact.filename}. Check your browser downloads.`);
    } catch {
      setMessage('Download could not be started. Retry or check browser download settings.');
    }
  }
  return (
    <section className="research-workspace" aria-label="Evidence basket workspace">
      <Panel
        kicker="Persistent research collection"
        title={`Evidence basket · ${selected.length} records`}
      >
        {storageError && (
          <p role="alert">
            Browser storage is unavailable. Your basket works in memory but may not survive a
            reload.
          </p>
        )}
        {notices.map((n, index) => (
          <p role="status" key={index}>
            {n}
          </p>
        ))}
        {state.reviewRequired && (
          <div role="alert">
            <p>
              Review current record values and sources before generating exports. Saved dataset
              references have changed.
            </p>
            <button className="button button--ghost" onClick={() => dispatch({ type: 'review' })}>
              I reviewed the current dataset
            </button>
          </div>
        )}
        {!selected.length ? (
          <EmptyState title="Your evidence basket is empty">
            Select experiments from the Evidence Atlas to build a research collection.{' '}
            <a href="#/atlas">Open Evidence Atlas →</a>
          </EmptyState>
        ) : (
          <>
            <p>
              Basket membership does not establish scientific equivalence. This workspace resolves
              records from bundled dataset <span className="mono">{researchSource.version}</span>.
            </p>
            <div className="basket-actions">
              <button className="text-link" onClick={() => setConfirmClear(true)}>
                Clear basket
              </button>
              <a href="#/atlas">Continue browsing Atlas</a>
            </div>
            {confirmClear && (
              <div role="alert">
                <p>
                  Clear all {selected.length} selected IDs from this basket? Scientific source
                  records will remain available.
                </p>
                <button
                  className="button button--ghost"
                  onClick={() => {
                    dispatch({ type: 'clear' });
                    setConfirmClear(false);
                    setMessage('Basket cleared.');
                  }}
                >
                  Confirm clear basket
                </button>
                <button className="text-link" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </div>
            )}
            <p>
              Choose up to four basket records for the existing Compare view. {compareIds.length}/4
              selected.
            </p>
            {!!compareIds.length && (
              <a
                className="button button--ghost"
                href={`#/compare?ids=${encodeURIComponent(compareIds.join(','))}&from=basket`}
              >
                Compare chosen basket records →
              </a>
            )}
            <div className="basket-records">
              {selected.map((r, index) => {
                const citation = citationFor(r, researchSource);
                return (
                  <article className="basket-record" key={r.experiment_id}>
                    <h3>
                      {r.experiment_id} · {r.family}
                    </h3>
                    <p>
                      {r.material_raw} · {r.geometry}
                    </p>
                    <p>
                      Oxygen: {formatCompact(r.oxygen_initial_pct)} ({r.oxygen_initial_pct.status});
                      pressure: {formatCompact(r.total_pressure_psia)} (
                      {r.total_pressure_psia.status}); flow: {formatCompact(r.flow_initial_cm_s)} (
                      {r.flow_initial_cm_s.status}).
                    </p>
                    <p>
                      Gravity: {r.gravity_regime.value ?? 'Unknown'} ({r.gravity_regime.status});
                      source quality: {r.validation_status}. Flags:{' '}
                      {r.quality_flags.join('; ') || 'none'}.
                    </p>
                    <p className="mono">{r.source_locator}</p>
                    <label>
                      <input
                        type="checkbox"
                        checked={compareIds.includes(r.experiment_id)}
                        disabled={!compareIds.includes(r.experiment_id) && compareIds.length >= 4}
                        onChange={() =>
                          setCompare((ids) =>
                            ids.includes(r.experiment_id)
                              ? ids.filter((id) => id !== r.experiment_id)
                              : [...ids.filter((id) => state.ids.includes(id)), r.experiment_id],
                          )
                        }
                      />{' '}
                      Compare {r.experiment_id}
                    </label>
                    <div className="basket-actions">
                      <button className="text-link" onClick={() => setDetail(r.experiment_id)}>
                        Inspect {r.experiment_id}
                      </button>
                      <button
                        className="text-link"
                        onClick={() => dispatch({ type: 'remove', id: r.experiment_id })}
                      >
                        Remove {r.experiment_id}
                      </button>
                      <button
                        className="text-link"
                        disabled={index === 0}
                        onClick={() => dispatch({ type: 'up', id: r.experiment_id })}
                      >
                        Move {r.experiment_id} up
                      </button>
                      <button
                        className="text-link"
                        disabled={index === selected.length - 1}
                        onClick={() => dispatch({ type: 'down', id: r.experiment_id })}
                      >
                        Move {r.experiment_id} down
                      </button>
                      {citation.url ? (
                        <SourceLink href={citation.url}>NASA source</SourceLink>
                      ) : (
                        <span>Verified source metadata unavailable.</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <h3>Research brief settings</h3>
            <p>
              Title and question are user-supplied purpose metadata, not verified scientific claims.
            </p>
            <label className="field">
              <span>Report title</span>
              <input
                value={options.title}
                maxLength={120}
                onChange={(e) => setOptions({ ...options, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Research question (optional)</span>
              <textarea
                value={options.question}
                maxLength={1000}
                onChange={(e) => setOptions({ ...options, question: e.target.value })}
              />
            </label>
            <div className="basket-actions">
              {(
                [
                  ['detailed', 'Include detailed measurement tables'],
                  ['includeMissing', 'Include missing-record summary'],
                  ['includeSourceNotes', 'Include source notes'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                  />{' '}
                  {label}
                </label>
              ))}
            </div>
            {!!errors.length && <p role="alert">{errors.join(' ')}</p>}
            <button
              className="button button--ember"
              disabled={!!errors.length || state.reviewRequired}
              onClick={generate}
            >
              Generate research brief
            </button>
            {generated && !report && (
              <p role="status">
                Basket, metadata or dataset review changed. Generate a fresh brief before
                downloading.
              </p>
            )}
            <div className="basket-actions">
              {(['csv', 'json', 'md', 'html'] as const).map((format) => (
                <button
                  className="button button--ghost"
                  key={format}
                  disabled={!report}
                  onClick={() => download(format)}
                >
                  Download basket{' '}
                  {format === 'md'
                    ? 'Markdown'
                    : format === 'html'
                      ? 'printable HTML'
                      : format.toUpperCase()}
                </button>
              ))}
            </div>
            <p>
              CSV is a spreadsheet-safe long-form measurement export; JSON retains full source
              records and metadata. Printable HTML is a self-contained report; use browser Print /
              Save as PDF. No direct PDF file generation is claimed.
            </p>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </Panel>
      {report && <ResearchBriefPreview brief={report} />}
      <RecordDrawer
        record={detail ? (researchSource.resolve(detail) ?? null) : null}
        onClose={() => setDetail(null)}
      />
    </section>
  );
}
