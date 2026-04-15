#!/usr/bin/env python3
"""Helpers for selecting the TabPFN backend."""

from __future__ import annotations

import importlib
import os
from typing import Any


def _require_cuda() -> bool:
    value = os.getenv("TABPFN_REQUIRE_CUDA", "0").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _pick_device() -> str:
    if _require_cuda():
        return "cuda"

    try:
        torch = importlib.import_module("torch")
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def make_regressor(backend: str = "auto"):
    """Create a regression backend and return it with bundle metadata."""
    local_error = None
    if backend not in {"auto", "tabpfn-local", "dummy"}:
        raise ValueError(f"unknown backend: {backend}")

    if backend in {"auto", "tabpfn-local"}:
        try:
            local_module = importlib.import_module("tabpfn")
            device = _pick_device()
            model = local_module.TabPFNRegressor(device=device)
            metadata = {
                "backend": "tabpfn-local",
                "auth_source": os.getenv("TABPFN_TOKEN") and "env",
                "device": device,
            }
            return model, metadata
        except Exception as exc:
            local_error = exc
            if backend == "tabpfn-local":
                raise

    from sklearn.dummy import DummyRegressor

    metadata: dict[str, Any] = {
        "backend": "dummy",
        "auth_source": None,
    }
    if local_error is not None:
        metadata["fallback_reason"] = str(local_error)
    return DummyRegressor(), metadata


def prepare_prediction_backend(bundle: dict[str, Any]):
    """Return backend auth metadata for prediction."""
    backend = bundle.get("backend", "unknown")

    if backend == "tabpfn-local":
        return os.getenv("TABPFN_TOKEN") and "env"

    return None
