"""Input sanitising and local-origin checks for the FIRETRACE backend.

Text is sanitised, length is bounded, and only loopback / RFC1918 origins are
accepted for local services.
"""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

from app.config import settings

CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
MARKDOWN_RE = re.compile(r"[*_`#>]+")
EMOJI_RE = re.compile(
    "[\U0001F1E0-\U0001F1FF\U0001F300-\U0001FAFF\U00002600-\U000027BF]"
)

LOCAL_HOST_RE = re.compile(
    r"(localhost|127\.0\.0\.1|::1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
)


class ValidationError(ValueError):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def guard_user_text(text: str, limit: int = 1200) -> str:
    """Collapse whitespace, strip control characters and bound the length."""
    clean = CONTROL_RE.sub(" ", text or "")
    clean = " ".join(clean.split())
    if len(clean) > limit:
        clean = clean[:limit].rsplit(" ", 1)[0] + "..."
    return clean.strip()


def clean_assistant_text(text: str, limit: int = 1200) -> str:
    """Remove URLs, markdown and emoji from a model candidate before speaking."""
    clean = CONTROL_RE.sub(" ", text or "")
    clean = URL_RE.sub("", clean)
    clean = MARKDOWN_RE.sub("", clean)
    clean = EMOJI_RE.sub("", clean)
    clean = clean.replace("\r", " ").replace("\n", " ")
    clean = " ".join(clean.split())
    if len(clean) > limit:
        clean = clean[:limit].rsplit(" ", 1)[0] + "."
    return clean.strip()


def trim_for_call(text: str, max_sentences: int = 2, max_words: int = 55) -> str:
    """Keep spoken replies short even when a small model ignores the prompt."""
    clean = clean_assistant_text(text)
    if not clean:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", clean)
    kept: list[str] = []
    words = 0
    for sentence in sentences:
        count = len(sentence.split())
        if kept and words + count > max_words:
            break
        if not kept and count > max_words:
            trimmed = " ".join(sentence.split()[:max_words])
            kept.append(trimmed.rstrip(".,;:") + ".")
            break
        kept.append(sentence)
        words += count
        if len(kept) >= max_sentences:
            break
    return " ".join(kept).strip()


def is_local_origin(origin: str | None) -> bool:
    """Allow same-machine and RFC1918 LAN origins only.

    Browsers omit Origin for some non-browser clients; those are accepted
    because the API is bound to loopback and the gateway performs the LAN hop.
    """
    if not origin:
        return True
    if origin == "null":
        return False
    try:
        parsed = urlparse(origin)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https", "ws", "wss"}:
        return False
    return bool(LOCAL_HOST_RE.fullmatch(parsed.hostname or ""))


def assert_local_service_url(url: str) -> None:
    """Reject a configuration that would send prompts or health data to a cloud host."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Local service URL must use http or https.")
    if not LOCAL_HOST_RE.fullmatch(host):
        raise ValueError(f"Refusing non-local service host '{host}'. FIRETRACE is local-only.")


assert_local_service_url(settings.ollama_url)


def normalise_origin(value: Optional[str]) -> str:
    return (value or "").strip().lower()
