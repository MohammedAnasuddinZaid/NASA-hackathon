"""Evaluation runner for the FIRETRACE question set.

What this script does:

* runs all 30 questions in ``eval/gold.jsonl`` through the same deterministic
  assistant the API uses;
* independently re-checks every returned answer — source ids must resolve, every
  numeric token must exist in a cited record, every claim must carry a locator,
  and no answer may emit a safety percentage or risk probability;
* reports retrieval hit@5 and abstention accuracy **only for items that carry a
  gold label**, and reports the labelling coverage next to the metric.

The shipped question set has empty ``expected`` fields on purpose: nobody has
written gold answers for it. So both metrics print ``null`` with a coverage
count of ``0/30`` instead of a fabricated number. Fill ``expected.record_ids``
and ``expected.abstain`` from a domain-expert review to turn them on.

    python eval/run_eval.py

Exit code is non-zero when any *integrity* check fails, so it can gate CI today.
"""
from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path
from typing import Any

EVAL_DIR = Path(__file__).resolve().parent
PROJECT_DIR = EVAL_DIR.parent
BACKEND_DIR = PROJECT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.v1 import policy  # noqa: E402
from app.v1.assistant import IDENTIFIER_RE, answer as build_answer  # noqa: E402
from app.v1.store import get_store  # noqa: E402

QUESTIONS_PATH = EVAL_DIR / "gold.jsonl"
ANSWER_TEXT_FIELDS = ("headline", "paragraphs", "bullets")
FORBIDDEN_PHRASES = ("% safe", "percent safe", "risk score:", "probability of ignition")
STATISTIC_LABELS = {"minimum", "maximum", "median", "mean"}


# --------------------------------------------------------------------------- #
# independent grounding check (deliberately not the production validator)
# --------------------------------------------------------------------------- #
def _number_pool(store, record: dict[str, Any]) -> set[str]:
    pool: set[str] = set()
    for payload in store.record_fields(record).values():
        value = payload.get("value")
        if value is not None and policy.is_number(value):
            pool.add(policy.fmt_num(value, 6))
        raw = payload.get("raw")
        if isinstance(raw, str):
            pool.update(policy.numeric_tokens(raw))
    for key in ("experiment_id", "test_number", "sample_number", "source_locator"):
        value = record.get(key)
        if isinstance(value, str):
            pool.update(policy.numeric_tokens(value))
    return pool


def _recompute(store, computation: dict[str, Any], evidence_ids: list[str]) -> float | None:
    """Recompute a declared computation; None when the label is unsupported."""
    label = str(computation.get("label") or "")
    inputs = [str(value) for value in computation.get("inputs") or []]
    if not set(inputs).issubset(evidence_ids):
        return None
    effective = inputs or evidence_ids
    field_name = computation.get("field")
    if label == "record_count":
        return float(len(effective) if effective else store.record_count())
    if label in STATISTIC_LABELS:
        if not field_name:
            return None
        values: list[float] = []
        for experiment_id in effective:
            record = store.resolve_record(experiment_id)
            if record is None:
                return None
            payload = store.record_fields(record).get(str(field_name))
            if policy.has_value(payload) and policy.is_number(payload.get("value")):
                values.append(float(payload["value"]))
        if not values:
            return None
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
        predicate = {
            "reported_count": lambda payload: policy.has_value(payload),
            "qualitative_count": lambda payload: policy.has_value(payload)
            and policy.status_of(payload) == "reported_qualitative",
            "measured_count": lambda payload: policy.status_of(payload) == "measured",
            "standardized_count": lambda payload: policy.status_of(payload)
            in {"measured", "derived"},
        }.get(label)
        if predicate is None:
            return float(len(effective))
        if not field_name:
            return None
        matching = 0
        for experiment_id in effective:
            record = store.resolve_record(experiment_id)
            if record is None:
                return None
            if predicate(store.record_fields(record).get(str(field_name))):
                matching += 1
        return float(matching)
    return None


