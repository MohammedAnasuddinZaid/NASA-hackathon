## 1. Summary

Adds TRACE, an optional server-side OpenAI interpretation layer over FIRETRACE's validated evidence engine. A question retrieves source-located claims before generation; the UI separates model interpretation from exact deterministic facts and clearly shows disabled, unavailable, rejected and insufficient-evidence modes.

Independent branch `feat/evidence-grounded-ai-assistant` starts directly at main `2d9d4e7`. No PR #2 commits were copied. Codex assisted implementation, tests and documentation; human scientific review remains necessary. No PR is merged by this work.

## 2. Previous Behavior

The Assistant called `/api/v1/ask` and fell back to bundled deterministic rules. It displayed messages but sent no follow-up context. Its labels promised no external model call. Existing FastAPI, FTS retrieval, claim/computation validation, sources and middleware were already on main.

## 3. New AI Architecture

```text
question + bounded history
  -> recognized previous user subject (never model prose as evidence)
  -> existing deterministic routing/FTS + source/numeric validation
  -> bounded stable-ID evidence with locators/status/units/nulls
  -> optional OpenAI Responses structured output
  -> schema + citation membership + conservative prose checks
  -> AI interpretation above unchanged exact evidence claims
  -> explicit deterministic fallback on provider failure
```

Uses official OpenAI Python SDK2.54.0, configurable model (default gpt-4.1-mini), lazy SDK import and a Provider protocol. No second backend/database/vector store. `trace.py:retrieve` is the future evidence-service adapter boundary.

## 4. Features Implemented

- POST `/api/v1/assistant/query`: bounded question/history/mode, typed answer and evidence, generation status and resolved question.
- Structured source-linked evidence IDs include corpus identity; URLs/DOIs/locators are resolved by the server.
- Follow-up subject continuity for recognized records/investigations, including bundled offline mode.
- AI interpretation, clickable evidence references, source links, loading/retry, deterministic toggle, bounded session display and scoped limitations.
- POST `/api/v1/assistant/calculate`: Decimal oxygen partial pressure from explicitly supplied psia/kPa and oxygen percentage; user-input derived value, no fire prediction.
- Existing deterministic answer, citations, calculations, safety abstention and original science files retained.

## 5. Scientific Safeguards

The model cannot author displayed exact measurements. Those remain validated deterministic claims with original units/status/source. Generated prose is qualitative: numeric tokens/selected numeric words, URLs and explicit safety/certification/causal assertions are rejected. Every cited ID must belong to the retrieved collection. Unknown/absent/out-of-scope questions skip generation. No source URL can be supplied by the model.

Citation membership does not establish semantic entailment. Qualitative interpretations may still mischaracterize evidence or evade lexical checks, and valid wording can be rejected conservatively. The UI explicitly identifies interpretation; no perfect hallucination prevention is claimed. No pressure imputation, cross-investigation equivalence, lunar applicability, risk probability, certification or NASA endorsement.

## 6. Screenshots

Genuine ChatGPT-browser captures. **The generated-answer UI uses an explicitly labelled mock provider, not a live authenticated model.**

