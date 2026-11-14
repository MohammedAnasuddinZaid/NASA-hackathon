"""Versioned scientific and answer policy for the FIRETRACE evidence API.

Two rules drive everything in this module:

1. A null value means *the source does not report this*. It is never zero, never
   imputed, and never folded into a score.
2. The API never emits a fire-risk probability, a material certification, an
   operational firefighting instruction, or a claim of NASA endorsement.

The corpus statuses are documented rather than invented. The curated data uses
ten value statuses; both value-bearing and no-value statuses are listed so the
data dictionary matches the schema actually shipped in ``corpus.json``.
"""
from __future__ import annotations

import re
from typing import Any, Optional

POLICY_VERSION = "1.0.0"
MATCHING_POLICY_VERSION = "matching-1.0"
ANSWER_SCHEMA_VERSION = "1.0.0"

# --------------------------------------------------------------------------- #
# value status vocabulary
# --------------------------------------------------------------------------- #
# Statuses that assert a curated value exists and may be quoted.
VALUE_BEARING_STATUSES: frozenset[str] = frozenset(
    {
        "measured",
        "corrected",
        "derived",
        "investigation_level",
        "reported_qualitative",
    }
)

# Statuses that assert no usable numeric value exists.
NO_VALUE_STATUSES: frozenset[str] = frozenset(
    {
        "not_reported",
        "not_extracted",
        "over_range",
        "reported_flag",
        "unverified",
    }
)

VALUE_STATUSES: tuple[str, ...] = (
    "measured",
    "corrected",
    "derived",
    "investigation_level",
    "not_reported",
    "not_extracted",
    "over_range",
    "reported_flag",
    "reported_qualitative",
    "unverified",
)

STATUS_MEANING: dict[str, str] = {
    "measured": "The source reports this number directly for this record.",
    "corrected": "The source reports this number after a documented correction (for example the BASS-II MCA offset).",
    "derived": "Computed from a reported source value by a documented rule (parsed text or a workbook factor).",
    "investigation_level": "Documented for the investigation, not measured per test (for example ISS microgravity).",
    "reported_qualitative": "The source reports a qualitative token rather than a number.",
    "not_reported": "The source table has no such column or leaves it blank. Null, never zero.",
    "not_extracted": "A source document may contain it but the value is not in the structured corpus. Null, never inferred.",
    "over_range": "The source reports an out-of-range marker such as '>500'. No numeric value is established.",
    "reported_flag": "The source reports a code such as '-1' that is a flag, not a concentration.",
    "unverified": "The source token has an unresolved or ambiguous basis. Null, never guessed.",
}

CURATED_SOURCE_OF_TRUTH = "src/data/corpus.json"
MIRRORED_SOURCE_OF_TRUTH = "public/data/corpus.json"

DISCLAIMER = (
    "FIRETRACE is an independent evidence workspace built on public NASA PSI data. "
    "It is not affiliated with, endorsed by, or certified by NASA. It supports "
    "reading published research evidence only: it does not predict fire risk, "
    "certify a material or atmosphere, or provide operational or emergency guidance."
)

ABSTENTION_NOTICE = (
    "No curated record reports a value that supports an answer to this question. "
    "FIRETRACE abstains instead of estimating, interpolating or generating one."
)

# --------------------------------------------------------------------------- #
# tolerated comparison quantities (matching-1.0)
# --------------------------------------------------------------------------- #
# absolute tolerance in the field unit, relative tolerance as a fraction.
TOLERANCES: dict[str, dict[str, float | None]] = {
    "oxygen_initial_pct": {"abs": 0.5, "rel": 0.05},
    "oxygen_final_pct": {"abs": 0.5, "rel": 0.05},
    "total_pressure_psia": {"abs": 0.5, "rel": 0.03},
    "flow_initial_cm_s": {"abs": 0.5, "rel": 0.10},
    "flow_derived_cm_s": {"abs": 0.5, "rel": 0.10},
    "thickness_mm": {"abs": 0.02, "rel": 0.10},
    "width_cm": {"abs": 0.1, "rel": 0.10},
    "length_cm": {"abs": 0.1, "rel": 0.10},
    "ignition_power_w": {"abs": 0.5, "rel": 0.05},
    "ignition_time_s": {"abs": 0.5, "rel": 0.05},
    "burn_time_s": {"abs": 1.0, "rel": 0.05},
    "co2_initial_pct": {"abs": 0.05, "rel": 0.05},
    "co2_final_pct": {"abs": 0.05, "rel": 0.05},
    "co_initial_ppm": {"abs": 1.0, "rel": 0.10},
    "co_final_ppm": {"abs": 1.0, "rel": 0.10},
}

# fields whose agreement or disagreement changes whether two records are
# mechanically comparable at all.
CONSEQUENTIAL_FIELDS: tuple[tuple[str, str], ...] = (
    ("material_species", "Material species"),
    ("oxygen_initial_pct", "Oxygen fraction (initial)"),
    ("total_pressure_psia", "Total pressure"),
    ("gravity_regime", "Gravity regime"),
    ("flow_initial_cm_s", "Forced flow (initial)"),
)

# fields that frame an experiment without defining its mechanism.
CONTEXTUAL_FIELDS: tuple[tuple[str, str], ...] = (
    ("family", "Investigation family"),
    ("geometry", "Geometry"),
    ("thickness_mm", "Thickness"),
    ("width_cm", "Width"),
    ("hardware", "Hardware"),
    ("ignition_method", "Ignition method"),
)

APPLICABILITY_CLASSES: tuple[str, ...] = (
    "Matched conditions",
    "Partial match",
    "Mechanistic context",
    "No applicable record",
)

