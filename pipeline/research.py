"""Deterministic, offline publication of reviewed report findings, separate from test rows.

Optional --verify-pdfs DIR checks original PDF hashes and exact page anchors using pypdf.
No network access, LLM extraction, source modification, or legacy corpus publication.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"methodology", "report_aggregate", "qualitative_observation", "research_limitation"}
UNITS = {"% O2", "kJ/g O2", "W", "kPa", "atm", "K", "tests", "µm"}
STATUSES = {"method_specification", "calculation_constant", "qualified_aggregate",
            "reported_range_bound", "calculation_assumption", "report_scope", "method_uncertainty"}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def unique(items, label):
    ids = [item["id"] for item in items]
    if len(set(ids)) != len(ids):
        raise ValueError(f"Duplicate {label} IDs")
    return {item["id"]: item for item in items}


def validate(data, root=ROOT):
    if data["schema_version"] != "firetrace.research/1":
        raise ValueError("Unsupported research schema")
    investigations = unique(data["investigations"], "investigation")
    sources = unique(data["sources"], "source")
    unique(data["findings"], "finding")
    for investigation in investigations.values():
        metadata = sources.get(investigation["metadata_source_id"])
        if not metadata or metadata["investigation_id"] != investigation["id"] or not investigation["metadata_locator"]:
            raise ValueError("Invalid investigation metadata source")
    for source in sources.values():
        if source["investigation_id"] not in investigations:
            raise ValueError("Invalid source investigation")
        for key in ("url", "download_url"):
            if not source[key].startswith(("https://psi.nasa.gov/", "https://ntrs.nasa.gov/")):
                raise ValueError("Non-NASA source URL")
        if len(source["sha256"]) != 64 or not source["license"]:
            raise ValueError("Missing source provenance")
        if source["local_path"]:
            path = (root / source["local_path"]).resolve()
            if not path.is_relative_to(root.resolve()):
                raise ValueError("Source path escapes repository")
            if sha(path.read_bytes()) != source["sha256"]:
                raise ValueError(f"Changed source: {source['id']}")
    for acquisition in data["acquisitions"]:
        path = (root / acquisition["path"]).resolve()
        if not path.is_relative_to(root.resolve()) or sha(path.read_bytes()) != acquisition["sha256"]:
            raise ValueError("Acquisition hash mismatch")
    for finding in data["findings"]:
        source = sources.get(finding["source_id"])
        if not source or source["kind"] != "research_report":
            raise ValueError("Invalid finding source")
        if finding["investigation_id"] != source["investigation_id"]:
            raise ValueError("Wrong report-to-investigation association")
        locator = finding["locator"]
        if not locator["section"] or not locator["printed_page"] or not isinstance(locator["pdf_page"], int) or locator["pdf_page"] < 1:
            raise ValueError("Missing source locator")
        if finding["finding_type"] not in KINDS or not finding["summary"] or not finding["limitations"]:
            raise ValueError("Invalid finding classification or limitations")
        if finding["experiment_ids"]:
            raise ValueError("No report-to-test mappings verified in research-1.0")
        if not finding["content_origin"].startswith("FIRETRACE-authored paraphrase"):
            raise ValueError("Summary must not impersonate source text")
        if not finding["verification"]["anchor"] or len(finding["verification"]["page_text_sha256"]) != 64:
            raise ValueError("Missing verification anchor")
        if finding["quantitative"] != bool(finding["quantities"]):
            raise ValueError("Quantitative classification mismatch")
        for quantity in finding["quantities"]:
            if quantity["unit"] not in UNITS or quantity["status"] not in STATUSES:
                raise ValueError("Unsupported report unit/status")
            if not quantity["raw"] or not quantity["qualifier"]:
                raise ValueError("Unqualified report quantity")
            value = quantity["value"]
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)):
                raise ValueError("Nonfinite or ambiguous numeric value")
    metadata = read(root / "data/research/raw/PSI-69-metadata.json")
    if (metadata["accession"], metadata["doi"], metadata["investigationAcronym"]) != ("PSI-69", "10.60555/mbq8-0451", "FLEX"):
        raise ValueError("FLEX metadata identity mismatch")
    for filename, identifier in [("BASS-ntrs-metadata.json", "20210011385"), ("FLEX-ntrs-metadata.json", "20150023456")]:
        if str(read(root / "data/research/raw" / filename)["id"]) != identifier:
            raise ValueError("NTRS metadata identity mismatch")


def verify_pdfs(data, directory):
    from importlib.metadata import version
    if version('pypdf') != '6.14.2':
        raise ValueError('Exact page-text fingerprints require pypdf==6.14.2; install pipeline/requirements-audit.txt. Original PDF hash checks and scientific values are unchanged.')
    from pypdf import PdfReader
    for source in data["sources"]:
        if source["kind"] != "research_report":
            continue
        path = directory / source["cache_filename"]
        if sha(path.read_bytes()) != source["sha256"]:
            raise ValueError(f"Changed PDF: {source['id']}")
        pages = PdfReader(path).pages
        for finding in data["findings"]:
            if finding["source_id"] != source["id"]:
                continue
            text = " ".join(pages[finding["locator"]["pdf_page"] - 1].extract_text().split())
            if sha(text.encode()) != finding["verification"]["page_text_sha256"] or " ".join(finding["verification"]["anchor"].split()).lower() not in text.lower():
                raise ValueError(f"Page verification failed: {finding['id']}")


def compile_research(data, root=ROOT):
    validate(data, root)
    result = copy.deepcopy(data)
    original = (root / "src/data/corpus.json").read_bytes()
    records = json.loads(original)["records"]
    # Data identity excludes wall clock and output paths; fixed acquisition metadata is an input.
    result["dataset_version"] = sha(json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode())
    result["base_corpus_sha256"] = sha(original)
    per_investigation = []
    for inv in result["investigations"]:
        rows = [r for r in records if r["source_id"] == inv["id"]]
        fields = {}
        for field in ["oxygen_initial_pct", "flow_initial_cm_s", "total_pressure_psia", "gravity_regime", "outcome"]:
            available = [r[field] for r in rows if r[field]["value"] is not None]
            fields[field] = {"available": len(available), "total": len(rows),
                             "statuses": dict(sorted(Counter(v["status"] for v in available).items()))}
        per_investigation.append({**inv, "structured_records": len(rows), "report_findings": sum(f["investigation_id"] == inv["id"] for f in result["findings"]),
                                  "linked_sources": sum(s["investigation_id"] == inv["id"] for s in result["sources"]), "fields": fields,
                                  "droplet_measurements": "not_normalized" if inv["combustion_type"] == "liquid_droplet" else "not_applicable"})
    # Preserved NASA CSV contains Windows-1252 en dash (0x96); never rewrite the original.
    with open(root / "data/research/raw/PSI-69-experimental.csv", newline="", encoding="cp1252") as f:
        csv_rows = list(csv.DictReader(f))
    if len({r["FLEX Test #"] for r in csv_rows}) != len(csv_rows) or any(None in r for r in csv_rows):
        raise ValueError("Malformed or duplicate FLEX source rows")
    coverage = {"schema_version": data["schema_version"], "dataset_version": result["dataset_version"], "base_corpus_sha256": result["base_corpus_sha256"],
                "verified_at": data["verified_at"], "investigations": per_investigation,
                "counts": {"investigations": len(per_investigation), "structured_records": len(records), "new_structured_records": 0,
                           "report_findings": len(result["findings"]), "linked_sources": len(result["sources"]),
                           "research_reports": sum(s["kind"] == "research_report" for s in result["sources"]),
                           "findings_with_locators": sum(bool(f["locator"]["section"]) for f in result["findings"])},
                "deferred_source_rows": len(csv_rows), "limitations": result["limitations"]}
    report = {"pipeline_version": data["pipeline_version"], "dataset_version": result["dataset_version"], "base_corpus_sha256": result["base_corpus_sha256"],
              "counts": coverage["counts"], "source_documents_processed": [s["id"] for s in result["sources"]],
              "unresolved": [{"source_id": "PSI-69-TABLE", "source_rows": len(csv_rows), "imported_records": 0,
                              "reason": "Burning-rate unit and source-version discrepancies unresolved; see documentation."}],
              "missing": {"per_record_pressure": sum(r["total_pressure_psia"]["value"] is None for r in records),
                          "per_test_measured_gravity": sum(r["gravity_regime"]["status"] != "measured" for r in records),
                          "report_to_test_links": "not_verified"},
              "checks": ["unique IDs", "source hashes", "NASA source identifiers", "report associations", "locators", "unit/status vocabulary", "no test-level promotion"],
              "warnings": result["limitations"]}
    return result, coverage, report


def publish(output=ROOT, pdf_directory=None):
    data = read(ROOT / "data/research/curation.json")
    if pdf_directory is not None:
        verify_pdfs(data, pdf_directory)
    result, coverage, report = compile_research(data)
    for relative, obj in [("public/data/research.json", result), ("src/data/research_coverage.json", coverage),
                          ("public/data/research_coverage.json", coverage), ("data/research/validation_report.json", report)]:
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((json.dumps(obj, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode())
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--verify-pdfs", type=Path)
    args = parser.parse_args()
    print(json.dumps(publish(args.output_root, args.verify_pdfs), indent=2, ensure_ascii=True))
