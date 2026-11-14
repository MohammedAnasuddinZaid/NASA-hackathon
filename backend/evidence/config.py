from dataclasses import dataclass
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    database: Path = ROOT / "backend/data/evidence.sqlite3"
    data_dir: Path = ROOT / "src/data"
    raw_dir: Path = ROOT / "data/raw"
    origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173")

    @classmethod
    def from_env(cls):
        origins = tuple(x.strip() for x in os.getenv("FIRETRACE_EVIDENCE_ORIGINS", ",".join(cls.origins)).split(",") if x.strip())
        if any(x == "*" or not x.startswith(("http://", "https://")) for x in origins):
            raise ValueError("Explicit HTTP frontend origins are required")
        return cls(database=Path(os.getenv("FIRETRACE_EVIDENCE_DB", str(cls.database))), origins=origins)
