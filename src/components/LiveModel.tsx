import { useMemo, useState } from 'react';
import { corpus } from '../lib/corpus';
import {
  clampAtmosphere,
  nearestReference,
  nitrogenPartialPressure,
  oxygenPartialPressure,
} from '../lib/atmosphere';
import { OxygenDistribution } from './charts';

const coverage = corpus.meta.coverage;
const total = corpus.meta.record_count;

export function LiveModel() {
  const [pressure, setPressure] = useState(10.2);
  const [oxygen, setOxygen] = useState(30);
  const [attempted, setAttempted] = useState(false);

  const input = clampAtmosphere({ pressurePsia: pressure, oxygenPct: oxygen });
  const ppO2 = oxygenPartialPressure(input);
  const pn2 = nitrogenPartialPressure(input);
  const closest = useMemo(() => nearestReference(input), [input.pressurePsia, input.oxygenPct]);

  const activePreset = corpus.presets.find(
    (preset) =>
      Math.abs(preset.pressure_psia - input.pressurePsia) < 0.05 &&
      Math.abs(preset.oxygen_pct - input.oxygenPct) < 0.05,
  );

  function change(nextPressure: number, nextOxygen: number) {
    setPressure(nextPressure);
    setOxygen(nextOxygen);
    setAttempted(false);
  }

  const gates = [
    {
      label: 'Initial oxygen fraction',
      value: `${coverage.oxygen_initial_reported} / ${total}`,
      state: 'Reported',
      tone: 'is-ok',
    },
    {
      label: 'Total pressure per test',
      value: `${coverage.pressure_reported} / ${total}`,
      state: 'Absent',
      tone: 'is-absent',
    },
    {
      label: 'Measured per-test gravity',
      value: `${coverage.gravity_per_record_reported} / ${total}`,
      state: 'Absent',
      tone: 'is-absent',
    },
    {
      label: 'Standardized outcome',
      value: `${coverage.standardized_outcome_reported} / ${total}`,
      state: 'Absent',
      tone: 'is-absent',
    },
    {
      label: 'Flow velocity',
      value: `${coverage.flow_reported} / ${total}`,
      state: 'Partial',
      tone: 'is-partial',
    },
  ];

  return (
    <section className="live" id="live-model" aria-labelledby="live-title">
      <div className="live__head">
        <div>
          <span className="kicker">The live model / working</span>
          <h2 id="live-title">
            Place an atmosphere. <em>Watch the corpus push back.</em>
          </h2>
        </div>
        <p className="live__lede">
          The same Dalton-law composition calculation used across FIRETRACE, wired to the real
          normalized records. Set the two numbers, then attempt a placement against the evidence.
        </p>
      </div>

      <div className="live__console">
        <div className="live__controls">
          <div className="live__presets" aria-label="Reference atmospheres">
            {corpus.presets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`live__preset ${activePreset?.id === preset.id ? 'is-active' : ''}`}
                onClick={() => change(preset.pressure_psia, preset.oxygen_pct)}
              >
                <span>{preset.label}</span>
                <small>
                  {preset.pressure_psia} psia / {preset.oxygen_pct}%
                </small>
              </button>
            ))}
          </div>

          <div className="live__sliders">
            <div className="live__field">
              <div className="live__field-head">
                <label htmlFor="live-pressure">Total pressure</label>
                <output htmlFor="live-pressure">
                  {input.pressurePsia.toFixed(1)} <small>psia</small>
                </output>
              </div>
              <input
                id="live-pressure"
                type="range"
                min={2}
                max={16}
                step={0.1}
                value={pressure}
                onChange={(event) => change(Number(event.target.value), oxygen)}
              />
              <div className="live__scale">
                <span>2</span>
                <span>16 psia</span>
              </div>
            </div>

            <div className="live__field">
              <div className="live__field-head">
                <label htmlFor="live-oxygen">Oxygen fraction</label>
                <output htmlFor="live-oxygen">
                  {input.oxygenPct.toFixed(1)} <small>% vol</small>
                </output>
              </div>
              <input
                id="live-oxygen"
                type="range"
                min={5}
                max={100}
                step={0.1}
                value={oxygen}
                onChange={(event) => change(pressure, Number(event.target.value))}
              />
              <div className="live__scale">
                <span>5</span>
                <span>100% vol</span>
              </div>
            </div>
          </div>

          <div className="live__readout" aria-live="polite">
            <div className="live__ppO2">
              <span className="kicker">Oxygen partial pressure</span>
              <strong>
                {ppO2 === null ? '—' : ppO2.toFixed(2)} <small>psi</small>
              </strong>
            </div>
            <dl className="live__readout-list">
              <div>
                <dt>ppN2 + other</dt>
                <dd>{pn2 === null ? '—' : pn2.toFixed(2)} psi</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{input.pressurePsia.toFixed(1)} psia</dd>
              </div>
              <div>
                <dt>Closest reference</dt>
                <dd>{closest?.label ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="live__actions">
            <button
              type="button"
              className="button button--ember"
              onClick={() => setAttempted(true)}
            >
              {attempted ? 'Placement failed' : 'Attempt placement'}{' '}
              <span aria-hidden="true">{attempted ? '\u2715' : '\u2192'}</span>
            </button>
            <a className="button button--ghost" href="#/atmosphere">
              Open full explorer
            </a>
          </div>
          <p className="live__caveat">
            Composition only. This model does not predict ignition, spread, extinction, fire risk or
            material safety.
          </p>
        </div>

        <div className="live__evidence">
          <div className={`live__verdict ${attempted ? 'is-attempted' : ''}`} aria-live="polite">
            <div className="live__verdict-number">
              0<span>/131</span>
            </div>
            <div className="live__verdict-copy">
              <span className="kicker">Placement verdict</span>
              <p>
                {attempted
                  ? 'No record in this corpus can be placed at that point. Total pressure is absent for every record, so the evidence plane has no y-coordinate. The composition is real; the placement is not.'
                  : 'A composition is calculable. A record placement is not. Attempt a placement to run the evidence gates against all 131 records.'}
              </p>
            </div>
            {attempted && (
              <div className="live__stamp" aria-hidden="true">
                Cannot place
              </div>
            )}
          </div>

          <div className="live__gates">
            <div className="live__gates-head">
              <span className="kicker">Evidence gates</span>
              <span className="mono">corpus.json / v{corpus.meta.pipeline_version}</span>
            </div>
            {gates.map((gate) => (
              <div className={`live__gate ${attempted ? 'is-checked' : ''}`} key={gate.label}>
                <span className="live__gate-label">{gate.label}</span>
                <span className="live__gate-value mono">{gate.value}</span>
                <span className={`live__gate-state ${gate.tone}`}>{gate.state}</span>
              </div>
            ))}
          </div>

          <div className="live__chart">
            <div className="live__chart-head">
              <span className="kicker">Real distribution</span>
              <span className="mono">initial O2 / n = {coverage.oxygen_initial_reported}</span>
            </div>
            <OxygenDistribution records={corpus.records} />
          </div>
        </div>
      </div>

      <div className="live__foot">
        <span className="hand">[ 131 records. 0 pressure values. 0 imputed pressures. ]</span>
        <a className="text-link" href="#/assistant">
          Ask the evidence assistant why &rarr;
        </a>
      </div>
    </section>
  );
}
