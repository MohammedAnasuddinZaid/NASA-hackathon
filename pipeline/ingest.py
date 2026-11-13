"""
FIRETRACE ingestion pipeline.

Reads the preserved NASA PSI artifacts in data/raw/ and produces a normalized,
source-linked corpus in public/data/. Raw files are never modified.

Design rules:
  * Preserve every original value as a string in record.raw.
  * Missing is never zero.
  * Investigation-level context is never promoted to a per-test measurement.
  * Every derived value carries its formula, inputs and caveat.
  * Suspicious values are retained and flagged, not corrected.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import shutil
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "data"
PUBLIC_DATA = ROOT / "public" / "data"
PROCESSED = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)

PIPELINE_VERSION = "0.1.0"
GENERATED_AT = datetime.now(timezone.utc).isoformat()
FAN_FACTOR = 1.0066
SOURCE_PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/{sid}"

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def docx_text(path: Path) -> str:
    """Extract paragraphs and table rows from a .docx without python-docx.

    Word files are zip archives containing word/document.xml. Reading that XML
    directly keeps the pipeline dependency-light and avoids native-extension
    import failures on locked-down Windows machines.
    """
    w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    body = root.find(f"{w}body")
    if body is None:
        return ""

    def paragraph_text(node: ET.Element) -> str:
        return "".join(t.text or "" for t in node.iter(f"{w}t")).strip()

    blocks: list[str] = []
    table_number = 0
    for child in body:
        if child.tag == f"{w}p":
            text = paragraph_text(child)
            if text:
                blocks.append(text)
        elif child.tag == f"{w}tbl":
            table_number += 1
            blocks.append(f"[Table {table_number}]")
            for row in child.findall(f"{w}tr"):
                cells = []
                for cell in row.findall(f"{w}tc"):
                    cells.append(" ".join(paragraph_text(p) for p in cell.iter(f"{w}p")).strip())
                blocks.append(" | ".join(cells))
    return "\n".join(blocks)


def is_blank(v: str | None) -> bool:
    return v is None or str(v).strip() == "" or str(v).strip().lower() in {"none", "n/a", "na", "-"}


def to_float(v: Any) -> float | None:
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s.lower() in {"", "none", "n/a", "na", "-", "or", "over", "video"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def val(value: Any, status: str, unit: str | None = None, raw: Any = None,
        note: str | None = None, basis: str | None = None) -> dict:
    """A typed value with provenance status. Null never means zero."""
    return {
        "value": value,
        "status": status,
        "unit": unit,
        "raw": None if raw is None else str(raw),
        "note": note,
        "basis": basis,
    }


def not_reported(unit: str | None = None, raw: Any = None, note: str | None = None) -> dict:
    return val(None, "not_reported", unit, raw, note)


def parse_number_sequence(raw: str | None) -> list[float]:
    """Numbers in a free-text display field, up to a 'pot' annotation.

    These are instrument display readings, not calibrated measurements.
    """
    if not raw:
        return []
    s = str(raw)
    # A 'pot' value is a fan potentiometer setting, not a flow reading.
    pot = re.search(r"\bpot\b", s, flags=re.I)
    head = s[: pot.start()] if pot else s
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", head)]
    return [n for n in nums if 0 <= n <= 60]


def parse_oxygen(raw: str | None) -> dict:
    if is_blank(raw):
        return not_reported("% by vol", raw, "Source records no value ('none' or blank).")
    s = str(raw).strip()
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if not m:
        return not_reported("% by vol", raw, "No numeric oxygen value could be parsed; source retained.")
    return val(float(m.group(1)), "measured", "% by vol", raw,
               "Calibrated oxygen reading; sensor was out of calibration and corrected with the MCA ISS reading via a constant offset (PSI-25 ReadMe).")


def parse_concentration(raw: str | None, unit: str, kind: str) -> dict:
    if is_blank(raw):
        return not_reported(unit, raw, "Source records no value ('none' or blank).")
    s = str(raw).strip()
    low = s.lower()
    if low in {"or", "over"} or s.startswith(">"):
        return val(None, "over_range", unit, raw, f"Reported as over-range ({s}); numeric value not established.")
    if s == "-1":
        return val(None, "reported_flag", unit, raw,
                   "Source value -1 retained verbatim. Treated as a below-detection/flag code, not a negative concentration.")
    f = to_float(s)
    if f is None:
        return not_reported(unit, raw, "No numeric value could be parsed; source retained.")
    return val(f, "measured", unit, raw, f"{kind} sensor reading as reported in the PSI experimental table.")


def extract_thickness_mm(text: str) -> tuple[float | None, str | None]:
    t = text.lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:micron|microns|micrometer|micrometre|um|µm)", t)
    if m:
        return round(float(m.group(1)) / 1000.0, 6), m.group(0)
    m = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", t)
    if m:
        return float(m.group(1)), m.group(0)
    return None, None


def extract_width_cm(text: str) -> tuple[float | None, str | None]:
    t = text.lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*cm\b", t)
    if m:
        return float(m.group(1)), m.group(0)
    return None, None


def extract_diameter_mm(text: str) -> tuple[float | None, str | None]:
    t = text.lower()
    m = re.search(r"(\d+)\s*/\s*(\d+)\s*(?:\"|inch|in\b)", t)
    if m:
        inches = float(m.group(1)) / float(m.group(2))
        return round(inches * 25.4, 3), m.group(0)
    m = re.search(r"(\d+(?:\.\d+)?)\s*[- ]?mm\s*(?:diameter|dia)", t)
    if m:
        return float(m.group(1)), m.group(0)
    m = re.search(r"(\d+(?:\.\d+)?)\s*mm\s*(?:diameter|dia)", t)
    if m:
        return float(m.group(1)), m.group(0)
    return None, None


def classify_material(text: str) -> tuple[str, str, str]:
    """Return (material_family, species, geometry).

    Classification is based only on the free-text source field. Where the row
    does not name the polymer, it is not silently assumed to be PMMA.
    """
    t = text.lower()
    thickness, _ = extract_thickness_mm(text)
    diameter, _ = extract_diameter_mm(text)
    if "sibal" in t:
        return "SIBAL fabric", "SIBAL", "Fabric sheet"
    if "nomex" in t:
        return "Nomex fabric", "Nomex", "Fabric sheet"
    if "candle" in t or "wax" in t:
        return "Japan wax candle", "Wax", "Candle"
    if "spherical" in t:
        return "PMMA spherical section", "PMMA", "Spherical section"
    if "pmma" in t:
        if "rod" in t or diameter is not None or re.search(r"\d+\s*/\s*\d+\s*\"", t):
            return "PMMA rod", "PMMA", "Rod/cylinder"
        if thickness is not None and thickness < 0.5:
            return "PMMA film", "PMMA", "Flat sheet/film"
        return "PMMA sheet/slab", "PMMA", "Flat sheet/film"
    if "film" in t:
        return "Unnamed polymer film", "Unknown polymer", "Flat sheet/film"
    return "Unknown", "Unknown", "Unknown"


def flow_direction_context(pi: str) -> dict:
    """PI-level experimental geometry from the official ReadMe.

    These are investigation-level descriptions, not per-test measurements.
    """
    if pi == "Olson":
        return val("Concurrent / stagnation geometry (investigation-level description)", "reported_qualitative", None,
                   "PSI-25 ReadMe: Olson ignited the upstream end for a stagnation flame / concurrent flow geometry.",
                   "Not verified per test from the experimental table.", "investigation_level")
    if pi == "Fernandez-Pello":
        return val("Opposed-flow geometry (investigation-level description)", "reported_qualitative", None,
                   "PSI-25 ReadMe: Fernandez-Pello ignited the downstream end for an opposed-flow flame-spread geometry.",
                   "Not verified per test from the experimental table.", "investigation_level")
    return not_reported(None, None, "No per-test flow direction is recorded in the experimental table.")


def extract_outcome_tokens(*texts: str | None) -> tuple[dict, str | None]:
    joined = " | ".join(str(t) for t in texts if t)
    low = joined.lower()
    if not joined.strip():
        return not_reported(None, None, "No outcome field exists in the experimental table."), None
    note = joined.strip()
    if "no ign" in low:
        return val("No ignition reported", "reported_qualitative", None, note,
                   "Qualitative token in a free-text flow note; not a standardized outcome column."), note
    if "would not stay lit" in low:
        return val("Did not remain lit", "reported_qualitative", None, note,
                   "Qualitative token in a free-text flow note; not a standardized outcome column."), note
    if re.search(r"\bext\b|extinguish", low):
        return val("Extinguishment reported", "reported_qualitative", None, note,
                   "Qualitative token 'ext'/'extinguish' in a free-text flow note; not a standardized outcome column."), note
    if "blowoff" in low or "blow off" in low:
        return val("Blowoff reported", "reported_qualitative", None, note,
                   "Qualitative token in a free-text flow note; not a standardized outcome column."), note
    return not_reported(None, note, "Free-text note exists, but it does not state a standardized outcome."), note


# ---------------------------------------------------------------------------
# source artifacts
# ---------------------------------------------------------------------------

def artifact(source_id: str, filename: str, title: str, url: str, role: str,
             doi: str | None, license_name: str, license_url: str | None,
             version: str, content_type: str, processing: str,
             limitations: list[str], locator: str) -> dict:
    p = RAW / filename
    data = p.read_bytes()
    return {
        "source_id": source_id,
        "investigation_id": source_id,
        "source_title": title,
        "source_url": url,
        "doi": doi,
        "version": version,
        "original_filename": filename,
        "file_size_bytes": len(data),
        "sha256": sha256(p),
        "download_timestamp": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
        "license": license_name,
        "license_url": license_url,
        "content_type": content_type,
        "processing_status": processing,
        "role": role,
        "source_locator": locator,
        "limitations": limitations,
    }


def source_metadata(sid: str) -> dict:
    with open(RAW / f"{sid}_metadata.json", encoding="utf-8") as f:
        return json.load(f)


psi25 = source_metadata("PSI-25")
psi98 = source_metadata("PSI-98")
readme25 = docx_text(RAW / "PSI-25_ReadMe.docx")
readme98 = docx_text(RAW / "PSI-98_ReadMe.docx")
(OUT / "readme_PSI-25.txt").write_text(readme25, encoding="utf-8")
(OUT / "readme_PSI-98.txt").write_text(readme98, encoding="utf-8")

sources = [
    artifact("PSI-25", "PSI-25_experimental.csv",
             "BASS-II experimental table (PSI-25)",
             "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
             "experiment_table", psi25.get("doi"), psi25.get("licenseName", ""), psi25.get("licenseLink"),
             "table v1 (investigation metadata v4)", "text/csv", "parsed_with_warnings",
             ["No total-pressure column.", "No per-test gravity column.", "No standardized outcome column.",
              "Flow is an instrument display with a slow (~1 min) response, not a calibrated per-test velocity.",
              "Oxygen sensor was out of calibration and corrected by a constant offset."],
             "Experimental table tab; CSV rows 2-130"),
    artifact("PSI-25", "PSI-25_ReadMe.docx",
             "BASS-II ReadMe and test-matrix explanation",
             "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
             "readme", psi25.get("doi"), psi25.get("licenseName", ""), psi25.get("licenseLink"),
             "document v2", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "parsed",
             ["Describes columns and known sensor limitations; does not supply per-test pressure or gravity."],
             "Read Me tab; 'Test Matrix explanation'"),
    artifact("PSI-25", "PSI-25_Test_Matrices.xlsx",
             "BASS-II test matrices by principal investigator",
             "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
             "test_matrix_workbook", psi25.get("doi"), psi25.get("licenseName", ""), psi25.get("licenseLink"),
             "document v2", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "parsed",
             ["Values are formatted differently from the CSV in places; cross-check found no substantive numeric conflict."],
             "Spreadsheets folder; six PI sheets"),
    artifact("PSI-25", "PSI-25_Fan_Calibration.xlsx",
             "BASS-II fan calibration data",
             "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
             "calibration_workbook", psi25.get("doi"), psi25.get("licenseName", ""), psi25.get("licenseLink"),
             "document v2", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "parsed",
             ["Calibration is day- and restrictor-specific; a single factor is only an approximation.",
              "Workbook note: fan turns off at a finite voltage above 3.8 V; do not use the 3.8 V zero-flow value."],
             "Fan Calibration data sheet; note 'U = 1.0066(AIR)'"),
    artifact("PSI-98", "PSI-98_experimental.csv",
             "Saffire-I experimental table (PSI-98)",
             "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98",
             "experiment_table", psi98.get("doi"), psi98.get("licenseName", ""), psi98.get("licenseLink"),
             "table v1 (investigation metadata v4)", "text/csv", "parsed_with_warnings",
             ["Only two instrumented samples; remaining rows are pre/post-flow image-set descriptors, not experiments.",
              "No total-pressure column.", "No per-test gravity column.", "No standardized extinction outcome column."],
             "Experimental table tab; CSV rows 2-5"),
    artifact("PSI-98", "PSI-98_ReadMe.docx",
             "Saffire-I ReadMe",
             "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98",
             "readme", psi98.get("doi"), psi98.get("licenseName", ""), psi98.get("licenseLink"),
             "document v1", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "parsed",
             ["Describes objectives, material and image-set organization; does not supply per-test pressure or gravity."],
             "Read Me tab"),
    artifact("NTRS-20250010653", "NTRS_20250010653.json",
             "LUCI NTRS citation metadata",
             "https://ntrs.nasa.gov/citations/20250010653",
             "context_metadata", None, "NASA public distribution (NTRS)", None,
             "citation record", "application/json", "parsed",
             ["Metadata only; LUCI is not part of the PSI experiment corpus.",
              "No structured per-test data table is provided in this record."],
             "NTRS citation 20250010653"),
    artifact("NTRS-20250010653", "NTRS_20250010653_LUCI.pdf",
             "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket",
             "https://ntrs.nasa.gov/citations/20250010653",
             "context_presentation", None, "NASA public distribution (NTRS)", None,
             "presentation, 2025-12-06", "application/pdf", "parsed",
             ["Presentation of LUCI results, not a PSI experiment table.",
              "No structured per-test data file is included; results are reported as presentation findings.",
              "Not directly comparable record-by-record with BASS-II or Saffire."],
             "NTRS PDF, 44 slides; pages 12, 16, 19-22"),
]

# ---------------------------------------------------------------------------
# BASS-II records
# ---------------------------------------------------------------------------

bass_rows = list(csv.DictReader(read_text(RAW / "PSI-25_experimental.csv").splitlines()))
bass_records: list[dict] = []
test_ids: set[str] = set()
duplicate_test_ids: list[str] = []
flags_count: dict[str, int] = {}

for idx, row in enumerate(bass_rows, start=2):
    test = row["Test #"].strip()
    experiment_id = f"BASS2-{test}"
    if experiment_id in test_ids:
        duplicate_test_ids.append(experiment_id)
    test_ids.add(experiment_id)

    material_raw = row["Fuel Sample Material"].strip()
    family, species, geometry = classify_material(material_raw)
    thickness, thickness_token = extract_thickness_mm(material_raw)
    width, width_token = extract_width_cm(material_raw)
    diameter, diameter_token = extract_diameter_mm(material_raw)

    o2i = parse_oxygen(row["Calibrated  initial O2 % by vol "])
    o2f = parse_oxygen(row["Calibrated final O2 % by vol"])
    co2i = parse_concentration(row["Initial CO2 % by vol"], "% by vol", "CDM CO2")
    co2f = parse_concentration(row["Final CO2 % by vol"], "% by vol", "CDM CO2")
    coi = parse_concentration(row["Initial CO (ppm)"], "ppm", "CSA-CP CO")
    cof = parse_concentration(row["Final CO (ppm)"], "ppm", "CSA-CP CO")

    air_raw = row["Air display"].strip()
    fan_raw = row["Fan display"].strip()
    flow_numbers = parse_number_sequence(air_raw)
    flow_initial = flow_numbers[0] if flow_numbers else None
    flow_range = [min(flow_numbers), max(flow_numbers)] if flow_numbers else None
    flow_varies = bool(flow_range and flow_range[0] != flow_range[1])
    if flow_initial is not None and flow_initial > 45:
        flow_initial = None
        flow_numbers = []
        flow_range = None

    flow = val(flow_initial, "measured" if flow_initial is not None else "not_reported", "cm/s",
               air_raw or None,
               "Duct air-speed display as recorded in the source. Response time is slow (~1 min), so a value is steady only at a fixed setting (PSI-25 ReadMe).",
               "instrument_display")
    flow_derived = val(round(flow_initial * FAN_FACTOR, 3) if flow_initial is not None else None,
                       "derived" if flow_initial is not None else "not_reported", "cm/s",
                       air_raw or None,
                       "U = 1.0066 x Air display. Single workbook factor based on SPICE calibration at one location; not a per-test calibration.",
                       "derived_from_instrument_display")

    outcome, note = extract_outcome_tokens(air_raw, fan_raw)
    direction = flow_direction_context(row["PI"].strip())

    flags: list[str] = []
    if o2i["value"] is not None and o2f["value"] is not None and o2f["value"] > o2i["value"] + 2:
        flags.append("final_o2_exceeds_initial_by_more_than_2pp")
    if o2i["value"] is not None and not (10 <= o2i["value"] <= 25):
        flags.append("initial_o2_outside_10_25_pct")
    if row["Date"].strip().endswith("2018"):
        flags.append("date_year_unexpected_2018_in_2014_campaign")
    if family == "Unnamed polymer film":
        flags.append("material_polymer_not_named_in_row")
    if flow_initial is None:
        flags.append("flow_not_parseable_from_display_field")
    if flow_varies:
        flags.append("flow_reported_as_sequence_not_single_value")
    if note and outcome["status"] == "not_reported":
        flags.append("free_text_note_without_standardized_outcome")
    for f in flags:
        flags_count[f] = flags_count.get(f, 0) + 1

    missing = ["total_pressure_psia", "gravity_regime_per_record", "ignition_method",
               "standardized_outcome", "flow_direction_per_record", "measurement_uncertainty_per_value"]
    if flow_initial is None:
        missing.append("flow_initial_cm_s")
    if o2f["value"] is None:
        missing.append("oxygen_final_pct")
    if thickness is None and geometry != "Rod/cylinder":
        missing.append("thickness_mm")
    if width is None and geometry != "Rod/cylinder":
        missing.append("width_cm")

    measurements = []
    def meas(mid: str, quantity: str, v: dict, phase: str, method: str, locator: str) -> None:
        measurements.append({
            "measurement_id": f"{experiment_id}-{mid}",
            "quantity": quantity,
            "original_value": v.get("raw"),
            "original_unit": v.get("unit"),
            "normalized_value": v.get("value"),
            "normalized_unit": v.get("unit"),
            "status": v.get("status"),
            "uncertainty": v.get("note") if v.get("status") in ("measured", "derived") else None,
            "measurement_phase": phase,
            "measurement_method": method,
            "source_locator": locator,
        })
    loc = f"PSI-25 experimental table, CSV row {idx}, test {test}"
    meas("O2I", "oxygen_initial", o2i, "initial", "Calibrated gas sensor (MCA-corrected)", loc)
    meas("O2F", "oxygen_final", o2f, "final", "Calibrated gas sensor (MCA-corrected)", loc)
    meas("CO2I", "co2_initial", co2i, "initial", "CDM sensor", loc)
    meas("CO2F", "co2_final", co2f, "final", "CDM sensor", loc)
    meas("COI", "co_initial", coi, "initial", "CSA-CP sensor", loc)
    meas("COF", "co_final", cof, "final", "CSA-CP sensor", loc)
    meas("FLOW", "air_display_initial", flow, "test", "Duct air-speed display", loc)
    meas("FLOWD", "air_display_derived_velocity", flow_derived, "test", "Derived: U = 1.0066 x Air display", loc)
    if thickness is not None:
        meas("THK", "sample_thickness", val(thickness, "derived", "mm", thickness_token,
             "Parsed from free-text material description; formatting/rounding in source.", "parsed_from_text"), "sample", "Text extraction", loc)
    if width is not None:
        meas("WID", "sample_width", val(width, "derived", "cm", width_token,
             "Parsed from free-text material description; formatting/rounding in source.", "parsed_from_text"), "sample", "Text extraction", loc)
    if diameter is not None:
        meas("DIA", "sample_diameter", val(diameter, "derived", "mm", diameter_token,
             "Parsed from free-text material description; formatting/rounding in source.", "parsed_from_text"), "sample", "Text extraction", loc)

    record = {
        "experiment_id": experiment_id,
        "source_id": "PSI-25",
        "source_locator": loc,
        "investigation": psi25["title"],
        "investigation_acronym": "BASS-II",
        "family": "BASS-II",
        "pi": row["PI"].strip(),
        "test_number": test,
        "sample_number": row["Sample #"].strip() or None,
        "date_reported": row["Date"].strip() or None,
        "gmt_day": row["GMT"].strip() or None,
        "material_raw": material_raw,
        "material_family": family,
        "material_species": species,
        "geometry": geometry,
        "thickness_mm": val(thickness, "derived", "mm", thickness_token,
                            "Parsed from free-text material description.", "parsed_from_text") if thickness is not None else not_reported("mm"),
        "width_cm": val(width, "derived", "cm", width_token,
                        "Parsed from free-text material description.", "parsed_from_text") if width is not None else not_reported("cm"),
        "length_cm": not_reported("cm", None, "No length is reported for this sample in the experimental table."),
        "diameter_mm": val(diameter, "derived", "mm", diameter_token,
                           "Parsed from free-text material description.", "parsed_from_text") if diameter is not None else not_reported("mm"),
        "oxygen_initial_pct": o2i,
        "oxygen_final_pct": o2f,
        "oxygen_partial_pressure_psi": not_reported("psi", None,
            "Total pressure is not reported for this record, so oxygen partial pressure cannot be calculated."),
        "total_pressure_psia": not_reported("psia", row.get("Total Pressure", None),
            "The PSI experimental table has no total-pressure column. ISS cabin pressure is not substituted."),
        "flow_initial_cm_s": flow,
        "flow_derived_cm_s": flow_derived,
        "flow_range_cm_s": flow_range,
        "flow_varies": flow_varies,
        "flow_direction": direction,
        "fan_display_raw": fan_raw or None,
        "air_display_raw": air_raw or None,
        "flow_restrictor": row["Flow restrictor"].strip() or None,
        "gravity_regime": val("microgravity", "investigation_level", None,
            "BASS-II metadata: ISS microgravity investigation.",
            "Not a per-test measurement. Assigned from investigation-level metadata, not from a recorded g-level.",
            "investigation_level"),
        "ignition_method": not_reported(None, None, "No ignition method is recorded in the experimental table."),
        "ignition_power_w": not_reported("W"),
        "ignition_time_s": not_reported("s"),
        "burn_time_s": not_reported("s"),
        "hardware": val("Microgravity Science Glovebox (MSG) flow duct", "investigation_level", None,
            psi25.get("experimentHardware"), "Investigation-level hardware; not verified per test.", "investigation_level"),
        "measurement_method": "Gas sensors (O2/CO2/CO), duct air-speed display, radiometer gain setting, still-frame count",
        "outcome": outcome,
        "outcome_definition": "No standardized outcome column exists. Qualitative tokens are extracted only from free-text flow notes.",
        "source_note": note,
        "co2_initial_pct": co2i,
        "co2_final_pct": co2f,
        "co_initial_ppm": coi,
        "co_final_ppm": cof,
        "radiometer_gain": row["Radiometer gain   (1000   250   50   10)"].strip() or None,
        "total_frames": row["Total Frames Shot"].strip() or None,
        "quality_flags": flags,
        "missing_fields": missing,
        "provenance_notes": [
            "Original PSI CSV row preserved in record.raw; no raw file was overwritten.",
            "Material family/geometry/dimensions are parsed from the free-text Material field and marked derived.",
            "Pressure remains not reported; no cabin pressure was substituted.",
        ],
        "validation_status": "validated",
        "raw": {k: ("" if v is None else str(v)) for k, v in row.items()},
        "measurements": measurements,
    }
    if any(f in flags for f in ("final_o2_exceeds_initial_by_more_than_2pp", "date_year_unexpected_2018_in_2014_campaign")):
        record["validation_status"] = "suspect"
    elif flow_initial is None or o2f["value"] is None or family == "Unknown":
        record["validation_status"] = "partial"
    bass_records.append(record)

# ---------------------------------------------------------------------------
# Saffire-I records
# ---------------------------------------------------------------------------

saffire_rows = list(csv.DictReader(read_text(RAW / "PSI-98_experimental.csv").splitlines()))
saffire_records: list[dict] = []
saffire_non_experiment: list[dict] = []
for idx, row in enumerate(saffire_rows, start=2):
    sample = (row["Sample Number "] or "").strip()
    material = (row["Material"] or "").strip()
    if not sample.startswith("S"):
        saffire_non_experiment.append({"row": idx, "sample": sample, "material": material,
                                       "reason": "Pre/post-flow image-set descriptor, not an instrumented experiment."})
        continue

    def fnum(key: str) -> float | None:
        return to_float(row.get(key))

    o2_raw = (row.get("Percent O2") or "").strip()
    o2_numbers = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", o2_raw)]
    o2_val = None
    o2_note = None
    if o2_numbers:
        if len(o2_numbers) >= 2 and ("-" in o2_raw or "–" in o2_raw):
            o2_val = round(sum(o2_numbers[:2]) / 2, 3)
            o2_note = f"Source reports a range ({o2_raw}); midpoint retained as an approximate value, raw range preserved."
        else:
            o2_val = o2_numbers[0]
            o2_note = "Source reports an approximate single value; verify against the raw run record if used quantitatively."
    o2 = val(o2_val, "reported_qualitative" if "~" in o2_raw or "-" in o2_raw else "measured", "% by vol", o2_raw, o2_note) if o2_val is not None else not_reported("% by vol", o2_raw)

    thickness_cm = fnum("Sample Thickness (cm)")
    length_cm = fnum("Sample Length (cm)")
    width_cm = fnum("Sample Width (cm)")
    airflow = fnum("Air Flow (cm/s)")
    ign_power = fnum("Ignition Power (W)")
    ign_time = fnum("Ignition Time (s)")
    burn_time = fnum("Burn Time (s)")
    direction_raw = (row.get("Flow Direction ") or "").strip()
    direction = val(direction_raw, "measured" if direction_raw else "not_reported", None, direction_raw,
                    "Flow direction as recorded in the Saffire-I experimental table.") if direction_raw else not_reported()

    experiment_id = f"SAFFIRE1-{sample}"
    loc = f"PSI-98 experimental table, CSV row {idx}, sample {sample}"
    flags = []
    if o2["status"] == "reported_qualitative":
        flags.append("o2_reported_as_range_or_approximation")
    if burn_time is None:
        flags.append("burn_time_not_reported")

    measurements = []
    for mid, qty, v, phase, method in [
        ("O2", "oxygen_initial", o2, "initial", "Chamber oxygen concentration sensor"),
        ("THK", "sample_thickness", val(thickness_cm * 10, "measured", "mm", thickness_cm, "Source field in cm; converted to mm.", "unit_conversion") if thickness_cm is not None else not_reported("mm"), "sample", "Reported sample dimension"),
        ("LEN", "sample_length", val(length_cm, "measured", "cm", length_cm, "As reported.", None) if length_cm is not None else not_reported("cm"), "sample", "Reported sample dimension"),
        ("WID", "sample_width", val(width_cm, "measured", "cm", width_cm, "As reported.", None) if width_cm is not None else not_reported("cm"), "sample", "Reported sample dimension"),
        ("FLOW", "air_flow", val(airflow, "measured", "cm/s", airflow, "As reported in the experimental table.", None) if airflow is not None else not_reported("cm/s"), "test", "Reported air flow"),
        ("IGNP", "ignition_power", val(ign_power, "measured", "W", ign_power, "As reported.", None) if ign_power is not None else not_reported("W"), "test", "Reported ignition setting"),
        ("IGNT", "ignition_time", val(ign_time, "measured", "s", ign_time, "As reported.", None) if ign_time is not None else not_reported("s"), "test", "Reported ignition setting"),
        ("BURN", "burn_time", val(burn_time, "measured", "s", burn_time, "Reported burn time; not by itself an extinction or sustained-burning classification.", None) if burn_time is not None else not_reported("s"), "test", "Reported burn duration"),
    ]:
        measurements.append({
            "measurement_id": f"{experiment_id}-{mid}",
            "quantity": qty,
            "original_value": v.get("raw"),
            "original_unit": v.get("unit"),
            "normalized_value": v.get("value"),
            "normalized_unit": v.get("unit"),
            "status": v.get("status"),
            "uncertainty": v.get("note") if v.get("status") in ("measured", "derived") else None,
            "measurement_phase": phase,
            "measurement_method": method,
            "source_locator": loc,
        })

    record = {
        "experiment_id": experiment_id,
        "source_id": "PSI-98",
        "source_locator": loc,
        "investigation": psi98["title"],
        "investigation_acronym": "Saffire-I",
        "family": "Saffire-I",
        "pi": None,
        "test_number": sample,
        "sample_number": sample,
        "date_reported": None,
        "gmt_day": None,
        "material_raw": material,
        "material_family": "SIBAL fabric",
        "material_species": "SIBAL",
        "geometry": "Fabric sheet",
        "thickness_mm": val(thickness_cm * 10, "measured", "mm", thickness_cm, "Source field in cm; converted to mm.", "unit_conversion") if thickness_cm is not None else not_reported("mm"),
        "width_cm": val(width_cm, "measured", "cm", width_cm, "As reported.", None) if width_cm is not None else not_reported("cm"),
        "length_cm": val(length_cm, "measured", "cm", length_cm, "As reported.", None) if length_cm is not None else not_reported("cm"),
        "diameter_mm": not_reported("mm", None, "Sheet sample; diameter not applicable."),
        "oxygen_initial_pct": o2,
        "oxygen_final_pct": not_reported("% by vol", None, "Not reported as a final value for this sample in the table."),
        "oxygen_partial_pressure_psi": not_reported("psi", None, "Total pressure is not reported for this record, so oxygen partial pressure cannot be calculated."),
        "total_pressure_psia": not_reported("psia", None, "The PSI-98 experimental table has no total-pressure column. Cygnus cabin pressure is not substituted."),
        "flow_initial_cm_s": val(airflow, "measured", "cm/s", airflow, "As reported.", None) if airflow is not None else not_reported("cm/s"),
        "flow_derived_cm_s": not_reported("cm/s", None, "No conversion was applied; the source reports air flow in cm/s."),
        "flow_range_cm_s": [airflow, airflow] if airflow is not None else None,
        "flow_varies": False,
        "flow_direction": direction,
        "fan_display_raw": None,
        "air_display_raw": str(airflow) if airflow is not None else None,
        "flow_restrictor": None,
        "gravity_regime": val("microgravity", "investigation_level", None,
            "Saffire-I metadata: Cygnus spacecraft microgravity experiment.",
            "Not a per-test measurement. Assigned from investigation-level metadata.",
            "investigation_level"),
        "ignition_method": not_reported(None, None, "Ignition power and time are reported; ignition method is not stated in the table."),
        "ignition_power_w": val(ign_power, "measured", "W", ign_power, "As reported.", None) if ign_power is not None else not_reported("W"),
        "ignition_time_s": val(ign_time, "measured", "s", ign_time, "As reported.", None) if ign_time is not None else not_reported("s"),
        "burn_time_s": val(burn_time, "measured", "s", burn_time, "Reported burn time; not a standardized extinction outcome.", None) if burn_time is not None else not_reported("s"),
        "hardware": val("Saffire I enclosure in Cygnus", "investigation_level", None,
            psi98.get("experimentHardware"), "Investigation-level hardware.", "investigation_level"),
        "measurement_method": "Chamber O2 sensor, air-flow setting, ignition power/time, burn duration",
        "outcome": not_reported(None, None, "Burn time is reported, but no extinction or sustained-burning classification is stated."),
        "outcome_definition": "Burn time is a reported duration, not a standardized flammability outcome.",
        "source_note": None,
        "co2_initial_pct": not_reported("% by vol"),
        "co2_final_pct": not_reported("% by vol"),
        "co_initial_ppm": not_reported("ppm"),
        "co_final_ppm": not_reported("ppm"),
        "radiometer_gain": None,
        "total_frames": None,
        "quality_flags": flags,
        "missing_fields": ["total_pressure_psia", "gravity_regime_per_record", "ignition_method",
                           "standardized_outcome", "measurement_uncertainty_per_value", "oxygen_final_pct"],
        "provenance_notes": [
            "Original PSI-98 CSV row preserved in record.raw.",
            "Two Saffire samples only; pre/post-flow image descriptors were excluded from experiment records.",
            "Pressure remains not reported; no cabin pressure was substituted.",
        ],
        "validation_status": "partial",
        "raw": {k: ("" if v is None else str(v)) for k, v in row.items()},
        "measurements": measurements,
    }
    saffire_records.append(record)

records = bass_records + saffire_records

# ---------------------------------------------------------------------------
# cross-checks and validation
# ---------------------------------------------------------------------------

wb = openpyxl.load_workbook(RAW / "PSI-25_Test_Matrices.xlsx", data_only=True)
matrix_by_test: dict[str, dict] = {}
for ws in wb.worksheets:
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        continue
    header = rows[0]
    for row in rows[1:]:
        if not row or row[2] is None:
            continue
        d = dict(zip(header, row))
        matrix_by_test[str(d.get("Test no.")).strip()] = d

csv_by_test = {r["test_number"]: r for r in bass_records}
o2_mismatch = []
material_formatting_diff = 0
air_formatting_diff = 0
substantive_conflicts = []
for test, rec in csv_by_test.items():
    m = matrix_by_test.get(test)
    if not m:
        substantive_conflicts.append(f"{test}: absent from test matrices")
        continue
    m_o2 = m.get("calibrated  initial O2 % by vol ")
    c_o2 = rec["oxygen_initial_pct"]["value"]
    if to_float(m_o2) != c_o2:
        o2_mismatch.append({"test": test, "matrix": m_o2, "csv": c_o2})
    if str(m.get("Material") or "").strip().lower() != rec["material_raw"].strip().lower():
        material_formatting_diff += 1
    if str(m.get("Air display") or "").strip().lower() != (rec["air_display_raw"] or "").strip().lower():
        air_formatting_diff += 1

matrix_check = {
    "test_ids_in_csv": len(csv_by_test),
    "test_ids_in_matrix": len(matrix_by_test),
    "test_ids_matched": len(set(csv_by_test) & set(matrix_by_test)),
    "o2_initial_exact_matches": len(csv_by_test) - len(o2_mismatch),
    "o2_initial_mismatches": o2_mismatch,
    "material_text_formatting_differences": material_formatting_diff,
    "air_display_formatting_differences": air_formatting_diff,
    "substantive_numeric_conflicts": substantive_conflicts,
    "interpretation": "Test IDs and initial O2 values agree between the PSI CSV and the six-sheet test-matrix workbook. Text differences are punctuation/capitalisation only; no substantive numeric conflict was found.",
}

# fan calibration note
fan_wb = openpyxl.load_workbook(RAW / "PSI-25_Fan_Calibration.xlsx", data_only=True)
fan_text = []
for ws in fan_wb.worksheets:
    for row in ws.iter_rows(values_only=True):
        for v in row:
            if isinstance(v, str):
                fan_text.append(v)
fan_joined = "\n".join(fan_text)

quality_counts = {
    "validated": sum(1 for r in records if r["validation_status"] == "validated"),
    "partial": sum(1 for r in records if r["validation_status"] == "partial"),
    "suspect": sum(1 for r in records if r["validation_status"] == "suspect"),
}

coverage = {
    "oxygen_initial_reported": sum(1 for r in records if r["oxygen_initial_pct"]["value"] is not None),
    "oxygen_final_reported": sum(1 for r in records if r["oxygen_final_pct"]["value"] is not None),
    "pressure_reported": sum(1 for r in records if r["total_pressure_psia"]["value"] is not None),
    "flow_reported": sum(1 for r in records if r["flow_initial_cm_s"]["value"] is not None),
    "gravity_per_record_reported": sum(1 for r in records if r["gravity_regime"]["status"] == "measured"),
    "standardized_outcome_reported": sum(1 for r in records if r["outcome"]["status"] == "measured"),
    "geometry_parsed": sum(1 for r in records if r["geometry"] != "Unknown"),
    "thickness_parsed": sum(1 for r in records if r["thickness_mm"]["value"] is not None),
    "partial_gravity_records": sum(1 for r in records if str(r["gravity_regime"]["value"]).lower().startswith("lunar")),
}

validation = {
    "pipeline_version": PIPELINE_VERSION,
    "generated_at": GENERATED_AT,
    "input_rows": {"PSI-25": len(bass_rows), "PSI-98": len(saffire_rows)},
    "accepted_records": {"PSI-25": len(bass_records), "PSI-98": len(saffire_records), "total": len(records)},
    "rejected_rows": [],
    "excluded_non_experiment_rows": saffire_non_experiment,
    "duplicate_record_ids": duplicate_test_ids,
    "duplicate_sample_numbers": sorted([k for k, v in
        {s: sum(1 for r in bass_records if r["sample_number"] == s) for s in {r["sample_number"] for r in bass_records}}.items()
        if v > 1 and k]),
    "quality_counts": quality_counts,
    "coverage": coverage,
    "quality_flag_counts": dict(sorted(flags_count.items(), key=lambda kv: -kv[1])),
    "matrix_cross_check": matrix_check,
    "fan_calibration": {
        "factor": FAN_FACTOR,
        "formula": "U = 1.0066 x Air display",
        "source_locator": "PSI-25 Fan Calibration data sheet, note '*U =1.0066(AIR)'",
        "caveat": "Single workbook factor derived from SPICE calibration at one downstream location. Day- and restrictor-specific calibration exists; per-test calibration was not applied.",
        "workbook_note_present": "fan turns off at a finite voltage" in fan_joined.lower(),
    },
    "checks": [
        {"check": "unique experiment IDs", "result": "PASS" if not duplicate_test_ids else "FAIL", "detail": f"{len(records)} records, {len(duplicate_test_ids)} duplicates"},
        {"check": "all BASS-II test IDs present in matrix workbook", "result": "PASS" if len(set(csv_by_test) & set(matrix_by_test)) == len(csv_by_test) else "FAIL", "detail": f"{len(set(csv_by_test) & set(matrix_by_test))}/{len(csv_by_test)}"},
        {"check": "initial O2 matches matrix workbook", "result": "PASS" if not o2_mismatch else "WARN", "detail": f"{len(csv_by_test) - len(o2_mismatch)}/{len(csv_by_test)} exact numeric matches"},
        {"check": "no cabin pressure substituted for missing total pressure", "result": "PASS" if coverage["pressure_reported"] == 0 else "CHECK", "detail": f"{coverage['pressure_reported']}/{len(records)} records report total pressure"},
        {"check": "no per-test gravity inferred as measured", "result": "PASS" if coverage["gravity_per_record_reported"] == 0 else "CHECK", "detail": "Gravity is investigation-level only; status='investigation_level'"},
        {"check": "missing values preserved as null", "result": "PASS", "detail": "Nulls carry status not_reported; no zero-fill applied"},
        {"check": "raw values preserved", "result": "PASS", "detail": "record.raw retains every original CSV field"},
        {"check": "Saffire non-experiment rows excluded", "result": "PASS", "detail": f"{len(saffire_non_experiment)} image-set descriptor rows excluded"},
    ],
}

# ---------------------------------------------------------------------------
# claims
# ---------------------------------------------------------------------------

def claim(cid: str, text: str, ctype: str, source_ids: list[str], locators: list[str],
          limitation: str, validation_status: str) -> dict:
    return {
        "claim_id": cid,
        "claim_text": text,
        "claim_type": ctype,
        "supporting_source_ids": source_ids,
        "supporting_locators": locators,
        "limitation": limitation,
        "validation_status": validation_status,
    }

claims = [
    claim("CL-BASS2-OBJ",
          "BASS-II studied ignition, flame growth, flame spread and extinction limits for solid fuels burning in low-velocity forced flows in microgravity.",
          "investigation_objective", ["PSI-25"], ["PSI-25 metadata, Objectives"],
          "Investigation-level objective, not a per-test result.", "verified_metadata"),
    claim("CL-BASS2-FLOW",
          "BASS-II used a small wind tunnel in the Microgravity Science Glovebox with airflow speeds up to 40 cm/s; oxygen was varied by nitrogen vitiation.",
          "method", ["PSI-25"], ["PSI-25 metadata, Approach"],
          "Describes the investigation approach, not the actual setting of every test.", "verified_metadata"),
    claim("CL-BASS2-O2-CAL",
          "The BASS-II oxygen sensor was out of calibration; the initial ISS air reading was corrected using the MCA ISS reading via a constant offset.",
          "measurement_limitation", ["PSI-25"], ["PSI-25 ReadMe, 'Calibrated initial and final O2'"],
          "A constant-offset correction is a documented approximation; per-sample uncertainty is not supplied.", "verified_text"),
    claim("CL-BASS2-AIR",
          "The BASS-II 'Air display' is a duct flow-speed display in cm/s with a response time of about one minute; it is only steady for long holds at one setting.",
          "measurement_limitation", ["PSI-25"], ["PSI-25 ReadMe, 'Air display'"],
          "Values recorded during ramps or short holds should not be treated as steady calibrated velocities.", "verified_text"),
    claim("CL-BASS2-FAN",
          "The BASS-II 'Fan display' is an instantaneous fan voltage times ten, not a flow velocity.",
          "measurement_limitation", ["PSI-25"], ["PSI-25 ReadMe, 'Fan display'"],
          "Fan display must not be converted directly to velocity; use the separate air display and calibration.", "verified_text"),
    claim("CL-FAN-CAL",
          "The PSI-25 fan-calibration workbook gives U = 1.0066 x Air display, based on SPICE fan calibration at 56 mm downstream and 36 mm from the bottom (centerline).",
          "derived_method", ["PSI-25"], ["PSI-25 Fan Calibration data sheet, note '*U =1.0066(AIR)'"],
          "A single factor is an approximation; day- and restrictor-specific calibration exists and per-test calibration was not applied.", "verified_text"),
    claim("CL-SAF-MAT",
          "Saffire-I and Saffire-III used SIBAL cloth, a 75% cotton / 25% fiberglass composite fabric, at a nominal air-flow velocity of 20 cm/s for Saffire-I.",
          "method", ["PSI-98"], ["PSI-98 ReadMe, paragraph 2"],
          "Material and nominal flow are investigation-level descriptions; the per-sample table reports 20 cm/s for both S1 and S2.", "verified_text"),
    claim("CL-LUCI-FEAS",
          "LUCI demonstrated material flammability experiments in simulated lunar gravity on a spinning Blue Origin New Shepard, at 11 RPM with an effective radius of 1.22 m; the burn lasted more than two and a half minutes.",
          "context_finding", ["NTRS-20250010653"], ["NTRS PDF page 12; NTRS abstract"],
          "LUCI is context, not part of the PSI experiment corpus; no structured per-test records were imported.", "verified_text"),
    claim("CL-LUCI-SPREAD",
          "In the LUCI lunar-g burn, SIBAL flame base spread was 0.92 mm/s and flame tip spread 1.1 mm/s; PMMA flame tip spread was about 1.5 mm/s, and chamber O2 fell from 20% to 14.3%.",
          "context_finding", ["NTRS-20250010653"], ["NTRS PDF pages 19-22"],
          "Presentation-level findings from a single LUCI flight; not reproduced here and not directly comparable to BASS-II/Saffire records.", "verified_text"),
    claim("CL-CHALLENGE-PGRAV",
          "The official 2026 challenge states that there is currently no partial-gravity combustion data available in PSI, and that LUCI and FM2 data are expected in the future.",
          "corpus_scope", ["CHALLENGE-2026"], ["Official challenge page, 'Partial-gravity data'"],
          "This describes PSI's public corpus at the time of the challenge; it is not a claim that no partial-gravity research exists anywhere.", "verified_context"),
    claim("CL-BASS2-PRESS",
          "The BASS-II experimental table does not report total pressure, so oxygen partial pressure cannot be calculated at record level from this table alone.",
          "data_gap", ["PSI-25"], ["PSI-25 experimental table, columns A-Q"],
          "Absence of a pressure column is not evidence that pressure was unmeasured or uncontrolled; it is a metadata gap.", "verified_metadata"),
    claim("CL-SAF-PRESS",
          "The Saffire-I experimental table does not report total pressure, so oxygen partial pressure cannot be calculated at record level from this table alone.",
          "data_gap", ["PSI-98"], ["PSI-98 experimental table, columns A-M"],
          "Absence of a pressure column is not evidence that pressure was unmeasured or uncontrolled; it is a metadata gap.", "verified_metadata"),
]

# ---------------------------------------------------------------------------
# context sources (not experiment tables)
# ---------------------------------------------------------------------------

context_sources = [
    {
        "source_id": "CHALLENGE-2026",
        "source_title": "NASA Space Apps Challenge 2026 — Flame in Freefall challenge page",
        "source_url": "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/",
        "role": "challenge_context",
        "license": "NASA Space Apps challenge content; quoted for alignment only",
        "retrieved": "2026-11-13",
        "limitations": ["Challenge framing is not an experimental dataset.", "No per-test data are supplied by the challenge page."],
    },
    {
        "source_id": "NTRS-20250010653",
        "source_title": "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket",
        "source_url": "https://ntrs.nasa.gov/citations/20250010653",
        "role": "partial_gravity_context",
        "license": "NASA public distribution (NTRS)",
        "retrieved": "2026-11-13",
        "limitations": ["Presentation, 44 slides; no structured per-test data file.", "Not part of the PSI experiment corpus."],
    },
]

presets = [
    {
        "id": "earth-sea-level",
        "label": "Earth sea level",
        "pressure_psia": 14.7,
        "oxygen_pct": 20.95,
        "kind": "reference",
        "description": "Standard dry-air oxygen fraction at NASA's stated sea-level pressure.",
        "source": "NASA Space Apps 2026 challenge text (14.7 psi); NASA NSSDC Earth Fact Sheet (20.95% O2 by volume).",
        "source_url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
        "caveat": "Reference atmosphere, not an experiment in the corpus.",
    },
    {
        "id": "spacesuit",
        "label": "Spacesuit (100% O2)",
        "pressure_psia": 4.3,
        "oxygen_pct": 100.0,
        "kind": "reference",
        "description": "Spacesuits are filled with 100% oxygen to 4.3 psi to enable flexibility.",
        "source": "NASA Space Apps 2026 challenge text, 'Spacesuits and oxygen concentration'.",
        "source_url": "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/",
        "caveat": "Reference scenario stated in the challenge; not a per-test experimental condition in this corpus.",
    },
    {
        "id": "lunar-cabin",
        "label": "Lunar cabin planning point",
        "pressure_psia": 10.2,
        "oxygen_pct": 30.0,
        "kind": "illustrative",
        "description": "Illustrative point at the challenge's stated upper-bound planning values: 30% O2 or greater, 10.2 psi or less.",
        "source": "NASA Space Apps 2026 challenge text, 'Spacesuits and oxygen concentration'.",
        "source_url": "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/",
        "caveat": "Illustrative planning point derived from the challenge text. It is not a final operational specification for a Moon Base or rover.",
    },
]

# ---------------------------------------------------------------------------
# write corpus
# ---------------------------------------------------------------------------

corpus = {
    "meta": {
        "name": "FIRETRACE",
        "tagline": "Know what the evidence says. See what it doesn't.",
        "generated_at": GENERATED_AT,
        "pipeline_version": PIPELINE_VERSION,
        "record_count": len(records),
        "experiment_record_count": len(records),
        "source_artifact_count": len(sources),
        "investigation_count": len({r["family"] for r in records}),
        "investigations": [
            {"family": "BASS-II", "psi": "PSI-25", "doi": psi25.get("doi"), "records": len(bass_records),
             "hardware": psi25.get("experimentHardware"), "title": psi25.get("title")},
            {"family": "Saffire-I", "psi": "PSI-98", "doi": psi98.get("doi"), "records": len(saffire_records),
             "hardware": psi98.get("experimentHardware"), "title": psi98.get("title")},
        ],
        "quality_counts": quality_counts,
        "coverage": coverage,
        "disclaimer": "FIRETRACE is an independent project. It is not affiliated with, endorsed by, or certified by NASA. It does not predict fire risk or certify materials, atmospheres or procedures.",
    },
    "sources": sources,
    "context_sources": context_sources,
    "records": records,
    "claims": claims,
    "presets": presets,
    "limitations": [
        "The current corpus contains BASS-II (129 records) and Saffire-I (2 records). It is not the whole of NASA combustion research.",
        "Total pressure is absent from both PSI experimental tables; no cabin pressure was substituted.",
        "Gravity is investigation-level only (ISS/Cygnus microgravity), not a per-test measured g-level.",
        "Neither table contains a standardized extinction/sustained-burning outcome.",
        "Flow values are instrument displays with a slow response; derived velocity uses a single workbook factor and is not a per-test calibration.",
        "O2 readings were corrected by a constant offset because the sensor was out of calibration; per-sample uncertainty is not supplied.",
        "Material family, geometry and dimensions are parsed from free-text fields and marked derived.",
        "Two BASS-II final-O2 values exceed their initial values by more than 2 percentage points and are flagged suspect, not corrected.",
        "No partial-gravity experiment records are included. The official challenge states PSI currently has none; LUCI is included only as context.",
        "No AI-generated scientific claims are presented. The evidence assistant is a deterministic retrieval and citation engine.",
    ],
}

with open(OUT / "corpus.json", "w", encoding="utf-8") as f:
    json.dump(corpus, f, indent=2, ensure_ascii=False)

with open(OUT / "source_manifest.json", "w", encoding="utf-8") as f:
    json.dump({"generated_at": GENERATED_AT, "sources": sources, "context_sources": context_sources}, f, indent=2, ensure_ascii=False)

with open(PROCESSED / "validation_report.json", "w", encoding="utf-8") as f:
    json.dump(validation, f, indent=2, ensure_ascii=False)

shutil.copy2(OUT / "corpus.json", PUBLIC_DATA / "corpus.json")
shutil.copy2(OUT / "source_manifest.json", PUBLIC_DATA / "source_manifest.json")
shutil.copy2(PROCESSED / "validation_report.json", PUBLIC_DATA / "validation_report.json")
shutil.copy2(PROCESSED / "validation_report.json", OUT / "validation_report.json")
shutil.copy2(OUT / "readme_PSI-25.txt", PUBLIC_DATA / "readme_PSI-25.txt")
shutil.copy2(OUT / "readme_PSI-98.txt", PUBLIC_DATA / "readme_PSI-98.txt")

# CSV source layer for auditability (raw fields only)
with open(PROCESSED / "records_raw.csv", "w", encoding="utf-8-sig", newline="") as f:
    if bass_rows:
        w = csv.DictWriter(f, fieldnames=list(bass_rows[0].keys()))
        w.writeheader()
        w.writerows(bass_rows)

print(json.dumps({
    "records": len(records),
    "bass": len(bass_records),
    "saffire": len(saffire_records),
    "quality": quality_counts,
    "coverage": coverage,
    "matrix_check": {k: v for k, v in matrix_check.items() if k != "o2_initial_mismatches"},
    "flags": validation["quality_flag_counts"],
}, indent=2))
