#!/usr/bin/env python3
"""Persistent prediction server over a Unix domain socket."""

import argparse
import json
import os
import pickle
import socket

import numpy as np

try:
    from .tabpfn_backend import prepare_prediction_backend
except ImportError:
    from tabpfn_backend import prepare_prediction_backend


def load_bundle(path):
    with open(path, "rb") as handle:
        bundle = pickle.load(handle)
    prepare_prediction_backend(bundle)
    return bundle


def predict(bundle, request_dict):
    features = bundle["features"]
    models = bundle["models"]

    try:
        x = np.array([[float(request_dict[key]) for key in features]])
    except (KeyError, TypeError, ValueError) as exc:
        return {"error": f"bad request: {exc}"}

    result = {"error": None}
    for target, model in models.items():
        result[target] = float(model.predict(x)[0])
    return result


def serve(model_path, socket_path):
    bundle = load_bundle(model_path)

    if os.path.exists(socket_path):
        os.unlink(socket_path)

    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as server:
        server.bind(socket_path)
        server.listen(1)

        while True:
            conn, _ = server.accept()
            with conn:
                data = b""
                while True:
                    chunk = conn.recv(4096)
                    if not chunk:
                        break
                    data += chunk
                    if b"\n" in data:
                        break

                try:
                    request = json.loads(data.decode().strip())
                except json.JSONDecodeError as exc:
                    response = {"error": f"json decode: {exc}"}
                    conn.sendall((json.dumps(response) + "\n").encode())
                    continue

                if request.get("shutdown"):
                    conn.sendall(b'{"shutdown":true}\n')
                    break

                response = predict(bundle, request)
                conn.sendall((json.dumps(response) + "\n").encode())

    if os.path.exists(socket_path):
        os.unlink(socket_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="ml/tabpfn_models.pkl")
    parser.add_argument("--socket", default="/tmp/cpu_scheduler_predict.sock")
    args = parser.parse_args()
    serve(args.model, args.socket)
