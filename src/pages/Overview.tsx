import { corpus, coverage } from '../lib/corpus';
import { corpusOxygenProfile } from '../lib/atmosphere';
import { Badge, PageHeader, Panel, SectionRule, SourceLink, Stat } from '../components/ui';
import { FlameMark } from '../components/AppShell';
import { OxygenDistribution } from '../components/charts';
import { DemoReel } from '../components/DemoReel';

const features = [
  {
    index: '01',
    title: 'Atmosphere Explorer',
    text: 'Compute gas composition, compare reference atmospheres, and see exactly why the corpus cannot be placed on a pressure plane.',
    href: '#/atmosphere',
  },
  {
    index: '02',
    title: 'Evidence Atlas',
    text: 'Search 131 records, inspect raw source rows, flags and provenance, and export the exact evidence behind a claim.',
    href: '#/atlas',
  },
  {
    index: '03',
    title: 'Compare',
    text: 'Put records side by side and read the comparability blockers instead of a misleading similarity score.',
    href: '#/compare',
  },
  {
    index: '04',
    title: 'Gap Planner',
    text: 'Turn a target atmosphere into a list of measurements and reporting controls the current evidence cannot replace.',
    href: '#/gap',
  },
];

export function Overview() {
  const profile = corpusOxygenProfile();
  return (
    <div className="page page--overview">
      <section className="hero">
        <div className="hero__copy">
          <div className="hero__eyebrow">
            <span className="index-mark">00</span>
            <span className="eyebrow">NASA Space Apps 2026 · Flame in Freefall</span>
          </div>
          <h1 className="hero__title">
            Fire changes when gravity lets go.
            <span className="hero__title-sub">The evidence should say so.</span>
          </h1>
          <p className="hero__lede">
            FIRETRACE turns public NASA microgravity combustion experiment tables into a traceable
            evidence workspace. It shows what the tests measured, what they did not, and why a
            plausible-sounding answer can still be unsupported.
          </p>
          <div className="hero__actions">
            <a className="button button--ember" href="#/atmosphere">
              Follow the 3-minute path <span aria-hidden="true">→</span>
            </a>
            <a className="button button--ghost" href="#/atlas">
              Inspect 131 records
            </a>
          </div>
          <div className="hero__note">
            <span className="status-dot" aria-hidden="true" />
            Works offline · deterministic retrieval · no external model
          </div>
        </div>

        <aside className="ledger" aria-label="Corpus evidence ledger">
          <div className="ledger__head">
            <FlameMark size={22} />
            <span>Evidence ledger</span>
            <span className="ledger__stamp mono">v{corpus.meta.pipeline_version}</span>
          </div>
          <div className="ledger__row ledger__row--strong">
            <span className="ledger__value">131</span>
            <span className="ledger__label">
              experiment records
              <small>129 BASS-II · 2 Saffire-I</small>
            </span>
          </div>
          <div className="ledger__rule" />
          <div className="ledger__row">
            <span className="ledger__value ledger__value--zero">0</span>
            <span className="ledger__label">
              total-pressure values
              <small>no pressure column in either table</small>
            </span>
          </div>
          <div className="ledger__row">
            <span className="ledger__value ledger__value--zero">0</span>
            <span className="ledger__label">
              measured per-test gravity
              <small>microgravity is investigation-level</small>
            </span>
          </div>
          <div className="ledger__row">
            <span className="ledger__value ledger__value--zero">0</span>
            <span className="ledger__label">
              standardized outcomes
              <small>burn duration ≠ flammability classification</small>
            </span>
          </div>
          <div className="ledger__foot">
            <span className="kicker">The missing axis is the finding</span>
            <a href="#/atmosphere">See why →</a>
          </div>
        </aside>
      </section>

      <SectionRule label="Demo reel" meta="Problem, evidence, solution" />
      <DemoReel />

      <div className="ticker" role="note">
        <span className="ticker__tag">SCOPE</span>
        <span>
          FIRETRACE is not a fire-risk model and does not certify materials, atmospheres or
          procedures. It retrieves reported evidence and preserves what is absent.
        </span>
        <a href="#/methodology">Evidence policy →</a>
      </div>

      <SectionRule label="The structural gap" meta="What 131 records do not contain" />
      <div className="gap-grid">
        <article className="gap-card">
          <div className="gap-card__index">A</div>
          <h3>Pressure is absent, not implied</h3>
          <p>
            Oxygen fraction is reported. Total pressure is not. Without both, oxygen partial
            pressure and any atmospheric equivalence remain unknown.
          </p>
          <div className="gap-card__figure">
            <span className="mono">0 / 131</span>
            <span>records with total pressure</span>
          </div>
          <SourceLink href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-25">
            PSI-25 experimental table
          </SourceLink>
        </article>
        <article className="gap-card">
          <div className="gap-card__index">B</div>
          <h3>Gravity is context, not measurement</h3>
          <p>
            “Microgravity” is assigned from the investigation description. No record carries a
            measured g-level or direction, and no partial-gravity records are included.
          </p>
          <div className="gap-card__figure">
            <span className="mono">0 / 131</span>
            <span>records with measured per-test gravity</span>
          </div>
          <SourceLink href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98">
            PSI-98 experimental table
          </SourceLink>
        </article>
        <article className="gap-card">
          <div className="gap-card__index">C</div>
          <h3>Outcomes are not standardized</h3>
          <p>
            Burn time and free-text notes exist. Neither is an extinction or sustained-burning
            classification, so a material cannot be ranked from these records alone.
          </p>
          <div className="gap-card__figure">
            <span className="mono">0 / 131</span>
            <span>records with a standardized outcome</span>
          </div>
          <SourceLink href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-25">
            PSI-25 ReadMe and test matrices
          </SourceLink>
        </article>
      </div>

      <div className="overview-split">
        <Panel
          kicker="The one axis we do have"
          title="Oxygen is reported — but it is only half an atmosphere"
          actions={<Badge tone="mint">{profile.initialReported} initial values</Badge>}
        >
          <OxygenDistribution records={corpus.records} />
          <div className="mini-notes">
            <div>
              <span className="mono">{profile.minInitial}–{profile.maxInitial}%</span>
              <span>initial O2 range</span>
            </div>
            <div>
              <span className="mono">{profile.finalReported} / 131</span>
              <span>final O2 values</span>
            </div>
            <div>
              <span className="mono">{profile.approximateInitial}</span>
              <span>approximate range midpoints</span>
            </div>
          </div>
          <p className="panel-caption">
            BASS-II oxygen readings were corrected with a constant offset after an out-of-calibration
            sensor. Two Saffire-I values are midpoints of reported ranges. Neither table reports
            per-sample uncertainty.
          </p>
        </Panel>

        <Panel kicker="Read the source, not the summary" title="What this workspace does">
          <div className="feature-list">
            {features.map((feature) => (
              <a className="feature" href={feature.href} key={feature.index}>
                <span className="feature__index mono">{feature.index}</span>
                <span className="feature__body">
                  <span className="feature__title">{feature.title}</span>
                  <span className="feature__text">{feature.text}</span>
                </span>
                <span className="feature__arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </Panel>
      </div>

      <SectionRule label="Two investigations, kept distinct" meta="Different hardware. Different reporting." />
      <div className="investigation-grid">
        {corpus.meta.investigations.map((investigation, index) => {
          const record = corpus.records.find((item) => item.family === investigation.family);
          return (
            <article className={`investigation-card investigation-card--${index === 0 ? 'bass' : 'saffire'}`} key={investigation.family}>
              <div className="investigation-card__head">
                <div>
                  <div className="kicker">{investigation.psi} · {investigation.family}</div>
                  <h3>{investigation.title}</h3>
                </div>
                <div className="investigation-card__count">
                  <span>{investigation.records}</span>
                  <small>records</small>
                </div>
              </div>
              <dl className="investigation-card__meta">
                <div>
                  <dt>Hardware</dt>
                  <dd>{investigation.hardware}</dd>
                </div>
                <div>
                  <dt>Gravity</dt>
                  <dd>{record?.gravity_regime.value ?? 'not reported'} · investigation level</dd>
                </div>
                <div>
                  <dt>Pressure</dt>
                  <dd className="is-missing">not reported</dd>
                </div>
                <div>
                  <dt>DOI</dt>
                  <dd className="mono">{investigation.doi}</dd>
                </div>
              </dl>
              <div className="investigation-card__foot">
                <a href={`#/atlas?family=${encodeURIComponent(investigation.family)}`}>Open records →</a>
                <SourceLink href={`https://doi.org/${investigation.doi}`} quiet>
                  DOI
                </SourceLink>
              </div>
            </article>
          );
        })}
      </div>

      <SectionRule label="Validation is part of the product" meta="Checks that can fail" />
      <div className="validation-strip">
        <Stat value="129/129" label="BASS-II test IDs matched" detail="CSV ↔ six-sheet matrix workbook" tone="mint" />
        <Stat value="129/129" label="initial O2 values matched" detail="Exact numeric match" tone="mint" />
        <Stat value="4" label="records flagged suspect" detail="Retained, not corrected" tone="amber" />
        <Stat value="2" label="non-experiment rows excluded" detail="Saffire image-set descriptors" tone="muted" />
        <div className="validation-strip__link">
          <a className="text-link" href="#/methodology">Read the full validation report →</a>
          <span className="mono">{coverage.pressure_reported} pressure · {coverage.gravity_per_record_reported} per-test gravity</span>
        </div>
      </div>

      <section className="closing-cta">
        <div className="closing-cta__mark"><FlameMark size={40} /></div>
        <div>
          <div className="kicker">Ask a question the evidence can answer</div>
          <h2>“What pressure was BASS-II run at?”</h2>
          <p>
            The assistant will not invent one. It will retrieve the table, show the missing column,
            cite the source, and abstain. That is the point.
          </p>
        </div>
        <a className="button button--paper" href="#/assistant">Open Evidence Assistant →</a>
      </section>
    </div>
  );
}
