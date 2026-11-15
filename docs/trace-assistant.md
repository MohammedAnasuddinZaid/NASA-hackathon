# TRACE: evidence-grounded explanations

TRACE extends the integrated FastAPI evidence service. PRs #1–#7 are merged on the
QA baseline; TRACE uses its existing EvidenceStore without another ingestion pipeline.

## Architecture

Question + bounded user history → identify prior experiment/investigation subject →
existing deterministic routing/FTS retrieval → existing validated claims and calculations →
bounded source-linked evidence → optional OpenAI Responses structured output →
schema, evidence-ID and conservative prose checks → UI interpretation + exact claims.

`app/v1/trace.py:retrieve` is the retrieval boundary. It uses the current EvidenceStore;
it uses the integrated store without changing the assistant contract.
Question history is never scientific evidence. Only recognized identifiers from the
latest relevant user subject are carried forward; prior assistant prose is ignored.
This is lightweight subject continuity, not unrestricted conversational reasoning.

`POST /api/v1/assistant/query` accepts question (1–500 chars), conversation_history
(maximum 8 entries, user/assistant roles, 1–1000 chars each), and mode auto/deterministic.
Returns the existing typed AnswerResponse plus answer_type, ai_status, model_used,
interpretation, interpretation_evidence_ids, evidence, notice and resolved_question.
Evidence IDs hash corpus identity + validated claim content. Sources/URLs/DOIs/locators
come from the server, never model output. Evidence includes bounded field metadata,
nulls/statuses/units/flags and limitations. Up to 6 items, serialized evidence ≤18,000
chars; total provider context ≤24,000 chars. Exact claims remain in AnswerResponse.

## Setup (Windows PowerShell, from repository root)

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-ai.txt
Copy-Item .env.example .env
# Edit .env locally: AI_ENABLED=true and your own OPENAI_API_KEY.
backend/.venv/Scripts/python.exe -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8013
# In a second terminal:
$env:VITE_EVIDENCE_API_BASE='http://127.0.0.1:8013'
npm.cmd run dev -- --host 127.0.0.1 --port 5183
```

Open http://127.0.0.1:5183/#/assistant. Standard ports 8000/5173 also work;
the isolated ports above avoid disturbing other worktrees. On Unix use
backend/.venv/bin/python, `export VITE_EVIDENCE_API_BASE=...`, and npm normally.
Only the public API base goes in Vite environment variables; API keys never do.

| Server variable | Default | Behavior |
|---|---|---|
| AI_ENABLED | false | Explicit opt-in to external generation |
| OPENAI_API_KEY | empty | Server credential; missing key gives deterministic answer |
| OPENAI_MODEL | gpt-4.1-mini | Configurable structured-output-capable model |
| AI_REQUEST_TIMEOUT_SECONDS | 30 | Valid range 1–60 seconds; no automatic SDK retries |

Set AI_ENABLED=false and restart the backend to disable external calls. The UI's
deterministic checkbox also skips the model per request. Installing only
backend/requirements.txt still runs the deterministic service: SDK import is lazy.
OpenAI SDK 2.54.0 is pinned in requirements-ai.txt. Provider adapter is a Protocol;
the currently implemented external provider is OpenAI only.

## Scientific rules and tradeoffs

The current corpus has 131 records (129 BASS-II, 2 Saffire-I). Existing FTS and intent
rules perform retrieval. No embeddings or new ranking are justified by this change.
Exact observation/derived claims and deterministic comparisons are preserved unchanged.
Measurements retain status, unit, correction/approximation notes and provenance.
Missing per-row pressure remains null; report-level context is never assigned to rows.
No new report-passage collection was ingested. Existing source-located context is
available only where the deterministic engine actually retrieves it.

The model writes a qualitative interpretation, never the exact measurements. Schema
validation forbids extra fields; citation IDs must belong to the retrieved set. Prose
containing digit tokens, a conservative set of number words, URLs, or explicit
safety/certification/causal assertions is rejected. The exact facts shown below the
interpretation are server-built, so a model cannot change a measurement's unit or field.
This deliberately restricts generated prose and can reject harmless wording such as
an experiment name containing digits. A rejected generation shows deterministic evidence.

These checks do **not** establish semantic entailment or perfect hallucination
prevention. A qualitative interpretation can still mischaracterize evidence or evade
lexical checks. The UI labels it interpretation and requires review. No safety advice,
operational recommendations, probabilities, certification or NASA endorsement is provided.
Safety/out-of-scope/absent-evidence responses skip the provider entirely.

The existing Atmosphere calculator remains deterministic. The added API calculation
endpoint `POST /api/v1/assistant/calculate` accepts total_pressure (0 < value ≤500),
oxygen_percent (0–100) and pressure_unit (psia/kPa). Decimal arithmetic computes
P × O2/100; 10.2 psia ×30% =3.06 psi. Output is labelled derived from user inputs,
not measured evidence or a fire prediction. Missing/invalid inputs return422.

## Reliability, privacy and costs

Requests retain existing POST body limits, per-client rate limits, provenance headers,
local CORS and structured validation errors. Generation adds 2 concurrent calls maximum,
30s default provider timeout, zero retries and650 output-token cap. The frontend waits
up to65s then clearly falls back. Busy/timeout/auth/rate/outage/parse/verification failures
never fabricate model success. No SDK exception text is sent to users. No tools or
privileged actions are exposed to the model. Retrieved text and user text are untrusted.

When enabled, the question and retrieved public evidence go to OpenAI; recognized
prior subjects are included in the resolved question. Responses use store=false.
This does not replace the provider's data handling policies. No conversation database
is added; frontend history is capped60 displayed messages and8 user subjects per request.
Refresh/clear resets it. Each successful model request may incur API charges. No live
request was made during development because credentials were unavailable.

## Tests and evaluation

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -q -p no:cacheprovider --basetemp tmp/pr3-pytest
npm.cmd test
npm.cmd run build
npm.cmd run e2e
```

