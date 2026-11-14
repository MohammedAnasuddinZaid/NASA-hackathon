"""Read-only evidence store over the curated corpus.

The store is the only place the API reads data from. It never writes to
``corpus.json`` or ``source_manifest.json``; the corpus version is the SHA-256 of
the exact bytes on disk, so a cached answer can be tied to a specific dataset.

Retrieval uses SQLite FTS5 with BM25 ranking. A persistent index built by
``scripts/build_index.py`` is used when it matches the current corpus version;
otherwise an equivalent in-memory index is built on load, so the API still works
on a fresh checkout with no build step.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

from app.config import settings
from app.v1 import policy
from app.v1.persistence import SCHEMA_VERSION, write_snapshot

logger = logging.getLogger("firetrace.store")

STOPWORDS: frozenset[str] = frozenset(
    """
    a an the and or but if then than that this these those of for from to in on at by
    with without into over under about as is are was were be been being do does did
    done have has had having i me my we our you your he she it they them their what
    which who whom whose when where why how can could should would will shall may
    might must not no nor so such very just also only own same too s t don now
    please tell show give list does did report reported corpus data record records
    """.split()
)

FIELD_LABELS: dict[str, str] = {
    "thickness_mm": "Thickness",
    "width_cm": "Width",
    "length_cm": "Length",
    "diameter_mm": "Diameter",
    "oxygen_initial_pct": "Oxygen fraction (initial)",
    "oxygen_final_pct": "Oxygen fraction (final)",
    "oxygen_partial_pressure_psi": "Oxygen partial pressure",
    "total_pressure_psia": "Total pressure",
    "flow_initial_cm_s": "Forced flow (initial)",
    "flow_derived_cm_s": "Forced flow (derived)",
    "flow_direction": "Flow direction",
    "gravity_regime": "Gravity regime",
    "ignition_method": "Ignition method",
    "ignition_power_w": "Ignition power",
    "ignition_time_s": "Ignition time",
    "burn_time_s": "Burn time",
    "hardware": "Hardware",
    "outcome": "Outcome",
    "co2_initial_pct": "CO2 (initial)",
    "co2_final_pct": "CO2 (final)",
    "co_initial_ppm": "CO (initial)",
    "co_final_ppm": "CO (final)",
}

# Metadata fields that are plain scalars rather than value/status objects.
SCALAR_FIELDS: tuple[str, ...] = (
    "experiment_id",
    "test_number",
    "sample_number",
    "family",
    "investigation",
    "investigation_acronym",
    "material_raw",
    "material_family",
    "material_species",
    "geometry",
    "pi",
    "date_reported",
    "gmt_day",
    "measurement_method",
    "outcome_definition",
    "source_note",
    "radiometer_gain",
    "total_frames",
    "fan_display_raw",
    "air_display_raw",
    "flow_restrictor",
    "validation_status",
    "source_id",
    "source_locator",
)

LIST_FIELDS: tuple[str, ...] = (
    "quality_flags",
    "missing_fields",
    "provenance_notes",
)

DEFAULT_INDEX_PATH = Path(
    os.getenv("FIRETRACE_INDEX_PATH", str(settings.base_dir / "index" / "corpus_fts.sqlite3"))
)


class CorpusLoadError(RuntimeError):
    """The curated corpus is missing, unreadable or internally inconsistent."""


@dataclass(frozen=True)
class RetrievalHit:
    kind: str  # record | claim | source
    ref_id: str
    score: float
    text: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "ref_id": self.ref_id,
            "score": round(self.score, 6),
        }


def _read_json_bytes(path: Path) -> tuple[dict[str, Any], bytes]:
    if not path.exists():
        raise CorpusLoadError(f"Evidence file not found: {path}")
    try:
        raw = path.read_bytes()
    except OSError as exc:  # pragma: no cover - OS-level failure
        raise CorpusLoadError(f"Could not read {path}: {exc}") from exc
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CorpusLoadError(f"Could not parse {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise CorpusLoadError(f"{path} is not a JSON object.")
    return payload, raw


def value_fields(record: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Return the value/status objects of a record, in a stable order."""
    fields: dict[str, dict[str, Any]] = {}
    for key, value in record.items():
        if isinstance(value, dict) and "status" in value:
            fields[key] = value
    return fields


