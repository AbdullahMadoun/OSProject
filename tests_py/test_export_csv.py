import csv
import os
import subprocess

import pytest

BINARY = "./cpu_scheduler"


@pytest.fixture
def basic_workload(tmp_path):
    path = tmp_path / "wl.txt"
    path.write_text("1 0 5 0\n2 1 3 1\n3 3 4 2\n", encoding="utf-8")
    return str(path)


def test_binary_exists():
    assert os.path.isfile(BINARY), (
        f"Build the C binary first: {BINARY} not found"
    )


def test_export_csv_created(basic_workload, tmp_path):
    out = str(tmp_path / "result.csv")
    result = subprocess.run(
        [BINARY, "-f", basic_workload, "-a", "fcfs", "-e", out],
        capture_output=True,
        timeout=10,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode()
    assert os.path.exists(out)


def test_export_csv_has_header(basic_workload, tmp_path):
    out = str(tmp_path / "result.csv")
    subprocess.run(
        [BINARY, "-f", basic_workload, "-a", "fcfs", "-e", out],
        capture_output=True,
        timeout=10,
        check=False,
    )
    with open(out, encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
    assert len(rows) >= 1
    required = {"algo", "avg_waiting", "cpu_utilization", "throughput"}
    assert required.issubset(set(reader.fieldnames))


def test_export_values_are_numeric(basic_workload, tmp_path):
    out = str(tmp_path / "result.csv")
    subprocess.run(
        [BINARY, "-f", basic_workload, "-a", "fcfs", "-e", out],
        capture_output=True,
        timeout=10,
        check=False,
    )
    with open(out, encoding="utf-8") as handle:
        row = list(csv.DictReader(handle))[-1]
    assert float(row["avg_waiting"]) >= 0
    assert float(row["cpu_utilization"]) > 0


def test_export_all_algorithms_have_labels(tmp_path):
    out = str(tmp_path / "all.csv")
    result = subprocess.run(
        [BINARY, "-s", "basic", "-a", "all", "-e", out],
        capture_output=True,
        timeout=10,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode()
    with open(out, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["algo"] for row in rows] == [
        "fcfs",
        "sjf",
        "rr",
        "priority",
        "srtf",
        "priorityp",
        "mlfq",
    ]
    assert all(row["algo"] != "unknown" for row in rows)
