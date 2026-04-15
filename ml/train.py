#!/usr/bin/env python3
"""Fit one regressor per target metric and save the model bundle."""

import argparse
import pickle

import pandas as pd

try:
    from .tabpfn_backend import make_regressor
except ImportError:
    from tabpfn_backend import make_regressor

FEATURES = [
    "algo_id",
    "n_procs",
    "avg_burst",
    "std_burst",
    "avg_arrival_gap",
    "max_priority",
    "quantum",
    "ctx_overhead",
]
TARGETS = [
    "avg_waiting",
    "avg_turnaround",
    "avg_response",
    "cpu_utilization",
    "throughput",
    "context_switches",
]


def train(data_path, out_path, backend="auto", interactive_auth=False):
    df = pd.read_csv(data_path)
    df = df.dropna(subset=FEATURES + TARGETS)
    x = df[FEATURES].values.astype(float)

    models = {}
    bundle_meta = None
    for target in TARGETS:
        y = df[target].values.astype(float)
        model, metadata = make_regressor(
            backend=backend,
            interactive_auth=interactive_auth,
        )
        model.fit(x, y)
        models[target] = model
        if bundle_meta is None:
            bundle_meta = metadata

    with open(out_path, "wb") as handle:
        pickle.dump(
            {
                "models": models,
                "features": FEATURES,
                "targets": TARGETS,
                "backend": bundle_meta["backend"],
                "auth_source": bundle_meta["auth_source"],
                "fallback_reason": bundle_meta.get("fallback_reason"),
            },
            handle,
        )

    print(f"Model bundle saved to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="ml/runs.csv")
    parser.add_argument("--out", default="ml/tabpfn_models.pkl")
    parser.add_argument(
        "--backend",
        choices=["auto", "tabpfn-local", "tabpfn-client", "dummy"],
        default="auto",
    )
    parser.add_argument(
        "--interactive-auth",
        action="store_true",
        help="allow the official tabpfn-client login flow if no token is set",
    )
    args = parser.parse_args()
    train(args.data, args.out, args.backend, args.interactive_auth)
