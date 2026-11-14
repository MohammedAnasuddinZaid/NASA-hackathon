"""Helpers shared by the API tests.

These are deliberately independent re-implementations of the two acceptance
rules, so a bug in the assistant's own validator cannot hide a grounding error:

1. every returned source id resolves to the curated manifest;
2. every numeric token in a claim exists in a cited record or is a declared
   computation over cited records.
"""
from __future__ import annotations

import statistics
from typing import Any, Iterable

from app.v1 import policy
from app.v1.assistant import IDENTIFIER_RE, _record_number_pool
from app.v1.store import EvidenceStore

ANSWER_TEXT_FIELDS = ("headline", "paragraphs", "bullets")
STATISTIC_LABELS = {"minimum", "maximum", "median", "mean"}
FIELD_PREDICATES = {
    "reported_count": lambda payload: policy.has_value(payload),
    "qualitative_count": lambda payload: policy.has_value(payload)
    and policy.status_of(payload) == "reported_qualitative",
    "measured_count": lambda payload: policy.status_of(payload) == "measured",
    "standardized_count": lambda payload: policy.status_of(payload)
    in {"measured", "derived"},
}


def answer_strings(payload: dict[str, Any]) -> list[str]:
    """All answer-owned text, excluding the echoed user question."""
    texts: list[str] = []
    for field in ANSWER_TEXT_FIELDS:
        value = payload.get(field)
        if isinstance(value, str):
            texts.append(value)
        elif isinstance(value, list):
            texts.extend(str(item) for item in value)
    for claim in payload.get("claims") or []:
        texts.append(str(claim.get("text") or ""))
    for key in ("limitations", "contradictions", "missing_conditions", "trace", "follow_ups"):
        texts.extend(str(item) for item in payload.get(key) or [])
    return texts


def claim_numbers(claim: dict[str, Any]) -> set[str]:
    return policy.numeric_tokens(IDENTIFIER_RE.sub(" ", claim.get("text") or ""))


def _recompute(
    store: EvidenceStore, computation: dict[str, Any], evidence_ids: list[str]
) -> float:
    """Recompute a declared computation from the records it cites.

    This mirrors the acceptance rule, not the production code: a computation is
    allowed to introduce a number only if its inputs reproduce that number.
    """
    label = str(computation.get("label") or "")
    inputs = [str(value) for value in computation.get("inputs") or []]
    assert set(inputs).issubset(evidence_ids), (label, inputs, evidence_ids)
    effective = inputs or evidence_ids
    field_name = computation.get("field")

    if label == "record_count":
        return float(len(effective) if effective else store.record_count())
    if label in STATISTIC_LABELS:
        assert field_name, f"{label} names no field"
        values = []
        for experiment_id in effective:
            record = store.resolve_record(experiment_id)
            assert record is not None, experiment_id
            payload = store.record_fields(record).get(str(field_name))
            if policy.has_value(payload) and policy.is_number(payload.get("value")):
                values.append(float(payload["value"]))
        assert values, f"{label} has no reported values"
        if label == "minimum":
            return float(min(values))
        if label == "maximum":
            return float(max(values))
        if label == "median":
            return float(statistics.median(values))
        return float(sum(values) / len(values))
    if label == "unresolved":
        return float(len(store.unresolved_references()))
    if label.endswith("count"):
        predicate = FIELD_PREDICATES.get(label)
        if predicate is None:
            return float(len(effective))
        assert field_name, f"{label} names no field"
        matching = 0
        for experiment_id in effective:
            record = store.resolve_record(experiment_id)
            assert record is not None, experiment_id
            if predicate(store.record_fields(record).get(str(field_name))):
                matching += 1
        return float(matching)
    raise AssertionError(f"unsupported computation label {label!r}")


def allowed_numbers(store: EvidenceStore, claim: dict[str, Any]) -> set[tuple[str, str | None]]:
    pool: list[tuple[str, str | None]] = []
    evidence_ids = [str(value) for value in claim.get("evidence_ids") or []]
    for evidence_id in evidence_ids:
        record = store.resolve_record(evidence_id)
        assert record is not None, f"unresolved evidence id {evidence_id}"
        pool.extend(_record_number_pool(store, record))
    for computation in claim.get("computations") or []:
        expected = _recompute(store, computation, evidence_ids)
        stated = float(str(computation.get("value")))
        assert abs(stated - expected) <= 1e-6 * max(1.0, abs(expected)), (
            f"computation {computation.get('label')!r} states {stated} but "
            f"recomputes to {expected}"
        )
        pool.extend(
            (token, computation.get("unit"))
            for token in policy.numeric_tokens(str(computation.get("value") or ""))
        )
    return set(pool)


def assert_claims_grounded(store: EvidenceStore, answer: dict[str, Any]) -> None:
    claims = answer.get("claims") or []
    for claim in claims:
        assert claim.get("source_id"), claim
        assert store.resolve_source(claim["source_id"]) is not None, claim["source_id"]
        assert str(claim.get("locator") or "").strip(), claim
        pool = allowed_numbers(store, claim)
        tokens = claim_numbers(claim)
        available = {token for token, _unit in pool}
        missing = tokens - available
        assert not missing, f"ungrounded numbers {missing} in {claim['text']!r}"
        if claim.get("unit"):
            units = {unit for token, unit in pool if token in tokens}
            assert claim["unit"] in units or None in units, (
                f"unit {claim['unit']!r} not supported by cited evidence"
            )


def assert_citations_resolve(store: EvidenceStore, answer: dict[str, Any]) -> None:
    cited: set[str] = set()
    for citation in answer.get("citations") or []:
        assert store.resolve_source(citation["source_id"]) is not None, citation
        assert str(citation.get("locator") or "").strip(), citation
        cited.add(str(citation["source_id"]))
    for claim in answer.get("claims") or []:
        assert store.resolve_source(claim["source_id"]) is not None, claim
        supporting = claim.get("supporting_source_ids") or [claim["source_id"]]
        assert claim["source_id"] in supporting, claim
        for source_id in supporting:
            assert store.resolve_source(source_id) is not None, source_id
            assert source_id in cited, f"supporting source {source_id} not cited"


def assert_no_forbidden_claims(texts: Iterable[str]) -> None:
    joined = "\n".join(texts).lower()
    for forbidden in ("% safe", "percent safe", "probability of ignition", "risk score:"):
        assert forbidden not in joined, forbidden