![Deterministic evidence](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-grounded-ai-assistant/docs/evidence/pr3/deterministic-answer.png)
![Mock interpretation—not live](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-grounded-ai-assistant/docs/evidence/pr3/mock-interpretation-not-live.png)
![Missing pressure follow-up](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-grounded-ai-assistant/docs/evidence/pr3/missing-pressure-follow-up.png)
![Controlled provider failure](https://raw.githubusercontent.com/MohammedAnasuddinZaid/NASA-hackathon/refs/heads/feat/evidence-grounded-ai-assistant/docs/evidence/pr3/provider-failure-mock.png)

Loading, safety abstention, route checks and logs: [evidence directory](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/tree/feat/evidence-grounded-ai-assistant/docs/evidence/pr3). No fabricated before/after evidence. Mobile override was ineffective; no mobile verification claimed.

## 7. Testing

| Test | Command | Result | Notes |
|---|---|---|---|
| Main baseline | pytest backend/tests; npm test; npm run build |155 backend/89 frontend + build pass|Before implementation|
| Full backend | `backend/.venv/Scripts/python.exe -m pytest backend/tests -q -p no:cacheprovider --basetemp tmp/pr3-final` |185 passed|30 new checks including SDK mocked transport|
| Frontend | `npm test` |93 passed|4 new client/history checks|
| TypeScript/build | `npm run build` |Pass|Existing large-chunk warning|
| Browser suite | `npm run e2e` |Blocked before launch|Expected Chromium headless-shell1254 missing; no pass claimed|
| ChatGPT browser |Navigate all8 routes and assistant flows|Checked|Real citation interaction/follow-up/abstention/mock failure|
| Diff |`git diff --check`|Pass|No lint script configured|

Existing Starlette/httpx deprecation remains. Automated provider tests make no paid/network model calls. Two new browser tests are included but unexecuted due the launch blocker.

## 8. AI Evaluation

`eval/trace_questions.json`:10 labelled cases spanning factual/missing/comparison/explanation/safety/certification/citation/unknown-ID/follow-up/injection. Expected deterministic predicates and source/record resolution pass. Dedicated tests reject invented citation IDs and generated numeric/URL/safety statements; test timeouts/auth/rate/malformed failures without leaking exception text. SDK serialization and parsed structured response tested with httpx MockTransport.

This small suite is not a semantic quality or retrieval-recall estimate. **No live model call was made: no API key is configured.** Live answer quality, latency and model compatibility beyond mocked wire verification remain pending.

## 9. Configuration

Server `.env.example`: AI_ENABLED=false; OPENAI_API_KEY empty; OPENAI_MODEL=gpt-4.1-mini; AI_REQUEST_TIMEOUT_SECONDS=30 (1–60). No Vite credential variables. Install `backend/requirements-ai.txt` for OpenAI; core requirements remain sufficient for deterministic operation.

Limits:500-char question,8 history entries×1000 chars,6 evidence items≤18k serialized chars,24k provider context,650 output tokens,2 concurrent generations, no SDK retries; existing per-client POST rate/body limits retained. UI timeout65s. When enabled, question and public evidence are sent to OpenAI with store=false; calls may cost money. No conversation database or new privileged model tools.

## 10. Integration Notes

PR #1 was already merged before this branch; the prompt's claim that both PRs were unmerged was stale. PR #2 remains open and independent. PR #3 reuses only current-main contracts and adds no persistent storage schema. Potential overlap: backend/api.py, backend/main.py, Assistant.tsx, README, .env.example. Combine router/env edits and preserve PR #2's version/session verification when reconciling the new client. No PR #2 code was cherry-picked or copied.

GitHub issues page showed0 open issues. No invented issue-closing references. Improvements and regressions are grouped here.

## 11. Known Limitations

- Authenticated live model testing pending; captures are deterministic or clearly labelled mock-provider UI.
- Conservative qualitative generation only; exact measurements/calculations remain deterministic. Lexical checks are incomplete and can reject harmless prose.
- Follow-ups resolve recognized prior subjects, not unrestricted conversation semantics. Existing intent/FTS retrieval still limits answerable questions.
- No new verified report-passage collection, embeddings, scientific predictions, authentication, deployment or reporting/basket feature.
- Standalone browser tests blocked by missing binary; mobile override unverified. Existing bundle/deprecation warnings.

## 12. Manual Review Guide

From this branch, `npm ci`; `python -m venv backend/.venv`; install `backend/requirements-ai.txt`; copy `.env.example` to ignored `.env`. Set your own server key and AI_ENABLED=true to test live generation. Full Windows/Unix instructions and architecture: [TRACE documentation](https://github.com/MohammedAnasuddinZaid/NASA-hackathon/blob/feat/evidence-grounded-ai-assistant/docs/trace-assistant.md).

1. Start `backend/.venv/Scripts/python.exe -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8013`.
2. In another PowerShell: `$env:VITE_FIRETRACE_API_BASE='http://127.0.0.1:8013'`; `npm run dev -- --host 127.0.0.1 --port 5183`.
3. Open http://127.0.0.1:5183/#/assistant. Ask BASS2-B1 oxygen; verify corrected22.2%, PSI-25 and row2. Interpretations must identify actual model use.
4. Follow up “Which pressure was used for it?”; verify missing pressure. Ask “Is PMMA safe in a lunar cabin?”; verify refusal.
5. Click evidence reference/source. Select deterministic mode; disable AI in server environment and restart; stop backend for explicit bundled fallback.
6. Run tests above. For UI-only mocked generation/failure, use the documented tests.trace_demo_server fixture; do not call that live-model verification.
7. Review limitations and source data diff. Leave this PR unmerged.
