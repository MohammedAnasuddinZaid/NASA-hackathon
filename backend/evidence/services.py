from collections import Counter
import hashlib
import json
from fastapi import HTTPException
from .store import metadata

SCOPE = "Coverage describes the imported record layer, not all NASA combustion research. Research support only; no fire prediction, certification or NASA endorsement."


def all_records(conn):
    return [json.loads(row[0]) for row in conn.execute("SELECT payload FROM experiments ORDER BY sort_id")]


def record(conn, identifier):
    row = conn.execute("SELECT payload FROM experiments WHERE experiment_id=?", (identifier,)).fetchone()
    if row is None:
        raise HTTPException(404, "Experiment not found")
    return json.loads(row[0])


def search(conn, query):
    where, args = [], []
    # Exact test or full ID takes precedence, matching the existing Atlas behavior.
    exact = conn.execute("SELECT experiment_id FROM experiments WHERE lower(experiment_id)=? OR lower(json_extract(payload,'$.test_number'))=?", (query.q.strip().lower(), query.q.strip().lower())).fetchall() if query.q.strip() else []
    if exact:
        where.append("experiment_id IN (" + ",".join("?" for _ in exact) + ")")
        args.extend(row[0] for row in exact)
    for term in query.q.lower().split():
        where.append("instr(search_text,?)>0")
        args.append(term)
    for field, value in (("family", query.investigation), ("material", query.material), ("quality", query.quality), ("experiment_id", query.experiment_id), ("source_id", query.source_id)):
        if value is not None:
            where.append(field + "=?")
            args.append(value)
    for column, low, high in (("oxygen", query.o2_min, query.o2_max), ("flow", query.flow_min, query.flow_max)):
        if low is not None:
            where.append(column + ">=?")
            args.append(low)
        if high is not None:
            where.append(column + "<=?")
            args.append(high)
    if query.flow_only:
        where.append("flow IS NOT NULL")
    clause = " WHERE " + " AND ".join(where) if where else ""
    order = {"id": "sort_id", "o2-asc": "oxygen IS NULL,oxygen,sort_id", "o2-desc": "oxygen IS NULL,oxygen DESC,sort_id", "material": "material,sort_id", "date": "date,sort_id"}[query.sort]
    total = conn.execute("SELECT count(*) FROM experiments" + clause, args).fetchone()[0]
    rows = conn.execute("SELECT payload FROM experiments" + clause + " ORDER BY " + order + " LIMIT ? OFFSET ?", [*args, query.limit, query.offset])
    return {"items": [json.loads(row[0]) for row in rows], "total": total, "limit": query.limit, "offset": query.offset, "dataset_id": metadata(conn)[0]}


def coverage(conn):
    records = all_records(conn)
    fields = {}
    keys = sorted({key for r in records for key, v in r.items() if isinstance(v, dict) and "value" in v and "status" in v})
    for key in keys:
        values = [r.get(key, {"value": None, "status": "not_reported"}) for r in records]
        fields[key] = {"available": sum(v["value"] is not None for v in values), "missing": sum(v["value"] is None for v in values), "per_test_measured": sum(v["value"] is not None and v["status"] in {"measured", "corrected"} and v.get("basis") != "investigation_level" for v in values), "context_only": sum(v["value"] is not None and (v["status"] == "investigation_level" or v.get("basis") == "investigation_level") for v in values), "statuses": dict(Counter(v["status"] for v in values)), "units": sorted({v.get("unit") for v in values if v.get("unit")})}
    return {"total": len(records), "investigations": dict(Counter(r["family"] for r in records)), "quality": dict(Counter(r["validation_status"] for r in records)), "fields": fields, "source_coverage": dict(Counter(r["source_id"] for r in records)), "limitations": [SCOPE, "Status labels and unit metadata are preserved from the current pipeline; extraction validation does not certify scientific correctness."], "dataset_id": metadata(conn)[0]}


def sources(conn, settings, source_id=None):
    rows = conn.execute("SELECT * FROM sources" + (" WHERE source_id=?" if source_id else "") + " ORDER BY artifact_id", (source_id,) if source_id else ())
    result = []
    for row in rows:
        item = json.loads(row["payload"])
        available = False
        # Registry comes exclusively from imported manifest. Only CC0 originals are served.
        if row["filename"] and "cc0" in (item.get("license_url") or "").lower():
            path = (settings.raw_dir / row["filename"]).resolve()
            available = path.is_relative_to(settings.raw_dir.resolve()) and path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"]
        result.append({**item, "artifact_id": row["artifact_id"], "download_available": available, "download_url": f"/api/v1/sources/{row['source_id']}/download?artifact_id={row['artifact_id']}&dataset_id={metadata(conn)[0]}" if available else None})
    return result


def compare(conn, identifiers):
    selected = [record(conn, identifier) for identifier in identifiers]
    checks = []
    def check(key, label, values, context=False):
        known = [v for v in values if v is not None]
        distinct = {json.dumps(v, sort_keys=True) for v in known}
        state = "blocked" if len(distinct) > 1 else "unknown" if not known else "partial" if len(known) < len(values) or context else "shared"
        checks.append({"id": key, "label": label, "state": state, "detail": f"{len(known)}/{len(values)} records have comparable-level values; {len(distinct)} distinct values. " + ("Investigation context or instrument settings do not establish equivalent test conditions." if context else "Missing values do not establish a match.")})
    for key, label in (("family", "Investigation context"), ("material_family", "Material family"), ("material_raw", "Material specification"), ("geometry", "Geometry"), ("measurement_method", "Test method")):
        check(key, label, [None if r.get(key) in (None, "Unknown", "") else r[key] for r in selected])
    for key, label in (("thickness_mm", "Thickness"), ("width_cm", "Width"), ("length_cm", "Length"), ("diameter_mm", "Diameter"), ("oxygen_initial_pct", "Oxygen"), ("total_pressure_psia", "Total pressure"), ("flow_direction", "Flow direction"), ("ignition_method", "Ignition method"), ("gravity_regime", "Per-test gravity"), ("outcome", "Standardized outcome")):
        check(key, label, [None if r[key].get("basis") == "investigation_level" or r[key]["status"] == "investigation_level" else {"value": r[key]["value"], "unit": r[key]["unit"]} if r[key]["value"] is not None else None for r in selected])
    check("flow", "Flow basis and scale", [{"value": r["flow_initial_cm_s"]["value"], "basis": r["flow_initial_cm_s"].get("basis"), "family": r["family"]} if r["flow_initial_cm_s"]["value"] is not None else None for r in selected], context=True)
    return {"records": selected, "checks": checks, "different_conditions": [x["id"] for x in checks if x["state"] == "blocked"], "missing_measurements": {r["experiment_id"]: [k for k, v in r.items() if isinstance(v, dict) and "value" in v and v["value"] is None] for r in selected}, "citations": [{"source_id": r["source_id"], "locator": r["source_locator"]} for r in selected], "limitations": [SCOPE, "No direct safety conclusion follows from shared values. Dimensions, hardware, atmosphere, airflow, scale and test method must be reviewed together.", "No standardized outcomes or measured per-test gravity are supplied in these imported tables."], "dataset_id": metadata(conn)[0]}
