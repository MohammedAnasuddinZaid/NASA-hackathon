import { useEffect, useMemo, useState } from 'react';
import { recordCitation } from '../lib/corpus';
import { scenarioAccess } from '../lib/scenarioAccess';
import { buildGapPlan } from '../lib/gap';
import type { GravityTarget } from '../lib/gap';
import { oxygenPartialPressure } from '../lib/atmosphere';
import { downloadText } from '../lib/export';
import {
  defaultScenario,
  labels,
  rankCandidates,
  relationLabels,
  researchGaps,
  validateScenario,
  weights,
} from '../lib/scenario';
import type { Scenario } from '../lib/scenario';
import { loadPlannerState, savePlannerState } from '../lib/scenarioState';
import { RecordDrawer } from '../components/RecordDrawer';
import { BasketButton } from '../lib/basketContext';
import { Badge, EmptyState, PageHeader, Panel, SourceLink } from '../components/ui';

const records = scenarioAccess.all();
const optionsFor = (key: 'material_family' | 'geometry' | 'measurement_method' | 'family') =>
  [...new Set(records.map((r) => r[key]))].filter((v) => v && v !== 'Unknown').sort();

export function GapPlanner() {
  const [state, setState] = useState(loadPlannerState);
  const { scenario, selected } = state;
  const [sort, setSort] = useState<'relevance' | 'coverage'>('relevance');
  const [mandatoryMaterial, setMandatoryMaterial] = useState(false);
  const [family, setFamily] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [showAll, setShowAll] = useState(true);
  const [limit, setLimit] = useState(8);
  const [detail, setDetail] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const errors = validateScenario(scenario);
  const candidates = useMemo(
    () =>
      rankCandidates(records, scenario, {
        sort,
        mandatory: mandatoryMaterial ? ['material'] : [],
        investigation: family,
        material: materialFilter,
        showAll,
      }),
    [scenario, sort, mandatoryMaterial, family, materialFilter, showAll],
  );
  const gaps = useMemo(() => researchGaps(candidates), [candidates]);
  const plan = useMemo(
    () =>
      buildGapPlan({
        pressurePsia: scenario.pressure ?? NaN,
        oxygenPct: scenario.oxygen ?? NaN,
        gravity: (scenario.gravity || 'unspecified') as GravityTarget,
        material: scenario.material || 'any',
        flowCmS: scenario.flow,
        objective: 'Evidence correspondence',
      }),
    [scenario],
  );
  const ppO2 =
    scenario.pressure !== null && scenario.oxygen !== null && !errors.length
      ? oxygenPartialPressure({ pressurePsia: scenario.pressure, oxygenPct: scenario.oxygen })
      : null;
  const realSelected = selected.filter((id) => scenarioAccess.find(id));
  useEffect(() => {
    setPersistenceWarning(!savePlannerState(state));
  }, [state]);
  function update<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setState((current) => ({ ...current, scenario: { ...current.scenario, [key]: value } }));
    setLimit(8);
  }
  function toggle(id: string) {
    setState((current) => ({
      ...current,
      selected: current.selected.includes(id)
        ? current.selected.filter((v) => v !== id)
        : current.selected.length < 4
          ? [...current.selected, id]
          : current.selected,
    }));
  }
  function downloadSummary() {
    const report = [
      '# FIRETRACE scenario evidence requirements',
      '',
      'Research support only. Relevance is not safety, scientific confidence, or a test procedure.',
      '',
      '## Hypothetical target',
      ...Object.entries(scenario).map(
        ([key, value]) =>
          `- ${labels[key as keyof Scenario]}: ${value === '' || value === null ? 'unspecified' : value}`,
      ),
      '',
      'Units: oxygen % by vol; pressure psia; flow cm/s; thickness mm. Policy: scenario-retrieval-1.0.',
      '',
      '## Relevant existing evidence',
      ...candidates
        .slice(0, 8)
        .map(
          (c) =>
            `- ${c.record.experiment_id}: ${c.explanation} Source: ${recordCitation(c.record).url}; ${c.record.source_locator}`,
        ),
      '',
      '## Missing measurements and comparability blockers',
      ...gaps.map((g) => `- ${g}`),
      '',
      '## Supported/different/unknown conditions',
      ...candidates
        .slice(0, 8)
        .flatMap((c) =>
          c.conditions
            .filter((e) => e.relation !== 'not_requested')
            .map(
              (e) =>
                `- ${c.record.experiment_id} / ${labels[e.key]}: target ${e.target}; experimental ${e.experimental ?? 'unknown'} ${e.unit ?? ''}; ${relationLabels[e.relation]}. ${e.explanation} ${e.locator}`,
            ),
        ),
      '',
      '## Reporting fields for future research',
      ...plan.requiredFields.map((f) => `- ${f.field} (${f.unit}): ${f.why}`),
      '',
      'No experimental pressure or outcome was inferred. This corpus is not exhaustive NASA research.',
    ];
    downloadText(
      'firetrace-scenario-evidence.md',
      report.join('\n'),
      'text/markdown;charset=utf-8',
    );
  }
  return (
    <div className="page page--gap">
      <PageHeader
        index="04"
        eyebrow="Gap Planner"
        title={
          <>
            Design the test <em>the evidence is missing.</em>
          </>
        }
        lede="Define hypothetical target conditions, inspect actual experiment candidates, and trace matches, differences and unknowns. Retrieval relevance does not establish scientific comparability."
        actions={<Badge tone="amber">No risk score</Badge>}
      />
      <div className="gap-layout">
        <Panel
          kicker="Hypothetical target"
          title="Conditions to investigate"
          className="gap-form-panel"
        >
          <p>Blank means not requested. A target is not an experimental measurement.</p>
          <div className="gap-form">
            <label className="field">
              <span>Material family (hypothetical target)</span>
              <input
                list="scenario-materials"
                value={scenario.material}
                maxLength={200}
                placeholder="Any, or enter an unrepresented material"
                onChange={(e) => update('material', e.target.value)}
              />
              <datalist id="scenario-materials">
                {optionsFor('material_family').map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
            {(
              [
                ['geometry', 'Geometry', 'geometry'],
                ['investigation', 'Target investigation', 'family'],
                ['method', 'Measurement method', 'measurement_method'],
              ] as const
            ).map(([key, label, sourceKey]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <select value={scenario[key]} onChange={(e) => update(key, e.target.value)}>
                  <option value="">Not specified</option>
                  {optionsFor(sourceKey).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="field">
              <span>Gravity target</span>
              <select value={scenario.gravity} onChange={(e) => update('gravity', e.target.value)}>
                <option value="">Not specified</option>
                <option value="microgravity">Orbital microgravity</option>
                <option value="lunar">Lunar partial gravity (hypothetical)</option>
                <option value="mars">Mars partial gravity (hypothetical)</option>
                <option value="earth">Normal gravity (hypothetical)</option>
              </select>
            </label>
            {(
              [
                ['oxygen', 'Oxygen (% by vol)', 0, 100, 0.1],
                ['pressure', 'Total pressure (psia)', 0.001, 500, 0.1],
                ['flow', 'Flow velocity (cm/s)', 0, 1000, 0.1],
                ['thickness', 'Thickness (mm)', 0.001, 1000, 0.01],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={scenario[key] === null || Number.isNaN(scenario[key]) ? '' : scenario[key]}
                  placeholder="Not specified"
                  onChange={(e) =>
                    update(key, e.target.value === '' ? null : e.target.valueAsNumber)
                  }
                />
              </label>
            ))}
            <label className="field">
              <span>Flow direction</span>
              <select
                value={scenario.direction}
                onChange={(e) => update('direction', e.target.value)}
              >
                <option value="">Not specified</option>
                {[
                  ...new Set(
                    records.map((r) => r.flow_direction.value).filter((v): v is string => !!v),
                  ),
                ]
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </label>
          </div>
          {!!errors.length && (
            <div role="alert">
              <h3>Revise target conditions</h3>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {persistenceWarning && !errors.length && (
            <p role="status">
              Session storage is unavailable; keep this tab open to retain your target.
            </p>
          )}
          <div className="target-readout">
            <div>
              <span className="kicker">Calculated ppO2 · target only</span>
              <strong>
                {ppO2 === null ? '—' : ppO2.toFixed(2)} <small>psi</small>
              </strong>
            </div>
            <div className="target-readout__meta">
              <span>
                {scenario.pressure ?? 'unknown'} psia × {scenario.oxygen ?? 'unknown'}% O2
              </span>
              <span>Derived from user inputs; no fire prediction.</span>
            </div>
          </div>
          <button
            className="button button--ember button--full"
            disabled={!!errors.length}
            onClick={downloadSummary}
          >
            Download evidence requirements (.md)
          </button>
          <button
            className="text-link"
            onClick={() => setState({ scenario: { ...defaultScenario }, selected: [] })}
          >
            Reset target and selection
          </button>
        </Panel>
        <div className="gap-results">
          <div className="gap-callout">
            <div className="kicker">Evidence gap</div>
            <p>
              The target is <strong>not directly evidenced</strong>: the imported tables do not
              supply total pressure or measured per-test gravity. A matching value does not resolve
              other experimental differences.
            </p>
            <p>Report pressure context exists elsewhere; it is not assigned to individual rows.</p>
          </div>
          <Panel kicker="Retrieval controls" title="Candidate experiment records">
            <div className="filter-grid">
              <label className="field">
                <span>Order candidates</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="relevance">Retrieval relevance</option>
                  <option value="coverage">Comparable field coverage</option>
                </select>
              </label>
              <label className="field">
                <span>Result investigation filter</span>
                <select
                  value={family}
                  onChange={(e) => {
                    setFamily(e.target.value);
                    setLimit(8);
                  }}
                >
                  <option value="">All investigations</option>
                  {optionsFor('family').map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Result material filter</span>
                <select
                  value={materialFilter}
                  onChange={(e) => {
                    setMaterialFilter(e.target.value);
                    setLimit(8);
                  }}
                >
                  <option value="">All materials</option>
                  {optionsFor('material_family').map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={mandatoryMaterial}
                  onChange={(e) => setMandatoryMaterial(e.target.checked)}
                />{' '}
                Exclude known material differences (unknowns remain unknown)
              </label>
            </p>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                />{' '}
                Include records with no retrieval credit
              </label>
            </p>
            <details>
              <summary>How ranking works · weights and tolerances</summary>
              <p>
                Exact reported category/value: full weight; within numerical retrieval tolerance: ¾;
                approximate/derived similarity: ½. Different, missing, ambiguous, incompatible and
                context-only: zero. Weights are never redistributed.
              </p>
              <p>
                {Object.entries(weights)
                  .map(([key, weight]) => `${labels[key as keyof Scenario]} ${weight}`)
                  .join(' · ')}
              </p>
              <p>
                Numerical tolerances: oxygen max(0.5 percentage points, 5%); pressure max(0.5 psia,
                3%); flow max(0.5 cm/s, 10%); thickness max(0.02 mm, 10%), using the larger
                magnitude. These are retrieval choices, not physical equivalence limits.
              </p>
              <p>
                Ordering: earned points, then comparable field weight, then fewer differences, then
                stable ASCII record ID. Coverage order swaps the first two. Source ranges retain
                bounds; varying flow tokens are not uncertainty. Investigation gravity earns no
                credit.
              </p>
            </details>
            <p role="status">
              {candidates.length} actual records · {candidates.filter((c) => c.earned > 0).length}{' '}
              with retrieval credit · {realSelected.length}/4 selected
            </p>
            {realSelected.length > 0 && (
              <p>
                <a
                  className="button button--ghost"
                  href={`#/compare?ids=${encodeURIComponent(realSelected.join(','))}&from=gap`}
                >
                  Compare selected records →
                </a>
              </p>
            )}
            {!!errors.length ? (
              <p>Fix the target errors to evaluate evidence.</p>
            ) : candidates.length === 0 ? (
              <EmptyState title="No candidate records under these conditions">
                Relax filters or include records with no credit. No equivalent material or
                experiment is inferred.
              </EmptyState>
            ) : (
              candidates.slice(0, limit).map((candidate, index) => {
                const r = candidate.record,
                  citation = recordCitation(r);
                return (
                  <article className="scenario-candidate" key={r.experiment_id}>
                    <h3>
                      {index + 1}. {r.experiment_id} · {r.material_family}
                    </h3>
                    <p>
                      {r.family} · {r.geometry} · source quality: {r.validation_status}
                    </p>
                    <p>
                      <strong>
                        {candidate.earned} / {candidate.requestedWeight} retrieval points
                      </strong>{' '}
                      · comparable field weight {candidate.comparableWeight}/
                      {candidate.requestedWeight}. Heuristic ordering only; never safety or
                      confidence.
                    </p>
                    <p>{candidate.explanation}</p>
                    <BasketButton id={r.experiment_id} />
                    {!!r.quality_flags.length && (
                      <p>Retained flags: {r.quality_flags.join('; ')}</p>
                    )}
                    <label>
                      <input
                        type="checkbox"
                        checked={realSelected.includes(r.experiment_id)}
                        disabled={
                          !realSelected.includes(r.experiment_id) && realSelected.length >= 4
                        }
                        onChange={() => toggle(r.experiment_id)}
                      />{' '}
                      Select {r.experiment_id} for comparison
                    </label>
                    <p>
                      <button className="text-link" onClick={() => setDetail(r.experiment_id)}>
                        Inspect {r.experiment_id} provenance
                      </button>{' '}
                      ·{' '}
                      <a href={`#/atlas?id=${encodeURIComponent(r.experiment_id)}&from=gap`}>
                        Open in Atlas
                      </a>{' '}
                      · <SourceLink href={citation.url}>NASA source</SourceLink>
                    </p>
                    <p className="mono">{citation.locator}</p>
                    <details>
                      <summary>Condition explanations for {r.experiment_id}</summary>
                      <div className="compare-table-wrap">
                        <table className="compare-table">
                          <caption>
                            Requested target versus reported record; no missing-value match credit
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Condition</th>
                              <th scope="col">Target</th>
                              <th scope="col">Experimental</th>
                              <th scope="col">Relationship and evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidate.conditions
                              .filter((c) => c.relation !== 'not_requested')
                              .map((c) => (
                                <tr key={c.key}>
                                  <th scope="row">{labels[c.key]}</th>
                                  <td>
                                    {c.target} {c.targetUnit}
                                  </td>
                                  <td>
                                    {c.experimental ?? 'Unknown'} {c.unit}
                                    <p>{c.status}</p>
                                    {c.raw && <p>Raw: {c.raw}</p>}
                                  </td>
                                  <td>
                                    <strong>{relationLabels[c.relation]}</strong>
                                    <p>{c.explanation}</p>
                                    {c.note && <p>{c.note}</p>}
                                    <p className="mono">
                                      {c.sourceId} · {c.locator}
                                    </p>
                                    <p>
                                      Contribution: {weights[c.key]} × {c.credit} ={' '}
                                      {weights[c.key] * c.credit}
                                    </p>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </article>
                );
              })
            )}
            {limit < candidates.length && (
              <button className="button button--ghost" onClick={() => setLimit((v) => v + 8)}>
                Show 8 more records
              </button>
            )}
          </Panel>
          <Panel kicker="Research-data requirements" title="What a defensible analysis still needs">
            <ul>
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
            <p>
              Reporting requirements only, not instructions for physical combustion experiments.
            </p>
          </Panel>
        </div>
      </div>
      <Panel kicker="Corpus coverage" title="What the current evidence can support">
        <div className="evidence-rows">
          {plan.evidence.map((e) => (
            <div className="evidence-row" key={e.dimension}>
              <h3>{e.dimension}</h3>
              <Badge tone={e.state === 'absent' ? 'red' : 'amber'}>
                {e.state === 'absent'
                  ? 'Absent'
                  : e.state === 'context'
                    ? 'Context only'
                    : 'Partial'}
              </Badge>
              <p>{e.finding}</p>
              <p className="mono">{e.citation}</p>
            </div>
          ))}
        </div>
      </Panel>
      <RecordDrawer
        record={detail ? (scenarioAccess.find(detail) ?? null) : null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
