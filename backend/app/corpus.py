"""Bundled FIRETRACE corpus access.

The backend never invents data. It reads the same JSON files that the static
application ships, so a citation produced by the voice agent has the same
source locator as one produced in the browser.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Optional

from app.config import settings


class CorpusError(RuntimeError):
    """Raised when the bundled evidence files are missing or malformed."""


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise CorpusError(f"Evidence file not found: {path}")
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise CorpusError(f"Could not read evidence file {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise CorpusError(f"Evidence file {path} is not a JSON object.")
    return payload


class Corpus:
    def __init__(self, corpus_path: Path, manifest_path: Path, validation_path: Path) -> None:
        self.path = corpus_path
        self.raw = _read_json(corpus_path)
        self.manifest = _read_json(manifest_path)
        self.validation = _read_json(validation_path)

        self.records: list[dict[str, Any]] = list(self.raw.get("records") or [])
        self.claims: list[dict[str, Any]] = list(self.raw.get("claims") or [])
        self.meta: dict[str, Any] = dict(self.raw.get("meta") or {})
        self.presets: list[dict[str, Any]] = list(self.raw.get("presets") or [])

        self.records_by_id: dict[str, dict[str, Any]] = {
            str(record.get("experiment_id", "")).upper(): record
            for record in self.records
            if record.get("experiment_id")
        }
        self.alias: dict[str, dict[str, Any]] = dict(self.records_by_id)
        for record in self.records:
            test = str(record.get("test_number", "")).upper()
            if test and test not in self.alias:
                self.alias[test] = record

        self.claims_by_id: dict[str, dict[str, Any]] = {
            str(claim.get("claim_id", "")): claim for claim in self.claims
        }
        self.sources: list[dict[str, Any]] = list(self.manifest.get("sources") or [])
        self.context_sources: list[dict[str, Any]] = list(
            self.manifest.get("context_sources") or []
        )
        self.sources_by_id: dict[str, list[dict[str, Any]]] = {}
        for source in self.sources:
            self.sources_by_id.setdefault(str(source.get("source_id")), []).append(source)

    # ------------------------------------------------------------------
    # citations
    # ------------------------------------------------------------------
    def artifacts_for(self, source_id: str) -> list[dict[str, Any]]:
        return self.sources_by_id.get(source_id, [])

    def citation_for(self, source_id: str, locator: str) -> dict[str, Any]:
        artifacts = self.artifacts_for(source_id)
        artifact = next(
            (item for item in artifacts if item.get("role") == "experiment_table"),
            artifacts[0] if artifacts else None,
        )
        return {
            "sourceId": source_id,
            "title": (artifact or {}).get("source_title") or source_id,
            "locator": locator,
            "url": (artifact or {}).get("source_url") or "https://psi.nasa.gov/",
            "doi": (artifact or {}).get("doi"),
        }

    def challenge_citation(self) -> dict[str, Any]:
        source = next(
            (
                item
                for item in self.context_sources
                if item.get("source_id") == "CHALLENGE-2026"
            ),
            None,
        )
        return {
            "sourceId": "CHALLENGE-2026",
            "title": (source or {}).get("source_title")
            or "NASA Space Apps 2026 challenge",
            "locator": "Challenge page, “Spacesuits and oxygen concentration” and “Partial-gravity data”",
            "url": (source or {}).get("source_url")
            or "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/",
        }

    def ntrs_citation(self, locator: str) -> dict[str, Any]:
        return {
            "sourceId": "NTRS-20250010653",
            "title": "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket",
            "locator": locator,
            "url": "https://ntrs.nasa.gov/citations/20250010653",
        }

    def claim_citations(self, claim_ids: Iterable[str]) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for claim_id in claim_ids:
            claim = self.claims_by_id.get(claim_id)
            if not claim:
                continue
            source_ids = list(claim.get("supporting_source_ids") or [])
            locators = list(claim.get("supporting_locators") or [])
            source_id = source_ids[0] if source_ids else "PSI-25"
            artifacts = self.artifacts_for(source_id)
            result.append(
                {
                    "sourceId": source_id,
                    "title": claim.get("claim_text") or source_id,
                    "locator": locators[0] if locators else "Source claim",
                    "url": (artifacts[0] if artifacts else {}).get("source_url")
                    or "https://psi.nasa.gov/",
                    "doi": (artifacts[0] if artifacts else {}).get("doi"),
                }
            )
        return result

    @staticmethod
    def dedupe_citations(citations: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        result: list[dict[str, Any]] = []
        for citation in citations:
            key = f"{citation.get('sourceId')}|{citation.get('locator')}"
            if key in seen:
                continue
            seen.add(key)
            result.append(citation)
        return result

    # ------------------------------------------------------------------
    # lookup
    # ------------------------------------------------------------------
    def find_record(self, question: str) -> Optional[dict[str, Any]]:
        import re

        upper = question.upper()
        candidates = re.findall(r"\b(?:BASS2-)?[A-Z]{1,2}\d{1,3}[A-Z]?\b", upper)
        for candidate in candidates:
            direct = self.records_by_id.get(candidate) or self.alias.get(candidate)
            if direct:
                return direct
        explicit = re.search(r"\b(?:TEST|SAMPLE)\s+([A-Z]{1,2}\d{1,3}[A-Z]?)\b", upper)
        if explicit:
            return self.alias.get(explicit.group(1))
        return None

    def record_count(self) -> int:
        return len(self.records)

    def summary(self) -> dict[str, Any]:
        coverage = dict(self.meta.get("coverage") or {})
        return {
            "name": self.meta.get("name", "FIRETRACE"),
            "tagline": self.meta.get("tagline"),
            "record_count": self.meta.get("record_count", len(self.records)),
            "experiment_record_count": self.meta.get(
                "experiment_record_count", len(self.records)
            ),
            "source_artifact_count": self.meta.get("source_artifact_count", len(self.sources)),
            "investigation_count": self.meta.get("investigation_count"),
            "investigations": self.meta.get("investigations") or [],
            "quality_counts": self.meta.get("quality_counts") or {},
            "coverage": coverage,
            "generated_at": self.meta.get("generated_at"),
            "pipeline_version": self.meta.get("pipeline_version"),
        }

    def record_brief(self, record: dict[str, Any]) -> dict[str, Any]:
        return {
            "experiment_id": record.get("experiment_id"),
            "test_number": record.get("test_number"),
            "family": record.get("family"),
            "investigation_acronym": record.get("investigation_acronym"),
            "material_raw": record.get("material_raw"),
            "material_family": record.get("material_family"),
            "validation_status": record.get("validation_status"),
            "source_id": record.get("source_id"),
            "source_locator": record.get("source_locator"),
            "oxygen_initial_pct": (record.get("oxygen_initial_pct") or {}).get("value"),
            "total_pressure_psia": (record.get("total_pressure_psia") or {}).get("value"),
            "gravity_status": (record.get("gravity_regime") or {}).get("status"),
        }

    def search_records(
        self,
        query: str = "",
        family: str = "",
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        needle = query.strip().lower()
        family_needle = family.strip().lower()
        matched = []
        for record in self.records:
            if family_needle and str(record.get("family", "")).lower() != family_needle:
                continue
            if needle:
                haystack = " ".join(
                    str(record.get(field, "") or "")
                    for field in (
                        "experiment_id",
                        "test_number",
                        "material_raw",
                        "material_family",
                        "investigation",
                        "investigation_acronym",
                        "source_id",
                    )
                ).lower()
                if needle not in haystack:
                    continue
            matched.append(record)
        total = len(matched)
        safe_limit = max(1, min(int(limit), 100))
        safe_offset = max(0, int(offset))
        return [self.record_brief(item) for item in matched[safe_offset : safe_offset + safe_limit]], total


@lru_cache(maxsize=1)
def get_corpus() -> Corpus:
    return Corpus(settings.corpus_path, settings.manifest_path, settings.validation_path)
