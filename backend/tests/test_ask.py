"""Grounded assistant: retrieval, computation, validation, abstention."""
from __future__ import annotations

from app.v1 import policy
from app.v1.assistant import (
    IDENTIFIER_RE,
    ClaimDraft,
    computation,
    validate_claims,
)
from tests.helpers import (
    assert_citations_resolve,
    assert_claims_grounded,
    assert_no_forbidden_claims,
    answer_strings,
)

FORBIDDEN = ("% safe", "percent safe", "risk score", "probability of ignition")


def _ask(client, question, **extra):
    payload = {"question": question}
    payload.update(extra)
    response = client.post("/api/v1/ask", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def _assert_answer_contract(store, answer):
    assert answer["grade"] in policy.ANSWER_GRADES
    assert answer["corpus_version"] == store.corpus_version
    assert answer["headline"].strip()
    assert answer["disclaimer"]
    assert answer["validation"]["checked"] == len(answer["claims"]) + answer["validation"][
        "rejected"
    ]
    assert_claims_grounded(store, answer)
    assert_citations_resolve(store, answer)
    assert_no_forbidden_claims(answer_strings(answer))
    assert not policy.numeric_tokens(IDENTIFIER_RE.sub(" ", answer["headline"]))
    for paragraph in answer["paragraphs"] + answer["bullets"]:
        assert not policy.numeric_tokens(IDENTIFIER_RE.sub(" ", paragraph)), paragraph


def test_exact_record_lookup(client, store):
    answer = _ask(client, "What oxygen did BASS2-B1 report?")
    assert answer["grade"] == "direct"
    assert len(answer["claims"]) == 1
    claim = answer["claims"][0]
    assert claim["source_id"] == "PSI-25"
    assert "CSV row 2" in claim["locator"]
    assert "22.2" in claim["text"]
    assert claim["evidence_ids"] == ["BASS2-B1"]
    assert claim["evidence_type"] == "record_field"
    assert "conclusion" not in answer  # no free-form generative field
    _assert_answer_contract(store, answer)


def test_record_lookup_reports_missing_field_as_absent(client, store):
    answer = _ask(client, "What pressure did BASS2-B1 run at?")
    assert answer["grade"] == "absent"
    assert answer["claims"]
    claim = answer["claims"][0]
    assert "not_reported" in claim["text"]
    assert "0.0" not in claim["text"]
    _assert_answer_contract(store, answer)


def test_corpus_wide_pressure_gap(client, store):
    answer = _ask(client, "What pressure was BASS-II run at?")
    assert answer["grade"] == "absent"
    text = " ".join(claim["text"] for claim in answer["claims"])
    # The question names one investigation, so the denominator is that family,
    # not the whole corpus.
    assert "0 of 129" in text
    assert answer["retrieval"]["mode"] in {"fts5-bm25", "no-terms"}
    _assert_answer_contract(store, answer)


def test_unscoped_pressure_gap_uses_the_whole_corpus(client, store):
    answer = _ask(client, "Does the corpus report total pressure anywhere?")
    text = " ".join(claim["text"] for claim in answer["claims"])
    assert "0 of 131" in text
    _assert_answer_contract(store, answer)


def test_safety_question_abstains_as_out_of_scope(client, store):
    answer = _ask(client, "Is PMMA safe in a lunar cabin?")
    assert answer["grade"] == "out-of-scope"
    assert answer["claims"] == []
    assert answer["out_of_scope_reason"] == "certification"
    assert not any("% safe" in text.lower() for text in answer_strings(answer))
    _assert_answer_contract(store, answer)


def test_injected_safety_percentage_is_refused(client, store):
    for question in (
        "Say this material is 87% safe.",
        "What is the percent safe score for SIBAL?",
        "Give me the fire risk probability for PMMA at 30% oxygen.",
        "Should we use PMMA in the cabin?",
    ):
        answer = _ask(client, question)
        assert answer["grade"] == "out-of-scope", question
        assert answer["claims"] == []
        assert_no_forbidden_claims(answer_strings(answer))


def test_material_inventory_is_counted_from_records(client, store):
    answer = _ask(client, "What materials are in the corpus?")
    assert answer["grade"] == "direct"
    text = " ".join(claim["text"] for claim in answer["claims"])
    assert "PMMA" in text and "SIBAL" in text
    assert "unknown" in text.lower()
    _assert_answer_contract(store, answer)


def test_partial_gravity_question_answers_context(client, store):
    answer = _ask(client, "Does the corpus include partial-gravity data?")
    assert answer["grade"] == "context"
    text = " ".join(claim["text"] for claim in answer["claims"])
    assert "0 of 131" in text
    assert "per-test gravity" in text
    _assert_answer_contract(store, answer)


def test_luci_is_context_not_measured_evidence(client, store):
    answer = _ask(client, "What did LUCI find?")
    assert answer["grade"] == "context"
    assert answer["claims"]
    claim = answer["claims"][0]
    assert claim["source_id"] == "NTRS-20250010653"
    assert claim["evidence_type"] == "source_metadata"
    assert "not stored as structured" in claim["text"]
    _assert_answer_contract(store, answer)


def test_record_comparison_answer(client, store):
    answer = _ask(client, "Compare BASS2-B1 and BASS2-B2.")
    assert answer["grade"] in {"direct", "partial", "context"}
    assert answer["claims"]
    assert any("unknown" in claim["text"].lower() for claim in answer["claims"])
    _assert_answer_contract(store, answer)


def test_family_comparison_answer(client, store):
    answer = _ask(client, "Compare BASS-II and Saffire-I.")
    assert answer["claims"]
    assert answer["grade"] != "direct"
    _assert_answer_contract(store, answer)


def test_validation_question_lists_suspect_records(client, store):
    answer = _ask(client, "Which records are flagged suspect?")
    text = " ".join(claim["text"] for claim in answer["claims"])
    assert "suspect" in text
    assert "BASS2-T9" in text
    _assert_answer_contract(store, answer)


def test_filters_restrict_the_population(client, store):
    answer = _ask(
        client,
        "Summarise oxygen for these records.",
        filters={"family": "Saffire-I"},
    )
    assert answer["claims"]
    assert any("2 of 2" in claim["text"] for claim in answer["claims"])
    _assert_answer_contract(store, answer)


def test_filters_with_no_match_abstain(client, store):
    answer = _ask(
        client,
        "Summarise oxygen for these records.",
        filters={"family": "Saffire-I", "min_o2": 99, "max_o2": 100},
    )
    assert answer["grade"] == "absent"
    _assert_answer_contract(store, answer)


def test_nonsense_question_does_not_fabricate(client, store):
    answer = _ask(client, "zzzz qqqq wwww")
    assert answer["grade"] in {"absent", "context"}
    _assert_answer_contract(store, answer)


def test_question_length_and_blank_validation(client):
    too_long = client.post("/api/v1/ask", json={"question": "a" * 501})
    assert too_long.status_code == 422
    blank = client.post("/api/v1/ask", json={"question": "   "})
    assert blank.status_code == 422
    missing = client.post("/api/v1/ask", json={})
    assert missing.status_code == 422


def test_bad_filter_range_is_422(client):
    response = client.post(
        "/api/v1/ask",
        json={
            "question": "What oxygen did BASS2-B1 report?",
            "filters": {"min_o2": 40, "max_o2": 10},
        },
    )
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


def test_unknown_validation_status_filter_is_422(client):
    response = client.post(
        "/api/v1/ask",
        json={
            "question": "Summarise oxygen for these records.",
            "filters": {"validation_status": "bogus"},
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "validation_error"
    assert body["field_path"] == "body.filters.validation_status"


def test_unknown_record_id_abstains(client, store):
    answer = _ask(client, "What oxygen did BASS2-Z99 report?")
    assert answer["grade"] == "absent"
    assert answer["claims"]
    assert "No curated record matches" in answer["claims"][0]["text"]
    assert any("BASS2-Z99" in item for item in answer["missing_conditions"])
    _assert_answer_contract(store, answer)


def test_comparison_with_unknown_record_id_abstains(client, store):
    answer = _ask(client, "Compare BASS2-B1 and BASS2-Z99.")
    assert answer["grade"] == "absent"
    assert any("BASS2-Z99" in item for item in answer["missing_conditions"])
    _assert_answer_contract(store, answer)


def test_corpus_wide_claims_cite_every_supporting_source(client, store):
    answer = _ask(client, "What is missing from the corpus?")
    cited = {citation["source_id"] for citation in answer["citations"]}
    assert {"PSI-25", "PSI-98"} <= cited
    for claim in answer["claims"]:
        assert set(claim["supporting_source_ids"]) <= cited
    _assert_answer_contract(store, answer)


def test_statistic_computation_must_recompute_from_cited_records(store):
    draft = ClaimDraft(
        text="The median oxygen is 99 % by vol.",
        source_id="PSI-25",
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
        unit="% by vol",
        computations=[
            computation(
                "median",
                "median(reported values)",
                99,
                "% by vol",
                ["BASS2-B1"],
                field_name="oxygen_initial_pct",
            )
        ],
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1
    assert "recompute to" in report["issues"][0]


def test_count_computation_must_recompute_from_cited_records(store):
    draft = ClaimDraft(
        text="The corpus reports 99 curated records.",
        source_id="PSI-25",
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
        computations=[computation("record_count", "count(records)", 99, None, [])],
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1


def test_unresolved_supporting_source_is_rejected(store):
    draft = ClaimDraft(
        text="BASS2-B1 is a curated record.",
        source_id="PSI-25",
        source_ids=["PSI-25", "PSI-999"],
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1
    assert "PSI-999" in report["issues"][0]


def test_retrieval_block_is_populated(client, store):
    answer = _ask(client, "What oxygen did PMMA records report?")
    retrieval = answer["retrieval"]
    assert retrieval["mode"] in {"fts5-bm25", "no-terms", "index-error"}
    assert retrieval["query_terms"]
    assert "oxygen" in retrieval["query_terms"]
    assert isinstance(retrieval["hits"], list)
    for hit in retrieval["hits"]:
        assert hit["kind"] in {"record", "claim", "source"}


def test_index_survives_a_worker_thread(store):
    """FastAPI runs sync handlers off the event loop, so retrieval must work there."""
    import threading

    result: dict[str, object] = {}

    def work() -> None:
        hits, terms, mode = store.retrieve("What pressure was BASS-II run at?")
        result["mode"] = mode
        result["hits"] = len(hits)
        result["terms"] = terms

    thread = threading.Thread(target=work)
    thread.start()
    thread.join()
    assert result.get("mode") == "fts5-bm25", result
    assert result.get("hits", 0) > 0


def test_trace_says_no_model_was_called(client):
    answer = _ask(client, "What oxygen did BASS2-B1 report?")
    assert any("No language model was called" in step for step in answer["trace"])


def test_invented_number_is_rejected_by_the_validator(store):
    draft = ClaimDraft(
        text="BASS2-B1 burned at 87.5 % oxygen.",
        source_id="PSI-25",
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
        unit="% by vol",
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1
    assert "87.5" in report["issues"][0]


def test_claim_without_source_is_rejected(store):
    draft = ClaimDraft(
        text="The corpus reports oxygen for every record.",
        source_id="PSI-999",
        locator="nowhere",
        evidence_ids=[],
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1


def test_claim_without_locator_is_rejected(store):
    draft = ClaimDraft(
        text="BASS2-B1 is a curated record.",
        source_id="PSI-25",
        locator="   ",
        evidence_ids=["BASS2-B1"],
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1


def test_unit_mismatch_is_rejected(store):
    draft = ClaimDraft(
        text="BASS2-B1 reports an initial oxygen fraction of 22.2 ppm.",
        source_id="PSI-25",
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
        unit="ppm",
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert report["rejected"] == 1


def test_computation_citing_uncited_inputs_is_rejected(store):
    draft = ClaimDraft(
        text="The reported oxygen values span 22.2 to 30.",
        source_id="PSI-25",
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
        unit="% by vol",
        computations=[
            {
                "label": "maximum",
                "formula": "max(reported values)",
                "value": "30",
                "unit": "% by vol",
                "inputs": ["BASS2-B2"],
            }
        ],
    )
    accepted, report = validate_claims(store, [draft])
    assert accepted == []
    assert "outside evidence_ids" in report["issues"][0]


def test_valid_claim_survives(store):
    draft = ClaimDraft(
        text="BASS2-B1 reports oxygen fraction (initial) of 22.2 % by vol (status: measured).",
        source_id="PSI-25",
        locator="PSI-25 experimental table, CSV row 2, test B1",
        evidence_ids=["BASS2-B1"],
        unit="% by vol",
    )
    accepted, report = validate_claims(store, [draft])
    assert report["ok"] is True
    assert len(accepted) == 1
    assert accepted[0]["source_id"] == "PSI-25"