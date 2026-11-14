"""Grounding guard for the optional local language model.

The deterministic retrieval engine is the only source of truth. When Ollama is
available it is allowed to *re-word* the retrieved answer for speech, but it may
never add a number, a source identifier, a URL or a markdown structure that was
not already present in the retrieved evidence. This module is the enforcement
point and is covered by unit tests.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

# Numbers we never allow the model to invent. We collect the exact numeric
# tokens that already appear in the retrieved evidence text.
_NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9.])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![A-Za-z0-9.])"
)

# Source IDs look like PSI-25, PSI-98, NTRS-20250010653, CHALLENGE-2026.
_SOURCE_ID_RE = re.compile(r"\b(?:PSI-\d+|NTRS-\d+|CHALLENGE-\d+)\b")

# Markdown / markup that we do not want in a spoken answer.
_MARKDOWN_PATTERNS = (
    re.compile(r"```"),
    re.compile(r"(?m)^\s{0,3}#{1,6}\s"),
    re.compile(r"\*\*[^*]+\*\*"),
    re.compile(r"(?m)^\s*[-*+]\s+\S"),
    re.compile(r"\[[^\]]*\]\([^)]*\)"),
    re.compile(r"<[^>]+>"),
)


@dataclass
class GroundingResult:
    ok: bool
    reason: str = ""
    offending: tuple[str, ...] = ()


def _numbers_in(text: str) -> set[str]:
    return {match.group(0).replace(",", "") for match in _NUMBER_RE.finditer(text)}


def _source_ids_in(text: str) -> set[str]:
    return set(_SOURCE_ID_RE.findall(text))


def _markdown_issues(text: str) -> list[str]:
    issues: list[str] = []
    for pattern in _MARKDOWN_PATTERNS:
        if pattern.search(text):
            issues.append(pattern.pattern)
    return issues


def evidence_text(answer: dict[str, Any]) -> str:
    """Flatten a retrieved answer into the only text the LLM may draw facts from."""
    parts: list[str] = []
    for key in ("headline",):
        if answer.get(key):
            parts.append(str(answer[key]))
    for key in ("paragraphs", "bullets", "trace", "followUps"):
        for item in answer.get(key) or []:
            parts.append(str(item))
    for citation in answer.get("citations") or []:
        parts.append(str(citation.get("sourceId") or ""))
        parts.append(str(citation.get("locator") or ""))
        parts.append(str(citation.get("title") or ""))
    return "\n".join(parts)


def allowed_numbers(answer: dict[str, Any]) -> set[str]:
    return _numbers_in(evidence_text(answer))


def allowed_source_ids(answer: dict[str, Any]) -> set[str]:
    ids = _source_ids_in(evidence_text(answer))
    for citation in answer.get("citations") or []:
        sid = citation.get("sourceId")
        if sid:
            ids.add(str(sid))
    return ids


def validate(candidate: str, answer: dict[str, Any]) -> GroundingResult:
    """Return whether ``candidate`` is safe to speak.

    Rules:
      1. No markdown / markup structures.
      2. Every numeric token in ``candidate`` must already appear in the
         retrieved evidence text.
      3. Every source ID in ``candidate`` must already appear in the retrieved
         evidence text.
    """
    if not isinstance(candidate, str) or not candidate.strip():
        return GroundingResult(False, "empty")

    issues = _markdown_issues(candidate)
    if issues:
        return GroundingResult(False, "markdown", tuple(issues))

    evidence = evidence_text(answer)
    allowed_ids = _source_ids_in(evidence)
    candidate_ids = _source_ids_in(candidate)
    offending_ids = sorted(candidate_ids - allowed_ids)
    if offending_ids:
        return GroundingResult(False, "source_id", tuple(offending_ids))

    allowed_nums = _numbers_in(evidence)
    candidate_nums = _numbers_in(candidate)
    offending_nums = sorted(candidate_nums - allowed_nums)
    if offending_nums:
        return GroundingResult(False, "number", tuple(offending_nums))

    return GroundingResult(True, "ok")


def sanitize(candidate: str) -> str:
    """Remove the most common markdown artefacts from a near-miss answer.

    Used only as a last resort before falling back to deterministic text; the
    guard above is the real gate.
    """
    text = candidate
    text = re.sub(r"```[a-zA-Z]*\n?", "", text)
    text = re.sub(r"```", "", text)
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
    text = text.replace("**", "").replace("__", "")
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    # collapse bullet markers into plain sentences
    text = re.sub(r"(?m)^\s*[-*+]\s+", "", text)
    return " ".join(text.split())


def evidence_numbers(answer: dict[str, Any]) -> set[str]:
    return allowed_numbers(answer)


def contains_invented(candidate: str, answer: dict[str, Any]) -> bool:
    return not validate(candidate, answer).ok
