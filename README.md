# CPU Scheduling Simulator

A fully featured CPU scheduling simulator written in C11, with a browser-based
interactive dashboard, gamified visualization features, a complete test suite,
CSV export, and AFL++ fuzzing support.

## Implemented Algorithms

| Algorithm | Key | Preemptive | C | Dashboard |
|-----------|-----|------------|---|-----------|
| First Come First Served | `fcfs` | No | ✓ | ✓ |
| Shortest Job First | `sjf` | No | ✓ | ✓ |
| Round Robin | `rr` | Yes (quantum) | ✓ | ✓ |
| Priority | `priority` | No | ✓ | ✓ |
| Shortest Remaining Time First | `srtf` | Yes | ✓ | ✓ |
| Preemptive Priority | `priorityp` | Yes | ✓ | ✓ |
| Multilevel Feedback Queue | `mlfq` | Yes | ✓ | ✓ |

All algorithms support context-switch overhead (`-o`), deterministic
tie-breaking by arrival time then PID, and idle-time accounting.

## Quick Start

```sh
make clean && make
make test-c
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
./cpu_scheduler -s basic -a all -e results.csv
```

Serve the browser dashboard locally:

```sh
cd dashboard && python3 -m http.server 8080
# then open http://localhost:8080
```

Or open `dashboard/index.html` directly in a browser (`file://` works).

## Final Phase 3 Report

The final submission report is available as `reports/phase3_final_report.pdf`.
Its LaTeX source is `reports/phase3_final_report.tex`, and the browser
evidence screenshots used in the report are stored under `reports/assets/`.

## Build Requirements

Required:

- C compiler with C11 support
- `make`

Optional:

- Python 3 for helper scripts and Python tests
- `pytest` and `psutil` from `requirements.txt`
- AFL++ for fuzzing

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

Run SRTF with context-switch overhead:

```sh
./cpu_scheduler -s basic -a srtf -o 1
```

Run MLFQ (quantum controls Q0 slice; Q1 = 2×Q0; Q2 = FCFS):

```sh
./cpu_scheduler -s mixed -a mlfq -q 2
```

Export a comparison CSV:

```sh
./cpu_scheduler -s basic -a all -e results.csv
```

Command-line options:

```text
-f <file>     Load workload from file
-s <name>     Use sample workload: basic | rr | priority | edge | mixed
-a <algo>     Algorithm: fcfs | sjf | rr | priority | srtf | priorityp | mlfq | all
-q <int>      Time quantum for RR / MLFQ Q0 (default: 2)
-o <int>      Context switch overhead in ms (default: 0)
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

**FCFS** — First Come First Served:
- sorts by arrival time, then PID
- runs each process to completion
- inserts idle time if no process has arrived

**SJF** — Shortest Job First (non-preemptive):
- picks the ready process with the shortest burst time
- tie-breaks by burst, then arrival time, then PID
- runs the chosen process to completion before reconsidering

**Round Robin**:
- uses a FIFO ready queue
- runs a process for at most `quantum` ticks
- newly arrived processes are enqueued before requeueing an unfinished process
- counts a context switch whenever execution moves to a different PID

**Priority** (non-preemptive):
- picks the ready process with the lowest priority number (highest urgency)
- tie-breaks by priority, then arrival time, then PID
- runs the chosen process to completion

**SRTF** — Shortest Remaining Time First (preemptive SJF):
- at each event, picks the ready process with the least remaining time
- preempts the running process whenever a shorter-remaining one arrives
- tie-breaks by remaining time, then arrival time, then PID

**Preemptive Priority** (`priorityp`):
- at each event, picks the ready process with the lowest priority number
- preempts the running process whenever a higher-priority one arrives
- tie-breaks by priority, then arrival time, then PID

**MLFQ** — Multilevel Feedback Queue (3 queues):
- Q0: quantum = `-q` value (default 2); highest priority
- Q1: quantum = 2 × Q0; medium priority
- Q2: FCFS, no quantum limit; lowest priority
- new arrivals always enter Q0
- exhausting a quantum demotes a process to the next queue
- a new Q0 arrival preempts any process running in Q1 or Q2

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
- total runtime / idle time

## Tests

11 C test suites, all passing:

```sh
make test-c
```

Suites: `test_process`, `test_queue`, `test_input`, `test_fcfs`, `test_sjf`,
`test_rr`, `test_priority`, `test_srtf`, `test_priority_p`, `test_mlfq`,
`test_metrics`.

Run Python helper tests:

```sh
python3 -m pytest -q tests_py
```

Run everything:

```sh
make test
```

## Browser Dashboard

The dashboard in `dashboard/` is a no-build static app. Open `index.html`
directly or serve it with any HTTP server.

**Algorithms:** all 7 — FCFS, SJF, RR, Priority, SRTF, P-Priority, MLFQ —
selectable via a segmented button bar. MLFQ exposes configurable Q0/Q1
quantums.

**Core views:**
- editable process table with live input validation
- sample workload selector and random workload generator
- Gantt chart with step-by-step playback controls
- per-process and aggregate metrics cards
- all-algorithm comparison chart and table

**Interactive features:**
- **Why Inspector** — click any Gantt block to see exactly why the scheduler
  chose that process at that moment, with the ready queue sorted by decision
  criterion
- **Race Mode** — runs all algorithms simultaneously and ranks them by average
  waiting time with a live animated bar race
- **Be the Scheduler** — manually dispatch processes step by step and receive
  a score comparing your decisions against FCFS, SJF, RR, and Priority
- **Adversarial Generator** — generates workloads that expose each algorithm's
  worst-case weakness (convoy, starvation, thrashing, priority inversion)
- **Guess the Algorithm Quiz** — shows an anonymous Gantt chart and asks you
  to identify the scheduling algorithm from four choices; tracks score, accuracy
  percentage, and streak
- **Kiosk / Presentation Mode** — hides all input controls and auto-cycles
  through workloads with animated playback; designed for EXPO display

## CSV Dashboard

Generate and visualize a comparison CSV:

```sh
./cpu_scheduler -s basic -a all -e results.csv
python3 scripts/visualize_runs.py results.csv -o results.html
```

## Fuzzing

Requires AFL++:

```sh
make fuzz-build
make fuzz-input
make fuzz-queue
make fuzz-baseline-input   # 10-minute input campaign
make fuzz-baseline-queue   # 10-minute queue campaign
```

Harnesses cover the workload parser (`fuzz/fuzz_input.c`) and the queue
implementation (`fuzz/fuzz_queue.c`). Seed corpora and a workload dictionary
are included in `fuzz/`.

## Project Layout

```text
include/                   Public C headers
src/                       C simulator implementation
src/schedulers/            All 7 scheduler implementations
tests/                     C unit tests (11 suites)
tests_py/                  Python tests for helper scripts
workloads/                 Sample workload files
dashboard/                 Browser dashboard (no build step)
scripts/                   Helper scripts and CSV-to-HTML generator
fuzz/                      AFL++ harnesses, dictionaries, and corpora
reports/                   Phase reports, final PDF, and evidence assets
```

## Suggested Grading Flow

1. Read the workload format and scheduling rules above.
2. `make clean && make`
3. `make test-c` — all 11 suites should pass.
4. `./cpu_scheduler -s basic -a all`
5. `./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4`
6. `./cpu_scheduler -s basic -a srtf -o 1`
7. `./cpu_scheduler -s mixed -a mlfq -q 2`
8. `./cpu_scheduler -s basic -a all -e results.csv`
9. Open `dashboard/index.html` — try the Gantt playback, Why Inspector, and Quiz.