def _fts_query(text: str) -> tuple[str, list[str]]:
    """Turn a question into a safe FTS5 MATCH expression.

    Every term is quoted, so an unbalanced quote or a bare ``*`` can never be
    interpreted as FTS5 syntax. Stopwords are removed; if nothing survives the
    query is empty and retrieval honestly returns no hits.
    """
    words = re.findall(r"[a-z0-9][a-z0-9._-]*", (text or "").lower())
    terms: list[str] = []
    for word in words:
        if word in STOPWORDS or len(word) < 2:
            continue
        if word.isdigit():
            continue
        term = word.replace('"', "")
        if term and term not in terms:
            terms.append(term)
    if not terms:
        return "", []
    expression = " OR ".join(f'"{term}"' for term in terms)
    return expression, terms


class EvidenceStore:
    def __init__(
        self,
        corpus_path: Path | None = None,
        manifest_path: Path | None = None,
        validation_path: Path | None = None,
        index_path: Path | None = None,
    ) -> None:
        self.corpus_path = Path(corpus_path or settings.corpus_path)
        self.manifest_path = Path(manifest_path or settings.manifest_path)
        self.validation_path = Path(validation_path or settings.validation_path)
        self.index_path = Path(index_path or DEFAULT_INDEX_PATH)

        self.raw, corpus_bytes = _read_json_bytes(self.corpus_path)
        self.corpus_version = hashlib.sha256(corpus_bytes).hexdigest()

        self.manifest, _ = _read_json_bytes(self.manifest_path)
        try:
            self.validation_report, _ = _read_json_bytes(self.validation_path)
        except CorpusLoadError:
            self.validation_report = {}

        self.meta: dict[str, Any] = dict(self.raw.get("meta") or {})
        self.records: list[dict[str, Any]] = list(self.raw.get("records") or [])
        self.claims: list[dict[str, Any]] = list(self.raw.get("claims") or [])
        self.presets: list[dict[str, Any]] = list(self.raw.get("presets") or [])
        self.limitations: list[str] = list(self.raw.get("limitations") or [])

        self.records_by_id: dict[str, dict[str, Any]] = {}
        self.alias: dict[str, str] = {}
        for record in self.records:
            experiment_id = str(record.get("experiment_id") or "")
            if not experiment_id:
                continue
            key = experiment_id.upper()
            self.records_by_id[key] = record
            self.alias[key] = key
            test = str(record.get("test_number") or "").upper()
            if test and test not in self.alias:
                self.alias[test] = key

        self.claims_by_id: dict[str, dict[str, Any]] = {
            str(claim.get("claim_id")): claim
            for claim in self.claims
            if claim.get("claim_id")
        }

        self.sources: list[dict[str, Any]] = list(self.manifest.get("sources") or [])
        self.context_sources: list[dict[str, Any]] = list(
            self.manifest.get("context_sources") or []
        )
        self.sources_by_id: dict[str, list[dict[str, Any]]] = {}
        for artifact in self.sources:
            self.sources_by_id.setdefault(str(artifact.get("source_id")), []).append(artifact)
        for artifact in self.context_sources:
            self.sources_by_id.setdefault(str(artifact.get("source_id")), []).append(artifact)

        self._lock = threading.Lock()
        self._validate_referential_integrity()
        self._conn, self.index_mode = self._open_index()
        # Runtime record lookups now read the lossless SQLite snapshot, not FTS text.
        persisted = [json.loads(row[0]) for row in self._conn.execute("SELECT payload FROM scientific_records ORDER BY rowid")]
        if persisted != self.records:
            self._conn.close()
            raise CorpusLoadError("Scientific snapshot differs from the curated corpus; rebuild the index")
        self.records = persisted
        self.records_by_id = {str(r["experiment_id"]).upper(): r for r in self.records}

    # ------------------------------------------------------------------ #
    # index
    # ------------------------------------------------------------------ #
    def _open_index(self) -> tuple[sqlite3.Connection, str]:
        if self.index_path.exists():
            conn = None
            try:
                # ``check_same_thread=False`` is required: FastAPI runs these sync
                # handlers in a worker thread, so the connection is opened on the
                # loading thread and read from another. Every use is serialised by
                # ``self._lock``.
                conn = sqlite3.connect(
                    f"file:{self.index_path}?mode=ro", uri=True, check_same_thread=False
                )
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT value FROM index_meta WHERE key = 'corpus_version'"
                ).fetchone()
                schema = conn.execute("SELECT value FROM index_meta WHERE key='scientific_schema'").fetchone()
                if row and row["value"] == self.corpus_version and schema and schema[0] == SCHEMA_VERSION:
                    conn.execute("SELECT payload FROM scientific_records LIMIT 1").fetchone()
                    return conn, "persistent"
                conn.close()
            except sqlite3.Error:
                if conn is not None:
                    conn.close()
        return self._build_memory_index(), "memory"

    def _build_memory_index(self) -> sqlite3.Connection:
        conn = sqlite3.connect(":memory:", check_same_thread=False)
        conn.row_factory = sqlite3.Row
        build_fts_index(conn, self.records, self.claims, self.sources + self.context_sources, self.meta.get("investigations", []))
        return conn

    def _validate_referential_integrity(self) -> None:
        if self.raw.get("sources") is not None and self.raw["sources"] != self.sources:
            raise CorpusLoadError("Corpus and source manifest differ")
        ids = [str(r.get("experiment_id") or "") for r in self.records]
        if not all(ids) or len(set(ids)) != len(ids):
            raise CorpusLoadError("Missing or duplicate experiment identifiers")
        declared = int(self.meta.get("record_count") or len(self.records))
        if declared != len(self.records):
            raise CorpusLoadError(
                f"meta.record_count={declared} but {len(self.records)} records are present."
            )
        unknown = {
            str(record.get("source_id"))
            for record in self.records
            if str(record.get("source_id")) not in self.sources_by_id
        }
        if unknown:
            raise CorpusLoadError(
                "Records reference unknown source_id(s): " + ", ".join(sorted(unknown))
            )
        for record in self.records:
            fields = value_fields(record)
            if not fields:
                raise CorpusLoadError(
                    "Record without value/status fields: " + str(record.get("experiment_id"))
                )
            for field, payload in fields.items():
                status = payload.get("status")
                if status not in policy.VALUE_STATUSES:
                    raise CorpusLoadError(
                        f"Unknown status {status!r} on {record.get('experiment_id')}.{field}"
                    )
                if payload.get("value") is not None and status in policy.NO_VALUE_STATUSES:
                    raise CorpusLoadError(
                        f"Value present with no-value status on {record.get('experiment_id')}.{field}"
                    )

    def close(self) -> None:
        with self._lock:
            try:
                self._conn.close()
            except sqlite3.Error:  # pragma: no cover
                pass

    # ------------------------------------------------------------------ #
    # records
    # ------------------------------------------------------------------ #
    def record_count(self) -> int:
        return len(self.records)

    def resolve_record(self, experiment_id: str) -> Optional[dict[str, Any]]:
        key = (experiment_id or "").strip().upper()
        canonical = self.alias.get(key)
        return self.records_by_id.get(canonical) if canonical else None

    def record_id(self, record: dict[str, Any]) -> str:
        return str(record.get("experiment_id"))

    def record_fields(self, record: dict[str, Any]) -> dict[str, dict[str, Any]]:
        return value_fields(record)

    def field_label(self, field: str) -> str:
        return FIELD_LABELS.get(field, field)

    def record_view(self, record: dict[str, Any], include_raw: bool = True) -> dict[str, Any]:
        view: dict[str, Any] = {
            "experiment_id": record.get("experiment_id"),
            "source_id": record.get("source_id"),
            "source_locator": record.get("source_locator"),
            "validation_status": record.get("validation_status"),
            "fields": self.record_fields(record),
            "measurements": list(record.get("measurements") or []),
            "corpus_version": self.corpus_version,
        }
        for key in SCALAR_FIELDS:
            if key in view:
                continue
            view[key] = record.get(key)
        for key in LIST_FIELDS:
            view[key] = list(record.get(key) or [])
        view["limitations"] = self.limitations
        if include_raw:
            view["raw"] = record.get("raw") or {}
        return view

    def record_brief(self, record: dict[str, Any]) -> dict[str, Any]:
        fields = self.record_fields(record)
        return {
            "experiment_id": record.get("experiment_id"),
            "test_number": record.get("test_number"),
            "family": record.get("family"),
            "investigation_acronym": record.get("investigation_acronym"),
            "material_raw": record.get("material_raw"),
            "material_family": record.get("material_family"),
            "material_species": record.get("material_species"),
            "geometry": record.get("geometry"),
            "validation_status": record.get("validation_status"),
            "source_id": record.get("source_id"),
            "source_locator": record.get("source_locator"),
            "oxygen_initial_pct": _brief_value(fields.get("oxygen_initial_pct")),
            "total_pressure_psia": _brief_value(fields.get("total_pressure_psia")),
            "flow_initial_cm_s": _brief_value(fields.get("flow_initial_cm_s")),
            "gravity_regime": _brief_value(fields.get("gravity_regime")),
        }

    # ------------------------------------------------------------------ #
    # filtering
    # ------------------------------------------------------------------ #
    def filter_records(
        self,
        *,
        q: str = "",
        family: str = "",
        material: str = "",
        gravity: str = "",
        min_o2: float | None = None,
        max_o2: float | None = None,
        flow_only: bool = False,
        validation_status: str = "",
        material_exact: bool = False,
        atlas_search: bool = False,
    ) -> list[dict[str, Any]]:
        needle = (q or "").strip().lower()
        family_needle = (family or "").strip().lower()
        material_needle = (material or "").strip().lower()
        gravity_needle = (gravity or "").strip().lower()
        status_needle = (validation_status or "").strip().lower()

        matched: list[dict[str, Any]] = []
        for record in self.records:
            if family_needle and str(record.get("family") or "").lower() != family_needle:
                continue
            if status_needle and str(record.get("validation_status") or "").lower() != status_needle:
                continue
            if material_needle:
                if material_exact and material_needle != str(record.get("material_family") or "").lower():
                    continue
                haystack = " ".join(
                    str(record.get(key) or "")
                    for key in ("material_raw", "material_family", "material_species")
                ).lower()
                if material_needle not in haystack:
                    continue
            fields = self.record_fields(record)
            if gravity_needle:
                regime = fields.get("gravity_regime") or {}
                if gravity_needle not in str(regime.get("value") or "").lower():
                    continue
            oxygen = policy.as_number(fields.get("oxygen_initial_pct"))
            if min_o2 is not None and (oxygen is None or oxygen < min_o2):
                continue
            if max_o2 is not None and (oxygen is None or oxygen > max_o2):
                continue
            if flow_only and policy.as_number(fields.get("flow_initial_cm_s")) is None:
                continue
            if needle:
                haystack = " ".join(
                    str(record.get(key) or "")
                    for key in (
                        "experiment_id",
                        "test_number",
                        "sample_number",
                        "material_raw",
                        "material_family",
                        "material_species",
                        "investigation",
                        "investigation_acronym",
                        "family",
                        "source_id",
                    )
                ).lower()
                if atlas_search:
                    haystack += " " + " ".join(str(record.get(k) or "") for k in ("pi", "date_reported", "geometry")).lower()
                matches = all(term in haystack for term in needle.split()) if atlas_search else needle in haystack
                if not matches:
                    continue
            matched.append(record)
        if atlas_search and needle:
            exact = self.resolve_record(needle)
            if exact is not None and exact in matched:
                return [exact]
        return matched

    # ------------------------------------------------------------------ #
    # retrieval
    # ------------------------------------------------------------------ #
    def retrieve(self, query: str, limit: int = 8) -> tuple[list[RetrievalHit], list[str], str]:
        expression, terms = _fts_query(query)
        if not expression:
            return [], terms, "no-terms"
        with self._lock:
            try:
                rows = self._conn.execute(
                    "SELECT kind, ref_id, text, bm25(evidence_fts) AS score "
                    "FROM evidence_fts WHERE evidence_fts MATCH ? "
                    "ORDER BY score LIMIT ?",
                    (expression, max(1, limit)),
                ).fetchall()
            except sqlite3.Error:
                # A read-only index can still fail (corrupt file, missing FTS5).
                # Surface it in the log so a silent "index-error" is diagnosable.
                logger.warning("FTS5 query failed; returning no hits", exc_info=True)
                return [], terms, "index-error"
        hits = [
            RetrievalHit(
                kind=str(row["kind"]),
                ref_id=str(row["ref_id"]),
                score=float(row["score"]),
                text=str(row["text"]),
            )
            for row in rows
        ]
        return hits, terms, "fts5-bm25"

    def retrieve_records(self, query: str, limit: int = 8) -> tuple[list[dict[str, Any]], list[str]]:
        hits, terms, _ = self.retrieve(query, limit=max(limit * 3, 12))
        records: list[dict[str, Any]] = []
        seen: set[str] = set()
        for hit in hits:
            if hit.kind != "record" or hit.ref_id in seen:
                continue
            record = self.records_by_id.get(hit.ref_id)
            if record is not None:
                records.append(record)
                seen.add(hit.ref_id)
            if len(records) >= limit:
                break
        return records, terms

    # ------------------------------------------------------------------ #
    # sources and citations
    # ------------------------------------------------------------------ #
    def resolve_source(self, source_id: str) -> Optional[dict[str, Any]]:
        key = (source_id or "").strip()
        canonical = key
        artifacts = self.sources_by_id.get(key)
        if not artifacts:
            upper = key.upper()
            match = next(
                (
                    (sid, items)
                    for sid, items in self.sources_by_id.items()
                    if sid.upper() == upper
                ),
                None,
            )
            if match is not None:
                canonical, artifacts = match
        if not artifacts:
            return None
        experiment_ids = [
            str(record.get("experiment_id"))
            for record in self.records
            if str(record.get("source_id")) == canonical
        ]
        claim_ids = [
            str(claim.get("claim_id"))
            for claim in self.claims
            if canonical in (claim.get("supporting_source_ids") or [])
        ]
        primary = next(
            (item for item in artifacts if item.get("role") == "experiment_table"),
            artifacts[0],
        )
        return {
            "source_id": primary.get("source_id"),
            "title": primary.get("source_title"),
            "url": primary.get("source_url"),
            "doi": primary.get("doi"),
            "role": primary.get("role"),
            "version": primary.get("version"),
            "sha256": primary.get("sha256"),
            "license": primary.get("license"),
            "license_url": primary.get("license_url"),
            "processing_status": primary.get("processing_status"),
            "limitations": list(primary.get("limitations") or []),
            "artifacts": artifacts,
            "experiment_count": len(experiment_ids),
            "experiment_ids": experiment_ids,
            "claim_ids": claim_ids,
            "corpus_version": self.corpus_version,
        }

    def citation(self, source_id: str, locator: str) -> dict[str, Any]:
        artifacts = self.sources_by_id.get(source_id) or []
        artifact = next(
            (item for item in artifacts if item.get("role") == "experiment_table"),
            artifacts[0] if artifacts else {},
        )
        return {
            "source_id": source_id,
            "title": artifact.get("source_title") or source_id,
            "locator": locator,
            "url": artifact.get("source_url") or "https://psi.nasa.gov/",
            "doi": artifact.get("doi"),
        }

    def dedupe_citations(self, citations: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[tuple[str, str]] = set()
        result: list[dict[str, Any]] = []
        for citation in citations:
            key = (str(citation.get("source_id")), str(citation.get("locator")))
            if key in seen:
                continue
            seen.add(key)
            result.append(citation)
        return result

    def locator_for(self, record: dict[str, Any]) -> str:
        return str(record.get("source_locator") or f"{record.get('source_id')} experimental table")

    # ------------------------------------------------------------------ #
    # coverage
    # ------------------------------------------------------------------ #
    def coverage(self) -> dict[str, Any]:
        family_counts: dict[str, int] = {}
        status_counts: dict[str, int] = {}
        for record in self.records:
            family = str(record.get("family") or "unknown")
            family_counts[family] = family_counts.get(family, 0) + 1
            status = str(record.get("validation_status") or "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1

        field_coverage: dict[str, dict[str, Any]] = {}
        all_fields: set[str] = set()
        for record in self.records:
            all_fields.update(self.record_fields(record).keys())
        for field in sorted(all_fields):
            reported = 0
            missing = 0
            per_test_measured = 0
            context_only = 0
            statuses: dict[str, int] = {}
            units: set[str] = set()
            for record in self.records:
                payload = self.record_fields(record).get(field)
                if payload is None:
                    missing += 1
                    continue
                status = policy.status_of(payload)
                statuses[status] = statuses.get(status, 0) + 1
                if payload.get("unit"):
                    units.add(str(payload["unit"]))
                if policy.has_value(payload):
                    reported += 1
                    context = status == "investigation_level" or payload.get("basis") == "investigation_level"
                    context_only += int(context)
                    per_test_measured += int(not context and status in {"measured", "corrected"})
                else:
                    missing += 1
            field_coverage[field] = {
                "label": self.field_label(field),
                "reported": reported,
                "missing": missing,
                "per_test_measured": per_test_measured,
                "context_only": context_only,
                "statuses": statuses,
                "units": sorted(units),
            }

        recomputed = {
            "oxygen_initial_reported": field_coverage.get("oxygen_initial_pct", {}).get(
                "reported", 0
            ),
            "oxygen_final_reported": field_coverage.get("oxygen_final_pct", {}).get(
                "reported", 0
            ),
            "pressure_reported": field_coverage.get("total_pressure_psia", {}).get(
                "reported", 0
            ),
            "flow_reported": field_coverage.get("flow_initial_cm_s", {}).get("reported", 0),
            "gravity_per_record_reported": field_coverage.get("gravity_regime", {})
            .get("statuses", {})
            .get("measured", 0),
            "standardized_outcome_reported": sum(
                1
                for record in self.records
                if policy.status_of(self.record_fields(record).get("outcome"))
                in {"measured", "corrected", "derived"}
            ),
            "partial_gravity_records": sum(
                1
                for record in self.records
                if "partial" in str(
                    (self.record_fields(record).get("gravity_regime") or {}).get("value") or ""
                ).lower()
            ),
        }
        declared = dict(self.meta.get("coverage") or {})
        return {
            "corpus_version": self.corpus_version,
            "policy_version": policy.POLICY_VERSION,
            "record_count": len(self.records),
            "experiment_record_count": len(self.records),
            "family_counts": family_counts,
            "validation_status_counts": status_counts,
            "field_coverage": field_coverage,
            "recomputed": recomputed,
            "declared_in_meta": declared,
            "declared_matches_recomputed": {
                key: declared.get(key) == value
                for key, value in recomputed.items()
                if key in declared
            },
            "claim_count": len(self.claims),
            "source_count": len(self.sources_by_id),
            "null_semantics": (
                "null means the curated value is absent; it is never zero and never imputed"
            ),
            "gaps": list(self.limitations),
        }

    # ------------------------------------------------------------------ #
    # queries used by the assistant
    # ------------------------------------------------------------------ #
    def values_for(self, field: str) -> list[tuple[dict[str, Any], Any]]:
        pairs: list[tuple[dict[str, Any], Any]] = []
        for record in self.records:
            payload = self.record_fields(record).get(field)
            if policy.has_value(payload) and policy.is_number(policy.value_of(payload)):
                pairs.append((record, policy.value_of(payload)))
        return pairs

    def records_with_flag(self, flag: str) -> list[dict[str, Any]]:
        return [
            record
            for record in self.records
            if flag in [str(item) for item in (record.get("quality_flags") or [])]
        ]

    def unresolved_references(self) -> list[str]:
        """Every source_id referenced anywhere that does not resolve."""
        problems: list[str] = []
        known = set(self.sources_by_id)
        for record in self.records:
            source_id = str(record.get("source_id"))
            if source_id not in known:
                problems.append(f"record {record.get('experiment_id')} -> {source_id}")
        for claim in self.claims:
            for source_id in claim.get("supporting_source_ids") or []:
                if str(source_id) not in known:
                    problems.append(f"claim {claim.get('claim_id')} -> {source_id}")
        return problems


def _brief_value(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    return {
        "value": payload.get("value"),
        "unit": payload.get("unit"),
        "status": payload.get("status"),
    }


def build_fts_index(
    conn: sqlite3.Connection,
    records: Iterable[dict[str, Any]],
    claims: Iterable[dict[str, Any]],
    sources: Iterable[dict[str, Any]],
    investigations: Iterable[dict[str, Any]] = (),
) -> None:
    """(Re)build the FTS5 table. Shared by the loader and build_index.py."""
    records, claims, sources = list(records), list(claims), list(sources)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("DROP TABLE IF EXISTS evidence_fts")
    conn.execute(
        "CREATE VIRTUAL TABLE evidence_fts USING fts5("
        "kind UNINDEXED, ref_id UNINDEXED, text, tokenize='unicode61')"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
    rows: list[tuple[str, str, str]] = []
    for record in records:
        fields = value_fields(record)
        parts = [
            str(record.get("experiment_id") or ""),
            str(record.get("test_number") or ""),
            str(record.get("sample_number") or ""),
            str(record.get("family") or ""),
            str(record.get("investigation") or ""),
            str(record.get("investigation_acronym") or ""),
            str(record.get("material_raw") or ""),
            str(record.get("material_family") or ""),
            str(record.get("material_species") or ""),
            str(record.get("geometry") or ""),
            str(record.get("source_id") or ""),
        ]
        for field, payload in fields.items():
            if field in ("gravity_regime", "hardware", "flow_direction", "outcome"):
                value = payload.get("value")
                if value is not None:
                    parts.append(str(value))
        rows.append(("record", str(record.get("experiment_id")), " ".join(parts)))
    for claim in claims:
        rows.append(
            (
                "claim",
                str(claim.get("claim_id")),
                " ".join(
                    [
                        str(claim.get("claim_text") or ""),
                        str(claim.get("claim_type") or ""),
                        " ".join(str(item) for item in claim.get("supporting_source_ids") or []),
                    ]
                ),
            )
        )
    for source in sources:
        rows.append(
            (
                "source",
                str(source.get("source_id")),
                " ".join(
                    [
                        str(source.get("source_id") or ""),
                        str(source.get("source_title") or ""),
                        str(source.get("role") or ""),
                        " ".join(str(item) for item in source.get("limitations") or []),
                    ]
                ),
            )
        )
    conn.executemany("INSERT INTO evidence_fts (kind, ref_id, text) VALUES (?, ?, ?)", rows)
    conn.execute(
        "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('row_count', ?)",
        (str(len(rows)),),
    )
    conn.commit()
    write_snapshot(conn, records, claims, sources, investigations)


_store: Optional[EvidenceStore] = None
_store_lock = threading.Lock()


def get_store() -> EvidenceStore:
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = EvidenceStore()
    return _store


def reset_store() -> None:
    """Test hook: drop the cached store so the next call reloads from disk."""
    global _store
    with _store_lock:
        if _store is not None:
            _store.close()
        _store = None
