"""Grounded, retrieval-first assistant over the curated corpus.

Pipeline: route intent -> retrieve with FTS5/BM25 -> compute in Python -> build
claims that each carry ``source_id`` + ``locator`` -> validate -> return.

Validation is the contract, not a decoration:

* every ``source_id`` must resolve to a curated artifact in the source manifest;
* every numeric token in a claim must already exist — with the same unit — in a
  cited curated record, or be the output of a computation whose inputs are all
  cited records.

A claim that fails either test is dropped. If no claim survives, the answer is
downgraded to an abstention. Retrieved text is treated as data, never as
instructions, and no model is called anywhere in this module.
"""
from __future__ import annotations

import re
import statistics
import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from app.v1 import policy
from app.v1.compare import ComparisonError, compare, compare_families
from app.v1.store import EvidenceStore

RECORD_ID_RE = re.compile(r"\b(?:BASS2|SAFFIRE1)-[A-Z]{1,2}\d{1,3}[a-z]?\b", re.IGNORECASE)
TEST_TOKEN_RE = re.compile(r"\b(?:test|sample)\s+([A-Z]{1,2}\d{1,3}[a-z]?)\b", re.IGNORECASE)

# Identifiers whose digits are names, not measurements.
IDENTIFIER_RE = re.compile(
    r"\b(?:BASS2|SAFFIRE1|PSI|NTRS|CHALLENGE)-\d+[A-Za-z0-9-]*\b", re.IGNORECASE
)

FIELD_INTENTS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("total_pressure_psia", re.compile(r"\b(pressure|psia|psi|atmospher\w*|partial pressure|dalton)\b", re.I)),
    ("gravity_regime", re.compile(r"\b(gravity|microgravity|micro-g|micro g|g-level|lunar|moon|mars|partial-g\w*)\b", re.I)),
    ("flow_initial_cm_s", re.compile(r"\b(flow|airflow|air flow|velocity|ventilation|fan|duct|cm/s)\b", re.I)),
    ("oxygen_initial_pct", re.compile(r"\b(oxygen|o2|oxid\w*)\b", re.I)),
    ("co2_initial_pct", re.compile(r"\b(co2|carbon dioxide)\b", re.I)),
    ("co_initial_ppm", re.compile(r"\b(carbon monoxide|\bco\b)\b", re.I)),
    ("thickness_mm", re.compile(r"\b(thickness|thick)\b", re.I)),
    ("ignition_method", re.compile(r"\b(ignition|igniter|ignitor)\b", re.I)),
    ("burn_time_s", re.compile(r"\b(burn time|burn duration)\b", re.I)),
    ("outcome", re.compile(r"\b(outcome|extinguish\w*|sustained burning|ignition success)\b", re.I)),
)

MATERIAL_INVENTORY_RE = re.compile(r"\b(materials?|species|polymer|fabric|samples?)\b", re.I)
MATERIAL_QUESTION_RE = re.compile(
    r"\b(material|materials|species|polymer|substrate)\b", re.I
)
CONTEXT_SOURCE_RE = re.compile(
    r"\b(luci|sounding rocket|new shepard|ntrs|context source|rotating)\b", re.I
)

COMPARE_RE = re.compile(r"\b(compare|comparison|versus|vs\.?|differ\w*|contrast)\b", re.I)
COVERAGE_RE = re.compile(
    r"\b(missing|absent|not reported|unreported|coverage|gap|gaps|lack\w*|what.*(?:don't|do not) have)\b",
    re.I,
)
VALIDATION_RE = re.compile(
    r"\b(valid\w*|quality|audit|suspect|flagged|provenance|citation|doi|download|integrity)\b",
    re.I,
)
HELP_RE = re.compile(r"\b(help|what can|how do|how to|guide|hello|hi)\b", re.I)

MATERIAL_TERMS: tuple[tuple[str, str], ...] = (
    ("pmma", "PMMA"),
    ("sibal", "SIBAL"),
    ("nomex", "Nomex"),
    ("wax", "Wax"),
)


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def _new_answer_id() -> str:
    return f"ans-{uuid.uuid4().hex[:16]}"


def _scrub_digits(text: str) -> str:
    """Remove any sentence carrying an unvalidated number from free prose.

    Claims are the only place a number may appear, because claims are validated.
    Digits that are part of a curated identifier (``BASS2-B1``, ``PSI-25``) are
    names, not measurements, so they are allowed.
    """
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    kept: list[str] = []
    for part in parts:
        without_ids = IDENTIFIER_RE.sub(" ", part)
        if policy.numeric_tokens(without_ids):
            continue
        kept.append(part)
    return " ".join(kept).strip()


def _unit_of(records: Iterable[dict[str, Any]], store: EvidenceStore, name: str) -> Optional[str]:
    for record in records:
        payload = store.record_fields(record).get(name)
        if isinstance(payload, dict) and payload.get("unit"):
            return str(payload["unit"])
    return None


def _normalise(text: str) -> str:
    return " ".join(str(text or "").strip().lower().split())


@dataclass
class ClaimDraft:
    text: str
    source_id: str
    locator: str
    evidence_type: str = "record_field"
    evidence_ids: list[str] = field(default_factory=list)
    source_ids: list[str] = field(default_factory=list)
    unit: Optional[str] = None
    computations: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "source_id": self.source_id,
            "locator": self.locator,
            "evidence_type": self.evidence_type,
            "evidence_ids": self.evidence_ids,
            "supporting_source_ids": self.source_ids or [self.source_id],
            "unit": self.unit,
            "computations": self.computations,
        }


def computation(
    label: str,
    formula: str,
    value: Any,
    unit: Optional[str],
    inputs: list[str],
    field_name: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "label": label,
        "formula": formula,
        "value": policy.fmt_num(value, 6) if policy.is_number(value) else str(value),
        "unit": unit,
        "field": field_name,
        "inputs": inputs,
    }


# --------------------------------------------------------------------------- #
# validation
# --------------------------------------------------------------------------- #
def _record_number_pool(store: EvidenceStore, record: dict[str, Any]) -> list[tuple[str, Optional[str]]]:
    """Every number a curated record actually carries, with its unit."""
    pool: list[tuple[str, Optional[str]]] = []
    for payload in store.record_fields(record).values():
        unit = payload.get("unit")
        if payload.get("value") is not None:
            pool.append((policy.fmt_num(payload["value"], 6), str(unit) if unit else None))
        raw = payload.get("raw")
        if isinstance(raw, str):
            for token in policy.numeric_tokens(raw):
                pool.append((token, str(unit) if unit else None))
    for key in ("experiment_id", "test_number", "sample_number", "source_locator"):
        value = record.get(key)
        if isinstance(value, str):
            for token in policy.numeric_tokens(value):
                pool.append((token, None))
    return pool


STATISTIC_LABELS = frozenset({"minimum", "maximum", "median", "mean"})


def _statistic(label: str, values: list[float]) -> float:
    if label == "minimum":
        return min(values)
    if label == "maximum":
        return max(values)
    if label == "median":
        return float(statistics.median(values))
    return float(sum(values) / len(values))


