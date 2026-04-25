#!/usr/bin/env python3
"""
Sample local OS processes and convert the observed CPU demand into a scheduler
workload.

This is intentionally a user-space approximation. It does not replace or
inspect the kernel scheduler. It samples process CPU time, turns each active
process into a simulated job, and lets the existing C simulator compare FCFS,
SJF, RR, and priority scheduling on that observed workload.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime
import math
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time


MAX_SIM_PROCS = 256
ALGOS = ("fcfs", "sjf", "rr", "priority")


@dataclass
class ProcStats:
    pid: int
    create_time: float
    name: str
    first_seen: float
    last_seen: float
    first_cpu: float
    last_cpu: float
    max_rss: int
    nice: int | None
    status: str
    samples: int = 1

    @property
    def cpu_delta(self) -> float:
        return max(0.0, self.last_cpu - self.first_cpu)


@dataclass
class SimProcess:
    sim_pid: int
    os_pid: int
    create_time: float
    name: str
    arrival: int
    burst: int
    priority: int
    cpu_seconds: float
    first_seen: float
    last_seen: float
    max_rss: int
    nice: int | None
    samples: int


def _default_binary() -> str:
    return "cpu_scheduler.exe" if os.name == "nt" else "./cpu_scheduler"


def _timestamp_slug() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _ascii_safe(text: object, anonymous: bool = False) -> str:
    if anonymous:
        return "process"
    raw = str(text or "unknown").replace("\n", " ").replace("\r", " ")
    return "".join(ch if 32 <= ord(ch) < 127 else "?" for ch in raw)


def _load_psutil():
    try:
        import psutil  # type: ignore
    except ImportError:
        print(
            "Missing dependency: psutil. Install it with "
            "`python3 -m pip install psutil` or install requirements.txt.",
            file=sys.stderr,
        )
        return None
    return psutil


def _priority_to_sim(nice: int | None) -> int:
    """Map OS priority/nice values to the simulator's lower-is-better scale."""
    if nice is None:
        return 20

    if platform.system().lower().startswith("win"):
        windows_priority_map = {
            256: 0,      # REALTIME_PRIORITY_CLASS
            128: 5,      # HIGH_PRIORITY_CLASS
            32768: 10,   # ABOVE_NORMAL_PRIORITY_CLASS
            32: 20,      # NORMAL_PRIORITY_CLASS
            16384: 30,   # BELOW_NORMAL_PRIORITY_CLASS
            64: 39,      # IDLE_PRIORITY_CLASS
        }
        return windows_priority_map.get(int(nice), 20)

    return max(0, min(39, int(nice) + 20))


def _snapshot(psutil, elapsed: float, sample_index: int, anonymous: bool):
    rows = []
    for proc in psutil.process_iter(
        ["pid", "name", "create_time", "status", "cpu_times",
         "memory_info", "num_threads"]
    ):
        try:
            info = proc.info
            cpu_times = info.get("cpu_times")
            cpu_seconds = 0.0
            if cpu_times is not None:
                cpu_seconds = float(cpu_times.user + cpu_times.system)

            memory_info = info.get("memory_info")
            rss = int(getattr(memory_info, "rss", 0) or 0)
            nice = proc.nice()

            rows.append(
                {
                    "sample": sample_index,
                    "elapsed": elapsed,
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "pid": int(info["pid"]),
                    "create_time": float(info.get("create_time") or 0.0),
                    "name": _ascii_safe(info.get("name"), anonymous),
                    "status": _ascii_safe(info.get("status")),
                    "cpu_seconds": cpu_seconds,
                    "rss_bytes": rss,
                    "nice": int(nice) if nice is not None else "",
                    "num_threads": int(info.get("num_threads") or 0),
                }
            )
        except (
            psutil.AccessDenied,
            psutil.NoSuchProcess,
            psutil.ZombieProcess,
            ProcessLookupError,
        ):
            continue
    return rows


def collect_process_log(
    duration: float,
    interval: float,
    raw_log_path: Path,
    anonymous: bool,
) -> dict[tuple[int, float], ProcStats]:
    psutil = _load_psutil()
    if psutil is None:
        raise RuntimeError("psutil is not installed")

    _ensure_parent(raw_log_path)
    stats: dict[tuple[int, float], ProcStats] = {}
    start = time.monotonic()
    sample_index = 0
    fieldnames = [
        "sample",
        "elapsed",
        "timestamp",
        "pid",
        "create_time",
        "name",
        "status",
        "cpu_seconds",
        "rss_bytes",
        "nice",
        "num_threads",
    ]

    with raw_log_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()

        while True:
            elapsed = time.monotonic() - start
            rows = _snapshot(psutil, elapsed, sample_index, anonymous)
            writer.writerows(rows)

            for row in rows:
                key = (int(row["pid"]), round(float(row["create_time"]), 3))
                existing = stats.get(key)
                if existing is None:
                    stats[key] = ProcStats(
                        pid=int(row["pid"]),
                        create_time=float(row["create_time"]),
                        name=str(row["name"]),
                        first_seen=elapsed,
                        last_seen=elapsed,
                        first_cpu=float(row["cpu_seconds"]),
                        last_cpu=float(row["cpu_seconds"]),
                        max_rss=int(row["rss_bytes"]),
                        nice=int(row["nice"]) if row["nice"] != "" else None,
                        status=str(row["status"]),
                    )
                else:
                    existing.name = str(row["name"])
                    existing.last_seen = elapsed
                    existing.last_cpu = float(row["cpu_seconds"])
                    existing.max_rss = max(existing.max_rss,
                                           int(row["rss_bytes"]))
                    existing.nice = (
                        int(row["nice"]) if row["nice"] != "" else None
                    )
                    existing.status = str(row["status"])
                    existing.samples += 1

            sample_index += 1
            if elapsed >= duration:
                break
            time.sleep(min(interval, max(0.0, duration - elapsed)))

    return stats


