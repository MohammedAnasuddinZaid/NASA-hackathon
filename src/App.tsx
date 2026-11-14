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
import { EvidenceStatus } from './lib/EvidenceProvider';

function NotFound() {
  return (
    <div className="page not-found">
      <div className="index-mark">404</div>
      <h1>This route is not in the evidence graph.</h1>
      <p>The workspace has eight sections. Start at the overview or open the record table.</p>
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
      default:
        return <NotFound />;
    }
  })();

  return <AppShell><EvidenceStatus />{page}</AppShell>;
}
