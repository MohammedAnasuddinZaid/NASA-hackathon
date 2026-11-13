import { useMemo, useState } from 'react';
import { records } from '../lib/corpus';
import { buildGapPlan, gravityLabels } from '../lib/gap';
import type { GapTarget, GravityTarget } from '../lib/gap';
import { nearestReference, oxygenPartialPressure } from '../lib/atmosphere';
import { downloadText } from '../lib/export';
import { Badge, Callout, PageHeader, Panel, SectionRule } from '../components/ui';

const stateLabel = {
  direct: 'Direct',
  partial: 'Partial',
  context: 'Context only',
  absent: 'Absent',
} as const;

const stateTone = {
  direct: 'mint',
  partial: 'amber',
  context: 'neutral',
  absent: 'red',
} as const;

const objectives = [
  'Material screening',
  'Flame spread measurement',
  'Extinction limit',
  'Ignition sensitivity',
  'Model validation',
];

export function GapPlanner() {
  const materials = useMemo(
    () => [...new Set(records.map((record) => record.material_family))].filter((value) => value !== 'Unknown').sort(),
    [],
  );
  const [target, setTarget] = useState<GapTarget>({
    pressurePsia: 10.2,
    oxygenPct: 30,
    gravity: 'lunar',
    material: 'any',
    flowCmS: 20,
    objective: objectives[0],
  });
  const plan = useMemo(() => buildGapPlan(target), [target]);
  const closest = nearestReference(target);
  const ppO2 = oxygenPartialPressure(target);

  function update<K extends keyof GapTarget>(key: K, value: GapTarget[K]) {
    setTarget((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="page page--gap">
      <PageHeader
        index="04"
        eyebrow="Gap Planner"
        title={<>Design the test <em>the evidence is missing.</em></>}
        lede="Set a target condition and see which parts of it the corpus can support, which it cannot, and what a defensible test would need to record. A planning checklist — not a prediction, protocol, or certification."
        actions={<Badge tone="amber">No risk score</Badge>}
      />

      <div className="gap-layout">
        <Panel kicker="Target condition" title="What do you need to know?" className="gap-form-panel">
          <div className="gap-form">
            <label className="field">
              <span>Objective</span>
              <select value={target.objective} onChange={(event) => update('objective', event.target.value)}>
                {objectives.map((objective) => (
                  <option key={objective} value={objective}>{objective}</option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label className="field">
                <span>Total pressure (psia)</span>
                <input
                  type="number"
                  min={2}
                  max={16}
                  step={0.1}
                  value={target.pressurePsia}
                  onChange={(event) => update('pressurePsia', Number(event.target.value))}
                />
              </label>
              <label className="field">
                <span>Oxygen (% by vol)</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  step={0.1}
                  value={target.oxygenPct}
                  onChange={(event) => update('oxygenPct', Number(event.target.value))}
                />
              </label>
            </div>

            <label className="field">
              <span>Gravity regime</span>
              <select
                value={target.gravity}
                onChange={(event) => update('gravity', event.target.value as GravityTarget)}
              >
                {Object.entries(gravityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Material of interest</span>
              <select value={target.material} onChange={(event) => update('material', event.target.value)}>
                <option value="any">Any / not specified</option>
                {materials.map((material) => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Flow velocity (cm/s)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={target.flowCmS ?? ''}
                placeholder="Not specified"
                onChange={(event) =>
                  update('flowCmS', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </label>
          </div>

          <div className="target-readout">
            <div>
              <span className="kicker">Calculated ppO2</span>
              <strong>{ppO2 === null ? '—' : ppO2.toFixed(2)} <small>psi</small></strong>
            </div>
            <div className="target-readout__meta">
              <span>{target.pressurePsia} psia × {target.oxygenPct}% O2</span>
              <span>Closest reference: {closest?.label ?? '—'}</span>
              <span className="muted">Composition reference only; not a flammability assessment.</span>
            </div>
          </div>

          <button
            className="button button--ember button--full"
            onClick={() =>
              downloadText(
                'firertrace-evidence-gap-plan.md',
                plan.markdown,
                'text/markdown;charset=utf-8',
              )
            }
          >
            Download plan (.md) <span aria-hidden="true">↓</span>
          </button>
        </Panel>

        <div className="gap-results">
          <div className="gap-callout">
            <div className="gap-callout__head">
              <span className="kicker">Bottom line</span>
              <Badge tone="amber">Evidence gap</Badge>
            </div>
            <p>
              The corpus supports oxygen fraction and some material/flow context. It does not support
              atmospheric placement, per-test gravity, or a standardized outcome. The target condition
              is therefore <strong>not directly evidenced</strong> by BASS-II or Saffire-I.
            </p>
            <div className="gap-callout__facts">
              <span><strong>0</strong> pressure values</span>
              <span><strong>0</strong> per-test gravity</span>
              <span><strong>0</strong> standardized outcomes</span>
            </div>
          </div>

          <Panel kicker="Coverage" title="What the current evidence can support">
            <div className="evidence-rows">
              {plan.evidence.map((row) => (
                <div className="evidence-row" key={row.dimension}>
                  <div className="evidence-row__top">
                    <span className="evidence-row__dimension">{row.dimension}</span>
                    <Badge tone={stateTone[row.state]}>{stateLabel[row.state]}</Badge>
                  </div>
                  <p className="evidence-row__question">{row.question}</p>
                  <p className="evidence-row__finding">{row.finding}</p>
                  <div className="evidence-row__citation">{row.citation}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <SectionRule label="Test design" meta="What to record, not what will happen" />
      <div className="plan-grid">
        <Panel kicker="Required measurements" title="Fields a comparable test must carry">
          <ol className="required-list">
            {plan.requiredFields.map((field, index) => (
              <li key={field.field}>
                <span className="required-list__index mono">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <div className="required-list__field">{field.field} <span className="mono">({field.unit})</span></div>
                  <p>{field.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="plan-side">
          <Panel kicker="Controls" title="Comparability controls">
            <ul className="check-list check-list--compact">
              {plan.controls.map((control) => (
                <li key={control}><span className="check-list__mark">✓</span>{control}</li>
              ))}
            </ul>
          </Panel>

          <Callout title="Claims this plan does not support" tone="ember">
            <ul className="refusal-list">
              {plan.unsupportedClaims.map((claim) => (
                <li key={claim}>{claim}</li>
              ))}
            </ul>
          </Callout>
        </div>
      </div>

      <div className="gap-foot">
        <div>
          <div className="kicker">Provenance</div>
          <p>
            Generated from BASS-II (PSI-25, 129 records) and Saffire-I (PSI-98, 2 records). Pressure
            and per-test gravity are absent from both experimental tables. No external model was called.
          </p>
        </div>
        <a className="button button--ghost button--small" href="#/methodology">Read the limitations →</a>
      </div>
    </div>
  );
}
