"""Validate the actual browser-downloaded example outputs using independent parsers."""
import csv
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'docs/evidence/pr5/generated'
corpus_bytes = (root / 'src/data/corpus.json').read_bytes()
corpus = json.loads(corpus_bytes)
records = {record['experiment_id']: record for record in corpus['records']}
brief = json.loads((folder / 'selected-evidence.json').read_text(encoding='utf-8'))
assert brief['schema_version'] == 'firetrace.research-brief/1'
assert brief['dataset_version'] == hashlib.sha256(corpus_bytes).hexdigest()
assert len(brief['selected_ids']) == len(set(brief['selected_ids'])) == brief['record_count']
assert brief['records'] == [records[record_id] for record_id in brief['selected_ids']]
with (folder / 'selected-evidence.csv').open(encoding='utf-8', newline='') as stream:
    reader = csv.DictReader(stream)
    rows = list(reader)
    assert len(reader.fieldnames) == 26
assert rows and all(None not in row for row in rows)
assert set(row['experiment_id'] for row in rows) == set(brief['selected_ids'])
assert all(row['dataset_version'] == brief['dataset_version'] and row['generated_at'] == brief['generated_at'] for row in rows)
assert all(row['normalized_value'] == '' for row in rows if row['quantity'] == 'total_pressure_psia')
assert any(row['experiment_id'] == 'BASS2-B1' and row['quantity'] == 'oxygen_initial_pct' and row['normalized_value'] == '22.2' and row['status'] == 'corrected' for row in rows)
assert any(row['experiment_id'] == 'SAFFIRE1-S1' and row['quantity'] == 'sample_thickness' and row['original_unit'] == 'cm' and row['normalized_unit'] == 'mm' and row['normalized_value'] == '3.7' for row in rows)
markdown = (folder / 'selected-evidence.md').read_text(encoding='utf-8')
html = (folder / 'selected-evidence.html').read_text(encoding='utf-8')
for section in ['Research scope', 'Selected experiments', 'Evidence observations', 'Comparison limitations', 'Source references', 'Scientific limitations']:
    assert section in markdown and section in html
assert '<script' not in html.lower() and '@media print' in html
assert brief['dataset_version'] in html and brief['dataset_version'] in markdown
assert 'CSV row 2' in markdown and 'CSV row 2' in html
print(json.dumps({'selected_records': brief['record_count'], 'csv_rows': len(rows), 'csv_columns': 26,
    'exact_source_record_roundtrip': True, 'dataset_sha256': brief['dataset_version'],
    'nulls_units_statuses_citations': 'verified', 'formats': ['CSV', 'JSON', 'Markdown', 'printable HTML']}, indent=2))