def _verify_computation(
    store: EvidenceStore, item: dict[str, Any], resolved_ids: set[str]
) -> Optional[str]:
    """Recompute a computation from its cited records and compare.

    A computation is the only way a number that is not verbatim in a record may
    enter a claim, so it must be reproducible from the inputs it names. Counts
    are checked against the input set (or a field predicate), statistics are
    recomputed from the named field, and empty-input computations are limited to
    corpus totals that the store can verify.
    """
    label = str(item.get("label") or "")
    inputs = [str(value) for value in item.get("inputs") or []]
    if not label:
        return "computation has no label"
    if not set(inputs).issubset(resolved_ids):
        return f"computation {label!r} cites inputs outside evidence_ids"
    try:
        value = float(str(item.get("value")))
    except (TypeError, ValueError):
        return f"computation {label!r} has a non-numeric value"
    effective = inputs or sorted(resolved_ids)
    field_name = item.get("field")

    if label == "unresolved":
        expected = float(len(store.unresolved_references()))
    elif label == "record_count":
        expected = float(len(effective) if effective else store.record_count())
    elif label in STATISTIC_LABELS:
        if not field_name:
            return f"{label} computation must name its field"
        values: list[float] = []
        for experiment_id in effective:
            record = store.resolve_record(experiment_id)
            if record is None:
                return f"unresolved input {experiment_id!r}"
            payload = store.record_fields(record).get(str(field_name))
            if policy.has_value(payload) and policy.is_number(payload.get("value")):
                values.append(float(payload["value"]))
        if not values:
            return f"{label} computation has no reported values in its inputs"
        expected = _statistic(label, values)
    elif label.endswith("count"):
        if field_name and label in {
            "reported_count",
            "qualitative_count",
            "measured_count",
            "standardized_count",
        }:
            matching = 0
            for experiment_id in effective:
                record = store.resolve_record(experiment_id)
                if record is None:
                    return f"unresolved input {experiment_id!r}"
                payload = store.record_fields(record).get(str(field_name))
                status = policy.status_of(payload)
                if label == "qualitative_count":
                    matched = policy.has_value(payload) and status == "reported_qualitative"
                elif label == "measured_count":
                    matched = status in {"measured", "corrected"}
                elif label == "standardized_count":
                    matched = status in {"measured", "corrected", "derived"}
                else:
                    matched = policy.has_value(payload)
                if matched:
                    matching += 1
            expected = float(matching)
        else:
            expected = float(len(effective))
    else:
        return f"unsupported computation label {label!r}"

    if abs(value - expected) > 1e-6 * max(1.0, abs(expected)):
        return (
            f"computation {label!r} states {policy.fmt_num(value, 6)} but its cited "
            f"records recompute to {policy.fmt_num(expected, 6)}"
        )
    return None


def _claim_problem(store: EvidenceStore, claim: ClaimDraft) -> Optional[str]:
    if not claim.text.strip():
        return "empty claim text"
    supporting_sources = claim.source_ids or [claim.source_id]
    if claim.source_id not in supporting_sources:
        return f"source_id {claim.source_id!r} missing from supporting sources"
    for source_id in supporting_sources:
        if store.resolve_source(source_id) is None:
            return f"unresolved source_id {source_id!r}"
    if not claim.locator.strip():
        return "claim has no locator"

    pool: list[tuple[str, Optional[str]]] = []
    resolved_ids: set[str] = set()
    for evidence_id in claim.evidence_ids:
        record = store.resolve_record(evidence_id)
        if record is None:
            return f"unresolved evidence id {evidence_id!r}"
        resolved_ids.add(store.record_id(record))
        pool.extend(_record_number_pool(store, record))

    tokens = policy.numeric_tokens(IDENTIFIER_RE.sub(" ", claim.text))

    for item in claim.computations:
        problem = _verify_computation(store, item, resolved_ids)
        if problem:
            return problem
        item_unit = item.get("unit")
        for token in policy.numeric_tokens(str(item.get("value") or "")):
            pool.append((token, str(item_unit) if item_unit else None))

    for token in tokens:
        matches = [unit for value, unit in pool if value == token]
        if not matches:
            return f"number {token!r} does not exist in cited evidence"
        if claim.unit:
            if not any(unit in (claim.unit, None) for unit in matches):
                return (
                    f"number {token!r} exists only with unit "
                    f"{sorted({str(unit) for unit in matches})}, not {claim.unit!r}"
                )
    return None


