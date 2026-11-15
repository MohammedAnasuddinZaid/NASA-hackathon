import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const corpusBytes = readFileSync(new URL('../src/data/corpus.json', import.meta.url));
const corpusVersion = createHash('sha256').update(corpusBytes).digest('hex');
(globalThis as { __BUNDLED_CORPUS_VERSION__?: string }).__BUNDLED_CORPUS_VERSION__ = corpusVersion;

const { runBenchmark } = await import('../src/lib/benchmark');

const run = await runBenchmark();
mkdirSync('data/processed', { recursive: true });
writeFileSync('data/processed/benchmark.json', JSON.stringify(run, null, 2));

console.log(
  `FIRETRACE ${run.benchmark_version}: ${run.passed}/${run.total} passed (${run.pass_rate}%)`,
);
console.log(`corpus ${run.corpus_version.slice(0, 16)}… · cases ${run.case_fingerprint.slice(0, 16)}…`);
for (const result of run.results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.id} ${result.question} -> ${result.actual_grade}`);
  for (const failure of result.failures) console.log(`  - ${failure}`);
}

if (run.failed > 0) process.exit(1);
