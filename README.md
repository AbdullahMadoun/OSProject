# CPU Scheduling Simulator

This repository contains a Phase 2 Operating Systems project: a working CPU
scheduling simulator written in C, with tests, sample workloads, CSV export,
browser visualization, fuzzing scaffolding, and a detailed progress report.

The project scope is now scheduler simulation only. The previous experimental
prediction path has been fully removed from the source tree, build file,
command-line interface, dependencies, and active documentation.

## Phase 2 Status

The implementation is approximately 70% complete for the final project scope.
The main scheduler modules are implemented and testable. Remaining work is
validation depth, polish, final screenshots/PDF packaging, and stronger fuzzing
and memory-safety evidence.

Implemented:

- FCFS, non-preemptive SJF, Round Robin, and non-preemptive priority scheduling
- workload parser for built-in samples and custom files
- deterministic tie-breaking by arrival time and PID where applicable
- Gantt timeline generation
- per-process waiting, turnaround, and response metrics
- aggregate utilization, throughput, context-switch, and total-time metrics
- all-algorithm comparison mode
- CSV export
- browser dashboard in `dashboard/`
- CSV-to-HTML dashboard generator in `scripts/visualize_runs.py`
- process logger in `scripts/os_process_logger.py`
- C unit tests for parser, process model, queues, schedulers, and metrics
- AFL++ fuzzing harnesses and starter corpora

Remaining:

- document final PDF build output from `reports/phase2_report.tex`
- add final screenshot assets or captured terminal images if required
- run and archive Valgrind or sanitizer memory checks
- run and archive longer AFL++ fuzz campaigns
- standardize context-switch overhead semantics across all algorithms
- add more edge-case tests near `MAX_PROCESSES` and CSV comparison export

## Quick Start

```sh
make clean
make
make test-c
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
./cpu_scheduler -s basic -a all -e results.csv
python3 scripts/visualize_runs.py results.csv -o results.html
```

Open the browser dashboard directly:

```sh
open dashboard/index.html
```

On Linux, use `xdg-open dashboard/index.html`.

## Build Requirements

Required:

- C compiler with C11 support
- `make`

Optional:

- Python 3 for helper scripts and Python tests
- `pytest` and `psutil` from `requirements.txt`
- AFL++ for fuzzing
- a TeX distribution for compiling `reports/phase2_report.tex`

Install optional Python dependencies:

```sh
python3 -m pip install -r requirements.txt
```

## Run The Simulator

Run all algorithms on the built-in basic workload:

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

Sample workloads are in `workloads/`.

## Scheduling Rules

FCFS:

- sorts by arrival time, then PID
- runs each process to completion
- inserts idle time if no process has arrived

SJF:

- non-preemptive
- chooses the arrived process with the shortest burst
- tie-breaks by burst, arrival time, and PID

Round Robin:

- uses a FIFO ready queue
- runs a process for at most `quantum` ticks
- enqueues newly arrived processes before requeueing an unfinished process
- counts a context switch when execution moves between different PIDs

Priority:

- non-preemptive
- lower priority number runs first
- tie-breaks by priority, arrival time, and PID

## Metrics

Per-process formulas:

```text
turnaround = completion - arrival
waiting    = turnaround - burst
response   = first_start - arrival
```

Aggregate metrics:

- average waiting time
- average turnaround time
- average response time
- CPU utilization
- throughput
- context switches
- total runtime
- idle time

## Tests

Run the C suite:

```sh
make test-c
```

Run all available tests:

```sh
make test
```

Python helper tests only:

```sh
python3 -m pytest -q tests_py
```

## Browser Dashboard

The browser dashboard in `dashboard/` is a no-build static app. It provides:

- editable process table
- sample workload selector
- scheduler selector
- Round Robin quantum control
- input validation
- Gantt chart rendering
- metric cards
- per-process metrics table
- all-algorithm comparison view

The dashboard reimplements the scheduler rules in JavaScript so it can run from
`file://`.

## CSV Dashboard

Generate scheduler metrics:

```sh
./cpu_scheduler -s basic -a all -e results.csv
```

Generate a self-contained HTML dashboard:

```sh
python3 scripts/visualize_runs.py results.csv -o results.html
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

```sh
make fuzz-build
make fuzz-input
make fuzz-queue
make fuzz-baseline-input
make fuzz-baseline-queue
```

Current fuzzing status:

- parser and queue harnesses exist
- seed corpora and a workload dictionary exist
- long campaign reports and triaged crash artifacts are not committed yet

## Project Layout

```text
include/              Public C headers
src/                  C simulator implementation
src/schedulers/       FCFS, SJF, RR, and priority schedulers
tests/                C unit tests
tests_py/             Python tests for helper scripts and CSV export
workloads/            Sample workload files
dashboard/            Browser dashboard
scripts/              Helper scripts and CSV dashboard generator
fuzz/                 AFL++ fuzz harnesses, dictionaries, and corpora
reports/              Phase report source
results.csv           Example CSV export
results.html          Example generated HTML dashboard
```

## Suggested Grading Flow

1. Read the workload format and scheduling rules above.
2. Run `make clean && make`.
3. Run `make test-c`.
4. Run `./cpu_scheduler -s basic -a all`.
5. Run `./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4`.
6. Run `./cpu_scheduler -s basic -a all -e results.csv`.
7. Run `python3 scripts/visualize_runs.py results.csv -o results.html`.
8. Open `dashboard/index.html` to inspect the interactive visualization.
9. Compile `reports/phase2_report.tex` to PDF for the Phase 2 report.
