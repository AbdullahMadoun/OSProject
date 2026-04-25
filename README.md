# CPU Scheduling Simulator

This repository contains a C-based CPU scheduling simulator for an Operating
Systems project. It loads a workload, runs one scheduler or all supported
schedulers, prints a Gantt chart and metrics, and can export results to CSV for
dashboard visualization.

The active project scope is scheduler simulation. Legacy ML-related files may
still exist in the repository, but they are not required for grading the core OS
simulator.

## Grader Quick Start

From the repository root:

```sh
make clean
make
make test-c
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
./cpu_scheduler -s basic -a all -e results.csv
python3 ml/visualize_runs.py results.csv -o results.html
```

To view the browser dashboard:

```sh
open dashboard/index.html
```

On Linux, use `xdg-open dashboard/index.html` instead of `open`.

## What To Grade

Primary grading targets:

- C source under `src/` and headers under `include/`
- scheduler implementations in `src/schedulers/`
- sample workloads under `workloads/`
- C unit tests under `tests/`
- `Makefile`
- optional browser dashboard under `dashboard/`
- optional CSV dashboard generator in `ml/visualize_runs.py`
- optional Phase 2 report source in `reports/phase2_report.tex`

Generated or local-only outputs:

- `cpu_scheduler` and `build/` are build outputs
- `results.csv`, `results.html`, `ml/runs.csv`, and `ml/runs_dashboard.html`
  are example/generated dashboard outputs
- `reports/os_process_logs/` is intentionally ignored because it can contain
  personal process activity from the local machine

## Implemented Features

- First-Come, First-Served (FCFS)
- non-preemptive Shortest Job First (SJF)
- Round Robin with configurable quantum
- non-preemptive priority scheduling
- built-in sample workloads and custom workload files
- deterministic process tie-breaking
- Gantt timeline generation
- per-process waiting, turnaround, and response time metrics
- aggregate waiting, turnaround, response, utilization, throughput, total time,
  and context-switch metrics
- all-algorithm comparison mode
- CSV export for metrics
- C unit tests for parser, process model, queues, schedulers, and metrics
- AFL++ fuzzing harnesses and seed corpora for parser and queue code
- browser dashboard with editable workloads and client-side visualizations
- optional OS process logger that converts observed local CPU activity into a
  simulator workload

## Build Requirements

Required for the C simulator:

- C compiler with C11 support, tested with `gcc`
- `make`

Optional tooling:

- Python 3 for CSV dashboard generation and Python tests
- dependencies from `requirements.txt`
- AFL++ for fuzzing targets
- a TeX distribution for compiling `reports/phase2_report.tex`

Install optional Python dependencies with:

```sh
python3 -m pip install -r requirements.txt
```

## Build

```sh
make
```

The build creates:

```text
./cpu_scheduler
```

Clean generated C build artifacts:

```sh
make clean
```

## Run The Simulator

Run one built-in sample with all algorithms:

```sh
./cpu_scheduler -s basic -a all
```

Run Round Robin with a custom quantum:

```sh
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
```

Run priority scheduling:

```sh
./cpu_scheduler -f workloads/sample_priority.txt -a priority
```

Export a comparison CSV:

```sh
./cpu_scheduler -s basic -a all -e results.csv
```

Command-line options:

```text
-f <file>     Load workload from file
-s <name>     Use sample workload: basic | rr | priority | edge
-a <algo>     Algorithm: fcfs | sjf | rr | priority | all
-q <int>      Round Robin quantum, default 2
-o <int>      Context switch overhead, default 0
-e <file>     Export metrics to CSV
-h            Show help
```

The `-p` flag may appear in help output because older ML prediction code still
exists in the repository. It is not part of the required scheduler simulation
workflow.

## Workload Format

Each process line has four integer fields:

```text
pid arrival burst priority
```

Rules:

- `pid` must be positive and unique
- `arrival` must be zero or greater
- `burst` must be greater than zero
- `priority` must be zero or greater
- lower priority number means higher scheduling priority
- blank lines and comment lines beginning with `#` are ignored

Example:

```text
# pid arrival burst priority
1 0 6 2
2 2 4 1
3 4 8 3
4 6 3 4
```

Sample workloads:

- `workloads/sample_basic.txt`
- `workloads/sample_rr.txt`
- `workloads/sample_priority.txt`
- `workloads/sample_edge.txt`

## Scheduling Rules

FCFS:

- sorts by arrival time, then PID
- runs each process to completion
- inserts idle time if no process has arrived

SJF:

- non-preemptive
- chooses the arrived process with the shortest burst
- tie-breaks by arrival time, then PID

Round Robin:

- uses a FIFO ready queue
- runs a process for at most `quantum` ticks
- enqueues new arrivals before requeueing an unfinished process
- counts a context switch when the running PID changes

Priority:

- non-preemptive
- lower priority number runs first
- tie-breaks by arrival time, then PID

## Metrics

For each process:

```text
turnaround = completion - arrival
waiting    = turnaround - burst
response   = first_start - arrival
```

Aggregate metrics include:

- average waiting time
- average turnaround time
- average response time
- CPU utilization
- throughput
- context switches
- total runtime
- idle time

## Tests

Run the C test suite:

```sh
make test-c
```

Current local result:

```text
123/123 C assertions passed
```

The C tests cover:

- process initialization and reset
- FIFO queue and min-heap ordering
- workload parsing and validation
- FCFS, SJF, Round Robin, and priority scheduler behavior
- metric formulas and idle-time utilization

Optional Python dashboard tests require Python dependencies:

```sh
python3 -m pip install -r requirements.txt
python3 -m pytest -q ml/tests/test_visualize_runs.py
```

## Browser Dashboard

The browser dashboard is in `dashboard/` and requires no server, npm install, or
build step:

```sh
open dashboard/index.html
```

It provides:

- editable process table
- sample workload selector
- scheduler selector
- Round Robin quantum control
- input validation
- Gantt chart rendering
- metric cards
- per-process metrics table
- all-algorithm comparison view

The dashboard reimplements the scheduler rules in JavaScript so it can run
entirely from `file://`.

## CSV Dashboard

Generate scheduler metrics:

```sh
./cpu_scheduler -s basic -a all -e results.csv
```

Generate a self-contained HTML dashboard:

```sh
python3 ml/visualize_runs.py results.csv -o results.html
```

Open `results.html` in a browser.

## OS Process Logger

The optional process logger samples local macOS or Windows process CPU activity
and converts active processes into a scheduler workload:

```sh
python3 scripts/os_process_logger.py --duration 60 --interval 1 --run-simulator
```

Useful options:

```sh
python3 scripts/os_process_logger.py --duration 120 --anonymous
python3 scripts/os_process_logger.py --duration 60 --run-simulator --quantum 4
python3 scripts/os_process_logger.py --duration 60 --binary ./cpu_scheduler.exe
```

This is an approximation for experimentation. It does not inspect, replace, or
claim to reproduce the real operating-system scheduler.

## Fuzzing Support

Fuzzing requires AFL++.

Build fuzz targets:

```sh
make fuzz-build
```

Run parser and queue fuzzers:

```sh
make fuzz-input
make fuzz-queue
```

Run timed baseline helper scripts:

```sh
make fuzz-baseline-input
make fuzz-baseline-queue
```

Current fuzzing status:

- parser and queue harnesses exist
- seed corpora and a workload dictionary exist
- long campaign reports and triaged crash artifacts are not committed

## Project Layout

```text
include/              Public C headers
src/                  C simulator implementation
src/schedulers/       FCFS, SJF, RR, and priority schedulers
tests/                C unit tests
workloads/            Sample workload files
dashboard/            Browser dashboard
ml/visualize_runs.py  CSV-to-HTML dashboard generator
scripts/              Helper scripts, including OS process logger
fuzz/                 AFL++ fuzz harnesses, dictionaries, and corpora
reports/              Report source and generated report-related files
```

## Known Limitations

- C tests cover the main behavior, but not every possible edge case.
- SJF and priority currently ignore scheduler config such as context-switch
  overhead.
- FCFS can add context-switch overhead idle entries, but does not currently
  increment `context_switches`.
- Fuzzing harnesses are present, but long campaign evidence is not included.
- Memory-leak proof with Valgrind is not documented in this repository.
- Some legacy ML files remain, but they are outside the active grading scope.

## Suggested Grading Flow

1. Read this README and inspect the workload format.
2. Run `make clean && make`.
3. Run `make test-c`.
4. Run `./cpu_scheduler -s basic -a all`.
5. Run `./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4`.
6. Run `./cpu_scheduler -s basic -a all -e results.csv`.
7. Generate `results.html` with `ml/visualize_runs.py` if Python dependencies
   are available.
8. Open `dashboard/index.html` to inspect the interactive visualization.
