#!/usr/bin/env python3
"""One-shot prediction fallback used when the socket server is unavailable."""

import json
import pickle
import sys

import numpy as np

try:
    from .tabpfn_backend import prepare_prediction_backend
except ImportError:
    from tabpfn_backend import prepare_prediction_backend

MODEL_PATH = "ml/tabpfn_models.pkl"


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: predict_once.py '<json>'"}))
        sys.exit(1)

    try:
        request = json.loads(sys.argv[1])
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"json: {exc}"}))
        sys.exit(1)

    try:
        with open(MODEL_PATH, "rb") as handle:
            bundle = pickle.load(handle)
    except FileNotFoundError:
        print(json.dumps({"error": f"model not found: {MODEL_PATH}"}))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"error": f"model load failed: {exc}"}))
        sys.exit(1)

    try:
        prepare_prediction_backend(bundle)
    except Exception as exc:
        print(json.dumps({"error": f"tabpfn auth failed: {exc}"}))
        sys.exit(1)

    features = bundle["features"]
    models = bundle["models"]

    try:
        x = np.array([[float(request[key]) for key in features]])
    except (KeyError, ValueError) as exc:
        print(json.dumps({"error": f"feature missing: {exc}"}))
        sys.exit(1)

    result = {"error": None}
    for target, model in models.items():
        result[target] = round(float(model.predict(x)[0]), 4)

    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
