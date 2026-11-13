import { mkdirSync, writeFileSync } from 'node:fs';
import { ask } from '../src/lib/assistant';
import type { AnswerGrade } from '../src/lib/assistant';

interface BenchmarkCase {
  id: string;
  question: string;
  expectedGrade: AnswerGrade;
  mustContain: string[];
  mustNotContain?: string[];
}

const cases: BenchmarkCase[] = [
  { id: 'B01', question: 'What pressure was BASS-II run at?', expectedGrade: 'absent', mustContain: ['0 of 131', 'lack a total-pressure column'] },
  { id: 'B02', question: 'What oxygen did BASS2-B1 report?', expectedGrade: 'direct', mustContain: ['BASS2-B1', '22.2'] },
  { id: 'B03', question: 'Does the corpus include partial-gravity data?', expectedGrade: 'absent', mustContain: ['0 of 131', 'partial-gravity records: 0'] },
  { id: 'B04', question: 'Compare BASS-II and Saffire-I.', expectedGrade: 'absent', mustContain: ['cannot be treated as directly comparable', 'similarity score'] },
  { id: 'B05', question: 'What did LUCI find?', expectedGrade: 'context', mustContain: ['not a PSI experiment record', '0.92 mm/s'] },
  { id: 'B06', question: 'What is missing from the corpus?', expectedGrade: 'direct', mustContain: ['absent across the corpus', 'Total pressure: 0 of 131'] },
  { id: 'B07', question: 'Is PMMA safe in a lunar cabin?', expectedGrade: 'out-of-scope', mustContain: ['does not predict fire risk', 'No material is labelled safe'] },
  { id: 'B08', question: 'Which records are flagged suspect?', expectedGrade: 'direct', mustContain: ['4 records', 'BASS2-P22b'] },
  { id: 'B09', question: 'What is the airspeed of an unladen swallow?', expectedGrade: 'absent', mustContain: ['I can’t answer that from the bundled corpus'] },
  { id: 'B10', question: 'What flow did B1 report?', expectedGrade: 'direct', mustContain: ['BASS2-B1', '5 cm/s'] },
  { id: 'B11', question: 'What materials are in the corpus?', expectedGrade: 'partial', mustContain: ['9 parsed material families'] },
  { id: 'B12', question: 'What ignition power did Saffire-I use?', expectedGrade: 'direct', mustContain: ['Saffire-I', '182'] },
  { id: 'B13', question: 'How many records report total pressure?', expectedGrade: 'absent', mustContain: ['0 of 131'] },
  { id: 'B14', question: 'Which records report per-test gravity?', expectedGrade: 'absent', mustContain: ['0 of 131', 'investigation-level'] },
  { id: 'B15', question: 'What is the oxygen range across the corpus?', expectedGrade: 'partial', mustContain: ['13.6', '22.2'] },
  { id: 'B16', question: 'What did Saffire-I report?', expectedGrade: 'direct', mustContain: ['420 s', '70 s'] },
  { id: 'B17', question: 'Why is flow not directly comparable?', expectedGrade: 'partial', mustContain: ['not share one measurement basis'] },
  { id: 'B18', question: 'What pressure did SAFFIRE1-S1 report?', expectedGrade: 'absent', mustContain: ['No total pressure is reported for SAFFIRE1-S1'] },
  { id: 'B19', question: 'What outcome did BASS2-B1 report?', expectedGrade: 'absent', mustContain: ['No standardized outcome'] },
  { id: 'B20', question: 'What gravity did BASS2-T9 report?', expectedGrade: 'partial', mustContain: ['has no measured per-test gravity', 'investigation-level'] },
  { id: 'B21', question: 'What is the derived flow for BASS2-B1?', expectedGrade: 'direct', mustContain: ['Derived flow', '5.033'] },
  { id: 'B22', question: 'What materials did BASS-II test?', expectedGrade: 'direct', mustContain: ['BASS-II contributes 129'] },
  { id: 'B23', question: 'What sources support the corpus?', expectedGrade: 'direct', mustContain: ['passed its identity', 'cross-check'] },
  { id: 'B24', question: 'What is the oxygen partial pressure for BASS2-B1?', expectedGrade: 'absent', mustContain: ['No total pressure is reported for BASS2-B1'] },
  { id: 'B25', question: 'How many records have thickness reported?', expectedGrade: 'direct', mustContain: ['Thickness: 44 of 131'] },
  { id: 'B26', question: 'What is the Saffire-I burn time?', expectedGrade: 'direct', mustContain: ['420 s', '70 s'] },
  { id: 'B27', question: 'What did LUCI report about spread?', expectedGrade: 'context', mustContain: ['0.92 mm/s', '1.1 mm/s'] },
  { id: 'B28', question: 'What pressure condition is stated for spacesuits?', expectedGrade: 'absent', mustContain: ['0 of 131'] },
  { id: 'B29', question: 'What partial-gravity evidence exists for a lunar cabin?', expectedGrade: 'absent', mustContain: ['0 of 131', 'no partial-gravity combustion data'] },
  { id: 'B30', question: 'What can FIRETRACE answer?', expectedGrade: 'direct', mustContain: ['Ask about records'] },
];

const results = cases.map((testCase) => {
  const answer = ask(testCase.question);
  const text = [answer.headline, ...answer.paragraphs, ...answer.bullets].join('\n');
  const gradePass = answer.grade === testCase.expectedGrade;
  const containsPass = testCase.mustContain.every((needle) => text.includes(needle));
  const excludesPass = (testCase.mustNotContain ?? []).every((needle) => !text.includes(needle));
  const pass = gradePass && containsPass && excludesPass;
  return {
    ...testCase,
    actualGrade: answer.grade,
    citations: answer.citations.length,
    pass,
    failures: [
      ...(!gradePass ? [`grade expected ${testCase.expectedGrade}, got ${answer.grade}`] : []),
      ...testCase.mustContain.filter((needle) => !text.includes(needle)).map((needle) => `missing "${needle}"`),
      ...(testCase.mustNotContain ?? []).filter((needle) => text.includes(needle)).map((needle) => `forbidden "${needle}"`),
    ],
  };
});

const passed = results.filter((result) => result.pass).length;
const summary = {
  generated_at: new Date().toISOString(),
  total: results.length,
  passed,
  failed: results.length - passed,
  pass_rate: `${Math.round((passed / results.length) * 100)}%`,
  results,
};

mkdirSync('data/processed', { recursive: true });
writeFileSync('data/processed/benchmark.json', JSON.stringify(summary, null, 2));
console.log(`FIRETRACE assistant benchmark: ${passed}/${results.length} passed (${summary.pass_rate})`);
for (const result of results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.id} ${result.question} -> ${result.actualGrade}`);
  for (const failure of result.failures) console.log(`  - ${failure}`);
}

if (passed !== results.length) process.exit(1);
