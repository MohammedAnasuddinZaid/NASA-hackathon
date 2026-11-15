# PR #3 verification evidence

All PNGs are actual ChatGPT in-app browser screenshots of the local branch.

- deterministic-answer.png: real API, model disabled, corrected B1 oxygen/source.
- missing-pressure-follow-up.png: real contextual follow-up, missing pressure retained.
- safety-abstention.png: unsupported safety question, no model call.
- mock-interpretation-not-live.png: real UI with explicitly labelled mock provider.
  This is not proof of a live model call.
- loading-mock.png: actual loading state during the mock provider's delay.
- provider-failure-mock.png: deliberate mock timeout; real deterministic fallback.
- viewport-attempt-unverified.png: viewport override did not affect inspected page
  width; no mobile verification is claimed.
- browser-route-checks.json: all eight headings checked through actual navigation.
- backend-tests.txt/frontend-tests.txt/build.txt: actual185/93/pass command output.

SDK2.54.0 wire contract uses a local mocked HTTP transport in test_trace.py.
No key was configured; authenticated OpenAI integration remains unverified.
Playwright's25 tests (23 existing+2 new) cannot launch because expected Chromium
headless-shell1254 is absent. This is an environment blocker, not a claimed test pass.
No before/after pair was fabricated. No standalone mobile or live-model screenshot.
