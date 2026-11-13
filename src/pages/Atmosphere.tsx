import { useMemo, useState } from 'react';
import { corpus } from '../lib/corpus';
import {
  clampAtmosphere,
  corpusOxygenProfile,
  nearestReference,
  nitrogenPartialPressure,
  oxygenPartialPressure,
  references,
} from '../lib/atmosphere';
import { Badge, Callout, PageHeader, Panel, SectionRule, Stat } from '../components/ui';
import { AtmospherePlane, OxygenDistribution } from '../components/charts';

export function Atmosphere() {
  const [pressure, setPressure] = useState(10.2);
  const [oxygen, setOxygen] = useState(30);
  const input = clampAtmosphere({ pressurePsia: pressure, oxygenPct: oxygen });
  const ppO2 = oxygenPartialPressure(input);
  const pn2 = nitrogenPartialPressure(input);
  const profile = useMemo(() => corpusOxygenProfile(), []);
  const closest = nearestReference(input);
  const refs = references();
  const activePreset = corpus.presets.find(
    (preset) => Math.abs(preset.pressure_psia - input.pressurePsia) < 0.05 && Math.abs(preset.oxygen_pct - input.oxygenPct) < 0.05,
  );

  function applyPreset(presetPressure: number, presetOxygen: number) {
    setPressure(presetPressure);
    setOxygen(presetOxygen);
  }

  return (
    <div className="page page--atmosphere">
      <PageHeader
        index="01"
        eyebrow="Atmosphere Explorer"
        title={<>An atmosphere is two numbers. <em>The corpus reports one.</em></>}
        lede="Oxygen fraction without total pressure is not an atmosphere. Explore the composition plane, compare reference points, and see why none of the 131 records can be located here without inventing a value."
        actions={<Badge tone="ember">0 / 131 records placeable</Badge>}
      />

      <div className="atmosphere-layout">
        <Panel
          kicker="Composition calculator"
          title="Set a target atmosphere"
          actions={<span className="mono muted">Dalton law only</span>}
        >
          <div className="preset-row">
            {corpus.presets.map((preset) => (
              <button
                key={preset.id}
                className={`preset ${activePreset?.id === preset.id ? 'is-active' : ''}`}
                onClick={() => applyPreset(preset.pressure_psia, preset.oxygen_pct)}
              >
                <span>{preset.label}</span>
                <span className="mono">{preset.pressure_psia} psia · {preset.oxygen_pct}%</span>
              </button>
            ))}
          </div>

          <div className="control">
            <div className="control__head">
              <label htmlFor="pressure">Total pressure</label>
              <div className="control__number">
                <input
                  id="pressure-number"
                  type="number"
                  min={2}
                  max={16}
                  step={0.1}
                  value={pressure}
                  onChange={(event) => setPressure(Number(event.target.value))}
                  aria-label="Total pressure in psia"
                />
                <span>psia</span>
              </div>
            </div>
            <input
              id="pressure"
              type="range"
              min={2}
              max={16}
              step={0.1}
              value={pressure}
              onChange={(event) => setPressure(Number(event.target.value))}
            />
            <div className="control__scale mono"><span>2</span><span>16 psia</span></div>
          </div>

          <div className="control">
            <div className="control__head">
              <label htmlFor="oxygen">Oxygen fraction</label>
              <div className="control__number">
                <input
                  id="oxygen-number"
                  type="number"
                  min={5}
                  max={100}
                  step={0.1}
                  value={oxygen}
                  onChange={(event) => setOxygen(Number(event.target.value))}
                  aria-label="Oxygen fraction percent by volume"
                />
                <span>% vol</span>
              </div>
            </div>
            <input
              id="oxygen"
              type="range"
              min={5}
              max={100}
              step={0.1}
              value={oxygen}
              onChange={(event) => setOxygen(Number(event.target.value))}
            />
            <div className="control__scale mono"><span>5</span><span>100% by volume</span></div>
          </div>

          <div className="composition-readout">
            <div className="composition-readout__main">
              <span className="kicker">Oxygen partial pressure</span>
              <strong>{ppO2 === null ? '—' : ppO2.toFixed(2)} <small>psi</small></strong>
            </div>
            <div className="composition-readout__side">
              <div><span>ppO2</span><span className="mono">{ppO2 === null ? '—' : `${ppO2.toFixed(2)} psi`}</span></div>
              <div><span>ppN2 + other</span><span className="mono">{pn2 === null ? '—' : `${pn2.toFixed(2)} psi`}</span></div>
              <div><span>Total</span><span className="mono">{input.pressurePsia.toFixed(1)} psia</span></div>
            </div>
          </div>

          <p className="panel-caption">
            ppO2 = total pressure × oxygen fraction. This is a gas-composition calculation. It does
            not predict ignition, flame spread, extinction, fire risk, or material safety.
          </p>
        </Panel>

        <Panel
          kicker="Pressure–oxygen plane"
          title="Where reference atmospheres sit"
          actions={<span className="mono muted">selected: {input.pressurePsia} psia / {input.oxygenPct}%</span>}
        >
          <AtmospherePlane
            selected={{ pressure: input.pressurePsia, oxygen: input.oxygenPct }}
            references={refs}
          />
          <div className="plane-note">
            <p>
              <strong>Same ppO2 is not the same atmosphere.</strong> Earth sea level (14.7 psia,
              20.95% O2) and the lunar planning point (10.2 psia, 30% O2) differ by 4.5 psia yet sit
              at 3.08 and 3.06 psi ppO2; the spacesuit reference is 4.3 psi at 4.3 psia. Composition
              equivalence does not imply equivalent fire behaviour — and the corpus cannot place a
              single test on this plane.
            </p>
          </div>
        </Panel>
      </div>

      <div className="reference-grid">
        {refs.map((reference) => {
          const delta = ppO2 === null ? null : ppO2 - reference.partialPressurePsi;
          return (
            <article className={`reference-card ${closest?.id === reference.id ? 'is-closest' : ''}`} key={reference.id}>
              <div className="reference-card__head">
                <span className={`reference-kind reference-kind--${reference.kind}`}>{reference.kind}</span>
                {closest?.id === reference.id && <Badge tone="mint">Closest by ppO2</Badge>}
              </div>
              <h3>{reference.label}</h3>
              <div className="reference-card__numbers">
                <span><strong>{reference.pressure_psia}</strong> psia</span>
                <span><strong>{reference.oxygen_pct}%</strong> O2</span>
                <span><strong>{reference.partialPressurePsi.toFixed(2)}</strong> psi ppO2</span>
              </div>
              {delta !== null && (
                <div className={`reference-card__delta ${Math.abs(delta) < 0.005 ? 'is-equal' : ''}`}>
                  {Math.abs(delta) < 0.005 ? 'Same ppO2 as target' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} psi vs target`}
                </div>
              )}
              <p>{reference.description}</p>
              <div className="reference-card__caveat">{reference.caveat}</div>
            </article>
          );
        })}
      </div>

      <Callout title="What the chart is not" tone="amber">
        Iso-lines are composition references, not flammability boundaries. A point on the same ppO2
        line as another atmosphere does not inherit its fire behaviour. Pressure, gravity, flow,
        material geometry and ignition all change the experiment. FIRETRACE deliberately withholds a
        “safe / unsafe” overlay.
      </Callout>

      <SectionRule label="The missing y-axis" meta="Why the corpus is not on this chart" />
      <div className="missing-axis">
        <div className="missing-axis__statement">
          <div className="missing-axis__number">0<span>/131</span></div>
          <h2>records report total pressure.</h2>
          <p>
            The oxygen axis is genuinely populated: {profile.initialReported} initial values, ranging
            from {profile.minInitial}% to {profile.maxInitial}%. But every record lacks a pressure
            ordinate. Plotting them at a nominal cabin pressure would fabricate the very measurement
            the chart is meant to test.
          </p>
          <p>
            This is a metadata gap, not evidence that pressure was unmeasured or uncontrolled. The
            experimental table simply does not carry the field.
          </p>
        </div>
        <div className="missing-axis__checks">
          <h3>What would place a record on this plane</h3>
          <ul className="check-list">
            <li><span className="check-list__mark">1</span> A measured total pressure for that test, in psia or an explicit unit.</li>
            <li><span className="check-list__mark">2</span> An oxygen fraction measured on the same test, with its calibration basis.</li>
            <li><span className="check-list__mark">3</span> The pressure and O2 sampled at the same location and time as the sample.</li>
            <li><span className="check-list__mark">4</span> Per-test gravity and flow, or an explicit statement that they were uncontrolled.</li>
          </ul>
          <div className="missing-axis__stats">
            <Stat value={profile.initialReported} label="initial O2 values" tone="mint" />
            <Stat value={profile.finalReported} label="final O2 values" tone="amber" />
            <Stat value="0" label="pressure values" tone="ember" />
            <Stat value="0" label="per-test gravity" tone="ember" />
          </div>
        </div>
      </div>

      <Panel
        kicker="Distribution"
        title="Initial oxygen fraction across the corpus"
        actions={<Badge tone="mint">n = {profile.initialReported}</Badge>}
      >
        <OxygenDistribution records={corpus.records} />
        <div className="distribution-split">
          <p>
            The distribution is descriptive only. It is not a flammability envelope: the same oxygen
            fraction can produce different behaviour at a different pressure, gravity level, flow or
            sample geometry. Two Saffire-I values are approximate midpoints of reported ranges, and
            BASS-II O2 values carry a constant-offset calibration correction.
          </p>
          <div className="family-bars">
            {profile.byFamily.slice(0, 6).map((family) => (
              <div className="family-bars__row" key={family.family}>
                <span>{family.family}</span>
                <span className="family-bars__range mono">{family.min}–{family.max}%</span>
                <span className="family-bars__count mono">n={family.count}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
