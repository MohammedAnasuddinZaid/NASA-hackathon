"""Run: python -m uvicorn backend.evidence.main:app --host 127.0.0.1"""
from contextlib import asynccontextmanager
import hashlib
import logging
import sqlite3
import time
from typing import Annotated
from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from .config import Settings
from .schemas import Comparison, Coverage, Experiment, Page, Search, Selection, Sources
from .store import SCHEMA_VERSION, connect, metadata
from . import services

logger = logging.getLogger("firetrace.evidence")
Identifier = Annotated[str, Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9-]{0,79}$")]


def create_app(settings=None):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        # Explicit import avoids writes during normal serving and makes stale datasets visible.
        with connect(settings.database) as conn:
            if conn.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
                raise RuntimeError("unsupported evidence schema; initialize database")
            metadata(conn)
        yield

    app = FastAPI(title="FIRETRACE Evidence API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.origins), allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Firetrace-Dataset"], expose_headers=["X-Firetrace-Dataset"])

    @app.middleware("http")
    async def logging_and_version(request: Request, call_next):
        started = time.monotonic()
        try:
            if request.headers.get("content-length", "0").isdigit() and int(request.headers.get("content-length", "0")) > 8192:
                return JSONResponse(status_code=413, content={"error": {"code": "payload_too_large", "message": "Request body exceeds 8192 bytes"}})
            # ASGI streaming bound also applies when Content-Length is absent or false.
            if request.method == "POST":
                body = bytearray()
                async for chunk in request.stream():
                    body.extend(chunk)
                    if len(body) > 8192:
                        return JSONResponse(status_code=413, content={"error": {"code": "payload_too_large", "message": "Request body exceeds 8192 bytes"}})
                request._body = bytes(body)
            with connect(settings.database) as conn:
                fingerprint = metadata(conn)[0]
            expected = request.headers.get("x-firetrace-dataset")
            if expected and expected != fingerprint:
                return JSONResponse(status_code=409, content={"error": {"code": "dataset_mismatch", "message": "Requested dataset differs from imported dataset"}})
            response = await call_next(request)
            response.headers["X-Firetrace-Dataset"] = fingerprint
            return response
        except Exception:
            logger.exception("Evidence request failed")
            return JSONResponse(status_code=503, content={"error": {"code": "evidence_unavailable", "message": "Evidence service unavailable; check local database initialization"}})
        finally:
            # Do not log queries, bodies, filenames or client addresses.
            logger.info("%s request %.1fms", request.method, (time.monotonic() - started) * 1000)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": f"http_{exc.status_code}", "message": str(exc.detail)}})

    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return JSONResponse(status_code=422, content={"error": {"code": "invalid_request", "message": "Invalid or unsupported input", "fields": [{"location": list(e["loc"]), "message": e["msg"]} for e in exc.errors()]}})

    @app.get("/api/v1/health")
    def health():
        with connect(settings.database) as conn:
            return {"status": "ok", "schema_version": SCHEMA_VERSION, "dataset_id": metadata(conn)[0], "records": conn.execute("SELECT count(*) FROM experiments").fetchone()[0]}

    @app.get("/api/v1/experiments", response_model=Page)
    def experiments(query: Annotated[Search, Query()]):
        with connect(settings.database) as conn:
            return services.search(conn, query)

    @app.get("/api/v1/experiments/{experiment_id}", response_model=Experiment)
    def experiment(experiment_id: Identifier):
        with connect(settings.database) as conn:
            return services.record(conn, experiment_id)

    @app.get("/api/v1/coverage", response_model=Coverage)
    def coverage():
        with connect(settings.database) as conn:
            return services.coverage(conn)

    @app.get("/api/v1/sources", response_model=Sources)
    def sources():
        with connect(settings.database) as conn:
            return {"items": services.sources(conn, settings), "dataset_id": metadata(conn)[0]}

    @app.get("/api/v1/sources/{source_id}", response_model=Sources)
    def source(source_id: Identifier):
        with connect(settings.database) as conn:
            items = services.sources(conn, settings, source_id)
            if not items:
                raise HTTPException(404, "Source not found")
            return {"items": items, "dataset_id": metadata(conn)[0]}

    @app.get("/api/v1/sources/{source_id}/download")
    def download(source_id: Identifier, artifact_id: str = Query(max_length=180), dataset_id: str | None = Query(None, max_length=64)):
        with connect(settings.database) as conn:
            if dataset_id and dataset_id != metadata(conn)[0]:
                raise HTTPException(409, "Download dataset differs from current imported dataset")
            item = next((s for s in services.sources(conn, settings, source_id) if s["artifact_id"] == artifact_id), None)
            if not item or not item["download_available"]:
                raise HTTPException(404, "Original download unavailable; use the authoritative source link")
            path = (settings.raw_dir / item["original_filename"]).resolve()
            # Recheck registered original at point of serving, never use a client path.
            if not path.is_relative_to(settings.raw_dir.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
                raise HTTPException(409, "Original artifact integrity check failed")
            return FileResponse(path, media_type=item["content_type"], filename=item["original_filename"], headers={"X-Content-Type-Options": "nosniff"})

    @app.post("/api/v1/compare", response_model=Comparison)
    def compare(body: Selection):
        with connect(settings.database) as conn:
            return services.compare(conn, body.experiment_ids)

    @app.get("/api/v1/passages")
    def passages():
        return {"items": [], "limitations": ["No verified report passage collection exists in the current default-branch contract. No excerpts were generated."]}

    return app


app = create_app()
