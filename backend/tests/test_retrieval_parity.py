import json
from pathlib import Path

import pytest

from app.retrieval import answer_to_text, ask


FIXTURE = Path(__file__).parent / "fixtures" / "parity.json"


def _strip_id(answer: dict) -> dict:
    copy = dict(answer)
    copy.pop("id", None)
    return copy


@pytest.mark.parametrize("case", json.loads(FIXTURE.read_text(encoding="utf-8")))
def test_retrieval_parity(case):
    actual = ask(case["question"])
    expected = case["answer"]
    assert _strip_id(actual) == _strip_id(expected), (
        f"Parity mismatch for {case['question']!r}"
    )
    assert answer_to_text(actual) == case["text"]