The new30 backend tests include real SDK serialization/parsing through httpx MockTransport,
fake-provider success/failure, numeric/URL/citation rejection, missing key, bounded inputs,
concurrency, abstention, prompt injection, stable evidence identity, subject continuity,
and exact calculations. Four frontend client tests cover payload bounds and error modes.
eval/trace_questions.json has10 labelled cases exercised by pytest. These are small
deterministic regressions, not live-model quality estimates or a retrieval-recall benchmark.
Evidence identity/source membership and the labelled expectations pass; broad semantic
accuracy remains unverified. Default tests require no API credentials or paid calls.

The existing23 browser checks and2 new TRACE UI checks are present. Execution on this
machine was blocked before page launch by missing Playwright Chromium headless-shell1254.
No automated browser pass is claimed. Eight routes and core assistant interactions were
checked using the signed-in ChatGPT in-app browser instead.
Final automated results:185 backend tests and93 frontend tests pass; TypeScript/build pass.
The existing bundle-size and Starlette/httpx deprecation warnings remain. A requested390px
viewport override did not change the inspected page dimensions in this browser session;
mobile layout is unverified. viewport-attempt-unverified.png is not mobile proof.

For mock-only UI review run:
```powershell
backend/.venv/Scripts/python.exe -m uvicorn tests.trace_demo_server:app --app-dir backend --host 127.0.0.1 --port 8014
# Separate terminal:
$env:VITE_EVIDENCE_API_BASE='http://127.0.0.1:8014'
npm.cmd run dev -- --host 127.0.0.1 --port 5184
```
This test module explicitly displays mock-provider-not-live. It is not a production
provider, never calls OpenAI, and never changes scientific facts. Ask BASS2-B1 oxygen
for a mocked interpretation; add “failure” to exercise timeout fallback. Do not use
these images as evidence of a live authenticated model call.

## Review and integration

Branch starts at main2d9d4e7. PR #1 is already merged; PR #2 remains independent/open.
No PR #2 implementation was copied. Shared files likely to conflict are backend/api.py,
backend/main.py, README, Assistant.tsx and .env.example. Keep both router registrations,
combine env examples, and preserve PR #2's corpus/version/session checks when integrating
the new TRACE client. This PR adds no storage schema and changes no original science data.

Manual review: ask BASS2-B1 oxygen; check corrected22.2% and row2; follow up “Which
pressure was used for it?”; inspect missing-value abstention; ask a lunar-cabin safety
question; verify source link; disable AI and retry; stop backend and verify explicit
bundled fallback. Configure your own key for the still-pending authenticated live test.
