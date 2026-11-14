"""Shared pytest fixtures for the FIRETRACE backend."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.v1.middleware import limiter  # noqa: E402
from app.v1.store import get_store  # noqa: E402


@pytest.fixture(scope="session")
def store():
    return get_store()


@pytest.fixture()
def client():
    from api import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    limiter.reset()
    limiter.limit = 1000
    yield
    limiter.reset()
    limiter.limit = 1000
