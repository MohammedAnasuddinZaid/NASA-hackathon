"""Policy units: statuses, null semantics, refusal rules, numeric helpers."""
from __future__ import annotations

from app.v1 import policy


def test_status_vocabulary_is_documented_and_disjoint():
    assert set(policy.VALUE_BEARING_STATUSES) | set(policy.NO_VALUE_STATUSES) == set(
        policy.VALUE_STATUSES
    )
    assert not set(policy.VALUE_BEARING_STATUSES) & set(policy.NO_VALUE_STATUSES)
    for status in policy.VALUE_STATUSES:
        assert status in policy.STATUS_MEANING
        assert policy.STATUS_MEANING[status].strip()


def test_null_never_counts_as_a_value():
    for status in policy.NO_VALUE_STATUSES:
        field = {"value": None, "status": status, "unit": "% by vol"}
        assert policy.has_value(field) is False
        assert policy.as_number(field) is None


def test_zero_is_a_real_value():
    field = {"value": 0.0, "status": "measured", "unit": "% by vol"}
    assert policy.has_value(field) is True
    assert policy.as_number(field) == 0.0
    assert policy.fmt_num(field["value"]) == "0"


def test_missing_field_objects_are_not_values():
    for field in (None, {}, "22.2"):
        assert policy.has_value(field) is False
        assert policy.as_number(field) is None


def test_fmt_num_does_not_invent_precision():
    assert policy.fmt_num(22.2) == "22.2"
    assert policy.fmt_num(0.1) == "0.1"
    assert policy.fmt_num(2.0) == "2"
    assert policy.fmt_num(float("nan")) == ""
    assert policy.fmt_num(float("inf")) == ""
    assert policy.fmt_num(None) == ""
    assert policy.fmt_num(True) == ""


def test_numeric_tokens_strips_separators():
    assert policy.numeric_tokens("1,250 ppm") == {"1250"}
    assert policy.numeric_tokens("22.20 % and 22.2 %") == {"22.2"}


def test_out_of_scope_rules():
    cases = {
        "Is PMMA safe in a lunar cabin?": "certification",
        "What is the percent safe for PMMA?": "risk_score",
        "Give me the fire risk probability for SIBAL.": "risk_prediction",
        "What fire suppressant should we use?": "operational_advice",
        "Is this NASA approved?": "endorsement",
    }
    for question, reason in cases.items():
        assert policy.out_of_scope_reason(question) == reason, question


def test_in_scope_questions_are_not_refused():
    for question in (
        "What oxygen did BASS2-B1 report?",
        "What pressure was BASS-II run at?",
        "What is missing from the corpus?",
        "Which records are flagged suspect?",
        "Compare BASS2-B1 and BASS2-B2.",
    ):
        assert policy.out_of_scope_reason(question) is None, question


def test_tolerances_are_versioned_and_positive():
    assert policy.MATCHING_POLICY_VERSION == "matching-1.0"
    for field, rule in policy.TOLERANCES.items():
        assert rule["abs"] is not None or rule["rel"] is not None, field
        for value in rule.values():
            if value is not None:
                assert value > 0, field


def test_within_tolerance_uses_absolute_then_relative():
    assert policy.within_tolerance("oxygen_initial_pct", 21.0, 21.4) is True
    assert policy.within_tolerance("oxygen_initial_pct", 21.0, 23.0) is False
    assert policy.within_tolerance("burn_time_s", 20.0, 20.9) is True
    assert policy.within_tolerance("burn_time_s", 20.0, 23.0) is False


def test_consequential_and_contextual_fields_are_distinct():
    consequential = {name for name, _label in policy.CONSEQUENTIAL_FIELDS}
    contextual = {name for name, _label in policy.CONTEXTUAL_FIELDS}
    assert not consequential & contextual
    assert "total_pressure_psia" in consequential
    assert "material_species" in consequential


def test_disclaimer_states_the_boundaries():
    text = policy.DISCLAIMER.lower()
    assert "not affiliated" in text
    assert "does not predict fire risk" in text
    assert "operational" in text


def test_answer_grades_match_contract():
    assert policy.ANSWER_GRADES == (
        "direct",
        "partial",
        "context",
        "absent",
        "out-of-scope",
    )