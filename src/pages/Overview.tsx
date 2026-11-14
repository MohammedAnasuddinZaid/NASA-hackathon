import { corpus, coverage } from '../lib/corpus';
import { corpusOxygenProfile } from '../lib/atmosphere';
import { Badge, Panel, SectionRule, SourceLink, Stat } from '../components/ui';
import { OxygenDistribution } from '../components/charts';
import { ExplainerFilm } from '../components/ExplainerFilm';
import { LiveModel } from '../components/LiveModel';

const features = [
  {
    index: '01',
    title: 'Atmosphere Explorer',
    text: 'Compute gas composition, compare reference atmospheres, and see why the corpus cannot be placed on a pressure plane.',
    href: '#/atmosphere',
  },
  {
    index: '02',
    title: 'Evidence Atlas',
    text: 'Search all 131 records, inspect raw source rows, flags and provenance, and export the exact evidence behind a claim.',
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
    text: 'Turn a target atmosphere into the measurements and reporting controls the current evidence cannot replace.',
    href: '#/gap',
  },
  {
    index: '05',
    title: 'Evidence Assistant',
    text: 'Ask the bundled corpus a question. It retrieves, cites, and abstains when the field is not in the table.',
    href: '#/assistant',
  },
  {
    index: '06',
    title: 'Methodology & Sources',
    text: 'Every normalized value keeps its status, raw token, source locator and limitation. Nothing is silently filled.',
    href: '#/methodology',
  },
];

