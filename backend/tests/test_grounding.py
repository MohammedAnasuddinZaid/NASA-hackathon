from app.grounding import validate, sanitize
from app.retrieval import ask


def test_grounding_accepts_paraphrase_without_new_numbers():
    answer = ask("What pressure was BASS-II run at?")
    candidate = "Total pressure is reported for zero of one hundred thirty one records."
    # candidate introduces no digits, should pass numeric guard (words not numbers)
    result = validate(candidate, answer)
    # words are not numeric tokens; passes
    assert result.ok is True


def test_grounding_rejects_invented_number():
    answer = ask("What pressure was BASS-II run at?")
    candidate = "BASS-II was run at 14.7 psi."
    result = validate(candidate, answer)
    assert result.ok is False
    assert result.reason == "number"
    assert "14.7" in result.offending


def test_grounding_rejects_invented_source_id():
    answer = ask("What pressure was BASS-II run at?")
    candidate = "See PSI-99 for details."
    result = validate(candidate, answer)
    assert result.ok is False
    assert result.reason == "source_id"


def test_grounding_rejects_markdown():
    answer = ask("What oxygen did BASS2-B1 report?")
    candidate = "**Bold** answer with a list:\n- item"
    result = validate(candidate, answer)
    assert result.ok is False
    assert result.reason == "markdown"


def test_sanitize_strips_markdown():
    text = "**Hello** world\n- item\n```code```"
    out = sanitize(text)
    assert "**" not in out
    assert "```" not in out
    assert "Hello" in out


def test_grounding_accepts_evidence_numbers():
    answer = ask("What oxygen did BASS2-B1 report?")
    # 21 is in evidence
    ev = str(answer)
    # Build candidate using a number present in evidence text
    from app.grounding import evidence_text

    nums = __import__("re").findall(r"\d+(?:\.\d+)?", evidence_text(answer))
    assert nums, "expected numbers in evidence"
    candidate = f"The record reports {nums[0]} percent oxygen."
    # numeric token present -> ok (unless markdown/source issues)
    res = validate(candidate, answer)
    assert res.ok is True
