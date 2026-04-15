import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

from ml.train import train


def _free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_for_health(url, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("server did not become healthy")


def test_http_server_predict_and_exit(tmp_path):
    data_path = tmp_path / "runs.csv"
    model_path = tmp_path / "bundle.pkl"
    data_path.write_text(
        "algo_id,n_procs,avg_burst,std_burst,avg_arrival_gap,max_priority,"
        "quantum,ctx_overhead,avg_waiting,avg_turnaround,avg_response,"
        "cpu_utilization,throughput,context_switches\n"
        "0,4,6.0,2.0,1.0,3,0,0,8.0,14.0,7.0,1.0,0.15,0\n"
        "1,4,5.0,1.0,1.0,3,0,0,7.0,13.0,6.0,1.0,0.15,0\n",
        encoding="utf-8",
    )

    train(str(data_path), str(model_path), backend="dummy",
          interactive_auth=False)

    port = _free_port()
    proc = subprocess.Popen(
        [
            sys.executable,
            "ml/predict_http_server.py",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--model",
            str(model_path),
            "--backend",
            "dummy",
            "--shutdown-after-predict",
        ],
        cwd=".",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        health = _wait_for_health(f"http://127.0.0.1:{port}/health")
        assert health["status"] == "ok"

        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/predict",
            data=json.dumps(
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
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        assert payload["error"] is None
        assert "avg_waiting" in payload

        proc.wait(timeout=20)
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
