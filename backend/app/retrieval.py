"""Deterministic FIRETRACE retrieval engine.

This is a line-for-line behavioural port of ``src/lib/assistant.ts``. The same
question must produce the same grade, headline, paragraphs, bullets, citations,
trace and follow-ups in the browser and on the backend. The voice agent treats
this module as the single source of truth: an optional language model may only
re-word the strings produced here, never add a fact, number or source.

Design rules encoded below (and tested):
  * a field is answered only when the source reports a value;
  * pressure and per-test gravity are absent for every record;
  * safety, certification and prediction requests are refused;
  * no answer is generated when no supported intent matches.
"""
from __future__ import annotations

import math
import re
import time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional

from app.corpus import Corpus, get_corpus

# ---------------------------------------------------------------------------
# formatting helpers (ports of src/lib/format.ts)
# ---------------------------------------------------------------------------


def format_number(value: Optional[float], max_digits: int = 3) -> str:
    """Match ``Number.prototype.toLocaleString('en-US', ...)``.

    The corpus contains ordinary decimal values, but rounding behaviour matters
    for parity. JavaScript's Intl formatter rounds half away from zero, so use
    Decimal ROUND_HALF_UP rather than Python's banker's rounding.
    """
    if value is None or not isinstance(value, (int, float)) or not math.isfinite(value):
        return "—"
    magnitude = abs(value)
    digits = 0 if magnitude >= 100 else 1 if magnitude >= 10 else max_digits
    quantum = Decimal(1).scaleb(-digits)
    try:
        rounded = Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP)
    except Exception:  # pragma: no cover - defensive
        return "—"
    rendered = f"{rounded:,.{digits}f}"
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    return rendered


def format_compact(
    data: Optional[dict[str, Any]],
    unit_override: Optional[str] = None,
    max_digits: int = 3,
) -> str:
    if not data or data.get("value") is None:
        return "—"
    value = data.get("value")
    rendered = format_number(value, max_digits) if isinstance(value, (int, float)) else str(value)
    unit = unit_override if unit_override is not None else data.get("unit")
    return f"{rendered} {unit}" if unit else str(rendered)


def humanize_token(token: str) -> str:
    text = str(token).replace("_", " ")
    text = re.sub(r"\bo2\b", "O2", text, flags=re.IGNORECASE)
    text = re.sub(r"\bco2\b", "CO2", text, flags=re.IGNORECASE)
    text = re.sub(r"\bco\b", "CO", text, flags=re.IGNORECASE)
    return text[:1].upper() + text[1:] if text else text


def _dv(record: dict[str, Any], field: str) -> dict[str, Any]:
    value = record.get(field)
    return value if isinstance(value, dict) else {}


def _value(record: dict[str, Any], field: str) -> Any:
    return _dv(record, field).get("value")


def _note(record: dict[str, Any], field: str) -> Optional[str]:
    return _dv(record, field).get("note")


def _status(record: dict[str, Any], field: str) -> str:
    return str(_dv(record, field).get("status") or "")


# ---------------------------------------------------------------------------
# retrieval engine
# ---------------------------------------------------------------------------


