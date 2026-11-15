"""Release regression cases use existing scientific records; no network/model calls."""
import copy
import csv
import io
import pytest
from app.v1.exports import records_csv, spreadsheet_value


@pytest.mark.parametrize('text', ['=1+1', '+SUM(A1)', '-CMD', '@x', '\t=1', '\ufeff=1', '\u200b@x'])
def test_backend_csv_formula_text(text):
    assert spreadsheet_value(text) == "'" + text


@pytest.mark.parametrize('value', [0, -2.5, 22.2, None])
def test_csv_numeric_and_null_types(value):
    assert spreadsheet_value(value) == value


def test_api_csv_escapes_source_text_without_changing_original_record(store):
    record = copy.deepcopy(store.resolve_record('BASS2-B1'))
    record['material_raw'] = '\t=HYPERLINK("https://example.test")'
    content, count = records_csv(store, [record])
    row = next(csv.DictReader(io.StringIO(content)))
    assert count == 1 and row['material_raw'].startswith("'\t=")
    assert row['total_pressure_psia_value'] == ''
    assert store.resolve_record('BASS2-B1')['material_raw'] != record['material_raw']


def test_trace_dataset_mismatch_rejected_before_answer(client):
    response = client.post('/api/v1/assistant/query', headers={'X-Corpus-Version': 'stale'},
                           json={'question': 'BASS2-B1 oxygen', 'mode': 'deterministic'})
    assert response.status_code == 409


@pytest.mark.parametrize('question', ['How does FLEX differ from BASS-II?', 'What does the BASS-II summary report say about pressure?'])
def test_report_question_does_not_become_record_fact(store, question):
    from app.v1.assistant import answer
    result = answer(store, question)
    assert result['grade'] == 'absent' and result['claims'] == []
    assert 'Research Library' in ' '.join(result['paragraphs'])
