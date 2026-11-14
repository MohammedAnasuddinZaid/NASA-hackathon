"""Controlled access to registered originals; never a client filesystem path."""
import hashlib
from pathlib import Path
from app.config import settings
from app.v1.errors import ApiError


def artifact_id(source):
    return source["source_id"] + "--" + (source.get("original_filename") or source["role"])


def original_path(source, raw_dir=None):
    root = Path(raw_dir or settings.project_dir / "data/raw").resolve()
    filename = source.get("original_filename")
    if not filename or Path(filename).name != filename or "\\" in filename:
        return None
    path = (root / filename).resolve()
    if not path.is_relative_to(root) or "cc0" not in str(source.get("license_url") or "").lower():
        return None
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != source.get("sha256"):
        return None
    return path


def source_view(store, source_id):
    result = store.resolve_source(source_id)
    if result is None:
        raise ApiError(404, "not_found", "Source not found", "path.source_id")
    result["artifacts"] = [{**item, "artifact_id": artifact_id(item), "download_available": original_path(item) is not None} for item in result["artifacts"]]
    return result
