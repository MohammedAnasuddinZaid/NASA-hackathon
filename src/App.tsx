import { EvidenceScope } from './components/EvidenceScope';
import { AppShell } from './components/AppShell';
import { useRoute } from './lib/router';
import { Overview } from './pages/Overview';
import { Atmosphere } from './pages/Atmosphere';
import { Atlas } from './pages/Atlas';
import { Compare } from './pages/Compare';
import { GapPlanner } from './pages/GapPlanner';
import { Assistant } from './pages/Assistant';
import { Methodology } from './pages/Methodology';
import { Exports } from './pages/Exports';
import { Coverage } from './pages/Coverage';
import { Notebook } from './pages/Notebook';
import { Graph } from './pages/Graph';
import { Verification } from './pages/Verification';
import { Evaluation } from './pages/Evaluation';
import { Analysis } from './pages/Analysis';
import { Integrity } from './pages/Integrity';
import { Reports } from './pages/Reports';
import { Health } from './pages/Health';
import { EvidenceConnection } from './lib/evidenceSession';

function NotFound() {
  return (
    <div className="page not-found">
      <div className="index-mark">404</div>
      <h1>This route is not in the evidence graph.</h1>
      <p>The workspace has seventeen sections. Start at the overview or open the record table.</p>
      <div className="not-found__actions">
        <a className="button button--ember" href="#/overview">Overview →</a>
        <a className="button button--ghost" href="#/atlas">Evidence Atlas</a>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const page = (() => {
    switch (route.segment) {
      case 'overview':
        return <Overview />;
      case 'atmosphere':
        return <Atmosphere />;
      case 'atlas':
        return <Atlas />;
      case 'compare':
        return <Compare />;
      case 'gap':
        return <GapPlanner />;
      case 'assistant':
        return <Assistant />;
      case 'methodology':
        return <Methodology />;
      case 'exports':
        return <Exports />;
      case 'coverage':
        return <Coverage />;
      case 'notebook':
        return <Notebook />;
      case 'graph':
        return <Graph />;
      case 'verification':
        return <Verification />;
      case 'evaluation':
        return <Evaluation />;
      case 'analysis':
        return <Analysis />;
      case 'integrity':
        return <Integrity />;
      case 'reports':
        return <Reports />;
      case 'health':
        return <Health />;
      default:
        return <NotFound />;
    }
  })();

  return <AppShell><EvidenceScope /><EvidenceConnection />{page}</AppShell>;
}
