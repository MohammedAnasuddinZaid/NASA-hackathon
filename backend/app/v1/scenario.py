"""Scenario evaluation against the curated corpus.

Given requested conditions, this module reports which curated records cover them,
which requested conditions the corpus cannot resolve at all, and how each
consequential condition compares. It never returns a risk probability, a safety
percentage or a certification — those keys are explicitly absent.
"""
from __future__ import annotations

from typing import Any, Optional

from app.v1 import policy
from app.v1.compare import _compare_field, _cell
from app.v1.store import EvidenceStore

GRAVITY_ALIASES: dict[str, str] = {
    "microgravity": "microgravity",
    "micro-g": "microgravity",
    "micro g": "microgravity",
    "µg": "microgravity",
    "ug": "microgravity",
    "0g": "microgravity",
    "zero-g": "microgravity",
    "zero g": "microgravity",
    "weightless": "microgravity",
    "iss": "microgravity",
}

PARTIAL_GRAVITY_TERMS: tuple[str, ...] = (
    "lunar",
    "moon",
    "mars",
    "partial",
    "fractional",
    "1/6",
    "3/8",
    "0.16",
    "0.38",
    "sounding rocket",
)


def _normalise(text: Optional[str]) -> str:
    return " ".join(str(text or "").strip().lower().split())


def _material_matches(record: dict[str, Any], needle: str) -> bool:
    if not needle:
        return True
    haystack = " ".join(
        str(record.get(key) or "")
        for key in ("material_raw", "material_family", "material_species")
    ).lower()
    return needle in haystack


