# Limitations

FIRETRACE is an evidence-retrieval workspace, not a fire-risk model, material certification or
NASA product. The following limitations are enforced throughout the application and are not
hidden behind a score.

## Data limitations

- Total pressure is absent from both experimental tables: 0 of 131 records.
- Per-test gravity is absent: 0 of 131 records. Microgravity is an investigation-level label.
- Standardized ignition, spread or extinction outcomes are absent: 0 of 131 records.
- Ignition method is absent: 0 of 131 records.
- Oxygen partial pressure cannot be computed without total pressure.
- Flow bases differ: BASS-II uses a slow-response duct display; Saffire-I reports a flow setting.
- BASS-II oxygen carries a constant-offset calibration correction; per-sample uncertainty is not
  supplied.
- Two Saffire-I oxygen values are approximate (a range midpoint and an approximate single value).
- Material family and geometry are parsed from free text, not a controlled specification.
- Thickness is parsed for only 44 of 131 records.
- Four BASS-II records carry suspect flags that are retained, not corrected.

## Comparability limitations

- BASS-II and Saffire-I cannot be treated as directly comparable tests.
- No similarity or relevance score is computed.
- No material is labeled safe or unsafe.
- No atmosphere is certified.
- No missing pressure or gravity value is imputed.

## Context limitations

- LUCI is presentation-level context from a single flight. It is not structured per-test data and
  is not compared record-by-record with BASS-II or Saffire-I.
- The challenge’s lunar-cabin values (about 30 % O2, 10.2 psi or less) are planning values, not
  a final operational specification.
- The official challenge states that PSI currently has no partial-gravity combustion data.

## Application limitations

- Exact assistant claims use deterministic retrieval. Optional TRACE interpretations use
  a server-configured model and can still mischaracterize evidence despite lexical/citation
  checks. Live authenticated model verification is pending; see trace-assistant.md.
- The Gap Planner is a checklist for test design, not a protocol, prediction or certification.
- The bundle is large because the corpus is imported directly for offline use.
- No external deployment, domain or hosting configuration is included.
- The evidence API is a local read-only service. It has no authentication, is intended for
  localhost or a trusted LAN, and rejects POST bodies above 1 MiB.
- `eval/run_eval.py` reports retrieval hit@5 and abstention accuracy as `null` because the shipped
  question set has no gold answers. No metric is estimated.
