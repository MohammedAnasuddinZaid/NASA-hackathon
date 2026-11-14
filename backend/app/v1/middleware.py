"""HTTP middleware: provenance headers, body size cap, rate limiting, logging.

Order matters. ``RequestContextMiddleware`` is added last so it is the outermost
layer: every response — including a 413 or a 429 produced deeper in the stack —
carries ``X-Request-ID`` and ``X-Corpus-Version``.
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections import deque
from typing import Any, Callable, Optional

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings
from app.v1.errors import BodyTooLarge, RateLimited

access_logger = logging.getLogger("firetrace.access")
security_logger = logging.getLogger("firetrace.security")

SECURITY_HEADERS: tuple[tuple[str, str], ...] = (
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "DENY"),
    ("Referrer-Policy", "no-referrer"),
    ("Cross-Origin-Resource-Policy", "same-origin"),
    ("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
)


def _client_ip(scope: Scope) -> str:
    client = scope.get("client")
    if client:
        return str(client[0])
    headers = dict(scope.get("headers") or [])
    forwarded = headers.get(b"x-forwarded-for")
    if forwarded:
        return forwarded.decode("latin-1").split(",")[0].strip()
    return "unknown"


def _header(scope: Scope, name: bytes) -> Optional[str]:
    for key, value in scope.get("headers") or []:
        if key.lower() == name:
            return value.decode("latin-1")
    return None


REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")


def _request_id(scope: Scope) -> str:
    supplied = (_header(scope, b"x-request-id") or "").strip()
    if supplied and REQUEST_ID_RE.match(supplied):
        return supplied
    return uuid.uuid4().hex


class BodyLimitMiddleware:
    """Reject bodies above ``max_bytes`` with HTTP 413.

    Content-Length is checked first, then the actual byte stream is counted so a
    chunked request cannot bypass the cap. A small allowlist of legacy voice
    paths (base64 audio uploads) can use a larger cap; the evidence API never
    does.
    """

    def __init__(
        self,
        app: ASGIApp,
        max_bytes: Optional[int] = None,
        large_max_bytes: Optional[int] = None,
        large_prefixes: tuple[str, ...] = (),
    ) -> None:
        self.app = app
        self.max_bytes = max_bytes or settings.max_request_bytes
        self.large_max_bytes = large_max_bytes or self.max_bytes
        self.large_prefixes = tuple(large_prefixes)

    def limit_for(self, scope: Scope) -> int:
        path = str(scope.get("path") or "")
        if self.large_prefixes and any(
            path.startswith(prefix) for prefix in self.large_prefixes
        ):
            return self.large_max_bytes
        return self.max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") in ("GET", "HEAD", "OPTIONS"):
            await self.app(scope, receive, send)
            return

        limit = self.limit_for(scope)
        declared = _header(scope, b"content-length")
        if declared and declared.isdigit() and int(declared) > limit:
            await self._reject(send, limit)
            return

        received = 0
        started = {"value": False}

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge(limit)
            return message

        async def tracking_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                started["value"] = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except BodyTooLarge:
            if not started["value"]:
                await self._reject(send, limit)

    async def _reject(self, send: Send, limit: int) -> None:
        body = json.dumps(
            {
                "error": "payload_too_large",
                "message": f"Request body exceeds the {limit} byte limit.",
                "field_path": "body",
            }
        ).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


class RateLimiter:
    """Sliding-window limiter for write endpoints.

    In-memory by design: this API is local-first and single-process. The state is
    bounded so a long-running process cannot leak memory per client.
    """

    def __init__(
        self,
        limit: Optional[int] = None,
        window_seconds: float = 60.0,
        max_keys: int = 2048,
    ) -> None:
        self.limit = limit if limit is not None else settings.rate_limit_per_minute
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}

    def reset(self) -> None:
        self._hits.clear()

    def check(self, key: str) -> tuple[bool, int]:
        now = time.monotonic()
        window = self._hits.get(key)
        if window is None:
            if len(self._hits) >= self.max_keys:
                self._hits.clear()
            window = deque()
            self._hits[key] = window
        cutoff = now - self.window_seconds
        while window and window[0] < cutoff:
            window.popleft()
        if len(window) >= self.limit:
            retry_after = int(max(1, self.window_seconds - (now - window[0])))
            return False, retry_after
        window.append(now)
        return True, 0


limiter = RateLimiter()


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, limiter_instance: Optional[RateLimiter] = None) -> None:
        self.app = app
        self.limiter = limiter_instance or limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return
        path = str(scope.get("path") or "")
        if path.endswith("/health/live") or path.endswith("/health/ready"):
            await self.app(scope, receive, send)
            return
        allowed, retry_after = self.limiter.check(_client_ip(scope))
        if not allowed:
            security_logger.warning(
                json.dumps(
                    {
                        "event": "rate_limited",
                        "ip": _client_ip(scope),
                        "path": path,
                        "retry_after": retry_after,
                    }
                )
            )
            body = json.dumps(
                {
                    "error": "rate_limited",
                    "message": "Too many write requests. Retry after the interval in the Retry-After header.",
                    "field_path": None,
                }
            ).encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": 429,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode("ascii")),
                        (b"retry-after", str(max(1, retry_after)).encode("ascii")),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return
        await self.app(scope, receive, send)


StoreProvider = Callable[[], Any]


class RequestContextMiddleware:
    """Attach provenance headers, time the request and write a JSON access log."""

    def __init__(self, app: ASGIApp, store_provider: StoreProvider) -> None:
        self.app = app
        self.store_provider = store_provider

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id(scope)
        try:
            corpus_version = str(self.store_provider().corpus_version)
        except Exception:  # pragma: no cover - store failure surfaces as 503 elsewhere
            corpus_version = "unavailable"

        state = scope.setdefault("state", {})
        state["request_id"] = request_id
        state["corpus_version"] = corpus_version

        started = time.perf_counter()
        status_code = {"value": 500}
        pending_start: dict[str, Any] = {}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_code["value"] = int(message["status"])
                pending_start["message"] = message
                return
            if message["type"] == "http.response.body":
                buffered = pending_start.pop("message", None)
                if buffered is not None:
                    headers = MutableHeaders(scope=buffered)
                    headers["X-Request-ID"] = request_id
                    headers["X-Corpus-Version"] = corpus_version
                    headers["X-Response-Time-Ms"] = (
                        f"{(time.perf_counter() - started) * 1000:.2f}"
                    )
                    for name, value in SECURITY_HEADERS:
                        if name not in headers:
                            headers[name] = value
                    if scope.get("path") == "/api/docs":
                        headers["Content-Security-Policy"] = "default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline'; style-src https://cdn.jsdelivr.net 'unsafe-inline'; img-src data: https://fastapi.tiangolo.com; connect-src 'self'; frame-ancestors 'none'"
                    if "cache-control" not in headers:
                        headers["Cache-Control"] = "no-store"
                    await send(buffered)
                await send(message)
                return
            await send(message)

        try:
            expected = _header(scope, b"x-corpus-version")
            if expected and expected != corpus_version:
                body = json.dumps({"error": "corpus_mismatch", "message": "Requested corpus differs from the server corpus", "corpus_version": corpus_version}).encode()
                await send_wrapper({"type": "http.response.start", "status": 409, "headers": [(b"content-type", b"application/json")]})
                await send_wrapper({"type": "http.response.body", "body": body})
                return
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.perf_counter() - started) * 1000
            access_logger.info(
                json.dumps(
                    {
                        "event": "http_request",
                        "request_id": request_id,
                        "method": scope.get("method"),
                        "path": scope.get("path"),
                        "status": status_code["value"],
                        "duration_ms": round(duration_ms, 2),
                        "corpus_version": corpus_version,
                        "client": _client_ip(scope),
                    }
                )
            )


def install_middleware(
    app: Any,
    store_provider: StoreProvider,
    *,
    max_bytes: Optional[int] = None,
    large_max_bytes: Optional[int] = None,
    large_prefixes: tuple[str, ...] = (),
) -> None:
    """Register middleware in the order documented in this module."""
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(
        BodyLimitMiddleware,
        max_bytes=max_bytes,
        large_max_bytes=large_max_bytes,
        large_prefixes=large_prefixes,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_origin_regex=settings.allowed_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "X-Response-Time-Ms",
            "X-Corpus-Version",
            "Retry-After",
        ],
    )
    app.add_middleware(RequestContextMiddleware, store_provider=store_provider)
