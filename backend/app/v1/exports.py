"""Deterministic exports.

Every export is generated from the curated store — no template value, no
placeholder, no estimated number. CSV cells for absent values stay empty and the
adjacent status column says why; an empty cell is never a zero.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any, Optional

from app.v1 import policy
from app.v1.assistant import answer as build_answer
from app.v1.store import EvidenceStore

VALUE_FIELD_ORDER: tuple[str, ...] = (
    "oxygen_initial_pct",
    "oxygen_final_pct",
    "oxygen_partial_pressure_psi",
    "total_pressure_psia",
    "flow_initial_cm_s",
    "flow_derived_cm_s",
    "flow_direction",
    "gravity_regime",
    "material_species",
    "geometry",
    "thickness_mm",
    "width_cm",
    "length_cm",
    "diameter_mm",
    "ignition_method",
    "ignition_power_w",
    "ignition_time_s",
    "burn_time_s",
    "outcome",
    "co2_initial_pct",
    "co2_final_pct",
    "co_initial_ppm",
    "co_final_ppm",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def spreadsheet_value(value: Any) -> Any:
    """Escape untrusted formula-like text without changing numeric zero/negatives."""
    if isinstance(value, str) and re.match(r"^[\s\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]*[=+\-@]", value):
        return "'" + value
    return value


def _cell_text(payload: Optional[dict[str, Any]]) -> tuple[Any, str, str]:
    if not isinstance(payload, dict):
        return "", "", "not_extracted"
    value = payload.get("value")
    rendered = "" if value is None else value
    return rendered, str(payload.get("unit") or ""), str(payload.get("status") or "not_extracted")


def records_csv(store: EvidenceStore, records: list[dict[str, Any]]) -> tuple[str, int]:
    buffer = io.StringIO()
    fieldnames = [
        "experiment_id",
        "test_number",
        "sample_number",
        "family",
        "investigation",
        "material_raw",
        "material_family",
        "material_species",
        "geometry",
        "validation_status",
        "source_id",
        "source_locator",
    ]
    for field in VALUE_FIELD_ORDER:
        fieldnames.extend([f"{field}_value", f"{field}_unit", f"{field}_status"])

    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for record in records:
        values = store.record_fields(record)
        row: dict[str, Any] = {
            "experiment_id": record.get("experiment_id"),
            "test_number": record.get("test_number"),
            "sample_number": record.get("sample_number"),
            "family": record.get("family"),
            "investigation": record.get("investigation"),
            "material_raw": record.get("material_raw"),
            "material_family": record.get("material_family"),
            "material_species": record.get("material_species"),
            "geometry": record.get("geometry"),
            "validation_status": record.get("validation_status"),
            "source_id": record.get("source_id"),
            "source_locator": record.get("source_locator"),
        }
        for field in VALUE_FIELD_ORDER:
            value, unit, status = _cell_text(values.get(field))
            row[f"{field}_value"] = value
            row[f"{field}_unit"] = unit
            row[f"{field}_status"] = status
        writer.writerow({key: spreadsheet_value(value) for key, value in row.items()})
    return buffer.getvalue(), len(records)


def claims_csv(store: EvidenceStore) -> tuple[str, int]:
    buffer = io.StringIO()
    fieldnames = [
        "claim_id",
        "claim_text",
        "claim_type",
        "supporting_source_ids",
        "supporting_locators",
        "limitation",
        "validation_status",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for claim in store.claims:
        writer.writerow(
            {key: spreadsheet_value(value) for key, value in {
                "claim_id": claim.get("claim_id"),
                "claim_text": claim.get("claim_text"),
                "claim_type": claim.get("claim_type"),
                "supporting_source_ids": "|".join(claim.get("supporting_source_ids") or []),
                "supporting_locators": "|".join(claim.get("supporting_locators") or []),
                "limitation": claim.get("limitation"),
                "validation_status": claim.get("validation_status"),
            }.items()}
        )
    return buffer.getvalue(), len(store.claims)


def evidence_brief(
    store: EvidenceStore,
    *,
    ids: Optional[list[str]] = None,
    question: Optional[str] = None,
    family: Optional[str] = None,
) -> tuple[str, int]:
    lines: list[str] = []
    lines.append("# FIRETRACE evidence brief")
    lines.append("")
    lines.append(f"- corpus_version: `{store.corpus_version}`")
    lines.append(f"- generated_at: `{_now()}`")
    lines.append(f"- policy_version: `{policy.POLICY_VERSION}`")
    lines.append(
        "- scope: research-evidence support only. Not NASA certification, not a "
        "universal fire-risk predictor, not emergency guidance."
    )
    lines.append("")

    rows = 0
    if question:
        result = build_answer(store, question)
        lines.append("## Answer")
        lines.append("")
        lines.append(f"**Grade:** `{result['grade']}`")
        lines.append("")
        lines.append(f"**Headline:** {result['headline']}")
        lines.append("")
        if result["claims"]:
            lines.append("### Claims")
            lines.append("")
            for claim in result["claims"]:
                lines.append(
                    f"- {claim['text']}  \n  `{claim['source_id']}` — {claim['locator']}"
                )
            lines.append("")
            rows += len(result["claims"])
        if result["paragraphs"]:
            lines.append("### Notes")
            lines.append("")
            for paragraph in result["paragraphs"]:
                lines.append(f"- {paragraph}")
            lines.append("")
        if result["citations"]:
            lines.append("### Sources")
            lines.append("")
            for citation in result["citations"]:
                lines.append(
                    f"- `{citation['source_id']}` — {citation['title']} — {citation['locator']} — {citation['url']}"
                )
            lines.append("")

    if ids:
        lines.append("## Records")
        lines.append("")
        for raw_id in ids:
            record = store.resolve_record(raw_id)
            if record is None:
                lines.append(f"- `{raw_id}`: not in the curated corpus (no fabricated record).")
                continue
            rows += 1
            lines.append(f"### {store.record_id(record)}")
            lines.append("")
            lines.append(f"- source: `{record.get('source_id')}` — {store.locator_for(record)}")
            lines.append(f"- validation_status: `{record.get('validation_status')}`")
            lines.append(f"- material: {record.get('material_raw')}")
            lines.append("")
            lines.append("| field | value | unit | status |")
            lines.append("| --- | --- | --- | --- |")
            for field, payload in store.record_fields(record).items():
                if field not in VALUE_FIELD_ORDER:
                    continue
                value, unit, status = _cell_text(payload)
                lines.append(
                    f"| {store.field_label(field)} | {value or '—'} | {unit or '—'} | `{status}` |"
                )
            lines.append("")

    if not ids and not question:
        coverage = store.coverage()
        lines.append("## Coverage")
        lines.append("")
        lines.append("| field | reported | missing |")
        lines.append("| --- | ---: | ---: |")
        for field, summary in coverage["field_coverage"].items():
            lines.append(
                f"| {summary['label']} | {summary['reported']} | {summary['missing']} |"
            )
        rows += len(coverage["field_coverage"])

    if family:
        members = [
            record for record in store.records if str(record.get("family") or "").lower() == family.lower()
        ]
        lines.append("")
        lines.append(f"## Family filter: {family}")
        lines.append("")
        lines.append(f"Records matched: {len(members)}")
        rows += len(members)

    lines.append("")
    lines.append("## Null discipline")
    lines.append("")
    lines.append(
        "An empty value means the curated source does not report it. It is never zero, never "
        "imputed and never turned into a score. The status column records why the value is absent."
    )
    lines.append("")
    return "\n".join(lines), rows


def export(
    store: EvidenceStore,
    *,
    kind: str,
    ids: Optional[list[str]] = None,
    question: Optional[str] = None,
    family: Optional[str] = None,
    limit: int = 200,
) -> dict[str, Any]:
    if kind == "records_csv":
        records = store.records
        if family:
            records = [
                record
                for record in records
                if str(record.get("family") or "").lower() == family.lower()
            ]
        if ids:
            wanted: set[str] = set()
            for item in ids:
                record = store.resolve_record(item)
                if record is not None:
                    wanted.add(str(record.get("experiment_id")))
            records = [
                record
                for record in records
                if str(record.get("experiment_id")) in wanted
            ]
        records = records[:limit]
        content, rows = records_csv(store, records)
        return {
            "corpus_version": store.corpus_version,
            "kind": kind,
            "content_type": "text/csv; charset=utf-8",
            "filename": f"firetrace-records-{store.corpus_version[:12]}.csv",
            "content": content,
            "row_count": rows,
            "generated_at": _now(),
        }
    if kind == "claims_csv":
        content, rows = claims_csv(store)
        return {
            "corpus_version": store.corpus_version,
            "kind": kind,
            "content_type": "text/csv; charset=utf-8",
            "filename": f"firetrace-claims-{store.corpus_version[:12]}.csv",
            "content": content,
            "row_count": rows,
            "generated_at": _now(),
        }
    content, rows = evidence_brief(store, ids=ids, question=question, family=family)
    return {
        "corpus_version": store.corpus_version,
        "kind": "evidence_brief",
        "content_type": "text/markdown; charset=utf-8",
        "filename": f"firetrace-evidence-brief-{store.corpus_version[:12]}.md",
        "content": content,
        "row_count": rows,
        "generated_at": _now(),
    }
