import { corpus, coverage } from '../../lib/corpus';
import { RevealOnScroll } from './RevealOnScroll';
import { RocketTrajectory, SpaceScene } from './SpaceScene';

const source = 'https://psi.nasa.gov/physci/repo/data/investigations/';

function ContextDiagram() {
  return <svg viewBox="0 0 400 280" fill="none" aria-hidden="true" focusable="false" className="cinema-diagram">
    <ellipse cx="200" cy="140" rx="162" ry="94" stroke="currentColor" strokeDasharray="3 8" />
    <path d="M90 140H145 M255 140H310 M200 45V90 M200 190V235" stroke="currentColor" />
    <rect x="145" y="90" width="110" height="100" rx="12" stroke="white" />
    <rect x="163" y="109" width="74" height="62" rx="4" stroke="#C6F432" />
    <path d="M177 140H223 M200 120V160" stroke="#C6F432" />
    <circle cx="200" cy="140" r="12" stroke="white" />
  </svg>;
}

export function ScrollStory({ paused }: { paused: boolean }) {
  const bass = corpus.records.filter(record => record.investigation_acronym === 'BASS-II').length;
  const saffire = corpus.records.filter(record => record.investigation_acronym === 'Saffire-I').length;
  return <section className="cinema-story" aria-labelledby="cinema-story-title" data-paused={paused}>
    <div className="cinema-story__heading">
      <div><span className="kicker">A field guide in six scenes</span><h2 id="cinema-story-title" tabIndex={-1}>From orbit <em>to evidence.</em></h2></div>
      <p>Scroll at your own pace. Every scene is readable with motion turned off.</p>
    </div>
    <ol className="cinema-story__scenes">
      <li className="cinema-scene" data-scene="problem">
        <RevealOnScroll paused={paused} className="cinema-scene__copy">
          <span className="cinema-step mono">01 / The question</span>
          <h3>Fire behaves differently <em>beyond Earth.</em></h3>
          <p>Microgravity combustion research asks what happens under conditions that Earth-based tests cannot simply stand in for. Begin with the experiment, then follow its evidence.</p>
          <a className="text-link" href={`${source}PSI-25`} target="_blank" rel="noreferrer">Read the BASS-II investigation ↗</a>
        </RevealOnScroll>
        <figure className="cinema-scene__visual">
          <SpaceScene paused={paused} className="cinema-space--orbit"><RocketTrajectory /></SpaceScene>
          <figcaption>Exploration metaphor · original vector art, not NASA hardware or a measured trajectory.</figcaption>
        </figure>
      </li>
      <li className="cinema-scene" data-scene="context">
        <RevealOnScroll paused={paused} className="cinema-scene__copy">
          <span className="cinema-step mono">02 / The environment</span>
          <h3>Microgravity is context.<br /><em>Read the conditions.</em></h3>
          <p>BASS-II and Saffire-I studied solid fuels in different orbital experimental settings. Material, geometry, airflow and test method still matter. An investigation label is not a measured g-level for each test.</p>
          <a className="text-link" href="#/compare">Inspect comparison blockers →</a>
        </RevealOnScroll>
        <figure className="cinema-scene__visual cinema-context"><ContextDiagram /><figcaption>Conceptual experiment window · not a hardware schematic or flame simulation.</figcaption></figure>
      </li>
      <li className="cinema-scene" data-scene="records">
        <RevealOnScroll paused={paused} className="cinema-scene__copy">
          <span className="cinema-step mono">03 / The record layer</span>
          <h3>Real records.<br /><em>Original addresses.</em></h3>
          <p>These counts come directly from the included normalized corpus. Partial and suspect rows remain visible with their flags; a record count is not a fire-safety verdict.</p>
          <a className="text-link" href="#/atlas">Inspect records and source rows →</a>
        </RevealOnScroll>
        <RevealOnScroll paused={paused} className="cinema-counts">
          <dl aria-label="Included experiment record counts">
            <div><dt>BASS-II</dt><dd>{bass}</dd></div>
            <div><dt>Saffire-I</dt><dd>{saffire}</dd></div>
            <div><dt>Total source-table records</dt><dd>{corpus.records.length}</dd></div>
          </dl>
          <p className="cinema-caption">Record coverage in FIRETRACE, not all NASA combustion research.</p>
        </RevealOnScroll>
      </li>
      <li className="cinema-scene" data-scene="gaps">
        <RevealOnScroll paused={paused} className="cinema-scene__copy">
          <span className="cinema-step mono">04 / The missing measurements</span>
          <h3>Unknown <em>is not zero.</em></h3>
          <p>Total pressure and measured per-test gravity are missing from these normalized tables. That is a gap in this record layer, not proof they were uncontrolled or absent from every NASA report.</p>
          <a className="text-link" href="#/coverage">Review the evidence scope →</a>
        </RevealOnScroll>
        <div className="cinema-missing">
          <dl><div><dt>Total pressure</dt><dd>— <span>not reported</span></dd></div><div><dt>Measured per-test gravity</dt><dd>— <span>not reported</span></dd></div></dl>
          <p>{coverage.pressure_reported} / {corpus.records.length} report pressure · {coverage.gravity_per_record_reported} / {corpus.records.length} report measured test gravity.</p>
          <p className="cinema-caption">Zero coverage counts. Unknown measurement values.</p>
        </div>
      </li>
      <li className="cinema-scene" data-scene="workflow">
        <RevealOnScroll paused={paused} className="cinema-scene__copy">
          <span className="cinema-step mono">05 / The research workflow</span>
          <h3>Follow the source.<br /><em>Check the claim.</em></h3>
          <p>Inspect provenance, compare conditions, identify missing measurements, verify a statement and carry selected evidence into a reproducible brief.</p>
          <a className="text-link" href="#/graph">Open the actual Evidence Graph →</a>
        </RevealOnScroll>
        <div className="cinema-workflow">
          <ol aria-label="FIRETRACE research workflow">
            <li><a href="#/methodology"><span className="mono">01</span> Original sources</a></li>
            <li><a href="#/atlas"><span className="mono">02</span> Experimental records</a></li>
            <li><a href="#/verification"><span className="mono">03</span> Claim verification</a></li>
            <li><a href="#/reports"><span className="mono">04</span> Research reports</a></li>
          </ol>
          <p className="cinema-caption">A conceptual workflow, not experimental causation or invented evidence connections.</p>
        </div>
      </li>
      <li className="cinema-scene cinema-scene--begin" data-scene="begin">
        <SpaceScene paused={paused} className="cinema-space--ending" />
        <RevealOnScroll paused={paused} className="cinema-scene__copy">
          <span className="cinema-step mono">06 / Begin research</span>
          <h3>Explore <em>the evidence.</em></h3>
          <p>The strongest next step is a source you can inspect. Start with a record, or plan the measurements the current evidence cannot replace.</p>
          <div className="cinema-actions"><a className="button button--lime" href="#/atlas">Open Evidence Atlas <span aria-hidden="true">→</span></a><a className="button button--outline" href="#/gap">Open Gap Planner</a></div>
        </RevealOnScroll>
      </li>
    </ol>
  </section>;
}
