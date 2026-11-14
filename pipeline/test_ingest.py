"""Offline regression checks against preserved source artifacts; no network required."""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

class IngestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (ROOT / "tmp").mkdir(exist_ok=True)
        cls.tmp = tempfile.TemporaryDirectory(dir=ROOT / "tmp", prefix="ingest-test-")
        cls.output = Path(cls.tmp.name)
        with patch.dict(os.environ, {"FIRETRACE_OUTPUT_ROOT": str(cls.output)}), contextlib.redirect_stdout(io.StringIO()):
            cls.ns = runpy.run_path(str(ROOT / "pipeline/ingest.py"))
        cls.corpus = json.loads((cls.output / "src/data/corpus.json").read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_invalid_ids_and_csv_shape(self):
        with self.assertRaises(ValueError):
            self.ns["validate_record_ids"]([{"experiment_id": "B1"}, {"experiment_id": "B1"}])
        with tempfile.TemporaryDirectory(dir=ROOT / "tmp") as directory:
            path = Path(directory)
            (path / "bad.csv").write_text("id,value\nB1,3,extra\n", encoding="utf-8")
            function = self.ns["read_rows"]
            with patch.dict(function.__globals__, {"RAW": path}):
                with self.assertRaisesRegex(ValueError, "Malformed CSV"):
                    function("bad.csv", {"id", "value"})
                with self.assertRaisesRegex(ValueError, "Missing required"):
                    function("bad.csv", {"nonexistent"})

    def test_modified_source_refuses_publication(self):
        import shutil
        with tempfile.TemporaryDirectory(dir=ROOT / "tmp") as directory:
            raw = Path(directory) / "raw"
            shutil.copytree(ROOT / "data/raw", raw)
            with (raw / "PSI-25_experimental.csv").open("ab") as handle:
                handle.write(b"\n")
            with patch.dict(os.environ, {"FIRETRACE_OUTPUT_ROOT": str(Path(directory) / "out"), "FIRETRACE_RAW_DIR": str(raw)}):
                with self.assertRaisesRegex(ValueError, "Source lock mismatch"):
                    runpy.run_path(str(ROOT / "pipeline/ingest.py"))
            self.assertFalse((Path(directory) / "out/src/data/corpus.json").exists())

    def test_repeat_is_byte_identical(self):
        before = {str(p.relative_to(self.output)): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        with patch.dict(os.environ, {"FIRETRACE_OUTPUT_ROOT": str(self.output)}), contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(ROOT / "pipeline/ingest.py"))
        after = {str(p.relative_to(self.output)): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        self.assertEqual(before, after)

    def test_finite_numeric_parsing_and_missing_zero(self):
        for token in ["", "none", "OR", "nan", "inf", "-inf", "garbage"]:
            self.assertIsNone(self.ns["to_float"](token))
        self.assertEqual(self.ns["to_float"]("0"), 0)
        self.assertEqual(self.ns["parse_number_sequence"]("5 2.5 (1.15 .5 .35)"), [5, 2.5])
        self.assertEqual(self.ns["parse_number_sequence"](".5"), [0.5])
        self.assertEqual(self.ns["parse_oxygen"]("-5")["status"], "unverified")
        self.assertEqual(self.ns["parse_oxygen"]("12abc")["status"], "unverified")
        self.assertEqual(self.ns["parse_oxygen"]("22.2")["status"], "corrected")

    def test_conversion_units_and_original_tokens(self):
        saffire = next(r for r in self.corpus["records"] if r["experiment_id"] == "SAFFIRE1-S1")
        thickness = next(m for m in saffire["measurements"] if m["quantity"] == "sample_thickness")
        self.assertEqual((thickness["original_value"], thickness["original_unit"]), ("0.37", "cm"))
        self.assertAlmostEqual(thickness["normalized_value"], 3.7)
        self.assertEqual(thickness["normalized_unit"], "mm")
        self.assertEqual(self.ns["extract_thickness_mm"]("100 micron PMMA film")[0], 0.1)
        self.assertEqual(self.ns["extract_diameter_mm"]('1/4" PMMA rod')[0], 6.35)

    def test_records_and_source_row_mapping(self):
        records = self.corpus["records"]
        self.assertEqual(len(records), 131)
        self.assertEqual(len({r["experiment_id"] for r in records}), len(records))
        for record in records:
            self.assertIn(record["test_number"], record["source_locator"])
            self.assertIsNone(record["total_pressure_psia"]["value"])
            self.assertEqual(record["gravity_regime"]["status"], "investigation_level")
            for m in record["measurements"]:
                self.assertIsNone(m["uncertainty"])
                self.assertIn("CSV row", m["source_locator"])
                self.assertIn("note", m)
        self.assertEqual(records[0]["raw"]["Calibrated  initial O2 % by vol "], "22.2")
        self.assertEqual(sum(r["validation_status"] == "suspect" for r in records), 4)

    def test_approximation_and_unresolved_flags(self):
        saffire = [r for r in self.corpus["records"] if r["family"] == "Saffire-I"]
        self.assertEqual([r["oxygen_initial_pct"]["raw"] for r in saffire], ["21.5 - 21.7", "~ 21.5"])
        self.assertEqual([r["oxygen_initial_pct"]["status"] for r in saffire], ["reported_qualitative"] * 2)
        flag = self.ns["parse_concentration"]("-1", "ppm", "CO")
        self.assertIsNone(flag["value"])
        self.assertIn("not interpreted as below detection", flag["note"])

    def test_downloads_are_untouched_originals(self):
        for artifact in self.corpus["sources"]:
            if artifact["local_original_url"]:
                local = self.output / "public/data/original" / artifact["original_filename"]
                self.assertEqual(hashlib.sha256(local.read_bytes()).hexdigest(), artifact["sha256"])

    def test_generated_files_match_committed_data(self):
        for name in ["corpus.json", "source_manifest.json", "validation_report.json"]:
            self.assertEqual((self.output / "src/data" / name).read_bytes(), (ROOT / "src/data" / name).read_bytes())

if __name__ == "__main__":
    unittest.main()
