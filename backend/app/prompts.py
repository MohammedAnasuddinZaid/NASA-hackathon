"""Prompt construction for the local FIRETRACE voice agent.

The model is never given the corpus directly. It is given the deterministic
retrieval answer (already grounded, cited and abstained where necessary) and
asked to *speak* it. The system prompt forbids adding facts, numbers or sources.
"""
from __future__ import annotations

from typing import Any

AGENT_NAME = "FIRETRACE Voice"
MAX_HISTORY_MESSAGES = 8
MAX_CONTEXT_CHARS = 4000


def system_prompt() -> str:
    return f"""You are {AGENT_NAME}, the spoken interface for FIRETRACE, a deterministic
evidence-retrieval system about spacecraft fire safety experiments.

You are speaking to a user over a voice line. Your job is to deliver the
retrieved answer clearly, concisely and in spoken English.

STRICT RULES - these override everything else:
1. You may ONLY use facts, numbers, source identifiers, citations and claims
   that appear in the EVIDENCE block provided with the user message.
2. Never add, estimate, round, convert, or recompute a number.
3. Never mention a source ID, URL or DOI that is not in the EVIDENCE block.
4. Never predict fire risk, certify a material, approve an atmosphere, or
   recommend a procedure. If the evidence says the field is absent, say it is
   absent.
5. Never claim total pressure or per-test gravity exists; both are absent for
   all 131 records.
6. Do not use markdown, bullet lists, headings, code blocks or URLs in the
   spoken reply. Plain sentences only.
7. Keep the reply under 90 words. Prefer two or three short sentences.
8. If the evidence is an abstention, deliver the abstention faithfully.

If you cannot follow these rules, output the EVIDENCE headline verbatim.
"""


def evidence_block(answer: dict[str, Any]) -> str:
    from app.grounding import evidence_text

    text = evidence_text(answer)
    if len(text) > MAX_CONTEXT_CHARS:
        text = text[:MAX_CONTEXT_CHARS].rsplit("\n", 1)[0] + "\n[truncated]"
    return text


def user_prompt(question: str, answer: dict[str, Any]) -> str:
    return (
        f"USER QUESTION:\n{question}\n\n"
        f"EVIDENCE (the only facts you may use):\n{evidence_block(answer)}\n\n"
        "Speak the answer now. Plain sentences, no markdown, under 90 words."
    )


def fallback_text(answer: dict[str, Any]) -> str:
    """Deterministic spoken text used when the LLM is unavailable or unsafe."""
    from app.retrieval import answer_to_text

    text = answer_to_text(answer)
    # Trim the trailing citation block for speech brevity while keeping sources.
    return text