def build_sim_processes(
    stats: dict[tuple[int, float], ProcStats],
    time_scale: int,
    min_cpu_seconds: float,
    max_processes: int,
) -> list[SimProcess]:
    active = [item for item in stats.values()
              if item.cpu_delta >= min_cpu_seconds]
    active.sort(key=lambda item: item.cpu_delta, reverse=True)
    selected = active[:max_processes]
    selected.sort(key=lambda item: (item.first_seen, item.pid))

    sim_procs = []
    for idx, item in enumerate(selected, start=1):
        sim_procs.append(
            SimProcess(
                sim_pid=idx,
                os_pid=item.pid,
                create_time=item.create_time,
                name=item.name,
                arrival=max(0, int(round(item.first_seen * time_scale))),
                burst=max(1, int(math.ceil(item.cpu_delta * time_scale))),
                priority=_priority_to_sim(item.nice),
                cpu_seconds=item.cpu_delta,
                first_seen=item.first_seen,
                last_seen=item.last_seen,
                max_rss=item.max_rss,
                nice=item.nice,
                samples=item.samples,
            )
        )
    return sim_procs


def write_workload(path: Path, sim_procs: list[SimProcess],
                   time_scale: int) -> None:
    _ensure_parent(path)
    tick_seconds = 1.0 / float(time_scale)
    with path.open("w", encoding="utf-8") as handle:
        handle.write("# Generated by scripts/os_process_logger.py\n")
        handle.write(
            f"# Captured at {datetime.now().isoformat(timespec='seconds')}\n"
        )
        handle.write("# Format: pid arrival burst priority\n")
        handle.write(
            f"# time_scale={time_scale}; one scheduler tick is "
            f"{tick_seconds:.6f} observed CPU seconds\n"
        )
        for item in sim_procs:
            handle.write(
                f"{item.sim_pid} {item.arrival} {item.burst} "
                f"{item.priority}\n"
            )


