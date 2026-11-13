# 3-minute demo script

Target: a reliable 3-minute walkthrough for judges. Keep the cursor moving; do not scroll
manually unless the script calls for it.

## 0:00–0:25 — Problem and evidence gap

1. Open `#/overview`.
2. Say: “Spacecraft fire safety depends on atmosphere and gravity, but the public microgravity
   combustion tables do not report the two variables that matter most.”
3. Point to the ledger: 131 records, 0 total-pressure values, 0 per-test gravity values.
4. Say: “FIRETRACE does not fix that by guessing. It shows the gap.”

## 0:25–0:55 — Atmosphere Explorer

1. Click “Follow the 3-minute path” or open `#/atmosphere`.
2. Move the sliders to the lunar-cabin planning point: 10.2 psi, 30 % O2.
3. Read the calculated ppO2: 3.06 psi.
4. Point to the plane note: every corpus record sits on the unknown-pressure axis.
5. Say: “An oxygen fraction alone is not an atmosphere.”

## 0:55–1:25 — Evidence Atlas

1. Open `#/atlas`.
2. Search `BASS2-B1`; one row remains.
3. Open the row. Show initial O2 22.2 %, total pressure “Not reported,” gravity
   “investigation level,” and the source locator `PSI-25 experimental table, CSV row 2`.
4. Close the drawer.
5. Say: “Missing means unknown, not zero.”

## 1:25–1:55 — Compare

1. Open `#/compare` (default pair: BASS2-B1 and SAFFIRE1-S1).
2. Read the audit: 5 blockers.
3. Point to “No similarity score. A score would hide the measurement mismatch.”
4. Say: “A comparison table is useful only when it shows why direct comparison is blocked.”

## 1:55–2:25 — Gap Planner

1. Open `#/gap`.
2. Leave the default lunar target (10.2 psi, 30 % O2, lunar gravity, PMMA film).
3. Read ppO2 3.06 psi.
4. Point to absent evidence: pressure, per-test gravity, standardized outcome.
5. Say: “The output is a checklist for a defensible test, not a prediction.”

## 2:25–2:50 — Evidence Assistant

1. Open `#/assistant`.
2. Click “What pressure was BASS-II run at?”
3. Read: “Total pressure is reported for 0 of 131 experiment records.”
4. Click “Is PMMA safe in a lunar cabin?”
5. Read the refusal and the citation list.
6. Say: “It answers when it can and refuses when it cannot.”

## 2:50–3:00 — Close

1. Open `#/exports`.
2. Show the preview and “0 pressure values.”
3. Close with: “FIRETRACE does not make fire safer. It makes the evidence honest enough to
   design the next test.”

## Backup questions

- “What oxygen did BASS2-B1 report?” — direct evidence, 22.2 %.
- “Does the corpus include partial-gravity data?” — no; LUCI is context only.
- “Which records are flagged suspect?” — four records, retained and disclosed.
- “What is missing from the corpus?” — pressure, gravity, outcome, ignition method.
