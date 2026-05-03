# Agent Repo Guide

This repository is a CPU scheduling simulator for an Operating Systems Phase 2
submission. The active scope is pure scheduler simulation. The earlier
experimental prediction path has been removed.

## Current Status

- The C simulator supports FCFS, non-preemptive SJF, Round Robin, and
  non-preemptive priority scheduling.
- The browser dashboard in `dashboard/` reimplements the same scheduling rules
  in client-side JavaScript.
- `scripts/visualize_runs.py` converts scheduler CSV exports into standalone
  HTML reports.
- `scripts/os_process_logger.py` samples local process CPU activity and turns
  it into simulator workloads for experimentation.
- The Phase 2 report source is `reports/phase2_report.tex`.
- C tests cover the main parser, queue, scheduler, and metrics behavior.
- Fuzzing harnesses and seed corpora exist, but long campaign evidence is not
  committed.
- Valgrind or equivalent memory-leak proof is not documented yet.

## Common Commands

```sh
make
make test-c
make test
python3 -m pytest -q tests_py
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
./cpu_scheduler -s basic -a all -e results.csv
python3 scripts/visualize_runs.py results.csv -o results.html
python3 scripts/os_process_logger.py --duration 60 --interval 1 --run-simulator
latexmk -pdf reports/phase2_report.tex
```

Fuzzing requires AFL++:

```sh
make fuzz-build
make fuzz-input
make fuzz-queue
make fuzz-baseline-input
make fuzz-baseline-queue
```

## Execution Flow

1. `src/main.c` parses CLI flags.
2. `src/input.c` loads a workload from `workloads/` or a built-in sample.
3. `schedule()` resets process state and dispatches to one scheduler.
4. Scheduler files in `src/schedulers/` fill process timing fields and Gantt
   timeline entries.
5. `src/metrics.c` computes per-process and aggregate metrics.
6. `src/visualization.c` prints terminal Gantt charts, metrics, and comparison
   tables.
7. Optional CSV export writes one metrics row per algorithm.
8. `scripts/visualize_runs.py` can turn exported CSV rows into an HTML report.
9. `dashboard/index.html` provides an interactive in-browser simulator.

## Important Rules

- Workload line format is `pid arrival burst priority`.
- PIDs must be positive and unique.
- Arrival time and priority must be non-negative.
- Burst time must be positive.
- Lower priority number means higher scheduling priority.
- PID `-1` in a Gantt entry means CPU idle time.
- FCFS sorts by arrival time, then PID.
- SJF is non-preemptive and uses burst time, then arrival/PID tie breaks.
- Priority scheduling is non-preemptive and uses priority, then arrival/PID tie
  breaks.
- Round Robin uses a FIFO ready queue and requeues unfinished processes after
  adding arrivals that became ready during the current quantum.
- `cfg->ctx_overhead` is applied by all four schedulers. An idle Gantt segment
  of length `ctx_overhead` is inserted whenever execution switches to a
  different PID.

## File Map

- `include/`: shared C headers and data types.
- `src/`: main simulator implementation.
- `src/schedulers/`: FCFS, SJF, Round Robin, and priority algorithms.
- `tests/`: C unit tests.
- `tests_py/`: Python tests for helper scripts and CSV export behavior.
- `workloads/`: sample workload files (basic, rr, priority, edge, mixed).
- `dashboard/`: no-build browser dashboard.
- `scripts/visualize_runs.py`: CSV-to-HTML dashboard generator.
- `scripts/os_process_logger.py`: local process sampler and workload generator.
- `fuzz/`: AFL++ fuzz targets, dictionaries, and corpora.
- `reports/phase2_report.tex`: Phase 2 progress report source.
- `DASHBOARD_SPEC.md`: dashboard build specification.
- `README.md`: human-facing project instructions.

## Maintenance Guidance

- Keep scheduler behavior changes covered by C tests under `tests/`.
- Keep browser dashboard logic aligned with the C scheduler rules.
- Keep CSV dashboard changes covered by `pytest -q tests_py`.
- Do not manually edit generated HTML unless the task is specifically about
  generated output.
- Keep process logger output out of commits unless it is a deliberate example;
  local process logs can reveal private app usage.
- Be careful with tie breaks because tests expect deterministic PID ordering.
- If claiming fuzzing readiness, add actual campaign output and crash replay
  evidence.
- If claiming memory safety, run and document a leak or sanitizer pass.
