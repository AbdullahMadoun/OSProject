import json
import os
import subprocess
import sys

import pytest

SCRIPT = "ml/predict_once.py"
MODEL = "ml/tabpfn_models.pkl"

SAMPLE_REQUEST = json.dumps(
    {
        "algo_id": 0,
        "n_procs": 4,
        "avg_burst": 6.0,
        "std_burst": 2.0,
        "avg_arrival_gap": 1.0,
        "max_priority": 3,
        "quantum": 0,
        "ctx_overhead": 0,
    }
)


def test_predict_once_returns_json():
    if not os.path.exists(MODEL):
        pytest.skip("model not trained yet")
    result = subprocess.run(
        [sys.executable, SCRIPT, SAMPLE_REQUEST],
        capture_output=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode()
    payload = json.loads(result.stdout.decode().strip())
    assert payload.get("error") is None


def test_predict_once_has_all_targets():
    if not os.path.exists(MODEL):
        pytest.skip("model not trained yet")
    result = subprocess.run(
        [sys.executable, SCRIPT, SAMPLE_REQUEST],
        capture_output=True,
        timeout=60,
        check=False,
    )
    payload = json.loads(result.stdout.decode().strip())
    for key in [
        "avg_waiting",
        "avg_turnaround",
        "avg_response",
        "cpu_utilization",
        "throughput",
        "context_switches",
    ]:
        assert key in payload, f"missing key: {key}"
        assert isinstance(payload[key], (int, float))


def test_predict_once_values_non_negative():
    if not os.path.exists(MODEL):
        pytest.skip("model not trained yet")
    result = subprocess.run(
        [sys.executable, SCRIPT, SAMPLE_REQUEST],
        capture_output=True,
        timeout=60,
        check=False,
    )
    payload = json.loads(result.stdout.decode().strip())
    for key in [
        "avg_waiting",
        "avg_turnaround",
        "cpu_utilization",
        "throughput",
    ]:
        assert payload[key] >= 0, f"{key} is negative: {payload[key]}"


def test_predict_once_bad_request_returns_error():
    result = subprocess.run(
        [sys.executable, SCRIPT, '{"algo_id": 0}'],
        capture_output=True,
        timeout=30,
        check=False,
    )
    payload = json.loads(result.stdout.decode().strip())
    assert payload.get("error") is not None
