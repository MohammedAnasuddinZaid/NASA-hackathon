"""HTTP surface for the typed evidence API.

Handlers are synchronous on purpose: FastAPI runs plain ``def`` endpoints in a
threadpool, so CPU work (retrieval, comparison, validation) never blocks the
event loop.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.v1 import API_VERSION, policy, schemas
from app.v1.assistant import answer as build_answer
from app.v1.compare import ComparisonError, compare
from app.v1.errors import ApiError
from app.v1.exports import export as build_export
from app.v1.scenario import evaluate as evaluate_scenario
from app.v1.store import EvidenceStore, get_store

router = APIRouter(tags=["evidence"])
health_router = APIRouter(tags=["health"])
error_logger = logging.getLogger("firetrace.error")


def store_dependency() -> EvidenceStore:
    try:
        return get_store()
    except Exception as exc:
        raise ApiError(
            503,
            "service_degraded",
            f"The curated corpus could not be loaded: {exc}",
        )


def _known_validation_statuses(store: EvidenceStore) -> set[str]:
    return {
        str(record.get("validation_status") or "").strip().lower()
        for record in store.records
        if record.get("validation_status")
    }


def _require_known_validation_status(
    value: Optional[str], store: EvidenceStore, field_path: str
) -> None:
    needle = (value or "").strip().lower()
    if not needle:
        return
    known = _known_validation_statuses(store)
    if needle not in known:
        raise ApiError(
            422,
            "validation_error",
            f"Unknown validation_status {value!r}; expected one of "
            + ", ".join(sorted(known)),
            field_path=field_path,
        )


# --------------------------------------------------------------------------- #
# metadata
# --------------------------------------------------------------------------- #
@router.get("", response_model=schemas.ApiInfo, summary="Describe this API")
def api_info(store: EvidenceStore = Depends(store_dependency)) -> dict[str, Any]:
    return {
        "corpus_version": store.corpus_version,
        "service": settings.service_name,
        "version": settings.version,
        "api_version": API_VERSION,
        "policy_version": policy.POLICY_VERSION,
        "matching_policy": policy.MATCHING_POLICY_VERSION,
        "endpoints": [
            "GET /api/v1/experiments",
            "GET /api/v1/experiments/{id}",
            "GET /api/v1/sources/{id}",
            "GET /api/v1/coverage",
            "POST /api/v1/compare",
            "POST /api/v1/ask",
            "POST /api/v1/scenarios/evaluate",
            "POST /api/v1/exports",
            "GET /health/live",
            "GET /health/ready",
        ],
        "statuses": schemas.status_vocabulary(),
        "answer_grades": list(policy.ANSWER_GRADES),
        "disclaimer": policy.DISCLAIMER,
        "policy": {
            "imputes_missing_values": False,
            "emits_risk_probability": False,
            "emits_safety_percentage": False,
            "certifies_materials": False,
            "calls_external_models": False,
        },
    }


# --------------------------------------------------------------------------- #
# experiments
# --------------------------------------------------------------------------- #
@router.get(
    "/experiments",
    response_model=schemas.ExperimentListResponse,
    summary="Filter and page curated experiment records",
)
def list_experiments(
    q: str = Query("", max_length=200),
    family: str = Query("", max_length=80),
    material: str = Query("", max_length=120),
    gravity: str = Query("", max_length=80),
    min_o2: Optional[float] = Query(None, ge=0, le=100),
    max_o2: Optional[float] = Query(None, ge=0, le=100),
    flow_only: bool = False,
    validation_status: str = Query("", max_length=40),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    if min_o2 is not None and max_o2 is not None and min_o2 > max_o2:
        raise ApiError(
            422,
            "validation_error",
            "min_o2 must be less than or equal to max_o2",
            field_path="query.min_o2",
        )
    _require_known_validation_status(validation_status, store, "query.validation_status")
    records = store.filter_records(
        q=q,
        family=family,
        material=material,
        gravity=gravity,
        min_o2=min_o2,
        max_o2=max_o2,
        flow_only=flow_only,
        validation_status=validation_status,
    )
    window = records[offset : offset + limit]
    return {
        "corpus_version": store.corpus_version,
        "items": [store.record_brief(record) for record in window],
        "total": len(records),
        "limit": limit,
        "offset": offset,
        "filters": {
            "q": q,
            "family": family,
            "material": material,
            "gravity": gravity,
            "min_o2": min_o2,
            "max_o2": max_o2,
            "flow_only": flow_only,
            "validation_status": validation_status,
        },
    }


@router.get(
    "/experiments/{experiment_id}",
    response_model=schemas.ExperimentDetail,
    summary="One curated record with per-field status",
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_experiment(
    experiment_id: str = Path(..., max_length=40),
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    record = store.resolve_record(experiment_id)
    if record is None:
        raise ApiError(404, "not_found", f"Unknown experiment id: {experiment_id}", "path.experiment_id")
    return store.record_view(record)


@router.get(
    "/sources/{source_id}",
    response_model=schemas.SourceDetail,
    summary="Source artifacts, licence and record links",
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_source(
    source_id: str = Path(..., max_length=80),
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    source = store.resolve_source(source_id)
    if source is None:
        raise ApiError(404, "not_found", f"Unknown source id: {source_id}", "path.source_id")
    return source


@router.get(
    "/coverage",
    response_model=schemas.CoverageResponse,
    summary="Recomputed field coverage and documented gaps",
)
def get_coverage(store: EvidenceStore = Depends(store_dependency)) -> dict[str, Any]:
    return store.coverage()


# --------------------------------------------------------------------------- #
# compare
# --------------------------------------------------------------------------- #
@router.post(
    "/compare",
    response_model=schemas.ComparisonResponse,
    summary="Per-field comparison with matched / mismatched / unknown",
    responses={422: {"model": schemas.ErrorResponse}, 404: {"model": schemas.ErrorResponse}},
)
def post_compare(
    payload: schemas.CompareRequest,
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    try:
        return compare(store, payload.ids)
    except ComparisonError as exc:
        status = 404 if exc.code == "unknown_experiment" else 422
        raise ApiError(status, exc.code, exc.message, exc.field_path)


# --------------------------------------------------------------------------- #
# ask
# --------------------------------------------------------------------------- #
@router.post(
    "/ask",
    response_model=schemas.AnswerResponse,
    summary="Grounded retrieval-first answer with validation",
    responses={422: {"model": schemas.ErrorResponse}},
)
def post_ask(
    payload: schemas.AskRequest,
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    if payload.filters:
        _require_known_validation_status(
            payload.filters.validation_status,
            store,
            "body.filters.validation_status",
        )
    filters = payload.filters.model_dump() if payload.filters else None
    return build_answer(store, payload.question, filters)


# --------------------------------------------------------------------------- #
# scenarios
# --------------------------------------------------------------------------- #
@router.post(
    "/scenarios/evaluate",
    response_model=schemas.ScenarioResponse,
    summary="Applicability of requested conditions to curated records",
    responses={422: {"model": schemas.ErrorResponse}},
)
def post_scenario(
    payload: schemas.ScenarioRequest,
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    return evaluate_scenario(
        store,
        material=payload.material,
        gravity=payload.gravity,
        oxygen_pct=payload.oxygen_pct,
        pressure_psia=payload.pressure_psia,
        flow_cm_s=payload.flow_cm_s,
    )


# --------------------------------------------------------------------------- #
# exports
# --------------------------------------------------------------------------- #
@router.post(
    "/exports",
    response_model=schemas.ExportResponse,
    summary="Deterministic evidence brief or CSV export",
    responses={422: {"model": schemas.ErrorResponse}},
)
def post_export(
    payload: schemas.ExportRequest,
    store: EvidenceStore = Depends(store_dependency),
) -> dict[str, Any]:
    if payload.kind == "evidence_brief" and not (payload.ids or payload.question or payload.family):
        raise ApiError(
            422,
            "validation_error",
            "evidence_brief requires ids, question or family",
            field_path="body.ids",
        )
    if payload.ids:
        unknown = [item for item in payload.ids if store.resolve_record(item) is None]
        if unknown:
            raise ApiError(
                422,
                "unknown_experiment",
                "Unknown experiment id(s): " + ", ".join(unknown),
                field_path="body.ids",
            )
    return build_export(
        store,
        kind=payload.kind,
        ids=payload.ids,
        question=payload.question,
        family=payload.family,
        limit=payload.limit,
    )


# --------------------------------------------------------------------------- #
# health
# --------------------------------------------------------------------------- #
def readiness(store: EvidenceStore) -> tuple[bool, list[dict[str, Any]], int, int]:
    expected = int(store.meta.get("record_count") or -1)
    loaded = store.record_count()
    unresolved = store.unresolved_references()
    null_problems: list[str] = []
    for record in store.records:
        record_id = store.record_id(record)
        for name, payload in store.record_fields(record).items():
            if not isinstance(payload, dict):
                null_problems.append(f"{record_id}.{name}: not a field payload")
                continue
            status = policy.status_of(payload)
            value = payload.get("value")
            if status not in policy.VALUE_STATUSES:
                null_problems.append(f"{record_id}.{name}: unknown status {status!r}")
            elif status in policy.NO_VALUE_STATUSES and value is not None:
                null_problems.append(
                    f"{record_id}.{name}: value present with no-value status {status!r}"
                )
            elif status in policy.VALUE_BEARING_STATUSES and value is None:
                null_problems.append(
                    f"{record_id}.{name}: null with value-bearing status {status!r}"
                )
            if len(null_problems) >= 6:
                break
        if len(null_problems) >= 6:
            break
    checks = [
        {
            "name": "record_count",
            "ok": loaded == expected,
            "detail": f"loaded={loaded} expected={expected}",
        },
        {
            "name": "referential_integrity",
            "ok": not unresolved,
            "detail": "all record and claim source ids resolve"
            if not unresolved
            else "; ".join(unresolved[:5]),
        },
        {
            "name": "fts_index",
            "ok": store.index_mode in ("persistent", "memory"),
            "detail": f"mode={store.index_mode}",
        },
        {
            "name": "corpus_version",
            "ok": len(store.corpus_version) == 64,
            "detail": f"sha256={store.corpus_version[:12]}",
        },
        {
            "name": "null_discipline",
            "ok": not null_problems,
            "detail": "every field value agrees with its status vocabulary"
            if not null_problems
            else "; ".join(null_problems[:5]),
        },
    ]
    return all(check["ok"] for check in checks), checks, loaded, expected


@health_router.get("/health/live", response_model=schemas.HealthLive, summary="Liveness")
def health_live() -> dict[str, Any]:
    try:
        corpus_version = get_store().corpus_version
    except Exception:
        corpus_version = "unavailable"
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "corpus_version": corpus_version,
    }


@health_router.get(
    "/health/ready",
    response_model=schemas.HealthReady,
    summary="Readiness (503 when the corpus is degraded)",
    responses={503: {"model": schemas.HealthReady}},
)
def health_ready(store: EvidenceStore = Depends(store_dependency)):
    ok, checks, loaded, expected = readiness(store)
    body = {
        "corpus_version": store.corpus_version,
        "status": "ready" if ok else "degraded",
        "checks": checks,
        "record_count": loaded,
        "expected_record_count": expected,
    }
    if not ok:
        return JSONResponse(status_code=503, content=body)
    return body


# --------------------------------------------------------------------------- #
# error handling
# --------------------------------------------------------------------------- #
def _error_body(
    error: str,
    message: str,
    request: Request,
    field_path: Optional[str] = None,
    details: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    state = getattr(request, "state", None)
    return {
        "error": error,
        "message": message,
        "field_path": field_path,
        "request_id": getattr(state, "request_id", None),
        "corpus_version": getattr(state, "corpus_version", None),
        "details": details or [],
    }


def install_error_handlers(app: Any, _store_provider: Callable[[], Any]) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, request, exc.field_path, exc.details),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details: list[dict[str, Any]] = []
        for error in exc.errors():
            location = [str(item) for item in error.get("loc", ())]
            if error.get("type") == "json_invalid":
                path = "body"
                message = "Request body is not valid JSON."
            else:
                path = ".".join(location)
                message = str(error.get("msg") or "invalid value")
            details.append({"field_path": path, "message": message, "type": error.get("type")})
        first = details[0] if details else {"field_path": None, "message": "Invalid request."}
        return JSONResponse(
            status_code=422,
            content=_error_body(
                "validation_error",
                first["message"],
                request,
                first["field_path"],
                details,
            ),
        )

    @app.exception_handler(json.JSONDecodeError)
    async def _json_error(request: Request, exc: json.JSONDecodeError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body("validation_error", "Request body is not valid JSON.", request, "body"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict):
            # Legacy routes raise HTTPException(detail={"error": ..., "message": ...}).
            # Preserve that structure instead of stringifying it into the message.
            code = str(detail.get("error") or ("not_found" if exc.status_code == 404 else "http_error"))
            message = str(detail.get("message") or detail.get("detail") or "Request failed.")
            details = [
                {"field_path": key, "message": str(value)}
                for key, value in detail.items()
                if key not in {"error", "message", "detail"}
            ]
            body = _error_body(code, message, request, detail.get("field_path"), details)
        else:
            code = "not_found" if exc.status_code == 404 else "http_error"
            body = _error_body(code, str(detail), request, None)
        return JSONResponse(
            status_code=exc.status_code,
            content=body,
            headers=getattr(exc, "headers", None) or {},
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
        request_id = getattr(getattr(request, "state", None), "request_id", None)
        error_logger.error(
            "Unhandled error on %s %s (request_id=%s)",
            request.method,
            request.url.path,
            request_id,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return JSONResponse(
            status_code=500,
            content=_error_body(
                "internal_error",
                "The server could not complete the request. The failure was logged.",
                request,
                None,
            ),
        )
