"""Validation of the main-branch normalized contract; extra provenance survives."""
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Preserved(BaseModel):
    model_config = ConfigDict(extra="allow", strict=True, allow_inf_nan=False)


class Value(Preserved):
    value: float | int | str | None
    status: str = Field(min_length=1)
    unit: str | None
    raw: str | None
    note: str | None
    basis: str | None

    @model_validator(mode="after")
    def missing(self):
        if self.status in {"not_reported", "missing"} and self.value is not None:
            raise ValueError("missing values must remain null")
        return self


class Measurement(Preserved):
    measurement_id: str
    quantity: str
    original_value: str | None
    original_unit: str | None
    normalized_value: float | int | str | None
    normalized_unit: str | None
    status: str
    uncertainty: str | None
    measurement_phase: str
    measurement_method: str | None
    source_locator: str = Field(min_length=1)


class Experiment(Preserved):
    experiment_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9-]{0,79}$")
    source_id: str
    source_locator: str = Field(min_length=1)
    family: str
    investigation: str
    test_number: str
    material_family: str
    geometry: str
    validation_status: Literal["validated", "partial", "suspect"]
    quality_flags: list[str]
    missing_fields: list[str]
    provenance_notes: list[str]
    raw: dict[str, str | None]
    measurements: list[Measurement]
    oxygen_initial_pct: Value
    total_pressure_psia: Value
    flow_initial_cm_s: Value
    gravity_regime: Value
    outcome: Value


class Search(BaseModel):
    model_config = ConfigDict(extra="forbid")
    q: str = Field("", max_length=200)
    investigation: str | None = Field(None, max_length=100)
    material: str | None = Field(None, max_length=100)
    quality: Literal["validated", "partial", "suspect"] | None = None
    experiment_id: str | None = Field(None, max_length=80)
    source_id: str | None = Field(None, max_length=80)
    o2_min: float | None = Field(None, ge=0, le=100, allow_inf_nan=False)
    o2_max: float | None = Field(None, ge=0, le=100, allow_inf_nan=False)
    flow_min: float | None = Field(None, ge=0, allow_inf_nan=False)
    flow_max: float | None = Field(None, ge=0, allow_inf_nan=False)
    flow_only: bool = False
    sort: Literal["id", "o2-asc", "o2-desc", "material", "date"] = "id"
    limit: int = Field(24, ge=1, le=100)
    offset: int = Field(0, ge=0, le=100000)

    @model_validator(mode="after")
    def ranges(self):
        for low, high in ((self.o2_min, self.o2_max), (self.flow_min, self.flow_max)):
            if low is not None and high is not None and low > high:
                raise ValueError("minimum cannot exceed maximum")
        return self


class Selection(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    experiment_ids: list[str] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def unique(self):
        import re
        if len(set(self.experiment_ids)) != len(self.experiment_ids) or any(not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,79}", x) for x in self.experiment_ids):
            raise ValueError("unique valid experiment identifiers required")
        return self


class Page(BaseModel):
    items: list[Experiment]
    total: int
    limit: int
    offset: int
    dataset_id: str


class Check(BaseModel):
    id: str
    label: str
    state: Literal["shared", "partial", "blocked", "unknown"]
    detail: str


class Comparison(BaseModel):
    records: list[Experiment]
    checks: list[Check]
    different_conditions: list[str]
    missing_measurements: dict[str, list[str]]
    citations: list[dict[str, str]]
    limitations: list[str]
    dataset_id: str


class Coverage(BaseModel):
    total: int
    investigations: dict[str, int]
    quality: dict[str, int]
    fields: dict[str, Any]
    source_coverage: dict[str, int]
    limitations: list[str]
    dataset_id: str


class Sources(BaseModel):
    items: list[dict[str, Any]]
    dataset_id: str
