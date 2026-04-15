#!/usr/bin/env python3
"""
Generate training data for the predictor by running the simulator on randomly
sampled workloads and recording the exported metrics.
"""

import argparse
import csv
import os
import random
import subprocess
import tempfile

ALGOS = ["fcfs", "sjf", "rr", "priority"]
ALGO_IDS = {algo: idx for idx, algo in enumerate(ALGOS)}
CSV_HEADER = [
    "algo",
    "algo_id",
    "n_procs",
    "avg_burst",
    "std_burst",
    "avg_arrival_gap",
    "max_priority",
    "quantum",
    "ctx_overhead",
    "avg_waiting",
    "avg_turnaround",
    "avg_response",
    "cpu_utilization",
    "throughput",
    "context_switches",
]
BINARY = "./cpu_scheduler"
EXPORT_FILE = "/tmp/cs_ml_export.csv"


def random_workload(n_min=2, n_max=12):
    n_procs = random.randint(n_min, n_max)
    procs = []
    arrival = 0
    for pid in range(1, n_procs + 1):
        burst = random.randint(1, 20)
        priority = random.randint(0, 9)
        procs.append((pid, arrival, burst, priority))
        arrival += random.randint(0, 5)
    return procs


def write_workload(procs, path):
    with open(path, "w", encoding="utf-8") as handle:
        for pid, arrival, burst, priority in procs:
            handle.write(f"{pid} {arrival} {burst} {priority}\n")


def run_simulator(workload_path, algo, quantum):
    if os.path.exists(EXPORT_FILE):
        os.remove(EXPORT_FILE)

    cmd = [BINARY, "-f", workload_path, "-a", algo, "-e", EXPORT_FILE]
    if algo == "rr":
        cmd.extend(["-q", str(quantum)])

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=10,
                                check=False)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None

    if result.returncode != 0 or not os.path.exists(EXPORT_FILE):
        return None

    with open(EXPORT_FILE, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return rows[-1] if rows else None


def generate(runs, output_path):
    written = 0
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    file_exists = os.path.exists(output_path)

    with open(output_path, "a", newline="", encoding="utf-8") as out_handle:
        writer = csv.DictWriter(out_handle, fieldnames=CSV_HEADER)
        if not file_exists:
            writer.writeheader()

        while written < runs:
            procs = random_workload()
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, encoding="utf-8"
            ) as tmp:
                write_workload(procs, tmp.name)
                tmp_path = tmp.name

            try:
                for algo in ALGOS:
                    quantum = random.choice([1, 2, 3, 4, 5]) \
                        if algo == "rr" else 0
                    row = run_simulator(tmp_path, algo, quantum)
                    if row is None:
                        continue
                    row["algo"] = algo
                    row["algo_id"] = ALGO_IDS[algo]
                    row["quantum"] = quantum
                    writer.writerow({key: row.get(key, "")
                                     for key in CSV_HEADER})
                    written += 1
                    if written >= runs:
                        break
            finally:
                os.unlink(tmp_path)

    print(f"Done. {written} rows written to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1000)
    parser.add_argument("--output", default="ml/runs.csv")
    args = parser.parse_args()
    generate(args.runs, args.output)
