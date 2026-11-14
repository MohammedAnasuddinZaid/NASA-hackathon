"""Deterministic comparison engine.

A comparison is a per-field audit, not a similarity score. Every field of every
participant is classified as ``matched``, ``mismatched`` or ``unknown``. A field
where any participant has no reported value is ``unknown`` — never ``equal``,
because two missing values are not evidence of agreement.

Tolerances come from ``policy.TOLERANCES`` and are versioned as
``matching-1.0``. Categorical fields (material species, gravity regime) are
compared by normalised text, not by tolerance.
"""
from __future__ import annotations

from typing import Any

from app.v1 import policy
from app.v1.store import EvidenceStore

NUMERIC_TOLERANCE_FIELDS = frozenset(policy.TOLERANCES)
CATEGORICAL_FIELDS = frozenset({"material_species", "gravity_regime", "family", "geometry"})


class ComparisonError(ValueError):
    def __init__(self, code: str, message: str, field_path: str = "ids") -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_path = field_path


def _normalise_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _cell(store: EvidenceStore, record: dict[str, Any], field: str) -> dict[str, Any]:
    if field in ("family",):
        return {
            "value": record.get("family"),
            "status": "reported_qualitative",
            "unit": None,
            "raw": record.get("family"),
        }
    if field in ("material_species", "geometry"):
        return {
            "value": record.get(field),
            "status": "reported_qualitative",
            "unit": None,
            "raw": record.get(field),
        }
    payload = store.record_fields(record).get(field)
    if payload is None:
        return {"value": None, "status": "not_extracted", "unit": None, "raw": None}
    return {
        "value": payload.get("value"),
        "status": payload.get("status"),
        "basis": payload.get("basis"),
        "unit": payload.get("unit"),
        "raw": payload.get("raw"),
    }


