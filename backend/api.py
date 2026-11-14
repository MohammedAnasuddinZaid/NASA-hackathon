"""Standalone FIRETRACE evidence API.

This entry point boots with zero AI runtimes installed. It needs only FastAPI,
Pydantic and the Python standard library.

    uvicorn api:app --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from app.config import settings
from app.v1 import API_VERSION, policy
from app.v1.middleware import install_middleware
from app.v1.router import health_router, install_error_handlers, router
from app.v1.store import get_store

DESCRIPTION = """
Read-only evidence API over the curated FIRETRACE corpus.

* Every response carries `X-Corpus-Version`, `X-Request-ID` and `X-Response-Time-Ms`.
* Missing values stay null. Null is never zero.
* Answers are retrieval-first, computed in Python, and validated claim by claim.
* No risk probability, safety percentage, certification or operational advice is produced.
"""


def create_app() -> FastAPI:
    app = FastAPI(
        title="FIRETRACE Evidence API",
        version=f"{settings.version}+{API_VERSION}",
        description=DESCRIPTION,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    install_error_handlers(app, get_store)
    app.include_router(router, prefix="/api/v1")
    app.include_router(health_router)
    install_middleware(app, get_store)
    app.state.policy_version = policy.POLICY_VERSION
    @app.get("/docs", include_in_schema=False)
    def docs_alias():
        return RedirectResponse("/api/docs")
    return app


app = create_app()
