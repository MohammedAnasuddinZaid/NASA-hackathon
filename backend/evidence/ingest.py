"""Import existing pipeline outputs transactionally. Run from repository root."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re

from .config import Settings
from .schemas import Experiment, Value
from .store import SCHEMA, SCHEMA_VERSION, connect, dump

FILES = ("corpus.json", "source_manifest.json", "validation_report.json")


def load_inputs(data_dir):
    texts = [(data_dir / name).read_text(encoding="utf-8") for name in FILES]
    fingerprint = hashlib.sha256("\n".join(texts).encode()).hexdigest()
    return fingerprint, [json.loads(text) for text in texts]


def import_dataset(settings):
    fingerprint, (corpus, manifest, validation) = load_inputs(settings.data_dir)
    records = corpus["records"]
    if not records or corpus["meta"]["record_count"] != len(records):
        raise ValueError("corpus count mismatch")
    if corpus["sources"] != manifest["sources"] or corpus["context_sources"] != manifest["context_sources"]:
        raise ValueError("source manifest differs from corpus")
    if validation["duplicate_record_ids"] or any(c["result"] == "FAIL" for c in validation["checks"]):
        raise ValueError("upstream validation failed")
    if validation["accepted_records"]["total"] != len(records):
        raise ValueError("validation record count mismatch")
    investigation_ids = {x["psi"] for x in corpus["meta"]["investigations"]}
    record_ids, measurement_ids, artifact_ids = set(), set(), set()
    for record in records:
        Experiment.model_validate(record)
        if record["experiment_id"] in record_ids or record["source_id"] not in investigation_ids:
            raise ValueError("duplicate record or unknown investigation")
        record_ids.add(record["experiment_id"])
        for value in record.values():
            if isinstance(value, dict) and "status" in value and "value" in value:
                Value.model_validate(value)
        for item in record["measurements"]:
            if item["measurement_id"] in measurement_ids:
                raise ValueError("duplicate measurement")
            measurement_ids.add(item["measurement_id"])
    for source in manifest["sources"]:
        filename = source["original_filename"]
        if Path(filename).name != filename or "/" in filename or "\\" in filename:
            raise ValueError("invalid source filename")
        artifact_id = source["source_id"] + "--" + filename
        if artifact_id in artifact_ids:
            raise ValueError("duplicate artifact")
        artifact_ids.add(artifact_id)
        path = (settings.raw_dir / filename).resolve()
        if not path.is_relative_to(settings.raw_dir.resolve()) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("source integrity failure: " + filename)
    tables = {}
    for source in manifest["sources"]:
        if source["role"] == "experiment_table":
            with (settings.raw_dir / source["original_filename"]).open(encoding="utf-8-sig", newline="") as stream:
                tables[source["source_id"]] = list(csv.DictReader(stream))
    for record in records:
        match = re.search(r"CSV row (\d+)", record["source_locator"])
        if not match or record["source_id"] not in tables:
            raise ValueError("record requires a registered CSV row locator")
        index = int(match[1]) - 2
        table = tables[record["source_id"]]
        if not 0 <= index < len(table) or record["raw"] != table[index]:
            raise ValueError("raw row does not match original artifact")
    settings.database.parent.mkdir(parents=True, exist_ok=True)
    with connect(settings.database, readonly=False) as conn:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, SCHEMA_VERSION):
            raise ValueError("unsupported schema version; rebuild a separate database")
        conn.executescript(SCHEMA)
        with conn:
            for table in ("measurements", "experiments", "investigations", "sources", "claims", "dataset"):
                conn.execute(f"DELETE FROM {table}")  # fixed internal table names only
            for item in corpus["meta"]["investigations"]:
                conn.execute("INSERT INTO investigations VALUES (?,?)", (item["psi"], dump(item)))
            for source in manifest["sources"]:
                conn.execute("INSERT INTO sources VALUES (?,?,?,?)", (source["source_id"] + "--" + source["original_filename"], source["source_id"], source["original_filename"], dump(source)))
            for source in manifest["context_sources"]:
                conn.execute("INSERT INTO sources VALUES (?,?,NULL,?)", (source["source_id"], source["source_id"], dump(source)))
            for record in records:
                searchable = " ".join(str(record.get(k) or "") for k in ("experiment_id", "test_number", "sample_number", "material_raw", "material_family", "pi", "investigation_acronym", "source_id", "date_reported", "geometry")).lower()
                sort_id = re.sub(r"\d+", lambda m: m[0].zfill(8), record["experiment_id"])
                conn.execute("INSERT INTO experiments VALUES (?,?,?,?,?,?,?,?,?,?,?)", (record["experiment_id"], record["source_id"], record["family"], record["material_family"], record["validation_status"], record["oxygen_initial_pct"]["value"], record["flow_initial_cm_s"]["value"], searchable, sort_id, record.get("date_reported"), dump(record)))
                for item in record["measurements"]:
                    conn.execute("INSERT INTO measurements VALUES (?,?,?,?,?)", (item["measurement_id"], record["experiment_id"], item["quantity"], item["status"], dump(item)))
            for claim in corpus["claims"]:
                conn.execute("INSERT INTO claims VALUES (?,?)", (claim["claim_id"], dump(claim)))
            snapshot = {k: v for k, v in corpus.items() if k != "records"}
            conn.execute("INSERT INTO dataset VALUES (1,?,?,?)", (fingerprint, dump(snapshot), dump(validation)))
            conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
    return {"dataset_id": fingerprint, "records": len(records), "measurements": len(measurement_ids), "artifacts": len(manifest["sources"]), "context_sources": len(manifest["context_sources"]), "schema_version": SCHEMA_VERSION}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path)
    args = parser.parse_args()
    settings = Settings.from_env()
    if args.database:
        from dataclasses import replace
        settings = replace(settings, database=args.database)
    print(json.dumps(import_dataset(settings), indent=2))