function scrollToFilm() {
  document.getElementById('explainer-film')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Overview() {
  const profile = corpusOxygenProfile();

  return (
    <div className="page page--overview">
      <section className="hero">
        <div className="hero__torch" aria-hidden="true">
          <span className="hero__torch-beam" />
          <span className="hero__torch-glow" />
          <span className="hero__torch-flare" />
        </div>
        <div className="hero__top">
          <span className="hero__badge">
            <span className="hero__badge-dot" aria-hidden="true" /> NASA Space Apps 2026
          </span>
          <span className="hero__meta-line">Flame in Freefall &middot; open evidence workspace</span>
        </div>

        <div className="hero__grid">
          <div className="hero__copy">
            <h1>
              Evidence has <span>an address.</span>
            </h1>
            <p className="hero__lede">
              FIRETRACE turns public NASA microgravity combustion tables into a traceable evidence
              workspace. See what 131 experiments measured, what they missed, and why a
              plausible-sounding answer can still be unsupported.
            </p>
            <div className="hero__actions">
              <button type="button" className="button button--lime" onClick={scrollToFilm}>
                Watch the 45s demo <span aria-hidden="true">&darr;</span>
              </button>
              <a className="button button--outline" href="#/atlas">
                Explore the evidence
              </a>
            </div>
            <dl className="hero__stats">
              <div>
                <dt>Records</dt>
                <dd>131</dd>
              </div>
              <div>
                <dt>Pressure values</dt>
                <dd className="is-lime">0</dd>
              </div>
              <div>
                <dt>Invented answers</dt>
                <dd className="is-lime">0</dd>
              </div>
            </dl>
          </div>

          <aside className="hero-card" aria-label="Live model preview">
            <div className="hero-card__top">
              <span>Live model</span>
              <span className="hero-card__pill">Working</span>
            </div>
            <div className="hero-card__metric">
              <span>Oxygen partial pressure</span>
              <strong>
                3.06 <small>psi</small>
              </strong>
            </div>
            <div className="hero-card__rows">
              <div>
                <span>Total pressure</span>
                <strong>10.2 psia</strong>
              </div>
              <div>
                <span>Oxygen</span>
                <strong>30%</strong>
              </div>
              <div>
                <span>Closest reference</span>
                <strong>Lunar cabin</strong>
              </div>
            </div>
            <div className="hero-card__verdict">
              <span className="hero-card__dot" aria-hidden="true" />
              <span>
                <strong>Cannot place.</strong> 0 of 131 records report total pressure.
              </span>
            </div>
            <button type="button" className="hero-card__link" onClick={scrollToFilm}>
              See it work <span aria-hidden="true">&rarr;</span>
            </button>
          </aside>
        </div>
      </section>

      <div id="explainer-film">
        <ExplainerFilm />
      </div>

      <LiveModel />

      <SectionRule label="The structural gap" meta="What 131 records do not contain" />
      <div className="gap-grid">
        <article className="gap-card">
          <div className="gap-card__index">A / Atmosphere</div>
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
          <div className="gap-card__index">B / Gravity</div>
          <h3>Gravity is context, not measurement</h3>
          <p>
            &ldquo;Microgravity&rdquo; is assigned from the investigation description. No record
            carries a measured g-level or direction, and no partial-gravity records are included.
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
          <div className="gap-card__index">C / Outcome</div>
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

      <SectionRule label="The one axis we do have" meta="Oxygen is reported — but it is only half an atmosphere" />
      <Panel
        kicker="Distribution / descriptive only"
        title={
          <>
            Oxygen is reported. <em>It is still only half an atmosphere.</em>
          </>
        }
        actions={<Badge tone="mint">{profile.initialReported} initial values</Badge>}
      >
        <OxygenDistribution records={corpus.records} />
        <div className="mini-notes">
          <div>
            <span className="mono">
              {profile.minInitial}–{profile.maxInitial}%
            </span>
            <span>initial O2 range</span>
          </div>
          <div>
            <span className="mono">
              {profile.finalReported} / 131
            </span>
            <span>final O2 values</span>
          </div>
          <div>
            <span className="mono">{profile.approximateInitial}</span>
            <span>approximate range midpoints</span>
          </div>
          <div>
            <span className="mono">0 / 131</span>
            <span>records with a pressure ordinate</span>
          </div>
        </div>
        <p className="panel-caption">
          BASS-II oxygen readings were corrected with a constant offset after an out-of-calibration
          sensor. Two Saffire-I values are midpoints of reported ranges. Neither table reports
          per-sample uncertainty. The distribution is not a flammability envelope.
        </p>
      </Panel>

      <SectionRule label="The workspace" meta="Read the source, not the summary" />
      <div className="feature-list">
        {features.map((feature) => (
          <a className="feature" href={feature.href} key={feature.index}>
            <span className="feature__index mono">{feature.index}</span>
            <span className="feature__body">
              <span className="feature__title">{feature.title}</span>
              <span className="feature__text">{feature.text}</span>
            </span>
            <span className="feature__arrow" aria-hidden="true">
              &#8599;
            </span>
          </a>
        ))}
      </div>

      <SectionRule label="Two investigations" meta="Different hardware. Different reporting. Kept distinct." />
      <div className="investigation-grid">
        {corpus.meta.investigations.map((investigation, index) => {
          const record = corpus.records.find((item) => item.family === investigation.family);
          return (
            <article className="investigation-card" key={investigation.family}>
              <div className="investigation-card__head">
                <div>
                  <div className="kicker">
                    {investigation.psi} &middot; {investigation.family}
                  </div>
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
                  <dd>{record?.gravity_regime.value ?? 'not reported'} &middot; investigation level</dd>
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
                <a href={`#/atlas?family=${encodeURIComponent(investigation.family)}`}>Open records &rarr;</a>
                <SourceLink href={`https://doi.org/${investigation.doi}`} quiet>
                  DOI
                </SourceLink>
              </div>
              <span className="investigation-card__order" aria-hidden="true">
                0{index + 1}
              </span>
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
      </div>
      <div className="validation-link">
        <a className="text-link" href="#/methodology">
          Read the full validation report &rarr;
        </a>
        <span className="mono">
          {coverage.pressure_reported} pressure &middot; {coverage.gravity_per_record_reported} per-test gravity
        </span>
      </div>

      <div className="scope-note">
        <span className="kicker">Scope</span>
        <p>
          FIRETRACE is not a fire-risk model and does not certify materials, atmospheres or
          procedures. It retrieves reported evidence and preserves what is absent.
        </p>
        <a href="#/methodology">Evidence policy &rarr;</a>
      </div>

      <section className="closing-cta">
        <span className="kicker">Ask a question the evidence can answer</span>
        <h2>
          &ldquo;What pressure was BASS-II run at?&rdquo;
          <em>It will not invent one.</em>
        </h2>
        <p>
          The assistant retrieves the table, shows the missing column, cites the source and abstains.
          That is the point.
        </p>
        <div className="closing-cta__actions">
          <a className="button button--ember" href="#/assistant">
            Open Evidence Assistant <span aria-hidden="true">&rarr;</span>
          </a>
          <a className="button button--ghost" href="#/gap">
            Plan the missing test
          </a>
        </div>
        <span className="closing-cta__mark" aria-hidden="true">
          fıretrace<sup>&reg;</sup>
        </span>
      </section>
    </div>
  );
}