def _compare_field(
    field: str,
    label: str,
    category: str,
    cells: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    payloads = list(cells.values())
    unit = next((cell.get("unit") for cell in payloads if cell.get("unit")), None)
    missing = [
        key
        for key, cell in cells.items()
        if cell.get("value") is None or cell.get("status") in policy.NO_VALUE_STATUSES or (field == "flow_direction" and (cell.get("status") == "investigation_level" or cell.get("basis") == "investigation_level"))
    ]
    if missing:
        return {
            "field": field,
            "label": label,
            "category": category,
            "unit": unit,
            "values": cells,
            "outcome": "unknown",
            "tolerance": policy.TOLERANCES.get(field),
            "explanation": (
                "No reported value for: " + ", ".join(missing) + ". Missing is not equality."
            ),
        }

    if field in NUMERIC_TOLERANCE_FIELDS:
        numbers = [(key, float(cell["value"])) for key, cell in cells.items() if policy.is_number(cell["value"])]
        if len(numbers) != len(payloads):
            return {
                "field": field,
                "label": label,
                "category": category,
                "unit": unit,
                "values": cells,
                "outcome": "unknown",
                "tolerance": policy.TOLERANCES.get(field),
                "explanation": "At least one value is not numeric, so tolerance matching does not apply.",
            }
        keys = [key for key, _ in numbers]
        mismatched_pairs = []
        for index, (left_key, left) in enumerate(numbers):
            for right_key, right in numbers[index + 1 :]:
                if not policy.within_tolerance(field, left, right):
                    mismatched_pairs.append(f"{left_key} vs {right_key}")
        outcome = "mismatched" if mismatched_pairs else "matched"
        tolerance = policy.TOLERANCES[field]
        explanation = (
            "Within matching-1.0 tolerance (abs "
            f"{tolerance.get('abs')}, rel {tolerance.get('rel')})."
            if outcome == "matched"
            else "Outside matching-1.0 tolerance for: " + ", ".join(mismatched_pairs) + "."
        )
        if unit and field == "gravity_regime":
            explanation += " Gravity is investigation-level, not a per-test measurement."
        return {
            "field": field,
            "label": label,
            "category": category,
            "unit": unit,
            "values": cells,
            "outcome": outcome,
            "tolerance": tolerance,
            "explanation": explanation,
        }

    distinct = {_normalise_text(cell.get("value")) for cell in payloads}
    outcome = "matched" if len(distinct) == 1 else "mismatched"
    statuses = {str(cell.get("status")) for cell in payloads}
    explanation = (
        "Same normalised value."
        if outcome == "matched"
        else "Different values: " + ", ".join(sorted(value or "(blank)" for value in distinct)) + "."
    )
    if "investigation_level" in statuses:
        explanation += " This value is investigation-level, not a per-test measurement."
    return {
        "field": field,
        "label": label,
        "category": category,
        "unit": unit,
        "values": cells,
        "outcome": outcome,
        "tolerance": None,
        "explanation": explanation,
    }


def _applicability(fields: list[dict[str, Any]]) -> tuple[str, str]:
    consequential = [item for item in fields if item["category"] == "consequential"]
    matched = [item for item in consequential if item["outcome"] == "matched"]
    mismatched = [item for item in consequential if item["outcome"] == "mismatched"]
    unknown = [item for item in consequential if item["outcome"] == "unknown"]

    species = next((item for item in consequential if item["field"] == "material_species"), None)
    same_material = species is not None and species["outcome"] == "matched"

    if mismatched:
        if same_material:
            return (
                "Mechanistic context",
                "The material species matches, but at least one consequential condition differs: "
                + ", ".join(item["label"] for item in mismatched)
                + ".",
            )
        return (
            "No applicable record",
            "A consequential condition differs and the material species is not matched: "
            + ", ".join(item["label"] for item in mismatched)
            + ".",
        )
    if matched and not unknown:
        return (
            "Matched conditions",
            "Every consequential field is reported and within matching-1.0 tolerance.",
        )
    if matched and unknown:
        return (
            "Partial match",
            "Consequential fields that are reported agree, but the corpus does not report: "
            + ", ".join(item["label"] for item in unknown)
            + ".",
        )
    return (
        "No applicable record",
        "None of the consequential fields is reported for all participants.",
    )


def compare(store: EvidenceStore, ids: list[str]) -> dict[str, Any]:
    if len(ids) < 2:
        raise ComparisonError("too_few_ids", "At least two experiment ids are required.")
    if len(ids) > 4:
        raise ComparisonError("too_many_ids", "At most four experiment ids can be compared.")

    resolved: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw_id in ids:
        record = store.resolve_record(raw_id)
        if record is None:
            raise ComparisonError(
                "unknown_experiment",
                f"Unknown experiment id: {raw_id}",
                field_path="ids",
            )
        experiment_id = store.record_id(record)
        if experiment_id in seen:
            raise ComparisonError(
                "duplicate_id", f"Duplicate experiment id: {experiment_id}", field_path="ids"
            )
        seen.add(experiment_id)
        resolved.append(record)

    # Direction changes flame-spread geometry even when speed settings agree.
    field_specs = policy.CONSEQUENTIAL_FIELDS + (("flow_direction", "Flow direction"),) + policy.CONTEXTUAL_FIELDS
    cells_by_field: dict[str, dict[str, dict[str, Any]]] = {}
    for record in resolved:
        experiment_id = store.record_id(record)
        for field, _label in field_specs:
            cells_by_field.setdefault(field, {})[experiment_id] = _cell(store, record, field)

    label_by_field = dict(field_specs)
    consequential_names = {name for name, _ in policy.CONSEQUENTIAL_FIELDS} | {"flow_direction"}

    fields: list[dict[str, Any]] = []
    for field, _label in field_specs:
        category = "consequential" if field in consequential_names else "contextual"
        fields.append(
            _compare_field(
                field,
                label_by_field.get(field, _label),
                category,
                cells_by_field[field],
            )
        )

    blockers = [
        item
        for item in fields
        if item["category"] == "consequential" and item["outcome"] == "mismatched"
    ]
    unknowns = [
        item
        for item in fields
        if item["category"] == "consequential" and item["outcome"] == "unknown"
    ]
    confounders = [
        item
        for item in fields
        if item["category"] == "contextual" and item["outcome"] != "matched"
    ]
    applicability, reason = _applicability(fields)

    counts = {
        "matched": sum(1 for item in fields if item["outcome"] == "matched"),
        "mismatched": sum(1 for item in fields if item["outcome"] == "mismatched"),
        "unknown": sum(1 for item in fields if item["outcome"] == "unknown"),
    }

    experiments = [
        {
            "experiment_id": store.record_id(record),
            "family": record.get("family"),
            "material_raw": record.get("material_raw"),
            "material_species": record.get("material_species"),
            "source_id": record.get("source_id"),
            "source_locator": store.locator_for(record),
            "validation_status": record.get("validation_status"),
        }
        for record in resolved
    ]

    return {
        "corpus_version": store.corpus_version,
        "matching_policy": policy.MATCHING_POLICY_VERSION,
        "policy_version": policy.POLICY_VERSION,
        "experiments": experiments,
        "fields": fields,
        "summary": counts,
        "blockers": [
            {"field": item["field"], "label": item["label"], "explanation": item["explanation"]}
            for item in blockers
        ],
        "unknowns": [
            {"field": item["field"], "label": item["label"], "explanation": item["explanation"]}
            for item in unknowns
        ],
        "confounders": [
            {"field": item["field"], "label": item["label"], "explanation": item["explanation"]}
            for item in confounders
        ],
        "applicability": applicability,
        "applicability_reason": reason,
        "fused_score": None,
        "score_note": (
            "No fused similarity or risk score is produced. matched / mismatched / unknown are "
            "per-field audit outcomes, and missing values stay unknown."
        ),
        "limitations": [
            "Comparison uses curated fields only; it never imputes a missing value.",
            "Gravity is investigation-level for every record, not a measured per-test g-level.",
        ],
    }


def compare_families(store: EvidenceStore, families: list[str]) -> dict[str, Any]:
    """Reduce each family to its modal conditions, then run the same audit.

    Used by the assistant for 'compare BASS-II and Saffire-I' questions. The
    synthetic per-family rows are labelled as aggregates, never as records.
    """
    chosen: list[dict[str, Any]] = []
    for family in families:
        members = [record for record in store.records if str(record.get("family")) == str(family)]
        if not members:
            members = [
                record
                for record in store.records
                if str(record.get("family") or "").lower() == str(family).lower()
            ]
        if not members:
            raise ComparisonError("unknown_family", f"No records for family: {family}", "ids")
        chosen.append(members[0])

    result = compare(store, [store.record_id(record) for record in chosen])
    result["comparison_basis"] = "representative-record"
    result["basis_note"] = (
        "Families are compared through their first curated record. Family-level ranges are "
        "reported separately; they are not merged into a score."
    )
    for entry in result["experiments"]:
        family = str(entry.get("family"))
        members = [record for record in store.records if str(record.get("family")) == family]
        oxygen = [
            policy.as_number(store.record_fields(record).get("oxygen_initial_pct"))
            for record in members
        ]
        oxygen = [value for value in oxygen if value is not None]
        entry["record_count"] = len(members)
        entry["oxygen_initial_pct_range"] = (
            {"min": min(oxygen), "max": max(oxygen), "n": len(oxygen)} if oxygen else None
        )
    return result


def compare_available(store: EvidenceStore, minimum: int = 2) -> list[str]:
    families = sorted({str(record.get("family")) for record in store.records})
    return [family for family in families if sum(1 for r in store.records if str(r.get("family")) == family) >= minimum]


__all__ = [
    "ComparisonError",
    "compare",
    "compare_families",
    "compare_available",
]
