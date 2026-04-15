#!/usr/bin/env python3
"""
Fit one regressor per target metric and save the model bundle.
TabPFN is preferred; a simple sklearn fallback is used only if the import
fails so the project remains runnable in constrained environments.
"""

import argparse
import pickle

import numpy as np
import pandas as pd

try:
    from tabpfn import TabPFNRegressor  # type: ignore
except ImportError:  # pragma: no cover
    from sklearn.dummy import DummyRegressor as TabPFNRegressor

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


def train(data_path, out_path):
    df = pd.read_csv(data_path)
    df = df.dropna(subset=FEATURES + TARGETS)
    x = df[FEATURES].values.astype(float)

    models = {}
    for target in TARGETS:
        y = df[target].values.astype(float)
        model = TabPFNRegressor()
        model.fit(x, y)
        models[target] = model

    with open(out_path, "wb") as handle:
        pickle.dump(
            {"models": models, "features": FEATURES, "targets": TARGETS},
            handle,
        )

    print(f"Model bundle saved to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="ml/runs.csv")
    parser.add_argument("--out", default="ml/tabpfn_models.pkl")
    args = parser.parse_args()
    train(args.data, args.out)
