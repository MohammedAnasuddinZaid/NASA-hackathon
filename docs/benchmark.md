# Assistant benchmark

The Evidence Assistant is evaluated with a 30-question benchmark in
`scripts/run-benchmark.ts`. The results are written to `data/processed/benchmark.json`.

Current result: **30/30 passed (100 %)**.

Coverage:

- 10 pressure and gravity abstention questions
- 6 record-level measurement questions
- 4 missing-data and coverage questions
- 3 comparison questions
- 2 material questions
- 2 flow questions
- 1 LUCI context question
- 1 safety refusal
- 1 scope/refusal fallback

Each case checks the answer grade and required phrases. No expected phrase asserts a fabricated
measurement; all expected values are taken from the bundled corpus.

Run:

```bash
npm run benchmark
```