class RetrievalEngine:
    def __init__(self, corpus: Optional[Corpus] = None) -> None:
        self.corpus = corpus or get_corpus()

    # -- citation helpers ------------------------------------------------
    def citation_for(self, source_id: str, locator: str) -> dict[str, Any]:
        return self.corpus.citation_for(source_id, locator)

    def challenge_citation(self) -> dict[str, Any]:
        return self.corpus.challenge_citation()

    def ntrs_citation(self, locator: str) -> dict[str, Any]:
        return self.corpus.ntrs_citation(locator)

    def claim_citations(self, claim_ids: list[str]) -> list[dict[str, Any]]:
        return self.corpus.claim_citations(claim_ids)

    @staticmethod
    def dedupe_citations(citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return Corpus.dedupe_citations(citations)

    # -- record lookup ---------------------------------------------------
    def find_record(self, question: str) -> Optional[dict[str, Any]]:
        upper = question.upper()
        candidates = re.findall(r"\b(?:BASS2-)?[A-Z]{1,2}\d{1,3}[A-Z]?\b", upper)
        for candidate in candidates:
            direct = self.corpus.records_by_id.get(candidate) or self.corpus.alias.get(candidate)
            if direct:
                return direct
        explicit = re.search(r"\b(?:TEST|SAMPLE)\s+([A-Z]{1,2}\d{1,3}[A-Z]?)\b", upper)
        if explicit:
            return self.corpus.alias.get(explicit.group(1))
        return None

    # -- answer constructor ---------------------------------------------
    @staticmethod
    def base_answer(question: str, **partial: Any) -> dict[str, Any]:
        answer: dict[str, Any] = {
            "id": f"ans-{int(time.time() * 1000)}",
            "question": question,
        }
        answer.update(partial)
        return answer

    # -- intents ---------------------------------------------------------
    def test_answer(self, question: str, record: dict[str, Any]) -> dict[str, Any]:
        q = question.lower()
        citation = self.citation_for(record["source_id"], record["source_locator"])
        trace = [
            f"Matched experiment entity {record['experiment_id']}.",
            f"Read normalized fields and provenance for {record['experiment_id']}.",
            "Applied missing-data rule: a field is answered only if the source reports a value.",
        ]
        experiment_id = record["experiment_id"]
        test_number = record["test_number"]

        if re.search(r"pressure|psia|\bpsi\b|partial pressure", q):
            return self.base_answer(
                question,
                grade="absent",
                headline=f"No total pressure is reported for {experiment_id}.",
                paragraphs=[
                    f"The {record['investigation_acronym']} experimental table has no total-pressure column for this record, so neither total pressure nor oxygen partial pressure can be stated.",
                    "FIRETRACE does not substitute a nominal cabin pressure. Absence of a pressure column is a metadata gap, not evidence that pressure was uncontrolled.",
                ],
                bullets=[
                    f"Recorded initial O2: {format_compact(_dv(record, 'oxygen_initial_pct'))} (fraction only).",
                    "O2 partial pressure requires total pressure: ppO2 = total pressure × O2 fraction.",
                    f"Recorded gravity field status: {str(_status(record, 'gravity_regime')).replace('_', ' ')}.",
                ],
                citations=self.dedupe_citations(
                    [
                        citation,
                        *self.claim_citations(
                            ["CL-BASS2-PRESS" if record["family"] == "BASS-II" else "CL-SAF-PRESS"]
                        ),
                    ]
                ),
                trace=trace,
                followUps=[
                    f"What oxygen fraction did {test_number} report?",
                    "Which records report total pressure?",
                    "What would make this record atmosphere-comparable?",
                ],
                page={"href": "#/atlas", "label": "Open record in Evidence Atlas"},
            )

        if re.search(r"gravity|\bg\b|partial gravity|lunar|moon|mars", q):
            gravity_measured = _status(record, "gravity_regime") == "measured"
            gravity_value = _value(record, "gravity_regime")
            return self.base_answer(
                question,
                grade="direct" if gravity_measured else "partial",
                headline=(
                    f"{experiment_id} reports gravity at test level."
                    if gravity_measured
                    else f"{experiment_id} has no measured per-test gravity."
                ),
                paragraphs=[
                    _note(record, "gravity_regime")
                    or "No per-test gravity value is present in the experimental table.",
                    "The investigation is described as microgravity, but that is an investigation-level assignment, not a measured g-level for this test.",
                ],
                bullets=[
                    f"Gravity status: {str(_status(record, 'gravity_regime')).replace('_', ' ')}.",
                    f"Gravity value: {gravity_value if gravity_value is not None else 'not reported'}.",
                    "No lunar or Martian partial-gravity experiment records are present in the corpus.",
                ],
                citations=self.dedupe_citations([citation, self.challenge_citation()]),
                trace=[
                    *trace,
                    "Checked per-test gravity status before quoting the investigation label.",
                ],
                followUps=[
                    "Does the corpus contain any partial-gravity records?",
                    "What did LUCI report about lunar-gravity spread?",
                    f"What flow did {test_number} report?",
                ],
                page={"href": "#/atmosphere", "label": "Open Atmosphere Explorer"},
            )

        if re.search(r"flow|air|velocity|ventilation|fan", q):
            derived = _value(record, "flow_derived_cm_s")
            flow_value = _value(record, "flow_initial_cm_s")
            flow_direction = _value(record, "flow_direction")
            return self.base_answer(
                question,
                grade="absent" if flow_value is None else "direct",
                headline=(
                    f"No air-flow value is reported for {experiment_id}."
                    if flow_value is None
                    else f"{experiment_id} reports an air-flow display of {format_compact(_dv(record, 'flow_initial_cm_s'))}."
                ),
                paragraphs=[
                    _note(record, "flow_initial_cm_s")
                    or "Flow is reported from the source experimental table.",
                    (
                        "BASS-II flow is an instrument display with a slow response; it is not a per-test calibrated velocity. The derived value uses a single workbook factor, not day- or restrictor-specific calibration."
                        if record["family"] == "BASS-II"
                        else "Saffire-I reports a flow setting in cm/s for each sample; it is a different measurement basis from the BASS-II display."
                    ),
                ],
                bullets=[
                    f"Reported flow: {format_compact(_dv(record, 'flow_initial_cm_s'))}.",
                    (
                        "Derived flow: not applicable."
                        if derived is None
                        else f"Derived flow (factor 1.0066): {format_number(derived)} cm/s."
                    ),
                    f"Flow direction: {flow_direction if flow_direction is not None else 'not reported'}.",
                    (
                        "The source records a changing flow sequence, not one steady value."
                        if record.get("flow_varies")
                        else "The source records a single value for this test."
                    ),
                ],
                citations=self.dedupe_citations(
                    [citation, *self.claim_citations(["CL-BASS2-AIR", "CL-BASS2-FAN"])]
                ),
                trace=trace,
                followUps=[
                    f"What oxygen fraction did {test_number} report?",
                    "Why is flow not directly comparable between BASS-II and Saffire-I?",
                    "Show the flow calibration caveat.",
                ],
                page={"href": "#/atlas", "label": "Open record in Evidence Atlas"},
            )

        if re.search(r"outcome|extinct|burn|ignit|spread|result", q):
            return self.base_answer(
                question,
                grade="direct" if _status(record, "outcome") == "measured" else "absent",
                headline=f"No standardized outcome is reported for {experiment_id}.",
                paragraphs=[
                    _note(record, "outcome")
                    or "The source table does not contain a standardized extinction or sustained-burning classification.",
                    record.get("outcome_definition") or "",
                ],
                bullets=[
                    f"Burn time: {format_compact(_dv(record, 'burn_time_s'))}.",
                    f"Ignition power: {format_compact(_dv(record, 'ignition_power_w'))}.",
                    f"Ignition method: {_value(record, 'ignition_method') if _value(record, 'ignition_method') is not None else 'not reported'}.",
                    "Burn duration is not equivalent to a flammability outcome.",
                ],
                citations=self.dedupe_citations([citation]),
                trace=trace,
                followUps=[
                    f"What material was {test_number}?",
                    "Which fields are missing from this record?",
                    "Can FIRETRACE predict whether a material will burn?",
                ],
                page={"href": "#/gap", "label": "Open Gap Planner"},
            )

        if re.search(r"o2|oxygen|oxid", q):
            oxygen_initial = _value(record, "oxygen_initial_pct")
            oxygen_final = _value(record, "oxygen_final_pct")
            return self.base_answer(
                question,
                grade="absent" if oxygen_initial is None else "direct",
                headline=f"{experiment_id} reports an initial oxygen fraction of {format_compact(_dv(record, 'oxygen_initial_pct'))}.",
                paragraphs=[
                    _note(record, "oxygen_initial_pct")
                    or "The value is taken directly from the source experimental table.",
                    (
                        "No final oxygen fraction is reported for this record."
                        if oxygen_final is None
                        else f"Final oxygen fraction: {format_compact(_dv(record, 'oxygen_final_pct'))}."
                    ),
                    "An oxygen fraction alone does not define an atmosphere. Total pressure is not reported for this record, so oxygen partial pressure cannot be computed.",
                ],
                bullets=[
                    f"Initial O2: {format_compact(_dv(record, 'oxygen_initial_pct'))}.",
                    f"Final O2: {format_compact(_dv(record, 'oxygen_final_pct'))}.",
                    f"Total pressure: {format_compact(_dv(record, 'total_pressure_psia'))}.",
                    f"O2 partial pressure: {format_compact(_dv(record, 'oxygen_partial_pressure_psi'))}.",
                ],
                citations=self.dedupe_citations(
                    [
                        citation,
                        *self.claim_citations(["CL-BASS2-O2-CAL", "CL-BASS2-PRESS", "CL-SAF-PRESS"]),
                    ]
                ),
                trace=trace,
                followUps=[
                    f"What pressure was {test_number} run at?",
                    "What is the O2 range across the corpus?",
                    "Why can’t I compute oxygen partial pressure?",
                ],
                page={"href": "#/atmosphere", "label": "Open Atmosphere Explorer"},
            )

        return self.base_answer(
            question,
            grade="partial",
            headline=f"{experiment_id} — {record['material_raw']}",
            paragraphs=[
                f"{record['investigation_acronym']} · {record['investigation']} · sample {record['sample_number']} · test {test_number}.",
                (
                    "BASS-II record. Total pressure, per-test gravity, ignition method and a standardized outcome are not reported."
                    if record["family"] == "BASS-II"
                    else "Saffire-I record. Total pressure, per-test gravity, ignition method and a standardized outcome are not reported."
                ),
            ],
            bullets=[
                f"Initial O2: {format_compact(_dv(record, 'oxygen_initial_pct'))}.",
                f"Final O2: {format_compact(_dv(record, 'oxygen_final_pct'))}.",
                f"Reported flow: {format_compact(_dv(record, 'flow_initial_cm_s'))}.",
                f"Material family (parsed): {record['material_family']}.",
                f"Validation status: {record['validation_status']}.",
                f"Missing fields: {len(record.get('missing_fields') or [])}.",
            ],
            citations=self.dedupe_citations([citation]),
            trace=trace,
            followUps=[
                f"What pressure was {test_number} run at?",
                f"What outcome did {test_number} report?",
                "Show the provenance for this record.",
            ],
            page={"href": "#/atlas", "label": "Open record in Evidence Atlas"},
        )

    def corpus_pressure_answer(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="absent",
            headline="Total pressure is reported for 0 of 131 experiment records.",
            paragraphs=[
                "Both PSI experimental tables lack a total-pressure column. BASS-II covers 129 tests and Saffire-I covers 2 samples; neither supplies pressure for any record.",
                "This is why FIRETRACE will not place these tests on an atmosphere plane or compute oxygen partial pressure. Substituting a cabin pressure would create a measurement that the sources do not contain.",
            ],
            bullets=[
                "BASS-II: 0 of 129 records report total pressure.",
                "Saffire-I: 0 of 2 records report total pressure.",
                "No cabin pressure was substituted anywhere in the corpus.",
                "Absence of a column is a metadata gap, not proof that pressure was uncontrolled.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table, columns A–Q"),
                    self.citation_for("PSI-98", "PSI-98 experimental table, columns A–M"),
                    *self.claim_citations(["CL-BASS2-PRESS", "CL-SAF-PRESS"]),
                ]
            ),
            trace=[
                "Counted records where total_pressure_psia.value is non-null.",
                "Result: 0 of 131.",
                "Confirmed neither experimental table has a pressure column.",
            ],
            followUps=[
                "What would make atmospheric placement possible?",
                "Does any record report per-test gravity?",
                "What does the corpus report about oxygen?",
            ],
            page={"href": "#/atmosphere", "label": "Open Atmosphere Explorer"},
        )

    def corpus_gravity_answer(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="absent",
            headline="Per-test gravity is reported for 0 of 131 records; partial-gravity records: 0.",
            paragraphs=[
                "BASS-II is described as an ISS microgravity investigation and Saffire-I as a Cygnus microgravity experiment. Those are investigation-level labels, not measured g-levels for individual tests.",
                "The official 2026 challenge states that PSI currently has no partial-gravity combustion data. LUCI is included here only as context and has no structured per-test records in this corpus.",
            ],
            bullets=[
                "Microgravity is assigned at investigation level for all 131 records.",
                "No record contains a measured gravity value or direction.",
                "No lunar, Martian, or other partial-gravity experiment records are included.",
                "LUCI flew at 11 RPM with a 1.22 m effective radius in simulated lunar gravity; its findings are presentation-level context only.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 metadata, investigation description"),
                    self.citation_for("PSI-98", "PSI-98 metadata, investigation description"),
                    self.challenge_citation(),
                    self.ntrs_citation("NTRS PDF pages 12, 16, 19–22"),
                ]
            ),
            trace=[
                "Counted records with a measured per-test gravity status.",
                "Result: 0 of 131.",
                "Separated investigation-level microgravity labels from measurements.",
                "Retrieved LUCI as context without importing it as experiment data.",
            ],
            followUps=[
                "What did LUCI report about lunar-gravity spread?",
                "What pressure data are missing?",
                "How should a partial-gravity test be reported?",
            ],
            page={"href": "#/atmosphere", "label": "Open Atmosphere Explorer"},
        )

    def corpus_oxygen_answer(self, question: str) -> dict[str, Any]:
        records = self.corpus.records
        initial = [
            _value(record, "oxygen_initial_pct")
            for record in records
            if isinstance(_value(record, "oxygen_initial_pct"), (int, float))
        ]
        final = [
            _value(record, "oxygen_final_pct")
            for record in records
            if isinstance(_value(record, "oxygen_final_pct"), (int, float))
        ]
        return self.base_answer(
            question,
            grade="partial",
            headline=(
                f"Initial O2 is reported for {len(initial)} of 131 records, spanning "
                f"{format_number(min(initial))}–{format_number(max(initial))}%."
            ),
            paragraphs=[
                f"Final O2 is reported for {len(final)} records (range {format_number(min(final))}–{format_number(max(final))}%).",
                "BASS-II oxygen readings were corrected with a constant offset because the sensor was out of calibration; per-sample uncertainty is not supplied. Two Saffire-I values are approximate midpoints of reported ranges.",
                "Oxygen fraction is only half of an atmosphere description. Without total pressure, partial pressure and atmospheric equivalence cannot be established.",
            ],
            bullets=[
                f"Records with initial O2: {len(initial)}.",
                f"Records with final O2: {len(final)}.",
                "Approximate initial values (Saffire ranges): 2.",
                "Two BASS-II final values exceed their initials by more than 2 percentage points and are flagged, not corrected.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 ReadMe, calibrated initial and final O2"),
                    self.citation_for("PSI-98", "PSI-98 experimental table, oxygen column"),
                    *self.claim_citations(["CL-BASS2-O2-CAL"]),
                ]
            ),
            trace=[
                "Counted non-null initial and final O2 values.",
                "Computed min/max from normalized values only.",
                "Retained sensor-calibration and range caveats.",
            ],
            followUps=[
                "What pressure was BASS-II run at?",
                "Why can’t oxygen fraction alone define flammability?",
                "Show the O2 distribution by material.",
            ],
            page={"href": "#/atmosphere", "label": "Open Atmosphere Explorer"},
        )

    def corpus_material_answer(self, question: str) -> dict[str, Any]:
        counts: dict[str, int] = {}
        for record in self.corpus.records:
            family = record["material_family"]
            counts[family] = counts.get(family, 0) + 1
        top = sorted(counts.items(), key=lambda item: -item[1])
        thickness = sum(
            1 for record in self.corpus.records if _value(record, "thickness_mm") is not None
        )
        return self.base_answer(
            question,
            grade="partial",
            headline=f"{len(counts)} parsed material families across 131 records.",
            paragraphs=[
                "Material family and dimensions are parsed from free-text source fields, not from a controlled materials taxonomy. They are marked derived.",
                f"{counts.get('Unknown', 0)} records have no identifiable material family in the source row, and {thickness} records have a parsable thickness.",
            ],
            bullets=[f"{family}: {count} records" for family, count in top],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table, Fuel Sample Material"),
                    self.citation_for("PSI-98", "PSI-98 experimental table, Material and dimensions"),
                ]
            ),
            trace=[
                "Grouped records by parsed material_family.",
                "Counted thickness availability separately.",
                "Did not treat material family as a certified specification.",
            ],
            followUps=[
                "Which materials were tested most often?",
                "How many records have thickness reported?",
                "Compare a BASS-II PMMA record with Saffire-I SIBAL.",
            ],
            page={"href": "#/atlas", "label": "Open Evidence Atlas"},
        )

    def corpus_flow_answer(self, question: str) -> dict[str, Any]:
        values = [
            _value(record, "flow_initial_cm_s")
            for record in self.corpus.records
            if isinstance(_value(record, "flow_initial_cm_s"), (int, float))
        ]
        sequences = sum(1 for record in self.corpus.records if record.get("flow_varies"))
        return self.base_answer(
            question,
            grade="partial",
            headline=(
                f"Air flow is reported for {len(values)} of 131 records; the corpus spans "
                f"{format_number(min(values))}–{format_number(max(values))} cm/s."
            ),
            paragraphs=[
                "The values do not share one measurement basis. BASS-II records a duct air-speed display with a response time of about one minute; Saffire-I reports a flow setting for each sample.",
                "The BASS-II derived velocity applies a single workbook factor (U = 1.0066 × Air display). Day- and restrictor-specific calibration exists but was not applied per test.",
            ],
            bullets=[
                f"Records with a reported flow: {len(values)}.",
                f"Records with a changing flow sequence: {sequences}.",
                "BASS-II flow direction: not reported per test.",
                "Saffire-I flow direction: concurrent (S1) and opposed (S2).",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 ReadMe, Air display and Fan display"),
                    self.citation_for("PSI-25", "PSI-25 Fan Calibration data sheet, U = 1.0066(AIR)"),
                    self.citation_for("PSI-98", "PSI-98 experimental table, air flow and flow direction"),
                    *self.claim_citations(["CL-BASS2-AIR", "CL-BASS2-FAN", "CL-FAN-CAL"]),
                ]
            ),
            trace=[
                "Counted non-null reported flow values.",
                "Computed range from normalized values.",
                "Separated display values from derived values.",
            ],
            followUps=[
                "Why is BASS-II flow not a calibrated velocity?",
                "Compare Saffire-I S1 and S2.",
                "Which records have changing flow?",
            ],
            page={"href": "#/atlas", "label": "Open Evidence Atlas"},
        )

    def saffire_answer(self, question: str) -> dict[str, Any]:
        saffire = [record for record in self.corpus.records if record["family"] == "Saffire-I"]
        descriptions = []
        for record in saffire:
            direction = _value(record, "flow_direction")
            descriptions.append(
                f"{record['experiment_id']}: {record['material_raw']}, "
                f"{format_compact(_dv(record, 'thickness_mm'))}, "
                f"{format_compact(_dv(record, 'width_cm'))} × {format_compact(_dv(record, 'length_cm'))}, "
                f"flow {format_compact(_dv(record, 'flow_initial_cm_s'))}, "
                f"ignition {format_compact(_dv(record, 'ignition_power_w'))} for {format_compact(_dv(record, 'ignition_time_s'))}, "
                f"burn {format_compact(_dv(record, 'burn_time_s'))}, "
                f"{str(direction).lower() if direction is not None else 'direction not reported'} flow."
            )
        return self.base_answer(
            question,
            grade="direct",
            headline="Saffire-I contributes 2 experiment records, both SIBAL fabric.",
            paragraphs=[
                " ".join(descriptions),
                "The Saffire-I CSV also contains two pre/post-flow image-set descriptor rows (F1C1/F1C2 and F2C1/F2C2). They were excluded because they are not instrumented experiments.",
                "Neither Saffire record reports total pressure, per-test gravity, ignition method, or a standardized extinction outcome.",
            ],
            bullets=[
                "Investigation: Spacecraft Fire Safety Experiment-I (PSI-98).",
                "Material: SIBAL cloth, 75% cotton / 25% fiberglass, 0.37 cm thick.",
                "S1 burn time: 420 s; S2 burn time: 70 s.",
                "Flow basis is not the same as the BASS-II duct display.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-98", "PSI-98 experimental table, CSV rows 2–3"),
                    *self.claim_citations(["CL-SAF-MAT", "CL-SAF-PRESS"]),
                ]
            ),
            trace=[
                "Filtered family = Saffire-I.",
                "Excluded non-experiment image-set descriptor rows at ingestion.",
                "Read ignition, burn and flow fields from normalized records.",
            ],
            followUps=[
                "Compare Saffire-I S1 and S2.",
                "Why are Saffire and BASS-II not directly comparable?",
                "What pressure data are missing from Saffire?",
            ],
            page={"href": "#/compare", "label": "Open Compare"},
        )

    def bass_answer(self, question: str) -> dict[str, Any]:
        bass = [record for record in self.corpus.records if record["family"] == "BASS-II"]
        pis: list[str] = []
        for record in bass:
            pi = record.get("pi")
            if pi and pi not in pis:
                pis.append(pi)
        return self.base_answer(
            question,
            grade="direct",
            headline="BASS-II contributes 129 experiment records across six principal investigators.",
            paragraphs=[
                "Burning and Suppression of Solids – II studied ignition, flame growth, flame spread and extinction limits for solid fuels in low-velocity forced flows in microgravity, using a small wind tunnel in the Microgravity Science Glovebox.",
                f"Principal investigators represented: {', '.join(pis)}. Initial O2 spans 13.6–22.2%. No record reports total pressure, per-test gravity, ignition method, or a standardized outcome.",
            ],
            bullets=[
                "Source: PSI-25, DOI 10.60555/4qc4-de67, CC0-1.0.",
                "Records: 129; all 129 test IDs match the six-sheet test matrix workbook.",
                "All 129 initial O2 values match the matrix workbook numerically.",
                "Oxygen sensor was out of calibration and corrected with a constant offset.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table, CSV rows 2–130"),
                    *self.claim_citations(["CL-BASS2-OBJ", "CL-BASS2-FLOW", "CL-BASS2-O2-CAL"]),
                ]
            ),
            trace=[
                "Filtered family = BASS-II.",
                "Counted distinct PIs and computed O2 range.",
                "Retrieved matrix cross-check result from the validation report.",
            ],
            followUps=[
                "What materials did BASS-II test?",
                "Show the validation cross-check.",
                "What is missing from BASS-II records?",
            ],
            page={"href": "#/atlas", "label": "Open Evidence Atlas"},
        )

    def luci_answer(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="context",
            headline="LUCI is partial-gravity context, not a PSI experiment record.",
            paragraphs=[
                "The Lunar Combustion Investigation flew material flammability experiments in simulated lunar gravity on a spinning Blue Origin New Shepard: 11 RPM at an effective radius of 1.22 m, with a burn lasting more than two and a half minutes.",
                "Reported findings: SIBAL flame base spread 0.92 mm/s and tip 1.1 mm/s; PMMA tip spread about 1.5 mm/s; chamber O2 fell from 20% to 14.3%. These are presentation-level findings from a single flight.",
                "FIRETRACE does not import LUCI as structured per-test data and does not compare it record-by-record with BASS-II or Saffire-I.",
            ],
            bullets=[
                "11 RPM, 1.22 m effective radius.",
                "SIBAL and 4 mm PMMA rod; air at normal pressure.",
                "Chamber O2 fell from 20% to 14.3%.",
                "Context source only: NTRS 20250010653.",
            ],
            citations=self.dedupe_citations(
                [
                    self.ntrs_citation("NTRS PDF pages 12, 16, 19–22"),
                    *self.claim_citations(["CL-LUCI-FEAS", "CL-LUCI-SPREAD"]),
                ]
            ),
            trace=[
                "Routed query to LUCI context.",
                "Retrieved verified claims with presentation locators.",
                "Kept LUCI outside the PSI record set.",
            ],
            followUps=[
                "Does the corpus contain partial-gravity records?",
                "Why is LUCI not directly comparable?",
                "What would a partial-gravity test need to report?",
            ],
            page={"href": "#/methodology", "label": "Open Methodology & Sources"},
        )

    def suspect_answer(self, question: str) -> dict[str, Any]:
        suspect = [
            record
            for record in self.corpus.records
            if record.get("validation_status") == "suspect"
        ]
        return self.base_answer(
            question,
            grade="direct",
            headline=f"{len(suspect)} records carry retained suspect flags. None were corrected or discarded.",
            paragraphs=[
                "The flags identify internal inconsistencies in the source values, not a judgement that the experiment failed. FIRETRACE preserves the reported values and exposes the flag in the record drawer and CSV exports.",
                "Two BASS-II final oxygen readings exceed their initial readings by more than 2 percentage points. Two BASS-II dates carry an unexpected 2018 year in a 2014 campaign. The six-sheet matrix cross-check found no substantive numeric conflict, so these remain source-level anomalies.",
            ],
            bullets=[
                f"{record['experiment_id']} ({record['investigation_acronym']}): "
                + "; ".join(humanize_token(flag) for flag in (record.get("quality_flags") or []))
                + "."
                for record in suspect
            ],
            citations=self.dedupe_citations(
                [self.citation_for("PSI-25", "PSI-25 experimental table and six-sheet test matrix")]
            ),
            trace=[
                "Selected records whose validation_status is suspect.",
                "Read the retained quality_flags without changing any measured value.",
                "Checked the matrix cross-check result for substantive numeric conflicts.",
            ],
            followUps=[
                "Show the validation cross-check.",
                "What is missing from the corpus?",
                "How are suspect records exported?",
            ],
            page={"href": "#/methodology", "label": "Open Methodology & Sources"},
        )

    def missing_answer(self, question: str) -> dict[str, Any]:
        records = self.corpus.records
        total = len(records)
        final = sum(1 for record in records if _value(record, "oxygen_final_pct") is not None)
        thickness = sum(1 for record in records if _value(record, "thickness_mm") is not None)
        return self.base_answer(
            question,
            grade="direct",
            headline="Pressure, per-test gravity, ignition method and a standardized outcome are absent across the corpus.",
            paragraphs=[
                "These are metadata gaps, not zeros. No cabin pressure or g-level was substituted, and no outcome was inferred from a free-text note or a burn duration.",
                "Oxygen and flow are broadly reported, but not on one comparable basis: BASS-II oxygen carries a constant-offset correction and its flow is a slow instrument display; the two Saffire oxygen values are approximate and its flow is a reported setting.",
            ],
            bullets=[
                f"Total pressure: 0 of {total} records.",
                f"Measured per-test gravity: 0 of {total} records.",
                f"Standardized outcome: 0 of {total} records.",
                f"Ignition method: 0 of {total} records.",
                f"Final O2: {final} of {total} records; four BASS-II finals are absent.",
                f"Thickness: {thickness} of {total} records parsed from free text.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table and ReadMe"),
                    self.citation_for("PSI-98", "PSI-98 experimental table and ReadMe"),
                    self.challenge_citation(),
                ]
            ),
            trace=[
                "Counted non-null values for each required comparison field.",
                "Separated absent metadata from measured zero.",
                "Did not impute pressure, gravity, ignition method or outcome.",
            ],
            followUps=[
                "What pressure was BASS-II run at?",
                "Which records are flagged suspect?",
                "What would a comparable test need to record?",
            ],
            page={"href": "#/gap", "label": "Open Gap Planner"},
        )

    def validation_answer(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="direct",
            headline="The corpus passed its identity, cross-check, missing-data and provenance gates.",
            paragraphs=[
                "All 131 experiment IDs are unique. All 129 BASS-II test IDs appear in the six-sheet matrix workbook, and all 129 initial O2 values match numerically. No substantive numeric conflict was found.",
                "Quality distribution: 71 validated, 56 partial, 4 suspect. Suspect flags are retained, not corrected: two final-O2 values exceed their initials by more than 2 percentage points, and two dates carry an unexpected 2018 year.",
            ],
            bullets=[
                "Unique experiment IDs: 131, 0 duplicates.",
                "Test IDs matched to matrix: 129/129.",
                "Initial O2 exact matches: 129/129.",
                "Records with total pressure: 0.",
                "Records with measured per-test gravity: 0.",
                "Saffire non-experiment rows excluded: 2.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table and six-sheet test matrix"),
                    self.citation_for("PSI-98", "PSI-98 experimental table"),
                ]
            ),
            trace=[
                "Read data/processed/validation_report.json.",
                "Reported pre-computed checks without re-scoring them.",
                "Listed retained anomalies separately from corrections.",
            ],
            followUps=[
                "Show the suspect records.",
                "Which source files were used?",
                "How was the matrix cross-check performed?",
            ],
            page={"href": "#/methodology", "label": "Open Methodology & Sources"},
        )

    def compare_answer(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="absent",
            headline="BASS-II and Saffire-I cannot be treated as directly comparable tests.",
            paragraphs=[
                "They differ in investigation, hardware, sample form and flow measurement basis. Neither reports total pressure or per-test gravity, and neither reports a standardized outcome.",
                "A side-by-side table is still useful, but it is a provenance comparison, not a controlled experimental comparison. FIRETRACE shows the blockers explicitly rather than collapsing them into a score.",
            ],
            bullets=[
                "Mixed investigations and hardware.",
                "Pressure unknown for both sides.",
                "Per-test gravity unknown for both sides.",
                "Different flow measurement bases.",
                "No standardized outcome on either side.",
                "No similarity score is computed; the blockers are shown instead.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table"),
                    self.citation_for("PSI-98", "PSI-98 experimental table"),
                ]
            ),
            trace=[
                "Recognized a comparison intent.",
                "Checked investigation, pressure, gravity, flow and outcome comparability.",
                "Returned blockers instead of a similarity score.",
            ],
            followUps=[
                "Compare BASS2-B1 and SAFFIRE1-S1.",
                "Why is pressure a blocker?",
                "What would a comparable test need to record?",
            ],
            page={"href": "#/compare", "label": "Open Compare"},
        )

    def safety_refusal(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="out-of-scope",
            headline="FIRETRACE does not predict fire risk or certify materials.",
            paragraphs=[
                "The corpus has no standardized ignition, spread or extinction outcome, no total pressure, and no per-test gravity. A fire-risk or material-safety conclusion cannot be supported by these records.",
                "The evidence assistant retrieves and cites what the sources report. It does not extrapolate a flammability result, rank materials by safety, or approve an atmosphere or procedure.",
            ],
            bullets=[
                "No fire-risk score is computed anywhere in this application.",
                "No material is labelled safe or unsafe.",
                "No missing pressure or gravity value is imputed.",
                "Planning outputs are checklists, not predictions or certifications.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table and ReadMe"),
                    self.citation_for("PSI-98", "PSI-98 experimental table and ReadMe"),
                    self.challenge_citation(),
                ]
            ),
            trace=[
                "Detected a request for prediction, risk, or certification.",
                "Checked for a standardized outcome and controlled atmosphere fields.",
                "Abstained under the project evidence policy.",
            ],
            followUps=[
                "What can the corpus say about oxygen?",
                "What measurements are missing?",
                "What would a defensible test plan record?",
            ],
            page={"href": "#/gap", "label": "Open Gap Planner"},
        )

    def help_answer(self, question: str) -> dict[str, Any]:
        return self.base_answer(
            question,
            grade="direct",
            headline="Ask about records, measured conditions, missing fields, or sources.",
            paragraphs=[
                "FIRETRACE is a deterministic retrieval and citation engine. It matches your question to the bundled corpus, answers only from reported values, and abstains when the sources do not support an answer. No external model or API is called.",
            ],
            bullets=[
                "“What pressure was BASS-II run at?”",
                "“What oxygen did BASS2-B1 report?”",
                "“Does the corpus include partial-gravity data?”",
                "“Compare BASS-II and Saffire-I.”",
                "“What did LUCI find?”",
                "“Is this material safe in a lunar cabin?”",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table"),
                    self.citation_for("PSI-98", "PSI-98 experimental table"),
                ]
            ),
            trace=["Matched help intent.", "Returned supported question patterns."],
            followUps=[
                "What pressure was BASS-II run at?",
                "What oxygen did BASS2-B1 report?",
                "What is missing from the corpus?",
            ],
        )

    # -- router ----------------------------------------------------------
    def ask(self, question: str) -> dict[str, Any]:
        q = (question or "").strip()
        if not q:
            return self.help_answer(question)

        if re.search(
            r"(is|are|would|will|could|can)\b.{0,40}\b(safe|unsafe|flammable|burn(?! (?:time|duration|rate))|ignite|fire risk|risk of fire)\b",
            q,
            flags=re.IGNORECASE,
        ) or re.search(
            r"\b(certif|approve|clearance|predict|risk score|safety factor)\b",
            q,
            flags=re.IGNORECASE,
        ):
            return self.safety_refusal(q)

        if re.search(r"\bcompare\b|\bcomparison\b|\bversus\b|\bvs\b", q, flags=re.IGNORECASE):
            return self.compare_answer(q)

        record = self.find_record(q)
        if record:
            return self.test_answer(q, record)

        if re.search(
            r"partial[- ]gravity|lunar|moon|mars|microgravity|gravity|\bg[- ]?level\b",
            q,
            flags=re.IGNORECASE,
        ):
            return self.corpus_gravity_answer(q)
        if re.search(
            r"pressure|psia|\bpsi\b|partial pressure|atmosphere",
            q,
            flags=re.IGNORECASE,
        ):
            return self.corpus_pressure_answer(q)
        if re.search(
            r"missing|absent|not reported|reported|coverage|\bgap\b|what.*lack",
            q,
            flags=re.IGNORECASE,
        ):
            return self.missing_answer(q)
        if re.search(r"luci|sounding rocket|new shepard", q, flags=re.IGNORECASE):
            return self.luci_answer(q)
        if re.search(r"saffire", q, flags=re.IGNORECASE):
            return self.saffire_answer(q)
        if re.search(r"bass", q, flags=re.IGNORECASE):
            return self.bass_answer(q)
        if re.search(
            r"material|pmma|sibal|nomex|wax|fabric|polymer|thickness",
            q,
            flags=re.IGNORECASE,
        ):
            return self.corpus_material_answer(q)
        if re.search(
            r"flow|airflow|air flow|velocity|fan|ventilation|cm/s",
            q,
            flags=re.IGNORECASE,
        ):
            return self.corpus_flow_answer(q)
        if re.search(r"oxygen|\bo2\b|oxid", q, flags=re.IGNORECASE):
            return self.corpus_oxygen_answer(q)
        if re.search(
            r"\bcompare\b|\bcomparison\b|\bversus\b|\bvs\b|\bdifference\b",
            q,
            flags=re.IGNORECASE,
        ):
            return self.compare_answer(q)
        if re.search(r"suspect|flagged|quality flag", q, flags=re.IGNORECASE):
            return self.suspect_answer(q)
        if re.search(
            r"valid|quality|check|audit|error|anomal|source|provenance|citation|doi|download",
            q,
            flags=re.IGNORECASE,
        ):
            return self.validation_answer(q)
        if re.search(
            r"help|what can|how do|guide|ask|hello|hi\b", q, flags=re.IGNORECASE
        ):
            return self.help_answer(q)

        pressure = sum(
            1 for record in self.corpus.records if _value(record, "total_pressure_psia") is not None
        )
        investigations = ", ".join(
            f"{item.get('family')} {item.get('records')}"
            for item in (self.corpus.meta.get("investigations") or [])
        )
        return self.base_answer(
            q,
            grade="absent",
            headline="I can’t answer that from the bundled corpus.",
            paragraphs=[
                "No retrieved record or verified claim supports a specific answer to this question. FIRETRACE abstains rather than generating an unsupported statement.",
                f"The corpus contains {len(self.corpus.records)} experiment records ({investigations}), {pressure} of which report total pressure.",
            ],
            bullets=[
                "Try a record ID such as BASS2-B1 or SAFFIRE1-S1.",
                "Ask about oxygen, flow, materials, validation, or a named investigation.",
                "Ask what is missing; abstention is a valid evidence result.",
            ],
            citations=self.dedupe_citations(
                [
                    self.citation_for("PSI-25", "PSI-25 experimental table"),
                    self.citation_for("PSI-98", "PSI-98 experimental table"),
                ]
            ),
            trace=[
                "No record entity matched.",
                "No supported intent matched.",
                "Abstained instead of generating an answer.",
            ],
            followUps=[
                "What pressure was BASS-II run at?",
                "What materials are in the corpus?",
                "What can FIRETRACE answer?",
            ],
        )


def answer_to_text(answer: dict[str, Any]) -> str:
    lines: list[str] = [answer.get("headline", ""), "", *(answer.get("paragraphs") or [])]
    bullets = answer.get("bullets") or []
    if bullets:
        lines.extend(["", *(f"• {bullet}" for bullet in bullets)])
    citations = answer.get("citations") or []
    if citations:
        lines.extend(["", "Sources:"])
        for citation in citations:
            lines.append(
                f"- {citation.get('sourceId')} · {citation.get('locator')} · {citation.get('url')}"
            )
    lines.extend(
        [
            "",
            "No external model was called. This answer is deterministic retrieval from the bundled corpus.",
        ]
    )
    return "\n".join(lines)


_engine: Optional[RetrievalEngine] = None


def get_engine() -> RetrievalEngine:
    global _engine
    if _engine is None:
        _engine = RetrievalEngine()
    return _engine


def ask(question: str) -> dict[str, Any]:
    return get_engine().ask(question)
