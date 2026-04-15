import os
import pickle

import numpy as np
import pandas as pd

MODEL_PATH = "ml/tabpfn_models.pkl"
DATA_PATH = "ml/runs.csv"


def test_data_exists():
    assert os.path.exists(DATA_PATH), (
        "Run ml/generate_data.py first to produce ml/runs.csv"
    )


def test_data_has_required_columns():
    df = pd.read_csv(DATA_PATH)
    required = {
        "algo_id",
        "n_procs",
        "avg_burst",
        "avg_waiting",
        "cpu_utilization",
        "throughput",
    }
    assert required.issubset(df.columns)


def test_data_no_negative_burst():
    df = pd.read_csv(DATA_PATH)
    assert (df["avg_burst"] > 0).all()


def test_model_file_exists():
    assert os.path.exists(MODEL_PATH), (
        "Run ml/train.py first to produce ml/tabpfn_models.pkl"
    )


def test_model_bundle_structure():
    with open(MODEL_PATH, "rb") as handle:
        bundle = pickle.load(handle)
    assert "models" in bundle
    assert "features" in bundle
    assert "targets" in bundle
    for target in bundle["targets"]:
        assert target in bundle["models"]


def test_model_predicts_shape():
    with open(MODEL_PATH, "rb") as handle:
        bundle = pickle.load(handle)
    x = np.array([[0, 4, 6.0, 2.0, 1.5, 3, 0, 0]])
    for target, model in bundle["models"].items():
        pred = model.predict(x)
        assert pred.shape == (1,), f"wrong shape for {target}"
        assert np.isfinite(pred[0]), f"non-finite prediction for {target}"