ANSWER_GRADES: tuple[str, ...] = ("direct", "partial", "context", "absent", "out-of-scope")

# --------------------------------------------------------------------------- #
# out-of-scope detection
# --------------------------------------------------------------------------- #
# A question is out of scope when it asks for a prediction, a certification or
# an operational instruction. It stays *in* scope when it asks what a record
# measured, what is missing, or what a source says.
_CERTIFY_RE = re.compile(
    r"\b(safe|unsafe|safety\s+(?:factor|margin|case)|certif\w*|approv\w*|clearance|"
    r"compliance|compliant|qualif\w*|licen[cs]\w*|permit\w*)\b",
    re.IGNORECASE,
)
_PREDICT_RE = re.compile(
    r"\b(risk|probability|probabilistic|chance|odds|likelihood|how\s+likely|"
    r"predict\w*|forecast\w*|projection|score|rating|hazard\s+index)\b",
    re.IGNORECASE,
)
_BURN_SUBJECT_RE = re.compile(
    r"\b(fire|flame|flammab\w*|ignit\w*|burn\w*|combust\w*|explos\w*|deflagrat\w*)\b",
    re.IGNORECASE,
)
_OPERATIONAL_RE = re.compile(
    r"\b(should\s+(?:we|i|they|you)\s+(?:use|fly|operate|run|load|charge)|"
    r"how\s+(?:do|should)\s+(?:we|i)\s+(?:fight|suppress|extinguish)|"
    r"what\s+(?:fire\s+)?suppressant|firefighting\s+procedure|emergency\s+procedure)\b",
    re.IGNORECASE,
)
_ENDORSEMENT_RE = re.compile(
    r"\b(nasa\s+(?:approv\w*|certif\w*|endors\w*)|endorsed\s+by\s+nasa)\b",
    re.IGNORECASE,
)


def out_of_scope_reason(question: str) -> Optional[str]:
    """Return a short reason when the question asks for something we refuse.

    ``None`` means the question is answerable *in principle*; whether evidence
    exists is decided later by retrieval.
    """
    text = (question or "").strip()
    if not text:
        return None
    if "% safe" in text.lower() or "percent safe" in text.lower():
        return "risk_score"
    if _ENDORSEMENT_RE.search(text):
        return "endorsement"
    if _OPERATIONAL_RE.search(text):
        return "operational_advice"
    if _CERTIFY_RE.search(text):
        return "certification"
    if _PREDICT_RE.search(text) and _BURN_SUBJECT_RE.search(text):
        return "risk_prediction"
    return None


OUT_OF_SCOPE_MESSAGES: dict[str, str] = {
    "risk_score": (
        "FIRETRACE does not produce a safety percentage, fire-risk probability or "
        "risk score. The curated corpus reports measured conditions for specific "
        "tests; it does not contain a validated risk model."
    ),
    "certification": (
        "FIRETRACE does not certify materials, atmospheres or procedures. It can "
        "report what a curated record measured and which conditions the corpus "
        "does not cover."
    ),
    "risk_prediction": (
        "FIRETRACE does not predict ignition, flammability or fire risk. It can "
        "report the measured oxygen, flow, pressure availability and materials in "
        "the corpus, and it will name the fields the sources do not report."
    ),
    "operational_advice": (
        "FIRETRACE does not give operational or emergency firefighting guidance. "
        "It is a research-evidence reader over public NASA PSI tables."
    ),
    "endorsement": (
        "FIRETRACE cannot claim NASA approval or endorsement. It is an independent "
        "project reading public NASA PSI data."
    ),
}

# --------------------------------------------------------------------------- #
# numeric helpers shared by comparison, assistant and exports
# --------------------------------------------------------------------------- #
NUMERIC_TOKEN_RE = re.compile(
    r"(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\w])"
)


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def fmt_num(value: Any, digits: int = 3) -> str:
    """Format a curated number without inventing precision.

    Trailing zeros are dropped so ``22.20`` and ``22.2`` compare and render the
    same way. Non-finite values are refused rather than rendered as ``nan``.
    """
    if not is_number(value):
        return ""
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):
        return ""
    text = f"{number:.{digits}f}".rstrip("0").rstrip(".")
    return text if text not in ("", "-") else "0"


def numeric_tokens(text: str) -> set[str]:
    found: set[str] = set()
    for match in NUMERIC_TOKEN_RE.finditer(text or ""):
        token = match.group(0).replace(",", "")
        found.add(_canonical_number(token))
    return found


def _canonical_number(token: str) -> str:
    try:
        number = float(token)
    except (TypeError, ValueError):
        return token
    return fmt_num(number, 6)


def status_of(field: dict[str, Any] | None) -> str:
    if not isinstance(field, dict):
        return "not_extracted"
    return str(field.get("status") or "not_extracted")


def value_of(field: dict[str, Any] | None) -> Any:
    if not isinstance(field, dict):
        return None
    return field.get("value")


def has_value(field: dict[str, Any] | None) -> bool:
    """True only when a curated value exists and its status asserts one."""
    if not isinstance(field, dict):
        return False
    return field.get("value") is not None and status_of(field) in VALUE_BEARING_STATUSES


def as_number(field: dict[str, Any] | None) -> Optional[float]:
    value = value_of(field)
    return float(value) if has_value(field) and is_number(value) else None


def within_tolerance(field: str, left: float, right: float) -> bool:
    rule = TOLERANCES.get(field)
    if rule is None:
        return left == right
    delta = abs(left - right)
    absolute = rule.get("abs")
    relative = rule.get("rel")
    if absolute is not None and delta <= absolute:
        return True
    if relative is not None:
        scale = max(abs(left), abs(right), 1e-12)
        return delta / scale <= relative
    return False
