#!/usr/bin/env python3
"""Small HTTP server for remote prediction on Vast.ai."""

from __future__ import annotations

import argparse
import json
import pickle
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading

import numpy as np

try:
    from .tabpfn_backend import prepare_prediction_backend
    from .train import train
except ImportError:
    from tabpfn_backend import prepare_prediction_backend
    from train import train


def load_or_train_bundle(model_path, data_path, backend):
    model_file = Path(model_path)
    if not model_file.exists():
        train(data_path, model_path, backend=backend)

    with model_file.open("rb") as handle:
        bundle = pickle.load(handle)
    prepare_prediction_backend(bundle)
    return bundle


def predict_from_bundle(bundle, request_dict):
    features = bundle["features"]
    models = bundle["models"]

    x = np.array([[float(request_dict[key]) for key in features]])
    result = {"error": None}
    for target, model in models.items():
        result[target] = float(model.predict(x)[0])
    return result


class PredictHandler(BaseHTTPRequestHandler):
    bundle = None
    shutdown_after_predict = False

    def _send_json(self, payload, status=HTTPStatus.OK):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(
                {
                    "status": "ok",
                    "backend": self.bundle.get("backend"),
                    "auth_source": self.bundle.get("auth_source"),
                    "device": self.bundle.get("device"),
                }
            )
            return
        self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self):
        if self.path != "/predict":
            self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json({"error": "bad content length"},
                            status=HTTPStatus.BAD_REQUEST)
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            result = predict_from_bundle(self.bundle, payload)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        self._send_json(result)
        if self.shutdown_after_predict:
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, fmt, *args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--model", default="ml/tabpfn_models.pkl")
    parser.add_argument("--data", default="ml/runs.csv")
    parser.add_argument(
        "--backend",
        choices=["auto", "tabpfn-local", "dummy"],
        default="auto",
    )
    parser.add_argument("--shutdown-after-predict", action="store_true")
    args = parser.parse_args()

    PredictHandler.bundle = load_or_train_bundle(
        args.model,
        args.data,
        args.backend,
    )
    PredictHandler.shutdown_after_predict = args.shutdown_after_predict
    server = ThreadingHTTPServer((args.host, args.port), PredictHandler)
    print(
        f"Listening on http://{args.host}:{args.port} "
        f"with backend={PredictHandler.bundle.get('backend')}",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
