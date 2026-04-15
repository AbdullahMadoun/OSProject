#!/usr/bin/env python3
"""Helpers for selecting and authenticating the TabPFN backend."""

from __future__ import annotations

import importlib
import os
from pathlib import Path
from typing import Any

TOKEN_ENV_VAR = "TABPFN_ACCESS_TOKEN"
INTERACTIVE_ENV_VAR = "TABPFN_INTERACTIVE_LOGIN"


def _truthy(value: str | None) -> bool:
    return bool(value) and value.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _load_client_module():
    return importlib.import_module("tabpfn_client")


def _client_cache_path(client_module) -> Path:
    return Path(client_module.__file__).resolve().parent / ".tabpfn" / "config"


def resolve_client_token(client_module=None, explicit_token: str | None = None):
    """Resolve a TabPFN client token from argument, environment, or cache."""
    client_module = client_module or _load_client_module()

    if explicit_token:
        return explicit_token.strip(), "argument"

    env_token = os.getenv(TOKEN_ENV_VAR)
    if env_token:
        return env_token.strip(), "env"

    cache_path = _client_cache_path(client_module)
    if cache_path.exists():
        cached_token = cache_path.read_text(encoding="utf-8").strip()
        if cached_token:
            return cached_token, "cache"

    return None, None


def configure_client_auth(explicit_token: str | None = None,
                          interactive: bool = False,
                          client_module=None):
    """Configure the official tabpfn-client module for authenticated use."""
    client_module = client_module or _load_client_module()
    token, source = resolve_client_token(client_module, explicit_token)

    if token:
        client_module.set_access_token(token)
        return client_module, source

    if interactive or _truthy(os.getenv(INTERACTIVE_ENV_VAR)):
        token = client_module.get_access_token()
        client_module.set_access_token(token)
        return client_module, "interactive"

    raise RuntimeError(
        "No TabPFN client token available. Set TABPFN_ACCESS_TOKEN, "
        "run python3 ml/init_tabpfn_client.py, or enable interactive auth."
    )


def make_regressor(backend: str = "auto",
                   interactive_auth: bool = False,
                   explicit_token: str | None = None):
    """Create a regression backend and return it with bundle metadata."""
    local_error = None
    client_error = None

    if backend not in {"auto", "tabpfn-local", "tabpfn-client", "dummy"}:
        raise ValueError(f"unknown backend: {backend}")

    if backend in {"auto", "tabpfn-local"}:
        try:
            local_module = importlib.import_module("tabpfn")
            model = local_module.TabPFNRegressor()
            metadata = {
                "backend": "tabpfn-local",
                "auth_source": os.getenv("TABPFN_TOKEN") and "env",
            }
            return model, metadata
        except Exception as exc:
            local_error = exc
            if backend == "tabpfn-local":
                raise

    if backend in {"auto", "tabpfn-client"}:
        try:
            client_module, auth_source = configure_client_auth(
                explicit_token=explicit_token,
                interactive=interactive_auth,
            )
            model = client_module.TabPFNRegressor()
            metadata = {
                "backend": "tabpfn-client",
                "auth_source": auth_source,
            }
            return model, metadata
        except Exception as exc:
            client_error = exc
            if backend == "tabpfn-client":
                raise

    from sklearn.dummy import DummyRegressor

    metadata: dict[str, Any] = {
        "backend": "dummy",
        "auth_source": None,
    }
    if local_error is not None:
        metadata["local_fallback_reason"] = str(local_error)
    if client_error is not None:
        metadata["fallback_reason"] = str(client_error)
    return DummyRegressor(), metadata


def prepare_prediction_backend(bundle: dict[str, Any],
                               interactive_auth: bool = False,
                               explicit_token: str | None = None):
    """Configure auth for prediction if the saved bundle uses tabpfn-client."""
    backend = bundle.get("backend", "unknown")

    if backend == "tabpfn-client":
        _, auth_source = configure_client_auth(
            explicit_token=explicit_token,
            interactive=interactive_auth,
        )
        return auth_source

    if backend == "tabpfn-local":
        return os.getenv("TABPFN_TOKEN") and "env"

    return None
