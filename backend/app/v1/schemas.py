"""Pydantic v2 request/response schemas for the evidence API.

The schemas are the executable version of the contract. Two invariants are
enforced here rather than in prose:

* ``value`` is allowed to be null and a null value never means zero.
* every response envelope carries ``corpus_version`` so a caller can tie an
  answer to the exact dataset bytes it came from.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.v1 import policy

ValueStatus = Literal[
    "measured",
    "derived",
    "investigation_level",
    "not_reported",
    "not_extracted",
    "over_range",
    "reported_flag",
    "reported_qualitative",
]

EvidenceType = Literal[
    "record_field",
    "record_aggregate",
    "investigation_claim",
    "source_metadata",
    "corpus_meta",
]

AnswerGrade = Literal["direct", "partial", "context", "absent", "out-of-scope"]

ExportKind = Literal["evidence_brief", "records_csv", "claims_csv"]


class ValueField(BaseModel):
    """One curated value with its provenance status.

    ``value`` may be null. When it is null the status says *why*: not_reported,
    not_extracted, over_range or reported_flag. A numeric zero is always
    distinguishable from an absent value.
    """

    model_config = ConfigDict(extra="allow")

    value: Any | None = None
    unit: str | None = None
    status: ValueStatus
    note: str | None = None
    basis: str | None = None
    raw: Any | None = None


class Citation(BaseModel):
    source_id: str
    title: str
    locator: str
    url: str
    doi: str | None = None


class CorpusEnvelope(BaseModel):
    corpus_version: str = Field(description="SHA-256 of src/data/corpus.json")


class ExperimentBrief(BaseModel):
    model_config = ConfigDict(extra="allow")

    experiment_id: str
    test_number: str | None = None
    family: str | None = None
    investigation_acronym: str | None = None
    material_raw: str | None = None
    material_family: str | None = None
    material_species: str | None = None
    geometry: str | None = None
    validation_status: str | None = None
    source_id: str | None = None
    source_locator: str | None = None
    oxygen_initial_pct: dict[str, Any] | None = None
    total_pressure_psia: dict[str, Any] | None = None
    flow_initial_cm_s: dict[str, Any] | None = None
    gravity_regime: dict[str, Any] | None = None


class ExperimentListResponse(CorpusEnvelope):
    items: list[ExperimentBrief]
    total: int
    limit: int
    offset: int
    filters: dict[str, Any] = Field(default_factory=dict)


class ExperimentDetail(CorpusEnvelope):
    model_config = ConfigDict(extra="allow")

    experiment_id: str
    source_id: str
    source_locator: str
    fields: dict[str, ValueField]
    measurements: list[dict[str, Any]] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    quality_flags: list[str] = Field(default_factory=list)
    provenance_notes: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class SourceDetail(CorpusEnvelope):
    source_id: str
    title: str | None = None
    url: str | None = None
    doi: str | None = None
    role: str | None = None
    version: str | None = None
    sha256: str | None = None
    license: str | None = None
    license_url: str | None = None
    processing_status: str | None = None
    limitations: list[str] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    experiment_count: int = 0
    experiment_ids: list[str] = Field(default_factory=list)
    claim_ids: list[str] = Field(default_factory=list)


class CoverageResponse(CorpusEnvelope):
    policy_version: str
    record_count: int
    experiment_record_count: int
    family_counts: dict[str, int]
    validation_status_counts: dict[str, int]
    field_coverage: dict[str, dict[str, Any]]
    recomputed: dict[str, Any]
    declared_in_meta: dict[str, Any]
    declared_matches_recomputed: dict[str, bool]
    claim_count: int
    source_count: int
    null_semantics: str
    gaps: list[str]


class CompareRequest(BaseModel):
    ids: list[str] = Field(min_length=2, max_length=4)

    @field_validator("ids")
    @classmethod
    def _strip_ids(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(not item for item in cleaned):
            raise ValueError("experiment ids must not be blank")
        return cleaned


class ComparisonField(BaseModel):
    field: str
    label: str
    category: Literal["consequential", "contextual"]
    unit: str | None = None
    values: dict[str, dict[str, Any]]
    outcome: Literal["matched", "mismatched", "unknown"]
    tolerance: dict[str, Any] | None = None
    explanation: str


class ComparisonResponse(CorpusEnvelope):
    matching_policy: str
    policy_version: str
    experiments: list[dict[str, Any]]
    fields: list[ComparisonField]
    summary: dict[str, int]
    blockers: list[dict[str, Any]]
    unknowns: list[dict[str, Any]]
    confounders: list[dict[str, Any]]
    applicability: Literal[
        "Matched conditions", "Partial match", "Mechanistic context", "No applicable record"
    ]
    applicability_reason: str
    fused_score: None = None
    score_note: str
    limitations: list[str] = Field(default_factory=list)
    comparison_basis: str | None = None
    basis_note: str | None = None


class AskFilters(BaseModel):
    family: str | None = None
    material: str | None = None
    gravity: str | None = None
    min_o2: float | None = Field(default=None, ge=0, le=100)
    max_o2: float | None = Field(default=None, ge=0, le=100)
    flow_only: bool = False
    validation_status: str | None = None

    @model_validator(mode="after")
    def _ordered_range(self) -> "AskFilters":
        if (
            self.min_o2 is not None
            and self.max_o2 is not None
            and self.min_o2 > self.max_o2
        ):
            raise ValueError("min_o2 must be less than or equal to max_o2")
        return self


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    filters: AskFilters | None = None

    @field_validator("question")
    @classmethod
    def _non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("question must not be blank")
        return value.strip()


class Computation(BaseModel):
    label: str
    formula: str
    value: str
    unit: str | None = None
    field: str | None = None
    inputs: list[str] = Field(default_factory=list)


class Claim(BaseModel):
    text: str
    source_id: str
    locator: str
    evidence_type: EvidenceType
    evidence_ids: list[str] = Field(default_factory=list)
    supporting_source_ids: list[str] = Field(default_factory=list)
    unit: str | None = None
    computations: list[Computation] = Field(default_factory=list)


class RetrievalInfo(BaseModel):
    mode: str
    query_terms: list[str] = Field(default_factory=list)
    hits: list[dict[str, Any]] = Field(default_factory=list)
    record_hits: list[str] = Field(default_factory=list)


class ValidationInfo(BaseModel):
    ok: bool
    checked: int
    rejected: int
    issues: list[str] = Field(default_factory=list)


class AnswerResponse(CorpusEnvelope):
    answer_id: str
    question: str
    grade: AnswerGrade
    headline: str
    claims: list[Claim] = Field(default_factory=list)
    paragraphs: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    missing_conditions: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    trace: list[str] = Field(default_factory=list)
    retrieval: RetrievalInfo
    validation: ValidationInfo
    follow_ups: list[str] = Field(default_factory=list)
    policy_version: str
    answer_schema_version: str
    disclaimer: str
    out_of_scope_reason: str | None = None


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    material: str | None = Field(default=None, max_length=120)
    gravity: str | None = Field(default=None, max_length=60)
    oxygen_pct: float | None = Field(default=None, ge=0, le=100)
    pressure_psia: float | None = Field(default=None, gt=0, le=500)
    # The published contract calls this ``flow``. ``flow_cm_s`` is accepted as an
    # alias so both spellings resolve to the same centimetre-per-second field.
    flow_cm_s: float | None = Field(
        default=None,
        ge=0,
        le=10_000,
        validation_alias=AliasChoices("flow_cm_s", "flow"),
    )

    @model_validator(mode="after")
    def _at_least_one(self) -> "ScenarioRequest":
        if not any(
            value is not None
            for value in (
                self.material,
                self.gravity,
                self.oxygen_pct,
                self.pressure_psia,
                self.flow_cm_s,
            )
        ):
            raise ValueError("at least one scenario condition is required")
        return self


class ScenarioResponse(CorpusEnvelope):
    requested: dict[str, Any]
    applicability: Literal[
        "Matched conditions", "Partial match", "Mechanistic context", "No applicable record"
    ]
    applicability_reason: str
    coverage_gaps: list[str] = Field(default_factory=list)
    candidates: list[dict[str, Any]] = Field(default_factory=list)
    population_size: int = 0
    candidate_count: int = 0
    class_counts: dict[str, int] = Field(default_factory=dict)
    matching_policy: str
    policy_version: str
    not_provided: list[str] = Field(default_factory=list)
    disclaimer: str


class ExportRequest(BaseModel):
    kind: ExportKind
    ids: list[str] | None = Field(default=None, max_length=4)
    question: str | None = Field(default=None, max_length=500)
    family: str | None = None
    limit: int = Field(default=200, ge=1, le=1000)


class ExportResponse(CorpusEnvelope):
    kind: ExportKind
    content_type: str
    filename: str
    content: str
    row_count: int
    generated_at: str


class HealthLive(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    corpus_version: str


class ReadinessCheck(BaseModel):
    name: str
    ok: bool
    detail: str


class HealthReady(CorpusEnvelope):
    status: Literal["ready", "degraded"]
    checks: list[ReadinessCheck]
    record_count: int
    expected_record_count: int


class ErrorResponse(BaseModel):
    error: str
    message: str
    field_path: str | None = None
    request_id: str | None = None
    corpus_version: str | None = None
    details: list[dict[str, Any]] = Field(default_factory=list)


class ApiInfo(CorpusEnvelope):
    service: str
    version: str
    api_version: str
    policy_version: str
    matching_policy: str
    endpoints: list[str]
    statuses: list[str]
    answer_grades: list[str]
    disclaimer: str
    policy: dict[str, bool]


def status_vocabulary() -> list[str]:
    return list(policy.VALUE_STATUSES)
