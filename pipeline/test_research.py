"""Offline source integrity, reproducibility and scientific separation checks."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from research import ROOT, compile_research, publish, read, validate


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.data = read(ROOT / 'data/research/curation.json')

    def test_verified_identities_and_counts(self):
        data, coverage, report = compile_research(self.data)
        self.assertEqual(coverage['counts'], dict(investigations=3, structured_records=131,
            new_structured_records=0, report_findings=16, linked_sources=8,
            research_reports=2, findings_with_locators=16))
        self.assertEqual([i['structured_records'] for i in coverage['investigations']], [129, 2, 0])
        self.assertEqual(report['unresolved'][0]['source_rows'], 274)
        flex = next(i for i in data['investigations'] if i['id'] == 'PSI-69')
        self.assertEqual(flex['combustion_type'], 'liquid_droplet')
        self.assertEqual(flex['doi'], '10.60555/mbq8-0451')

    def test_original_record_bytes_unchanged_and_missing(self):
        path = ROOT / 'src/data/corpus.json'
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),
            '89446315d96a01158774ece0b4f509099e72109a642ce1f99b50de720e599cd9')
        records = read(path)['records']
        self.assertEqual(len(records), 131)
        self.assertTrue(all(r['total_pressure_psia']['value'] is None for r in records))
        self.assertTrue(all(r['gravity_regime']['status'] == 'investigation_level' for r in records))
        self.assertFalse(any(r['outcome']['status'] == 'measured' for r in records))

    def test_determinism_and_committed_mirrors(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp') as directory:
            out = Path(directory)
            publish(out)
            before = {p.relative_to(out): p.read_bytes() for p in out.rglob('*') if p.is_file()}
            publish(out)
            after = {p.relative_to(out): p.read_bytes() for p in out.rglob('*') if p.is_file()}
            self.assertEqual(before, after)
            for relative, content in before.items():
                self.assertEqual(content, (ROOT / relative).read_bytes(), str(relative))

    def test_duplicate_sources_findings_investigations_rejected(self):
        for field in ['sources', 'findings', 'investigations']:
            data = copy.deepcopy(self.data)
            data[field].append(copy.deepcopy(data[field][0]))
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'Duplicate'):
                validate(data)

    def test_invalid_source_association_and_locator(self):
        for mutate in [lambda f: f.update(source_id='MISSING'),
                       lambda f: f.update(investigation_id='PSI-69'),
                       lambda f: f['locator'].update(section=''),
                       lambda f: f['locator'].update(pdf_page=0),
                       lambda f: f.update(experiment_ids=['BASS2-B1'])]:
            data = copy.deepcopy(self.data)
            mutate(data['findings'][0])
            with self.assertRaises(ValueError): validate(data)

    def test_invalid_units_status_raw_and_nonfinite_rejected(self):
        for patch in [{'unit': 'unknown'}, {'status': 'measured'}, {'raw': ''}, {'value': float('nan')}, {'qualifier': ''}]:
            data = copy.deepcopy(self.data)
            data['findings'][1]['quantities'][0].update(patch)
            with self.subTest(patch=patch), self.assertRaises(ValueError): validate(data)

    def test_source_hash_and_path_fail_closed(self):
        data = copy.deepcopy(self.data)
        data['sources'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'Changed source'): validate(data)
        data['sources'][0]['local_path'] = '../outside'
        with self.assertRaisesRegex(ValueError, 'escapes'): validate(data)

    def test_report_values_remain_qualified_and_unmapped(self):
        result, coverage, _ = compile_research(self.data)
        by_id = {f['id']: f for f in result['findings']}
        pressure = by_id['BASS-REPORT-PRESSURE-SUBSET']
        self.assertEqual([q['value'] for q in pressure['quantities']], [99.2, 99.5])
        self.assertTrue(all(q['unit'] == 'kPa' and q['status'] == 'reported_range_bound' for q in pressure['quantities']))
        self.assertEqual(by_id['BASS-REPORT-GAS-LAW']['quantities'][0]['status'], 'calculation_assumption')
        self.assertEqual(by_id['FLEX-REPORT-SIZE-UNCERTAINTY']['quantities'][0]['uncertainty'], '±50 µm')
        self.assertTrue(all(not f['experiment_ids'] for f in result['findings']))
        self.assertEqual(coverage['investigations'][2]['droplet_measurements'], 'not_normalized')

    def test_fingerprint_changes_with_curation(self):
        original = compile_research(self.data)[0]['dataset_version']
        self.data['findings'][0]['summary'] += ' Reviewed.'
        self.assertNotEqual(original, compile_research(self.data)[0]['dataset_version'])

    def test_bad_nasa_url_and_quantitative_classification(self):
        self.data['sources'][0]['url'] = 'https://example.com/PSI-25'
        with self.assertRaises(ValueError): validate(self.data)
        self.setUp()
        self.data['findings'][0]['quantitative'] = True
        with self.assertRaises(ValueError): validate(self.data)


if __name__ == '__main__': unittest.main()