def check_answer(store, answer: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    if answer["grade"] not in policy.ANSWER_GRADES:
        problems.append(f"bad grade {answer['grade']!r}")

    cited = {
        str(citation.get("source_id"))
        for citation in answer.get("citations") or []
        if store.resolve_source(citation.get("source_id")) is not None
    }

    for claim in answer.get("claims") or []:
        source_id = claim.get("source_id")
        if not source_id or store.resolve_source(source_id) is None:
            problems.append(f"unresolved source {source_id!r}")
        supporting = claim.get("supporting_source_ids") or [source_id]
        for supporting_source in supporting:
            if store.resolve_source(supporting_source) is None:
                problems.append(f"unresolved supporting source {supporting_source!r}")
            elif str(supporting_source) not in cited:
                problems.append(f"supporting source {supporting_source!r} not cited")
        if not str(claim.get("locator") or "").strip():
            problems.append("claim without locator")
        evidence_ids = [str(value) for value in claim.get("evidence_ids") or []]
        pool: set[str] = set()
        for evidence_id in evidence_ids:
            record = store.resolve_record(evidence_id)
            if record is None:
                problems.append(f"unresolved evidence id {evidence_id!r}")
                continue
            pool |= _number_pool(store, record)
        for computation in claim.get("computations") or []:
            expected = _recompute(store, computation, evidence_ids)
            try:
                stated = float(str(computation.get("value")))
            except (TypeError, ValueError):
                problems.append(f"non-numeric computation {computation.get('label')!r}")
                continue
            if expected is None:
                problems.append(f"unsupported computation {computation.get('label')!r}")
                continue
            if abs(stated - expected) > 1e-6 * max(1.0, abs(expected)):
                problems.append(
                    f"computation {computation.get('label')!r} states {stated} but "
                    f"recomputes to {expected}"
                )
            pool.update(policy.numeric_tokens(str(computation.get("value") or "")))
        tokens = policy.numeric_tokens(IDENTIFIER_RE.sub(" ", claim.get("text") or ""))
        for token in sorted(tokens - pool):
            problems.append(f"ungrounded number {token!r} in {claim.get('text')!r}")

    for citation in answer.get("citations") or []:
        if store.resolve_source(citation.get("source_id")) is None:
            problems.append(f"unresolved citation {citation.get('source_id')!r}")

    texts: list[str] = []
    for field in ANSWER_TEXT_FIELDS:
        value = answer.get(field)
        if isinstance(value, str):
            texts.append(value)
        elif isinstance(value, list):
            texts.extend(str(item) for item in value)
    joined = "\n".join(texts).lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in joined:
            problems.append(f"forbidden phrase {phrase!r}")
    return problems


def main() -> int:
    if not QUESTIONS_PATH.exists():
        print(json.dumps({"ok": False, "error": f"missing {QUESTIONS_PATH}"}, indent=2))
        return 2

    items = [
        json.loads(line)
        for line in QUESTIONS_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    store = get_store()

    results: list[dict[str, Any]] = []
    hit_labelled = 0
    hit_correct = 0
    abstain_labelled = 0
    abstain_correct = 0
    integrity_failures = 0

    for item in items:
        answer = build_answer(store, item["question"])
        problems = check_answer(store, answer)
        if problems:
            integrity_failures += 1

        abstained = answer["grade"] in {"absent", "out-of-scope"}
        expected = item.get("expected") or {}
        record_ids = [str(value) for value in expected.get("record_ids") or []]
        top5 = [str(value) for value in (answer.get("retrieval") or {}).get("record_hits", [])][:5]
        hit_at_5: bool | None = None
        if record_ids:
            hit_labelled += 1
            hit_at_5 = any(value in top5 for value in record_ids)
            hit_correct += int(hit_at_5)

        abstain_label = expected.get("abstain")
        abstain_match: bool | None = None
        if isinstance(abstain_label, bool):
            abstain_labelled += 1
            abstain_match = abstained is abstain_label
            abstain_correct += int(abstain_match)

        results.append(
            {
                "id": item["id"],
                "category": item["category"],
                "question": item["question"],
                "grade": answer["grade"],
                "abstained": abstained,
                "claims": len(answer.get("claims") or []),
                "rejected_claims": answer["validation"]["rejected"],
                "retrieval_mode": answer["retrieval"]["mode"],
                "retrieval_top5": top5,
                "hit_at_5": hit_at_5,
                "abstention_match": abstain_match,
                "integrity_problems": problems,
            }
        )

    total = len(results)
    grades: dict[str, int] = {}
    categories: dict[str, int] = {}
    for result in results:
        grades[result["grade"]] = grades.get(result["grade"], 0) + 1
        categories[result["category"]] = categories.get(result["category"], 0) + 1

    report = {
        "ok": integrity_failures == 0,
        "questions": total,
        "corpus_version": store.corpus_version,
        "policy_version": policy.POLICY_VERSION,
        "integrity": {
            "answers_with_problems": integrity_failures,
            "note": (
                "Independent re-check of source resolution, locator presence, numeric "
                "grounding and forbidden safety phrasing. Must be 0."
            ),
        },
        "observed": {
            "grade_counts": grades,
            "category_counts": categories,
            "abstention_rate": round(
                sum(1 for result in results if result["abstained"]) / total, 4
            )
            if total
            else None,
        },
        "metrics": {
            "retrieval_hit_at_5": round(hit_correct / hit_labelled, 4) if hit_labelled else None,
            "retrieval_hit_at_5_labelled_items": f"{hit_labelled}/{total}",
            "abstention_accuracy": round(abstain_correct / abstain_labelled, 4)
            if abstain_labelled
            else None,
            "abstention_accuracy_labelled_items": f"{abstain_labelled}/{total}",
            "note": (
                "The shipped question set has no gold answers, so both metrics are null "
                "with zero labelled items. They are not estimated. Fill expected.record_ids "
                "(record ids that should appear in the top 5) and expected.abstain (true when "
                "the corpus cannot answer) from a domain-expert review to enable them."
            ),
        },
        "results": results,
    }

    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())