def _gravity_requested(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Return (normalised regime, honest gap message)."""
    if not value:
        return None, None
    needle = _normalise(value)
    if needle in GRAVITY_ALIASES:
        return GRAVITY_ALIASES[needle], None
    for term in PARTIAL_GRAVITY_TERMS:
        if term in needle:
            return needle, (
                f"Requested gravity regime '{value}' is not covered: the corpus contains "
                "0 records with a measured per-test g-level and 0 partial-gravity records. "
                "Gravity is investigation-level only (ISS / Cygnus microgravity)."
            )
    return needle, (
        f"Requested gravity regime '{value}' does not match the investigation-level "
        "regime recorded in the corpus (microgravity)."
    )


def evaluate(
    store: EvidenceStore,
    *,
    material: Optional[str] = None,
    gravity: Optional[str] = None,
    oxygen_pct: Optional[float] = None,
    pressure_psia: Optional[float] = None,
    flow_cm_s: Optional[float] = None,
    max_candidates: int = 5,
) -> dict[str, Any]:
    material_needle = _normalise(material)
    gravity_needle, gravity_gap = _gravity_requested(gravity)

    gaps: list[str] = []
    if gravity_gap:
        gaps.append(gravity_gap)

    population = [record for record in store.records if _material_matches(record, material_needle)]
    if material_needle and not population:
        gaps.append(
            f"No curated record reports material matching '{material}'. The corpus covers "
            + ", ".join(sorted({str(record.get("material_species")) for record in store.records}))
            + "."
        )

    if pressure_psia is not None:
        gaps.append(
            "Total pressure cannot be compared: 0 of "
            f"{store.record_count()} curated records report a total-pressure value "
            "(the PSI experimental tables have no total-pressure column)."
        )
    if gravity_needle and not gravity_gap:
        measured = sum(
            1
            for record in store.records
            if policy.status_of(store.record_fields(record).get("gravity_regime")) == "measured"
        )
        if measured == 0:
            gaps.append(
                "Gravity cannot be compared per test: 0 of "
                f"{store.record_count()} records carry a measured g-level; the regime is "
                "investigation-level for the whole investigation."
            )

    conditions: list[tuple[str, Any, str | None]] = []
    if oxygen_pct is not None:
        conditions.append(("oxygen_initial_pct", oxygen_pct, "% by vol"))
    if pressure_psia is not None:
        conditions.append(("total_pressure_psia", pressure_psia, "psia"))
    if flow_cm_s is not None:
        conditions.append(("flow_initial_cm_s", flow_cm_s, "cm/s"))

    candidates: list[dict[str, Any]] = []
    for record in population:
        cells: dict[str, dict[str, Any]] = {}
        requested_cells: dict[str, dict[str, Any]] = {}
        for field, requested, unit in conditions:
            actual = _cell(store, record, field)
            cells["requested"] = {
                "value": requested,
                "status": "measured",
                "unit": unit,
                "raw": None,
            }
            cells["record"] = actual
            comparison = _compare_field(field, store.field_label(field), "consequential", dict(cells))
            explanation = comparison["explanation"]
            if "record" in explanation:
                explanation = explanation.replace(
                    "record", str(record.get("experiment_id"))
                )
            requested_cells[field] = {
                "field": field,
                "label": store.field_label(field),
                "requested": requested,
                "unit": unit,
                "record_value": actual.get("value"),
                "record_status": actual.get("status"),
                "record_unit": actual.get("unit"),
                "outcome": comparison["outcome"],
                "explanation": explanation,
            }
        if gravity_needle:
            actual = _cell(store, record, "gravity_regime")
            matched = gravity_needle in _normalise(actual.get("value"))
            outcome = "matched" if matched else ("unknown" if actual.get("value") is None else "mismatched")
            requested_cells["gravity_regime"] = {
                "field": "gravity_regime",
                "label": store.field_label("gravity_regime"),
                "requested": gravity,
                "unit": None,
                "record_value": actual.get("value"),
                "record_status": actual.get("status"),
                "record_unit": actual.get("unit"),
                "outcome": outcome,
                "explanation": (
                    "Regime name matches at investigation level; no per-test g-level is reported."
                    if matched
                    else "Requested regime does not match the recorded investigation-level regime."
                ),
            }
        if material_needle:
            requested_cells["material_species"] = {
                "field": "material_species",
                "label": store.field_label("material_species"),
                "requested": material,
                "unit": None,
                "record_value": record.get("material_family"),
                "record_status": "reported_qualitative",
                "record_unit": None,
                "outcome": "matched",
                "explanation": "Material text matches this curated record.",
            }

        outcomes = [item["outcome"] for item in requested_cells.values()]
        matched = outcomes.count("matched")
        mismatched = outcomes.count("mismatched")
        unknown = outcomes.count("unknown")
        if mismatched:
            applicability = "Mechanistic context"
        elif unknown and matched:
            applicability = "Partial match"
        elif matched and not unknown:
            applicability = "Matched conditions"
        elif unknown:
            applicability = "Partial match" if matched else "No applicable record"
        else:
            applicability = "No applicable record"

        candidates.append(
            {
                "experiment_id": record.get("experiment_id"),
                "family": record.get("family"),
                "material_raw": record.get("material_raw"),
                "material_family": record.get("material_family"),
                "source_id": record.get("source_id"),
                "source_locator": store.locator_for(record),
                "applicability": applicability,
                "conditions": list(requested_cells.values()),
                "counts": {"matched": matched, "mismatched": mismatched, "unknown": unknown},
            }
        )

    candidate_count = len(candidates)
    class_counts = {name: 0 for name in policy.APPLICABILITY_CLASSES}
    for candidate in candidates:
        class_counts[candidate["applicability"]] += 1

    candidates.sort(key=lambda item: (-item["counts"]["matched"], item["counts"]["mismatched"]))
    candidates = candidates[: max(1, max_candidates)]

    if class_counts["Matched conditions"]:
        applicability = "Matched conditions"
        reason = "At least one curated record matches every requested condition that the corpus reports."
    elif class_counts["Partial match"]:
        applicability = "Partial match"
        reason = "Curated records match some requested conditions; others are not reported."
    elif class_counts["Mechanistic context"]:
        applicability = "Mechanistic context"
        reason = "The corpus has related records but at least one requested condition differs."
    else:
        applicability = "No applicable record"
        reason = "No curated record covers the requested conditions."

    if not population:
        applicability = "No applicable record"
        reason = "No curated record matches the requested material."

    return {
        "corpus_version": store.corpus_version,
        "requested": {
            "material": material,
            "gravity": gravity,
            "oxygen_pct": oxygen_pct,
            "pressure_psia": pressure_psia,
            "flow_cm_s": flow_cm_s,
        },
        "applicability": applicability,
        "applicability_reason": reason,
        "coverage_gaps": gaps,
        "candidates": candidates,
        "population_size": store.record_count(),
        "candidate_count": candidate_count,
        "class_counts": class_counts,
        "matching_policy": policy.MATCHING_POLICY_VERSION,
        "policy_version": policy.POLICY_VERSION,
        "not_provided": [
            "fire-risk probability",
            "safety percentage or '% safe'",
            "material or atmosphere certification",
            "ignition or extinction prediction",
            "operational or emergency procedure",
        ],
        "limitations": [
            "Applicability classes describe evidence coverage, not safety.",
            "Missing conditions are reported as unknown and never filled with a nominal value.",
        ],
        "disclaimer": policy.DISCLAIMER,
    }


__all__ = ["evaluate", "_applicability"]
