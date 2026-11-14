"""Exception types and JSON error envelopes."""
from __future__ import annotations

from typing import Any, Optional


class ApiError(Exception):
    """An error that maps to a documented HTTP status and JSON body."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field_path: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
        details: Optional[list[Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_path = field_path
        self.headers = headers or {}
        self.details = details or []


class BodyTooLarge(ApiError):
    def __init__(self, limit: int) -> None:
        super().__init__(
            413,
            "payload_too_large",
            f"Request body exceeds the {limit} byte limit.",
        )


class RateLimited(ApiError):
    def __init__(self, retry_after: int) -> None:
        super().__init__(
            429,
            "rate_limited",
            "Too many write requests. Retry after the interval in the Retry-After header.",
            headers={"Retry-After": str(max(1, retry_after))},
        )


class ServiceDegraded(ApiError):
    def __init__(self, message: str, details: Optional[list[Any]] = None) -> None:
        super().__init__(503, "service_degraded", message, details=details)
