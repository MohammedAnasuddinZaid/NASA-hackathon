"""FIRETRACE evidence API, version 1.

This package is deliberately independent of every optional AI runtime. It only
needs ``fastapi``, ``pydantic`` and the Python standard library, so the typed
evidence API boots on a machine with no Ollama, whisper.cpp, sherpa-onnx or
onnxruntime installed.
"""
from __future__ import annotations

API_VERSION = "v1"

__all__ = ["API_VERSION"]