def write_process_map(path: Path, sim_procs: list[SimProcess]) -> None:
    _ensure_parent(path)
    fieldnames = [
        "sim_pid",
        "os_pid",
        "create_time",
        "process_name",
        "arrival",
        "burst",
        "priority",
        "cpu_seconds",
        "first_seen",
        "last_seen",
        "max_rss",
        "nice",
        "samples",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in sim_procs:
            writer.writerow(
                {
                    "sim_pid": item.sim_pid,
                    "os_pid": item.os_pid,
                    "create_time": item.create_time,
                    "process_name": item.name,
                    "arrival": item.arrival,
                    "burst": item.burst,
                    "priority": item.priority,
                    "cpu_seconds": f"{item.cpu_seconds:.6f}",
                    "first_seen": f"{item.first_seen:.6f}",
                    "last_seen": f"{item.last_seen:.6f}",
                    "max_rss": item.max_rss,
                    "nice": "" if item.nice is None else item.nice,
                    "samples": item.samples,
                }
            )


def _run_command(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )


def ensure_simulator(binary: str) -> bool:
    binary_path = Path(binary)
    if binary_path.exists():
        return True

    if shutil.which("make") is None:
        return False

    result = _run_command(["make"])
    if result.returncode != 0:
        print(result.stdout, file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        return False
    return binary_path.exists()


def run_simulator(
    workload_path: Path,
    results_path: Path,
    dashboard_path: Path | None,
    binary: str,
    quantum: int,
) -> list[dict[str, str]]:
    if not ensure_simulator(binary):
        raise RuntimeError(
            f"Simulator binary not found: {binary}. Build it first with make."
        )

    _ensure_parent(results_path)
    if results_path.exists():
        results_path.unlink()

    for algo in ALGOS:
        cmd = [binary, "-f", str(workload_path), "-a", algo,
               "-e", str(results_path)]
        if algo == "rr":
            cmd.extend(["-q", str(quantum)])
        result = _run_command(cmd)
        if result.returncode != 0:
            raise RuntimeError(
                f"Simulator failed for {algo}: {result.stderr.strip()}"
            )

    if dashboard_path is not None:
        _ensure_parent(dashboard_path)
        result = _run_command(
            [sys.executable, "ml/visualize_runs.py", str(results_path),
             "-o", str(dashboard_path)]
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Dashboard generation failed: {result.stderr.strip()}"
            )

    with results_path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def summarize_results(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "No simulator results were produced."

    def as_float(row: dict[str, str], key: str) -> float:
        return float(row[key])

    best_wait = min(rows, key=lambda row: as_float(row, "avg_waiting"))
    best_turn = min(rows, key=lambda row: as_float(row, "avg_turnaround"))
    best_response = min(rows, key=lambda row: as_float(row, "avg_response"))
    best_ctx = min(rows, key=lambda row: as_float(row, "context_switches"))

    lines = [
        "Best observed algorithms:",
        f"  lowest avg waiting    : {best_wait['algo']}",
        f"  lowest avg turnaround : {best_turn['algo']}",
        f"  lowest avg response   : {best_response['algo']}",
        f"  fewest ctx switches   : {best_ctx['algo']}",
    ]
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    slug = _timestamp_slug()
    default_out_dir = Path("reports") / "os_process_logs" / slug

    parser = argparse.ArgumentParser(
        description=(
            "Log local processes and convert observed CPU usage into a "
            "scheduler workload."
        )
    )
    parser.add_argument("--duration", type=float, default=60.0,
                        help="Seconds to sample processes. Default: 60.")
    parser.add_argument("--interval", type=float, default=1.0,
                        help="Seconds between samples. Default: 1.")
    parser.add_argument("--out-dir", type=Path, default=default_out_dir,
                        help="Directory for generated files.")
    parser.add_argument("--raw-log", type=Path,
                        help="Raw process sample CSV path.")
    parser.add_argument("--workload-out", type=Path,
                        help="Generated simulator workload path.")
    parser.add_argument("--map-out", type=Path,
                        help="CSV mapping simulator PIDs to OS processes.")
    parser.add_argument("--results-out", type=Path,
                        help="Simulator results CSV path.")
    parser.add_argument("--dashboard-out", type=Path,
                        help="Generated dashboard HTML path.")
    parser.add_argument("--run-simulator", action="store_true",
                        help="Run all scheduler algorithms after logging.")
    parser.add_argument("--no-dashboard", action="store_true",
                        help="Skip dashboard generation when running simulator.")
    parser.add_argument("--binary", default=_default_binary(),
                        help="Path to cpu_scheduler binary.")
    parser.add_argument("--quantum", type=int, default=4,
                        help="Round Robin quantum for simulation. Default: 4.")
    parser.add_argument("--time-scale", type=int, default=10,
                        help="Scheduler ticks per observed CPU second.")
    parser.add_argument("--min-cpu-seconds", type=float, default=0.01,
                        help="Ignore processes below this observed CPU use.")
    parser.add_argument("--max-processes", type=int, default=MAX_SIM_PROCS,
                        help="Maximum processes in generated workload.")
    parser.add_argument("--anonymous", action="store_true",
                        help="Do not write process names to CSV logs.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.duration <= 0:
        print("--duration must be > 0", file=sys.stderr)
        return 2
    if args.interval <= 0:
        print("--interval must be > 0", file=sys.stderr)
        return 2
    if args.time_scale <= 0:
        print("--time-scale must be > 0", file=sys.stderr)
        return 2
    if args.quantum <= 0:
        print("--quantum must be > 0", file=sys.stderr)
        return 2
    if args.max_processes < 1 or args.max_processes > MAX_SIM_PROCS:
        print(f"--max-processes must be between 1 and {MAX_SIM_PROCS}",
              file=sys.stderr)
        return 2

    out_dir = args.out_dir
    raw_log = args.raw_log or out_dir / "process_samples.csv"
    workload = args.workload_out or out_dir / "observed_workload.txt"
    process_map = args.map_out or out_dir / "process_map.csv"
    results = args.results_out or out_dir / "scheduler_results.csv"
    dashboard = args.dashboard_out or out_dir / "scheduler_dashboard.html"

    try:
        stats = collect_process_log(
            duration=args.duration,
            interval=args.interval,
            raw_log_path=raw_log,
            anonymous=args.anonymous,
        )
        sim_procs = build_sim_processes(
            stats=stats,
            time_scale=args.time_scale,
            min_cpu_seconds=args.min_cpu_seconds,
            max_processes=args.max_processes,
        )
        write_workload(workload, sim_procs, args.time_scale)
        write_process_map(process_map, sim_procs)

        print(f"Raw log: {raw_log}")
        print(f"Workload: {workload}")
        print(f"Process map: {process_map}")
        print(f"Simulated processes: {len(sim_procs)}")

        if not sim_procs:
            print(
                "No CPU-active processes met the threshold. Try a longer "
                "duration or lower --min-cpu-seconds.",
                file=sys.stderr,
            )
            return 1 if args.run_simulator else 0

        if args.run_simulator:
            rows = run_simulator(
                workload_path=workload,
                results_path=results,
                dashboard_path=None if args.no_dashboard else dashboard,
                binary=args.binary,
                quantum=args.quantum,
            )
            print(f"Results: {results}")
            if not args.no_dashboard:
                print(f"Dashboard: {dashboard}")
            print(summarize_results(rows))
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
