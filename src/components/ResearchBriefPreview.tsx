import type { ResearchBrief } from '../lib/researchBrief';
import { valueFields } from '../lib/researchBrief';
import { SourceLink } from './ui';

export function ResearchBriefPreview({ brief }: { brief: ResearchBrief }) {
  return (
    <article className="research-brief" aria-label="Generated research brief">
      <header>
        <div className="kicker">FIRETRACE · derived research product</div>
        <h2>{brief.user_metadata.title}</h2>
        <p>
          Generated {brief.generated_at} · {brief.record_count} selected records
        </p>
        <p className="mono">Dataset SHA-256: {brief.dataset_version}</p>
        <p>
          User-supplied purpose (not verified scientific findings):{' '}
          {brief.user_metadata.research_question || 'No research question supplied.'}
        </p>
      </header>
      <h3>Research scope</h3>
      <ul>
        {brief.summary.investigations.map((i) => (
          <li key={i.family}>
            {i.family}: {i.count} records ({i.record_ids.join(', ')})
          </li>
        ))}
      </ul>
      <h3>Selected experiments</h3>
      <div className="table-wrap">
        <table>
          <caption>Reported conditions, units and source statuses. Unknown is not zero.</caption>
          <thead>
            <tr>
              <th scope="col">Record / material</th>
              <th scope="col">Initial oxygen</th>
              <th scope="col">Total pressure</th>
              <th scope="col">Reported flow</th>
              <th scope="col">Gravity</th>
            </tr>
          </thead>
          <tbody>
            {brief.records.map((r) => (
              <tr key={r.experiment_id}>
                <th scope="row">
                  {r.experiment_id}
                  <p>
                    {r.family} · {r.material_raw}
                  </p>
                </th>
                {[
                  r.oxygen_initial_pct,
                  r.total_pressure_psia,
                  r.flow_initial_cm_s,
                  r.gravity_regime,
                ].map((d, index) => (
                  <td key={index}>
                    {d.value ?? 'Unknown'} {d.unit}
                    <p>{d.status}</p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Evidence observations</h3>
      <ul>
        {brief.summary.coverage.map((c) => (
          <li key={c.field}>
            {c.label}: {c.available}/{c.total} available; {c.measured_or_corrected}{' '}
            measured/corrected, {c.derived} derived, {c.approximate_or_qualitative}{' '}
            approximate/qualitative, {c.context_only} context-only.
            <details>
              <summary>Supporting record IDs</summary>
              <p>Available: {c.reported_ids.join(', ') || 'none'}</p>
            </details>
          </li>
        ))}
      </ul>
      <p>
        Standardized measured outcomes: {brief.summary.standardized_outcome_count}/
        {brief.record_count}. Burn durations and qualitative annotations are not standardized
        outcomes.
      </p>
      <h3>Comparison limitations</h3>
      <ul>
        {brief.comparisons.map((c) => (
          <li key={c.id}>
            <strong>
              {c.label} ({c.state}):
            </strong>{' '}
            {c.detail}
          </li>
        ))}
      </ul>
      {brief.options.includeMissing && (
        <>
          <h3>Missing evidence and research gaps</h3>
          <ul>
            {brief.summary.coverage.map((c) => (
              <li key={c.field}>
                {c.label} unavailable/unverified in: {c.missing_ids.join(', ') || 'none'}.
              </li>
            ))}
          </ul>
          <p>
            These are normalized record-layer gaps; reports elsewhere may contain context not mapped
            to these rows. Required reporting includes measured conditions, methods, units,
            uncertainty and an original source locator.
          </p>
        </>
      )}
      {brief.options.detailed && (
        <>
          <h3>Detailed measurement fields</h3>
          {brief.records.map((r) => (
            <section key={r.experiment_id}>
              <h4>{r.experiment_id}</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Value / unit</th>
                      <th scope="col">Status</th>
                      <th scope="col">Source locator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valueFields(r).map(([key, d]) => (
                      <tr key={key}>
                        <th scope="row">{key}</th>
                        <td>
                          {d.value ?? 'Unknown'} {d.unit}
                        </td>
                        <td>{d.status}</td>
                        <td>{d.source_locator || r.source_locator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
      <h3>Source references</h3>
      <ol>
        {brief.citations.map((c) => (
          <li key={c.experiment_id}>
            <strong>
              {c.experiment_id} · {c.source_id}
            </strong>
            <p>
              {c.title ?? 'Source title unavailable'} · {c.locator} · DOI {c.doi ?? 'not reported'}
            </p>
            {c.url ? <SourceLink href={c.url}>NASA source</SourceLink> : <p>{c.limitation}</p>}
            {brief.options.includeSourceNotes && (
              <details>
                <summary>Correction, approximation and provenance notes</summary>
                {brief.records
                  .find((r) => r.experiment_id === c.experiment_id)!
                  .provenance_notes.map((note, index) => (
                    <p key={index}>{note}</p>
                  ))}
                {valueFields(brief.records.find((r) => r.experiment_id === c.experiment_id)!)
                  .filter(([, d]) => d.note)
                  .map(([key, d]) => (
                    <p key={key}>
                      {key} ({d.status}): {d.note}
                    </p>
                  ))}
              </details>
            )}
          </li>
        ))}
      </ol>
      <h3>Scientific limitations</h3>
      <ul>
        {brief.limitations.map((l, index) => (
          <li key={index}>{l}</li>
        ))}
      </ul>
      <h3>Scientific disclaimer</h3>
      <p className="research-disclaimer">{brief.disclaimer}</p>
    </article>
  );
}