def validate_claims(
    store: EvidenceStore, drafts: list[ClaimDraft]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    accepted: list[dict[str, Any]] = []
    issues: list[str] = []
    for draft in drafts:
        problem = _claim_problem(store, draft)
        if problem:
            issues.append(f"rejected claim ({problem}): {draft.text}")
            continue
        accepted.append(draft.as_dict())
    report = {
        "ok": not issues,
        "checked": len(drafts),
        "rejected": len(issues),
        "issues": issues,
    }
    return accepted, report


# --------------------------------------------------------------------------- #
# answer assembly
# --------------------------------------------------------------------------- #
class Assistant:
    def __init__(self, store: EvidenceStore) -> None:
        self.store = store

    # -- public -------------------------------------------------------- #
    def answer(self, question: str, filters: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        question = (question or "").strip()
        hits, terms, mode = self.store.retrieve(question, limit=8)
        retrieval = {
            "mode": mode,
            "query_terms": terms,
            "hits": [hit.as_dict() for hit in hits],
            "record_hits": [
                hit.ref_id for hit in hits if hit.kind == "record"
            ][:8],
        }

        reason = policy.out_of_scope_reason(question)
        if reason:
            return self._out_of_scope(question, reason, retrieval)

        drafts, grade, headline, paragraphs, bullets, extra = self._route(
            question, filters, hits
        )

        if filters:
            extra.setdefault("missing_conditions", []).extend(self._filter_gaps(filters))

        claims, report = validate_claims(self.store, drafts)

        if not claims and grade != "out-of-scope" and not extra.get("research_scope"):
            grade = "absent"
            headline = (
                "No validated claim survives retrieval for this question."
                if drafts
                else "No curated record or claim supports an answer to this question."
            )
            paragraphs = [
                policy.ABSTENTION_NOTICE,
                "Claims that failed source resolution or numeric grounding were discarded.",
            ]
            bullets = []
            if not report["issues"]:
                report = {
                    "ok": True,
                    "checked": 0,
                    "rejected": 0,
                    "issues": [],
                }

        citations = self._citations(claims)
        if not citations:
            citations = self._coverage_citations()

        trace = self._trace(mode, terms, bool(hits), bool(claims), report)
        answer = {
            "answer_id": _new_answer_id(),
            "corpus_version": self.store.corpus_version,
            "question": question,
            "grade": grade,
            "headline": _scrub_digits(headline) or "Retrieved evidence summary.",
            "claims": claims,
            "paragraphs": [_scrub_digits(item) for item in paragraphs if _scrub_digits(item)],
            "bullets": [_scrub_digits(item) for item in bullets if _scrub_digits(item)],
            "limitations": list(self.store.limitations),
            "contradictions": extra.get("contradictions", []),
            "missing_conditions": extra.get("missing_conditions", []),
            "citations": citations,
            "trace": trace,
            "retrieval": retrieval,
            "validation": report,
            "follow_ups": extra.get("follow_ups", self._default_follow_ups()),
            "policy_version": policy.POLICY_VERSION,
            "answer_schema_version": policy.ANSWER_SCHEMA_VERSION,
            "disclaimer": policy.DISCLAIMER,
            "out_of_scope_reason": None,
        }
        return answer

    # -- routing ------------------------------------------------------- #
    def _route(
        self,
        question: str,
        filters: Optional[dict[str, Any]],
        hits: list[Any],
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        record = self._find_record(question)
        record_ids = self._record_ids(question)
        families = self._families(question)

        unresolved = self._unresolved_record_tokens(question)
        if unresolved:
            return self._unknown_identifier_answer(unresolved)

        if re.search(r"\bFLEX\b|\bsummary report\b|\bresearch report\b", question, re.I):
            return ([], "absent", "Report evidence is outside this assistant's indexed record layer.",
                    ["Use the Research Library in Evidence Atlas for verified report findings and page citations. "
                     "This assistant indexes the experimental record layer; it cannot retrieve those report passages. "
                     "A report observation is not a measurement for an individual test. "
                     "FLEX droplet research must not be substituted for solid-fuel experiment evidence."], [],
                    {"research_scope": True, "follow_ups": ["What oxygen did BASS2-B1 report?"]})

        if filters:
            return self._filtered_answer(question, filters)

        if COMPARE_RE.search(question) and (len(record_ids) >= 2 or len(families) >= 2):
            return self._compare_answer(record_ids, families)

        if record is not None:
            return self._record_answer(question, record)

        material = self._material(question)
        if material:
            return self._material_answer(material)

        if COVERAGE_RE.search(question):
            return self._gap_answer()

        if VALIDATION_RE.search(question):
            return self._validation_answer()

        if MATERIAL_INVENTORY_RE.search(question) and not re.search(
            r"\b(pressure|oxygen|flow|gravity|ignition|outcome|thickness)\b", question, re.I
        ):
            return self._materials_answer()

        for field_name, pattern in FIELD_INTENTS:
            if pattern.search(question):
                # If the question names one investigation or one material, the
                # aggregate must be computed over that population, not the whole
                # corpus. Otherwise a Saffire question would be answered with
                # BASS-II statistics.
                population = None
                if len(families) == 1:
                    population = [
                        record
                        for record in self.store.records
                        if str(record.get("family")) == families[0]
                    ]
                elif material:
                    needle = material.lower()
                    population = [
                        record
                        for record in self.store.records
                        if needle
                        in " ".join(
                            str(record.get(key) or "")
                            for key in ("material_raw", "material_family", "material_species")
                        ).lower()
                    ]
                return self._aggregate_answer(field_name, question, records=population)

        if len(families) == 1:
            return self._family_answer(families[0])

        if CONTEXT_SOURCE_RE.search(question):
            return self._context_source_answer("NTRS-20250010653")

        if HELP_RE.search(question):
            return self._help_answer()

        return self._fallback_answer(question, hits)

    # -- entity and intent detection ----------------------------------- #
    def _find_record(self, question: str) -> Optional[dict[str, Any]]:
        for match in RECORD_ID_RE.finditer(question):
            record = self.store.resolve_record(match.group(0))
            if record is not None:
                return record
        explicit = TEST_TOKEN_RE.search(question)
        if explicit:
            return self.store.resolve_record(explicit.group(1))
        return None

    def _record_ids(self, question: str) -> list[str]:
        found: list[str] = []
        for match in RECORD_ID_RE.finditer(question):
            record = self.store.resolve_record(match.group(0))
            if record is not None:
                found.append(self.store.record_id(record))
        return found

    def _unresolved_record_tokens(self, question: str) -> list[str]:
        """Record-shaped identifiers in the question that no curated record matches."""
        unresolved: list[str] = []
        for match in RECORD_ID_RE.finditer(question):
            token = match.group(0)
            if self.store.resolve_record(token) is None and token not in unresolved:
                unresolved.append(token)
        for match in TEST_TOKEN_RE.finditer(question):
            token = match.group(1)
            if self.store.resolve_record(token) is None and token not in unresolved:
                unresolved.append(token)
        return unresolved

    def _families(self, question: str) -> list[str]:
        families: list[str] = []
        for family in sorted({str(record.get("family")) for record in self.store.records}):
            if re.search(rf"\b{re.escape(family)}\b", question, re.I):
                families.append(family)
        return families

    def _material(self, question: str) -> Optional[str]:
        lowered = question.lower()
        for needle, label in MATERIAL_TERMS:
            if re.search(rf"\b{re.escape(needle)}\b", lowered):
                return label
        return None

    def _field_intent(self, question: str) -> Optional[str]:
        for field_name, pattern in FIELD_INTENTS:
            if pattern.search(question):
                return field_name
        return None

    def _unknown_identifier_answer(
        self, tokens: list[str]
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        source_ids, locator = self._scope(self.store.records)
        claim = ClaimDraft(
            text="No curated record matches the identifier named in this question.",
            source_id="PSI-25",
            locator=locator or "PSI-25 experimental table; PSI-98 experimental table",
            evidence_type="corpus_meta",
            evidence_ids=[],
            source_ids=source_ids or ["PSI-25"],
        )
        return (
            [claim],
            "absent",
            "The named record is not in the curated corpus.",
            [
                "The question names an experiment identifier that no curated record matches. "
                "FIRETRACE abstains instead of substituting a different record or a corpus-wide "
                "average.",
                "Identifiers are matched against curated record ids and test numbers only.",
            ],
            [],
            {
                "missing_conditions": [f"Curated record for {token}" for token in tokens],
                "follow_ups": [
                    "What oxygen did BASS2-B1 report?",
                    "What is missing from the corpus?",
                ],
            },
        )

    # -- record answers ------------------------------------------------- #
    def _record_answer(
        self, question: str, record: dict[str, Any]
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        experiment_id = self.store.record_id(record)
        source_id = str(record.get("source_id"))
        locator = self.store.locator_for(record)
        fields = self.store.record_fields(record)
        drafts: list[ClaimDraft] = []
        missing: list[str] = []

        def add_field_claim(name: str) -> None:
            payload = fields.get(name)
            label = self.store.field_label(name)
            if policy.has_value(payload):
                value = payload.get("value")
                unit = payload.get("unit")
                status = payload.get("status")
                if policy.is_number(value):
                    text = (
                        f"{experiment_id} reports {label.lower()} of "
                        f"{policy.fmt_num(value)} {unit or ''} (status: {status})."
                    ).replace(" )", ")")
                else:
                    text = (
                        f"{experiment_id} records {label.lower()} as {value} "
                        f"(status: {status})."
                    )
                drafts.append(
                    ClaimDraft(
                        text=text,
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_field",
                        evidence_ids=[experiment_id],
                        unit=str(unit) if unit else None,
                    )
                )
            else:
                missing.append(label)
                drafts.append(
                    ClaimDraft(
                        text=(
                            f"No {label.lower()} is reported for {experiment_id}; "
                            f"the source status is {policy.status_of(payload)}."
                        ),
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_field",
                        evidence_ids=[experiment_id],
                    )
                )

        requested = self._field_intent(question)
        material_intent = requested is None and bool(MATERIAL_QUESTION_RE.search(question))
        species_value = str(record.get("material_species") or "")
        species_named = bool(species_value) and not species_value.lower().startswith("unknown")

        if requested:
            add_field_claim(requested)
        elif material_intent:
            raw = record.get("material_raw")
            family_material = record.get("material_family")
            geometry = record.get("geometry")
            drafts.append(
                ClaimDraft(
                    text=f"{experiment_id} is curated as {raw}.",
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_field",
                    evidence_ids=[experiment_id],
                )
            )
            if family_material:
                drafts.append(
                    ClaimDraft(
                        text=f"The curated material family for {experiment_id} is {family_material}.",
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_field",
                        evidence_ids=[experiment_id],
                    )
                )
            if species_named:
                drafts.append(
                    ClaimDraft(
                        text=f"The curated material species for {experiment_id} is {species_value}.",
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_field",
                        evidence_ids=[experiment_id],
                    )
                )
            else:
                missing.append("Named polymer species")
                drafts.append(
                    ClaimDraft(
                        text=(
                            f"The source row does not name a polymer species for "
                            f"{experiment_id}, so the species stays unknown."
                        ),
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_field",
                        evidence_ids=[experiment_id],
                    )
                )
            if geometry:
                drafts.append(
                    ClaimDraft(
                        text=f"The curated geometry for {experiment_id} is {geometry}.",
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_field",
                        evidence_ids=[experiment_id],
                    )
                )
        else:
            for name in (
                "oxygen_initial_pct",
                "flow_initial_cm_s",
                "total_pressure_psia",
                "gravity_regime",
            ):
                add_field_claim(name)
            drafts.insert(
                0,
                ClaimDraft(
                    text=(
                        f"{experiment_id} is a curated {record.get('family')} record for "
                        f"{record.get('material_family')}."
                    ),
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_field",
                    evidence_ids=[experiment_id],
                ),
            )

        has_pressure = policy.has_value(fields.get("total_pressure_psia"))
        has_gravity_measure = (
            policy.status_of(fields.get("gravity_regime")) == "measured"
        )
        grade = "direct"
        if requested:
            grade = "direct" if policy.has_value(fields.get(requested)) else "absent"
        elif material_intent:
            grade = "direct" if species_named else "partial"
        elif not has_pressure or not has_gravity_measure:
            grade = "partial"

        if material_intent:
            headline = f"{experiment_id} — curated material record."
        elif not requested:
            headline = (
                f"{experiment_id} — {record.get('material_family')} in {record.get('family')}."
            )
        else:
            headline = f"{experiment_id} — {self.store.field_label(requested).lower()}."
        if requested and not policy.has_value(fields.get(requested)):
            headline = (
                f"{experiment_id} does not report "
                f"{self.store.field_label(requested).lower()}."
            )

        paragraphs = [
            (
                f"This record is curated from {source_id}. Its validation status is "
                f"{record.get('validation_status')}, and the pipeline recorded the "
                "following missing fields."
            ),
            "Values are quoted with their source status. A missing value is reported as "
            "missing, never filled with a nominal cabin or laboratory condition.",
        ]
        bullets = [f"Validation status: {record.get('validation_status')}."]
        if record.get("quality_flags"):
            bullets.append(
                "Quality flags: " + ", ".join(str(item) for item in record["quality_flags"]) + "."
            )

        contradictions = self._contradictions([record])

        return (
            drafts,
            grade,
            headline,
            paragraphs,
            bullets,
            {
                "missing_conditions": missing,
                "contradictions": contradictions,
                "follow_ups": [
                    f"What material does {experiment_id} test?",
                    f"What is missing for {experiment_id}?",
                    "Compare this record with another.",
                ],
            },
        )

    # -- aggregate answers ---------------------------------------------- #
    def _aggregate_answer(
        self, field_name: str, question: str, records: Optional[list[dict[str, Any]]] = None
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        store = self.store
        population = records if records is not None else store.records
        label = store.field_label(field_name)
        unit = _unit_of(population, store, field_name)

        pairs: list[tuple[dict[str, Any], float]] = []
        for record in population:
            payload = store.record_fields(record).get(field_name)
            if policy.has_value(payload) and policy.is_number(policy.value_of(payload)):
                pairs.append((record, float(policy.value_of(payload))))

        total = len(population)
        drafts: list[ClaimDraft] = []
        population_ids = [store.record_id(record) for record in population]
        source_ids, scope_locator = self._scope(population)
        source_id = source_ids[0] if source_ids else "PSI-25"
        locator = scope_locator or (
            store.locator_for(population[0])
            if population
            else "PSI-25 experimental table"
        )

        if field_name == "gravity_regime":
            return self._gravity_answer(population)

        if not pairs:
            qualitative = [
                (record, store.record_fields(record).get(field_name))
                for record in population
                if policy.has_value(store.record_fields(record).get(field_name))
            ]
            if qualitative:
                distinct: dict[str, int] = {}
                for _record, payload in qualitative:
                    text = str(payload.get("value"))
                    distinct[text] = distinct.get(text, 0) + 1
                qualitative_ids = [
                    store.record_id(record) for record, _payload in qualitative
                ]
                drafts.append(
                    ClaimDraft(
                        text=(
                            f"{len(qualitative)} of {total} curated records report "
                            f"{label.lower()} as a qualitative value rather than a number."
                        ),
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_aggregate",
                        evidence_ids=population_ids,
                        source_ids=source_ids,
                        computations=[
                            computation(
                                "qualitative_count",
                                "count(records with a qualitative value)",
                                len(qualitative),
                                None,
                                qualitative_ids,
                                field_name=field_name,
                            ),
                            computation(
                                "record_count",
                                "count(records)",
                                total,
                                None,
                                population_ids,
                            ),
                        ],
                    )
                )
                digit_free = [
                    value for value in distinct if not policy.numeric_tokens(value)
                ]
                if digit_free:
                    named = [
                        (record, payload)
                        for record, payload in qualitative
                        if str(payload.get("value")) in digit_free
                    ]
                    named_sources, named_locator = self._scope(
                        record for record, _payload in named
                    )
                    drafts.append(
                        ClaimDraft(
                            text="Recorded qualitative values: " + ", ".join(sorted(digit_free)) + ".",
                            source_id=named_sources[0] if named_sources else source_id,
                            locator=named_locator or locator,
                            evidence_type="record_field",
                            evidence_ids=[
                                store.record_id(record) for record, _payload in named
                            ][:5],
                            source_ids=named_sources or source_ids,
                        )
                    )
                return (
                    drafts,
                    "partial",
                    f"{label} is qualitative in this corpus; no standardized numeric column exists.",
                    [
                        "The source records free-text tokens rather than a standardized outcome "
                        "column, so no numeric aggregate is produced.",
                    ],
                    [],
                    {"missing_conditions": ["Standardized numeric outcome"]},
                )

            drafts.append(
                ClaimDraft(
                    text=f"0 of {total} curated records report {label.lower()}.",
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_aggregate",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                    computations=[
                        computation(
                            "reported_count",
                            "count(records where value reported)",
                            0,
                            None,
                            population_ids,
                            field_name=field_name,
                        ),
                        computation(
                            "record_count",
                            "count(records)",
                            total,
                            None,
                            population_ids,
                        ),
                    ],
                )
            )
            return (
                drafts,
                "absent",
                f"No curated record reports {label.lower()}.",
                [
                    policy.ABSTENTION_NOTICE,
                    "The absence is a documented metadata gap in the source table, not a "
                    "measured zero.",
                ],
                [],
                {
                    "missing_conditions": [label],
                    "follow_ups": [
                        "What is missing from the corpus?",
                        "Which fields are covered?",
                    ],
                },
            )

        values = [value for _record, value in pairs]
        all_ids = [store.record_id(record) for record, _value in pairs]
        minimum = min(pairs, key=lambda item: item[1])
        maximum = max(pairs, key=lambda item: item[1])
        median = statistics.median(values)

        drafts.append(
            ClaimDraft(
                text=f"{len(pairs)} of {total} curated records report {label.lower()}.",
                source_id=source_id,
                locator=locator,
                evidence_type="record_aggregate",
                evidence_ids=population_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "reported_count",
                        "count(records where value reported)",
                        len(pairs),
                        None,
                        all_ids,
                        field_name=field_name,
                    ),
                    computation(
                        "record_count",
                        "count(records)",
                        total,
                        None,
                        population_ids,
                    ),
                ],
            )
        )
        extremes = [minimum[0], maximum[0]]
        extreme_sources, _extreme_locator = self._scope(extremes)
        drafts.append(
            ClaimDraft(
                text=(
                    f"Reported {label.lower()} values span {policy.fmt_num(minimum[1])} to "
                    f"{policy.fmt_num(maximum[1])} {unit or ''}."
                ).replace(" )", ")"),
                source_id=str(minimum[0].get("source_id")),
                locator="; ".join(store.locator_for(record) for record in extremes),
                evidence_type="record_aggregate",
                evidence_ids=[store.record_id(minimum[0]), store.record_id(maximum[0])],
                source_ids=extreme_sources,
                unit=unit,
                computations=[
                    computation(
                        "minimum",
                        "min(reported values)",
                        minimum[1],
                        unit,
                        [store.record_id(minimum[0])],
                        field_name=field_name,
                    ),
                    computation(
                        "maximum",
                        "max(reported values)",
                        maximum[1],
                        unit,
                        [store.record_id(maximum[0])],
                        field_name=field_name,
                    ),
                ],
            )
        )
        drafts.append(
            ClaimDraft(
                text=(
                    f"The median reported {label.lower()} is {policy.fmt_num(median)} "
                    f"{unit or ''}."
                ).replace(" )", ")"),
                source_id=source_id,
                locator=locator,
                evidence_type="record_aggregate",
                evidence_ids=population_ids,
                source_ids=source_ids,
                unit=unit,
                computations=[
                    computation(
                        "median",
                        "median(reported values)",
                        median,
                        unit,
                        all_ids,
                        field_name=field_name,
                    )
                ],
            )
        )

        by_family: dict[str, int] = {}
        for record, _value in pairs:
            family = str(record.get("family"))
            by_family[family] = by_family.get(family, 0) + 1
        if len(by_family) > 1:
            top_family, top_count = max(by_family.items(), key=lambda item: item[1])
            top_records = [
                record for record, _value in pairs if str(record.get("family")) == top_family
            ]
            top_ids = [store.record_id(record) for record in top_records]
            top_sources, top_locator = self._scope(top_records)
            drafts.append(
                ClaimDraft(
                    text=(
                        f"{top_family} contributes {top_count} of the records reporting "
                        f"{label.lower()}."
                    ),
                    source_id=top_sources[0] if top_sources else source_id,
                    locator=top_locator or locator,
                    evidence_type="record_aggregate",
                    evidence_ids=top_ids,
                    source_ids=top_sources or source_ids,
                    computations=[
                        computation(
                            "family_count",
                            f"count(records in {top_family})",
                            top_count,
                            None,
                            top_ids,
                        )
                    ],
                )
            )

        missing_labels: list[str] = []
        for name in store.record_fields(population[0]).keys():
            reported = sum(
                1
                for record in population
                if policy.has_value(store.record_fields(record).get(name))
            )
            if reported < len(population):
                missing_labels.append(name)
        structural = [
            name
            for name in missing_labels
            if all(
                not policy.has_value(store.record_fields(record).get(name))
                for record in population
            )
        ]
        chosen = structural or missing_labels
        missing_labels = chosen[:4]

        return (
            drafts,
            "direct",
            f"{label} across the curated corpus.",
            [
                "Counts and ranges are computed in Python from curated field values only.",
                "Values marked derived come from a documented parsing or workbook factor, "
                "not from a new measurement.",
            ],
            [
                "Every quoted number is traceable to a curated record and its locator.",
                "Missing values are excluded from the statistics rather than treated as zero.",
            ],
            {
                "missing_conditions": [
                    store.field_label(name) for name in missing_labels
                ],
                "follow_ups": [
                    "What is missing from the corpus?",
                    "Compare two records on this quantity.",
                ],
            },
        )

    # -- corpus level answers ------------------------------------------- #
    def _gravity_answer(
        self, population: list[dict[str, Any]]
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        store = self.store
        total = len(population)
        population_ids = [store.record_id(record) for record in population]
        source_ids, scope_locator = self._scope(population)
        source_id = source_ids[0] if source_ids else "PSI-25"
        locator = scope_locator or (
            store.locator_for(population[0])
            if population
            else "PSI-25 experimental table"
        )

        regimes: dict[str, list[str]] = {}
        measured_ids: list[str] = []
        for record in population:
            payload = store.record_fields(record).get("gravity_regime")
            if payload.get("value") is not None:
                value = str(payload.get("value"))
                regimes.setdefault(value, []).append(store.record_id(record))
            if policy.status_of(payload) == "measured":
                measured_ids.append(store.record_id(record))

        drafts: list[ClaimDraft] = []
        if regimes:
            regime, regime_ids = max(regimes.items(), key=lambda item: len(item[1]))
            count = len(regime_ids)
            drafts.append(
                ClaimDraft(
                    text=(
                        f"Gravity is recorded as {regime} at investigation level for {count} of "
                        f"{total} curated records."
                    ),
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_aggregate",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                    computations=[
                        computation(
                            "regime_count",
                            f"count(records with {regime})",
                            count,
                            None,
                            regime_ids,
                        ),
                        computation(
                            "record_count",
                            "count(records)",
                            total,
                            None,
                            population_ids,
                        ),
                    ],
                )
            )
        measured = len(measured_ids)
        drafts.append(
            ClaimDraft(
                text=(
                    f"{measured} of {total} curated records carry a measured per-test gravity "
                    "value. The regime label is investigation-level metadata, not a measurement."
                ),
                source_id=source_id,
                locator=locator,
                evidence_type="record_aggregate",
                evidence_ids=population_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "measured_count",
                        "count(records with status measured)",
                        measured,
                        None,
                        population_ids,
                        field_name="gravity_regime",
                    ),
                    computation(
                        "record_count",
                        "count(records)",
                        total,
                        None,
                        population_ids,
                    ),
                ],
            )
        )
        partial_ids = [
            store.record_id(record)
            for record in population
            if "partial" in str(
                (store.record_fields(record).get("gravity_regime") or {}).get("value") or ""
            ).lower()
        ]
        partial_gravity = len(partial_ids)
        if partial_gravity:
            drafts.append(
                ClaimDraft(
                    text=(
                        f"{partial_gravity} of {total} curated records are partial-gravity "
                        "experiments."
                    ),
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_aggregate",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                    computations=[
                        computation(
                            "partial_gravity_count",
                            "count(partial-gravity records)",
                            partial_gravity,
                            None,
                            partial_ids,
                        ),
                        computation(
                            "record_count",
                            "count(records)",
                            total,
                            None,
                            population_ids,
                        ),
                    ],
                )
            )
        else:
            drafts.append(
                ClaimDraft(
                    text=(
                        "No curated record is a partial-gravity experiment; gravity is "
                        "recorded only at investigation level."
                    ),
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_aggregate",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                )
            )
        return (
            drafts,
            "context",
            "Gravity is investigation-level in this corpus.",
            [
                "No curated record carries a per-test g-level. The regime is documented once per "
                "investigation, so it cannot be compared between tests.",
                "FIRETRACE does not substitute a nominal gravity value for a missing measurement.",
            ],
            ["Partial-gravity experiments are not present in the curated corpus."],
            {
                "missing_conditions": ["Measured per-test gravity"],
                "follow_ups": [
                    "What is missing from the corpus?",
                    "Does the corpus include partial-gravity data?",
                ],
            },
        )

    def _materials_answer(
        self,
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        store = self.store
        groups: dict[str, list[dict[str, Any]]] = {}
        for record in store.records:
            species = str(record.get("material_species") or "Unknown")
            if species.lower().startswith("unknown"):
                species = "Unnamed"
            groups.setdefault(species, []).append(record)
        total = store.record_count()
        population_ids = [store.record_id(record) for record in store.records]
        source_ids, locator = self._scope(store.records)
        drafts: list[ClaimDraft] = []
        for species, members in sorted(groups.items(), key=lambda item: -len(item[1])):
            count = len(members)
            member_ids = [store.record_id(record) for record in members]
            if species == "Unnamed":
                text = (
                    f"The source row does not name a polymer species for {count} of {total} "
                    "curated records, so the species stays unknown."
                )
            else:
                text = f"{species} is reported for {count} of {total} curated records."
            drafts.append(
                ClaimDraft(
                    text=text,
                    source_id=source_ids[0] if source_ids else "PSI-25",
                    locator=locator,
                    evidence_type="record_aggregate",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                    computations=[
                        computation(
                            "species_count",
                            f"count(records with species {species})",
                            count,
                            None,
                            member_ids,
                        ),
                        computation(
                            "record_count",
                            "count(records)",
                            total,
                            None,
                            population_ids,
                        ),
                    ],
                )
            )
        return (
            drafts,
            "direct",
            "Material species across the curated corpus.",
            [
                "Species are parsed from the source material text. Unnamed polymers stay unknown "
                "rather than being assigned a species.",
            ],
            ["Material family, geometry and dimensions are curated fields, not inferred values."],
            {
                "missing_conditions": ["Named polymer species for every record"],
                "follow_ups": [
                    "What oxygen did PMMA records report?",
                    "What is missing from the corpus?",
                ],
            },
        )

    def _gap_answer(self) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        coverage = self.store.coverage()
        recomputed = coverage["recomputed"]
        total = coverage["record_count"]
        population_ids = [self.store.record_id(record) for record in self.store.records]
        source_ids, locator = self._scope(self.store.records)
        source_id = source_ids[0] if source_ids else "PSI-25"
        drafts: list[ClaimDraft] = []

        gap_rows = [
            ("total pressure", "reported_count", "total_pressure_psia", recomputed["pressure_reported"]),
            (
                "a measured per-test gravity level",
                "measured_count",
                "gravity_regime",
                recomputed["gravity_per_record_reported"],
            ),
            (
                "a standardized ignition or extinction outcome",
                "standardized_count",
                "outcome",
                recomputed["standardized_outcome_reported"],
            ),
        ]
        for label, computation_label, field_name, reported in gap_rows:
            drafts.append(
                ClaimDraft(
                    text=f"{reported} of {total} curated records report {label}.",
                    source_id=source_id,
                    locator=locator,
                    evidence_type="record_aggregate",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                    computations=[
                        computation(
                            computation_label,
                            "count(records where value reported)",
                            reported,
                            None,
                            population_ids,
                            field_name=field_name,
                        ),
                        computation(
                            "record_count",
                            "count(records)",
                            total,
                            None,
                            population_ids,
                        ),
                    ],
                )
            )

        drafts.append(
            ClaimDraft(
                text=(
                    f"An initial oxygen fraction is reported for "
                    f"{recomputed['oxygen_initial_reported']} of {total} records."
                ),
                source_id=source_id,
                locator=locator,
                evidence_type="record_aggregate",
                evidence_ids=population_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "reported_count",
                        "count(records where oxygen_initial_pct reported)",
                        recomputed["oxygen_initial_reported"],
                        None,
                        population_ids,
                        field_name="oxygen_initial_pct",
                    ),
                    computation(
                        "record_count",
                        "count(records)",
                        total,
                        None,
                        population_ids,
                    ),
                ],
            )
        )
        drafts.append(
            ClaimDraft(
                text=(
                    f"A forced-flow value is reported for {recomputed['flow_reported']} of "
                    f"{total} records."
                ),
                source_id=source_id,
                locator=locator,
                evidence_type="record_aggregate",
                evidence_ids=population_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "reported_count",
                        "count(records where flow_initial_cm_s reported)",
                        recomputed["flow_reported"],
                        None,
                        population_ids,
                        field_name="flow_initial_cm_s",
                    ),
                    computation(
                        "record_count",
                        "count(records)",
                        total,
                        None,
                        population_ids,
                    ),
                ],
            )
        )

        return (
            drafts,
            "direct",
            "What the corpus does not report.",
            [
                "These gaps are structural: the PSI experimental tables have no "
                "total-pressure column and no per-test gravity column.",
                "FIRETRACE keeps those values null. It does not substitute a nominal cabin "
                "pressure or a nominal gravity level.",
            ],
            [f"Curated limitation: {item}" for item in self.store.limitations[:4]],
            {
                "missing_conditions": [
                    "Total pressure",
                    "Measured per-test gravity",
                    "Standardized outcome",
                    "Ignition method",
                ],
                "follow_ups": [
                    "Which fields are covered?",
                    "What pressure was BASS-II run at?",
                ],
            },
        )

    def _validation_answer(self) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        store = self.store
        total = store.record_count()
        population_ids = [store.record_id(record) for record in store.records]
        source_ids, locator = self._scope(store.records)
        source_id = source_ids[0] if source_ids else "PSI-25"
        groups: dict[str, list[dict[str, Any]]] = {}
        for record in store.records:
            status = str(record.get("validation_status") or "unknown")
            groups.setdefault(status, []).append(record)
        suspect = store.records_with_flag("final_o2_exceeds_initial_by_more_than_2pp")
        suspect += [
            record
            for record in store.records
            if str(record.get("validation_status")) == "suspect"
            and record not in suspect
        ]

        drafts: list[ClaimDraft] = []
        for status, members in sorted(groups.items()):
            count = len(members)
            member_ids = [store.record_id(record) for record in members]
            drafts.append(
                ClaimDraft(
                    text=f"{count} of {total} curated records carry validation status {status}.",
                    source_id=source_id,
                    locator=locator,
                    evidence_type="corpus_meta",
                    evidence_ids=population_ids,
                    source_ids=source_ids,
                    computations=[
                        computation(
                            f"{status}_count",
                            f"count(records with status {status})",
                            count,
                            None,
                            member_ids,
                        ),
                        computation(
                            "record_count",
                            "count(records)",
                            total,
                            None,
                            population_ids,
                        ),
                    ],
                )
            )
        if suspect:
            drafts.append(
                ClaimDraft(
                    text=(
                        "Records flagged for a final oxygen reading above the initial value: "
                        + ", ".join(store.record_id(record) for record in suspect)
                        + "."
                    ),
                    source_id=source_id,
                    locator=locator,
                    evidence_type="corpus_meta",
                    evidence_ids=[store.record_id(record) for record in suspect],
                    source_ids=source_ids,
                )
            )

        unresolved = store.unresolved_references()
        drafts.append(
            ClaimDraft(
                text=(
                    "Every curated record resolves to a source artifact in the manifest; "
                    "the referential check found no unresolved source identifiers."
                    if not unresolved
                    else f"The referential check found {len(unresolved)} unresolved references."
                ),
                source_id=source_id,
                locator=locator,
                evidence_type="corpus_meta",
                evidence_ids=[],
                source_ids=source_ids,
                computations=(
                    []
                    if not unresolved
                    else [computation("unresolved", "count(unresolved references)", len(unresolved), None, [])]
                ),
            )
        )

        return (
            drafts,
            "direct",
            "Provenance and validation status of the curated corpus.",
            [
                "The corpus is curated from public NASA PSI experimental tables and a source "
                "manifest with per-artifact checksums.",
                "Suspect records are flagged and kept as reported; values are not corrected.",
            ],
            [
                "Each record carries a source locator down to the CSV row.",
                "The corpus version is the SHA-256 of the curated dataset.",
            ],
            {
                "contradictions": self._contradictions(suspect),
                "follow_ups": [
                    "What is missing from the corpus?",
                    "Which records are flagged suspect?",
                ],
            },
        )

    def _family_answer(
        self, family: str
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        records = [record for record in self.store.records if str(record.get("family")) == family]
        if not records:
            return self._fallback_answer(family, [])
        drafts, grade, headline, paragraphs, bullets, extra = self._aggregate_answer(
            "oxygen_initial_pct", family, records=records
        )
        family_ids = [self.store.record_id(record) for record in records]
        source_ids, locator = self._scope(records)
        drafts.insert(
            0,
            ClaimDraft(
                text=f"{family} contributes {len(records)} curated records to the corpus.",
                source_id=source_ids[0] if source_ids else str(records[0].get("source_id")),
                locator=locator or self.store.locator_for(records[0]),
                evidence_type="record_aggregate",
                evidence_ids=family_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "family_records",
                        f"count(records in {family})",
                        len(records),
                        None,
                        family_ids,
                    )
                ],
            ),
        )
        species = sorted({str(record.get("material_species")) for record in records})
        drafts.insert(
            1,
            ClaimDraft(
                text=f"{family} covers these curated material species: {', '.join(species)}.",
                source_id=source_ids[0] if source_ids else str(records[0].get("source_id")),
                locator=locator or self.store.locator_for(records[0]),
                evidence_type="record_field",
                evidence_ids=family_ids,
                source_ids=source_ids,
            ),
        )
        return (
            drafts,
            grade,
            f"{family}: curated records and reported conditions.",
            paragraphs,
            bullets,
            extra,
        )

    def _material_answer(
        self, material: str
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        needle = material.lower()
        records = [
            record
            for record in self.store.records
            if needle
            in " ".join(
                str(record.get(key) or "")
                for key in ("material_raw", "material_family", "material_species")
            ).lower()
        ]
        if not records:
            return (
                [
                    ClaimDraft(
                        text=f"0 curated records report material matching {material}.",
                        source_id="PSI-25",
                        locator="PSI-25 experimental table; PSI-98 experimental table",
                        evidence_type="record_aggregate",
                        evidence_ids=[],
                        computations=[
                            computation("material_count", "count(matching records)", 0, None, [])
                        ],
                    )
                ],
                "absent",
                f"No curated record reports material matching {material}.",
                [policy.ABSTENTION_NOTICE],
                [],
                {},
            )

        drafts, _grade, _headline, paragraphs, bullets, extra = self._aggregate_answer(
            "oxygen_initial_pct", material, records=records
        )
        material_ids = [self.store.record_id(record) for record in records]
        source_ids, locator = self._scope(records)
        drafts.insert(
            0,
            ClaimDraft(
                text=f"{len(records)} curated records report material matching {material}.",
                source_id=source_ids[0] if source_ids else str(records[0].get("source_id")),
                locator=locator or self.store.locator_for(records[0]),
                evidence_type="record_aggregate",
                evidence_ids=material_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "material_count",
                        "count(matching records)",
                        len(records),
                        None,
                        material_ids,
                    )
                ],
            ),
        )
        families = sorted({str(record.get("family")) for record in records})
        drafts.insert(
            1,
            ClaimDraft(
                text=f"Matching records come from these investigations: {', '.join(families)}.",
                source_id=source_ids[0] if source_ids else str(records[0].get("source_id")),
                locator=locator or self.store.locator_for(records[0]),
                evidence_type="record_field",
                evidence_ids=material_ids,
                source_ids=source_ids,
            ),
        )
        return (
            drafts,
            "partial",
            f"{material}: curated records and reported conditions.",
            paragraphs,
            bullets,
            extra,
        )

    def _filtered_answer(
        self, question: str, filters: dict[str, Any]
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        records = self.store.filter_records(
            family=filters.get("family") or "",
            material=filters.get("material") or "",
            gravity=filters.get("gravity") or "",
            min_o2=filters.get("min_o2"),
            max_o2=filters.get("max_o2"),
            flow_only=bool(filters.get("flow_only")),
            validation_status=filters.get("validation_status") or "",
        )
        if not records:
            return (
                [
                    ClaimDraft(
                        text="0 curated records match the requested filters.",
                        source_id="PSI-25",
                        locator="PSI-25 experimental table; PSI-98 experimental table",
                        evidence_type="record_aggregate",
                        evidence_ids=[],
                        computations=[
                            computation("filtered_records", "count(records matching filters)", 0, None, [])
                        ],
                    )
                ],
                "absent",
                "No curated record matches the requested filters.",
                [
                    "An empty result is a real answer: the filters describe conditions the "
                    "corpus does not cover.",
                    "Values are not relaxed or imputed to produce a match.",
                ],
                [],
                {},
            )

        filter_ids = [self.store.record_id(record) for record in records]
        source_ids, locator = self._scope(records)
        drafts: list[ClaimDraft] = [
            ClaimDraft(
                text=f"{len(records)} curated records match the requested filters.",
                source_id=source_ids[0] if source_ids else str(records[0].get("source_id")),
                locator=locator or self.store.locator_for(records[0]),
                evidence_type="record_aggregate",
                evidence_ids=filter_ids,
                source_ids=source_ids,
                computations=[
                    computation(
                        "filtered_records",
                        "count(records matching filters)",
                        len(records),
                        None,
                        filter_ids,
                    )
                ],
            )
        ]
        for record in records[:3]:
            drafts.append(
                ClaimDraft(
                    text=(
                        f"{self.store.record_id(record)} is a matching curated record for "
                        f"{record.get('material_family')} in {record.get('family')}."
                    ),
                    source_id=str(record.get("source_id")),
                    locator=self.store.locator_for(record),
                    evidence_type="record_field",
                    evidence_ids=[self.store.record_id(record)],
                )
            )
        aggregate, _g, _h, paragraphs, bullets, extra = self._aggregate_answer(
            "oxygen_initial_pct", question, records=records
        )
        return (
            drafts + aggregate,
            "partial",
            "Records matching the requested filters.",
            paragraphs,
            bullets,
            extra,
        )

    # -- comparison ------------------------------------------------------ #
    def _compare_answer(
        self, record_ids: list[str], families: list[str]
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        try:
            if len(record_ids) >= 2:
                result = compare(self.store, record_ids)
            elif len(families) >= 2:
                result = compare_families(self.store, families)
            else:
                raise ComparisonError("too_few_ids", "Two identifiers are required.")
        except ComparisonError as exc:
            return (
                [],
                "absent",
                exc.message,
                [policy.ABSTENTION_NOTICE],
                [],
                {},
            )

        evidence_ids = [item["experiment_id"] for item in result["experiments"]]
        first = result["experiments"][0]
        source_id = str(first.get("source_id"))
        locator = " ; ".join(str(item.get("source_locator")) for item in result["experiments"])

        drafts: list[ClaimDraft] = []
        for item in result["fields"]:
            if item["category"] != "consequential":
                continue
            if item["outcome"] == "matched":
                cells = item["values"]
                if item["field"] in policy.TOLERANCES:
                    parts = []
                    for key, cell in cells.items():
                        value = cell.get("value")
                        if policy.is_number(value):
                            parts.append(f"{key} {policy.fmt_num(value)} {cell.get('unit') or ''}".strip())
                    text = f"{item['label']} agrees: " + " and ".join(parts) + "."
                else:
                    text = (
                        f"{item['label']} agrees: "
                        + " and ".join(str(cell.get("value")) for cell in cells.values())
                        + "."
                    )
                drafts.append(
                    ClaimDraft(
                        text=text,
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_aggregate",
                        evidence_ids=evidence_ids,
                        unit=item.get("unit"),
                    )
                )
            elif item["outcome"] == "unknown":
                drafts.append(
                    ClaimDraft(
                        text=(
                            f"{item['label']} is unknown for this comparison because at least "
                            "one record does not report it. Missing values are not treated as "
                            "agreement."
                        ),
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_aggregate",
                        evidence_ids=evidence_ids,
                    )
                )
            else:
                cells = item["values"]
                rendered = " vs ".join(
                    f"{policy.fmt_num(cell.get('value')) if policy.is_number(cell.get('value')) else cell.get('value')}"
                    for cell in cells.values()
                )
                drafts.append(
                    ClaimDraft(
                        text=f"{item['label']} differs: {rendered}.",
                        source_id=source_id,
                        locator=locator,
                        evidence_type="record_aggregate",
                        evidence_ids=evidence_ids,
                        unit=item.get("unit"),
                    )
                )

        headline = f"{result['applicability']}: " + " and ".join(
            str(item.get("experiment_id")) for item in result["experiments"]
        ) + "."
        paragraphs = [
            result["applicability_reason"],
            "Each field is classified as matched, mismatched or unknown. There is no fused "
            "similarity or risk score.",
        ]
        bullets = [
            f"Blockers: {len(result['blockers'])}. Unknowns: {len(result['unknowns'])}. "
            f"Contextual differences: {len(result['confounders'])}."
        ]
        grade_by_applicability = {
            "Matched conditions": "direct",
            "Partial match": "partial",
            "Mechanistic context": "context",
            "No applicable record": "context",
        }
        return (
            drafts,
            grade_by_applicability.get(result["applicability"], "context"),
            headline,
            paragraphs,
            bullets,
            {
                "missing_conditions": [item["label"] for item in result["unknowns"]],
                "follow_ups": ["What is missing from the corpus?"],
            },
        )

    # -- fallbacks ------------------------------------------------------- #
    def _context_source_answer(
        self, source_id: str
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        source = self.store.resolve_source(source_id)
        if source is None:
            return self._fallback_answer(source_id, [])
        locator = next(
            (
                str(artifact.get("source_locator"))
                for artifact in source.get("artifacts", [])
                if artifact.get("source_locator")
            ),
            f"{source_id} citation metadata",
        )
        claims = [
            ClaimDraft(
                text=(
                    f"{source_id} is included in the source manifest with role "
                    f"{source.get('role')}. Its per-test results are not stored as structured "
                    "experiment records in this corpus."
                ),
                source_id=source_id,
                locator=locator,
                evidence_type="source_metadata",
                evidence_ids=[],
            )
        ]
        return (
            claims,
            "context",
            "Context source, not a structured record set.",
            [
                "This source is part of the manifest so a reader can follow the investigation. "
                "The curated corpus does not contain per-test measurements for it.",
                "No result is paraphrased from a document that was not extracted into structured fields.",
            ],
            ["Context sources are cited but never presented as measured results."],
            {
                "missing_conditions": ["Structured per-test records"],
                "follow_ups": [
                    "Does the corpus include partial-gravity data?",
                    "Which investigations have structured records?",
                ],
            },
        )

    def _fallback_answer(
        self, question: str, hits: list[Any]
    ) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for hit in hits:
            if hit.kind == "record":
                record = self.store.records_by_id.get(hit.ref_id)
                if record is not None and record not in records:
                    records.append(record)
            if len(records) >= 3:
                break

        if records:
            drafts = [
                ClaimDraft(
                    text=(
                        f"{self.store.record_id(record)} is a curated record for "
                        f"{record.get('material_family')} in {record.get('family')}."
                    ),
                    source_id=str(record.get("source_id")),
                    locator=self.store.locator_for(record),
                    evidence_type="record_field",
                    evidence_ids=[self.store.record_id(record)],
                )
                for record in records
            ]
            return (
                drafts,
                "context",
                "Retrieved records that match these terms.",
                [
                    "The question did not map to a single supported quantity, so these are the "
                    "curated records that retrieval returned.",
                    "No interpretation is added beyond the curated fields.",
                ],
                ["Ask for a specific field to get a direct answer."],
                {},
            )

        source_hits = [hit for hit in hits if hit.kind == "source"]
        if source_hits:
            source_id = source_hits[0].ref_id
            source = self.store.resolve_source(source_id)
            if source is not None:
                drafts = [
                    ClaimDraft(
                        text=(
                            f"{source_id} is included in the source manifest with role "
                            f"{source.get('role')}. Its results are not stored as structured "
                            "experiment records in this corpus."
                        ),
                        source_id=source_id,
                        locator=str(
                            next(
                                (
                                    artifact.get("source_locator")
                                    for artifact in source.get("artifacts", [])
                                    if artifact.get("source_locator")
                                ),
                                f"{source_id} citation metadata",
                            )
                        ),
                        evidence_type="source_metadata",
                        evidence_ids=[],
                    )
                ]
                return (
                    drafts,
                    "context",
                    "Retrieved source context, not structured records.",
                    [
                        "This investigation is present as context metadata only. The curated corpus "
                        "does not contain per-test records for it, so no measurement is quoted.",
                    ],
                    ["Context sources are cited but never presented as measured results."],
                    {
                        "missing_conditions": ["Structured experiment records"],
                        "follow_ups": [
                            "What is missing from the corpus?",
                            "Which investigations have structured records?",
                        ],
                    },
                )

        return (
            [
                ClaimDraft(
                    text="No curated record or claim matches the query terms.",
                    source_id="PSI-25",
                    locator="PSI-25 experimental table; PSI-98 experimental table",
                    evidence_type="corpus_meta",
                    evidence_ids=[],
                )
            ],
            "absent",
            "The corpus has no record for this question.",
            [policy.ABSTENTION_NOTICE],
            [],
            {
                "follow_ups": [
                    "What can FIRETRACE answer?",
                    "What is missing from the corpus?",
                ]
            },
        )

    def _help_answer(self) -> tuple[list[ClaimDraft], str, str, list[str], list[str], dict[str, Any]]:
        return (
            [
                ClaimDraft(
                    text=(
                        f"The curated corpus contains {self.store.record_count()} experiment "
                        "records across the investigations it covers."
                    ),
                    source_id="PSI-25",
                    locator="PSI-25 experimental table; PSI-98 experimental table",
                    evidence_type="corpus_meta",
                    evidence_ids=[],
                    computations=[
                        computation("record_count", "count(records)", self.store.record_count(), None, [])
                    ],
                )
            ],
            "context",
            "What this assistant can do.",
            [
                "Ask about a specific record identifier, a measured field, an investigation, "
                "a material, a comparison, or a documented gap.",
                "It abstains when the curated corpus does not report the field.",
            ],
            [
                "Record questions: oxygen, flow, pressure status, gravity status, material.",
                "Corpus questions: coverage, missing fields, validation status.",
                "Comparison questions: two to four records side by side.",
            ],
            {
                "follow_ups": [
                    "What oxygen did BASS2-B1 report?",
                    "What is missing from the corpus?",
                ]
            },
        )

    def _out_of_scope(
        self, question: str, reason: str, retrieval: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "answer_id": _new_answer_id(),
            "corpus_version": self.store.corpus_version,
            "question": question,
            "grade": "out-of-scope",
            "headline": _scrub_digits(
                "This question is outside the scope of an evidence reader."
            ),
            "claims": [],
            "paragraphs": [
                policy.OUT_OF_SCOPE_MESSAGES.get(reason, policy.DISCLAIMER),
                "FIRETRACE reports curated research evidence only. It does not predict fire "
                "risk, certify materials or prescribe procedures.",
            ],
            "bullets": [
                "Ask what a curated record measured.",
                "Ask which conditions the corpus does not cover.",
            ],
            "limitations": list(self.store.limitations),
            "contradictions": [],
            "missing_conditions": [],
            "citations": self._coverage_citations(),
            "trace": [
                "Applied the out-of-scope policy before retrieval.",
                "Refused instead of generating a risk statement.",
            ],
            "retrieval": retrieval,
            "validation": {"ok": True, "checked": 0, "rejected": 0, "issues": []},
            "follow_ups": [
                "What oxygen did BASS2-B1 report?",
                "What is missing from the corpus?",
            ],
            "policy_version": policy.POLICY_VERSION,
            "answer_schema_version": policy.ANSWER_SCHEMA_VERSION,
            "disclaimer": policy.DISCLAIMER,
            "out_of_scope_reason": reason,
        }

    # -- shared pieces --------------------------------------------------- #
    def _source_ids(self, records: Iterable[dict[str, Any]]) -> list[str]:
        return sorted(
            {str(record.get("source_id")) for record in records if record.get("source_id")}
        )

    def _table_locator(self, source_id: str) -> str:
        source = self.store.resolve_source(source_id)
        for artifact in (source or {}).get("artifacts", []):
            if artifact.get("role") == "experiment_table" and artifact.get("source_locator"):
                return str(artifact["source_locator"])
        return ""

    def _scope(self, records: Iterable[dict[str, Any]]) -> tuple[list[str], str]:
        """Supporting sources and a table-level locator for an aggregate claim."""
        records = list(records)
        source_ids = self._source_ids(records)
        locators = [
            f"{source_id}: {self._table_locator(source_id)}"
            for source_id in source_ids
            if self._table_locator(source_id)
        ]
        return source_ids, "; ".join(locators)

    def _citations(self, claims: list[dict[str, Any]]) -> list[dict[str, Any]]:
        citations: list[dict[str, Any]] = []
        for claim in claims:
            sources = claim.get("supporting_source_ids") or [claim["source_id"]]
            if len(sources) == 1:
                citations.append(self.store.citation(sources[0], claim["locator"]))
                continue
            for source_id in sources:
                locator = self._table_locator(source_id) or claim["locator"]
                citations.append(self.store.citation(source_id, locator))
        return self.store.dedupe_citations(citations)

    def _coverage_citations(self) -> list[dict[str, Any]]:
        citations = [
            self.store.citation(source_id, source_id + " experimental table")
            for source_id in ("PSI-25", "PSI-98")
            if self.store.resolve_source(source_id)
        ]
        return citations

    def _contradictions(self, records: Iterable[dict[str, Any]]) -> list[str]:
        notes: list[str] = []
        for record in records:
            flags = [str(item) for item in (record.get("quality_flags") or [])]
            if "final_o2_exceeds_initial_by_more_than_2pp" in flags:
                notes.append(
                    f"{self.store.record_id(record)}: the reported final oxygen fraction "
                    "exceeds the initial value by more than two percentage points. The flag is "
                    "kept and the value is not corrected."
                )
            if "date_year_unexpected_2018_in_2014_campaign" in flags:
                notes.append(
                    f"{self.store.record_id(record)}: the reported date year is unexpected for "
                    "the campaign. The source value is kept verbatim."
                )
        return notes

    def _filter_gaps(self, filters: dict[str, Any]) -> list[str]:
        gaps: list[str] = []
        if filters.get("min_o2") is not None or filters.get("max_o2") is not None:
            gaps.append(
                "Oxygen filters apply to the reported initial oxygen fraction only."
            )
        if filters.get("gravity"):
            gaps.append(
                "Gravity is investigation-level; no per-test g-level exists in the corpus."
            )
        return gaps

    def _trace(
        self,
        mode: str,
        terms: list[str],
        had_hits: bool,
        had_claims: bool,
        report: dict[str, Any],
    ) -> list[str]:
        steps = ["Normalised the question and removed stopwords."]
        if mode == "no-terms":
            steps.append("No searchable terms remained after stopword removal.")
        else:
            steps.append("Ran FTS5 BM25 retrieval over the curated index.")
            steps.append(
                "Retrieved indexed evidence documents."
                if had_hits
                else "Retrieval returned no indexed evidence documents."
            )
        steps.append("Routed the question to a supported evidence dimension.")
        steps.append(
            "Computed every quote and aggregate in Python from curated field values."
        )
        steps.append(
            "Validated each claim: source resolution plus numeric token and unit grounding."
        )
        if report["rejected"]:
            steps.append("Dropped claims that failed validation.")
        if not had_claims:
            steps.append("Abstained because no claim survived validation.")
        steps.append("No language model was called for this answer.")
        return steps

    def _default_follow_ups(self) -> list[str]:
        return [
            "What is missing from the corpus?",
            "Which fields are covered?",
        ]


def answer(store: EvidenceStore, question: str, filters: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    return Assistant(store).answer(question, filters)
