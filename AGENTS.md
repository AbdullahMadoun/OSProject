# Agent Repo Guide

This file is a plain-English map of the repository for future agents or
developers. The active project is a CPU scheduling simulator written in C,
with a browser dashboard, Python tooling for CSV dashboards and process
logging, and fuzzing support. The earlier ML prediction idea is out of scope
for the current Phase 2 submission.

## Current Status

The repository is useful and tested, but it should not be described as fully
finished or submission-proof yet.

- The core simulator supports FCFS, non-preemptive SJF, Round Robin, and
  non-preemptive priority scheduling.
- The browser dashboard in `dashboard/` reimplements those algorithms in
  client-side JavaScript with editable workloads, Gantt charts, metrics, and
  comparison views.
- The Phase 2 report source exists at `reports/phase2_report.tex`.
- The C tests cover the main behavior, but they do not prove every edge case.
- Fuzzing harnesses and seed corpora exist, but long campaign evidence and
  triaged crash artifacts are not committed.
- The HTML dashboards are generated outputs from CSV files.
- `valgrind` zero-leak proof is not documented in the repo.

## How The Project Works

The C command-line program loads a workload, runs one scheduler or all
schedulers, builds a Gantt chart, computes metrics, prints terminal output, and
optionally exports one CSV row per run.

The normal flow is:

1. `src/main.c` parses CLI flags.
2. `src/input.c` loads a workload from `workloads/*` or a built-in sample.
3. `schedule()` resets process state and calls one scheduler.
4. Scheduler files in `src/schedulers/` fill process completion data and the
   `SimResult` Gantt timeline.
5. `src/metrics.c` computes waiting, turnaround, response, utilization,
   throughput, and context-switch metrics.
6. `src/visualization.c` prints Gantt charts, metric summaries, comparisons,
   and comparison tables.
7. `dashboard/index.html` provides an interactive in-browser simulator and
   visualization interface.
8. `ml/visualize_runs.py` can turn exported CSV rows into a self-contained
   HTML dashboard.
9. `scripts/os_process_logger.py` can sample the local machine, convert active
   processes into a simulator workload, and optionally generate results and a
   dashboard.

## Common Commands

```sh
make
make test-c
python3 -m pip install -r requirements.txt
python3 -m pytest -q ml/tests/test_visualize_runs.py
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
./cpu_scheduler -s basic -a all -e results.csv
python3 ml/visualize_runs.py results.csv -o results.html
open dashboard/index.html
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

## Important Implementation Notes

- A process line format is `pid arrival burst priority`.
- PIDs must be positive and unique.
- Arrival time and priority must be non-negative.
- Burst time must be positive.
- Lower priority number means higher scheduling priority.
- PID `-1` in a Gantt entry means CPU idle time.
- FCFS sorts by arrival time, then PID.
- SJF is non-preemptive and uses burst time, then arrival/PID tie breaks.
- Priority scheduling is non-preemptive and uses priority, then arrival/PID tie
  breaks.
- Round Robin uses a FIFO ready queue and requeues unfinished processes.
- `cfg->ctx_overhead` is used by FCFS and RR. SJF and priority currently ignore
  scheduler config.
- RR increments `context_switches` when switching between different PIDs.
- FCFS inserts overhead idle Gantt entries but currently does not increment
  `context_switches`.
- The OS process logger is an approximation. It samples user-space process CPU
  time and maps that into the simulator's single-machine workload format; it
  does not inspect or replace the real macOS/Windows scheduler.

## File By File

### Root

- `README.md`
  Main human-facing project README. It explains current scheduler-only scope,
  latest features, build, run, tests, dashboards, process logging, report
  generation, fuzzing concepts, and remaining gaps.

- `DASHBOARD_SPEC.md`
  Build specification for the single-page interactive browser dashboard.

- `Makefile`
  Builds `cpu_scheduler`, builds and runs C unit tests, runs Python tests, and
  builds/runs AFL++ fuzz targets.

- `requirements.txt`
  Python dependencies used by the CSV dashboard tooling, process logger, and
  current Python tests. Some legacy dependencies may remain until final cleanup.

- `results.csv`
  Example scheduler export for the basic workload across all algorithms.

- `results.html`
  Generated HTML dashboard from scheduler CSV output.

- `AGENTS.md`
  This guide.

- `reports/phase2_report.tex`
  Phase 2 implementation and progress report source. It covers the current
  non-ML scheduler simulator scope.

- `dashboard/`
  Browser-based interactive scheduler dashboard. It can be opened directly via
  `dashboard/index.html`.

### C Headers In `include/`

- `include/config.h`
  Shared constants: maximum processes, Gantt capacity, defaults, ANSI colors,
  buffer sizes, and return codes.

- `include/process.h`
  Defines `ProcessState`, the `Process` struct, and functions to initialize,
  reset, and stringify process state.

- `include/queue.h`
  Defines the FIFO queue used by Round Robin and the min-heap used by SJF and
  priority scheduling.

- `include/sim_engine.h`
  Defines Gantt entries, simulation results, scheduler config, and helpers for
  appending/finalizing timelines.

- `include/scheduler.h`
  Defines scheduler enum values, the `schedule()` dispatcher, per-algorithm
  function declarations, and algorithm name parsing helpers.

- `include/metrics.h`
  Defines the aggregate `Metrics` struct and metric computation/export helper
  declarations.

- `include/input.h`
  Declares file, buffer, sample workload loading, and validation functions.

- `include/visualization.h`
  Declares terminal display functions for Gantt charts, live status, metrics,
  and algorithm comparison.

### C Source In `src/`

- `src/main.c`
  CLI entrypoint. Parses flags, loads workloads, dispatches one/all algorithms,
  prints output, and exports CSV.

- `src/process.c`
  Initializes process structs, resets simulation-only fields, and returns
  readable state names.

- `src/input.c`
  Parses workload files and in-memory workload buffers. Skips comments/blanks,
  rejects malformed lines, validates process values, and provides built-in
  sample workloads.

- `src/queue.c`
  Implements FIFO queue operations and min-heap operations. The heap uses
  comparator-specific ordering with arrival/PID tie breaks.

- `src/sim_engine.c`
  Manages Gantt timeline entries, merges adjacent entries with the same PID,
  computes idle and total time, and clears simulation result structs.

- `src/metrics.c`
  Computes per-process and aggregate metrics, prints a process table, exports
  CSV rows, and summarizes workload features.

- `src/visualization.c`
  Prints colored terminal Gantt charts, metric dashboards, all-algorithm
  comparisons with best values highlighted, and terminal metric summaries.

### Schedulers In `src/schedulers/`

- `src/schedulers/fcfs.c`
  First-Come, First-Served scheduler. Sorts by arrival/PID, runs each process
  to completion, and records idle gaps before the first arrival or optional
  context-switch overhead.

- `src/schedulers/sjf.c`
  Non-preemptive Shortest Job First scheduler. Adds arrived processes to a
  burst-time min-heap and runs the shortest ready process to completion.

- `src/schedulers/rr.c`
  Round Robin scheduler. Maintains a FIFO ready queue, runs each process for up
  to `quantum`, requeues unfinished processes, and counts PID-to-PID switches.

- `src/schedulers/priority.c`
  Non-preemptive priority scheduler. Adds arrived processes to a priority
  min-heap and runs the highest-priority ready process to completion.

### Workloads

- `workloads/sample_basic.txt`
  Four-process example with staggered arrivals and different burst/priority
  values.

- `workloads/sample_rr.txt`
  Textbook-style Round Robin workload. Intended to be used with `-q 4`.

- `workloads/sample_priority.txt`
  Textbook-style priority scheduling workload.

- `workloads/sample_edge.txt`
  Single process arriving at time 5, used to exercise initial idle time.

### C Tests In `tests/`

- `tests/minunit.h`
  Small custom C test macro header used by every C test binary.

- `tests/test_process.c`
  Verifies process initialization and simulation-state reset behavior.

- `tests/test_queue.c`
  Verifies FIFO order, FIFO snapshots, heap burst ordering, heap priority
  ordering, and PID tie breaks.

- `tests/test_input.c`
  Verifies valid workload parsing, comments/blanks, built-in samples, duplicate
  PID rejection, invalid burst rejection, in-memory buffer parsing, NUL byte
  rejection, and extra-token rejection.

- `tests/test_fcfs.c`
  Verifies FCFS completion/waiting times for all-at-zero arrivals, staggered
  arrivals, and a single process with initial idle time.

- `tests/test_sjf.c`
  Verifies non-preemptive SJF textbook behavior, non-preemption when a shorter
  process arrives later, and tie-breaking by PID.

- `tests/test_rr.c`
  Verifies Round Robin textbook behavior, partial quantum behavior, arrivals
  during a quantum, and context-switch counting.

- `tests/test_priority.c`
  Verifies priority scheduler textbook behavior and priority tie-breaking.

- `tests/test_metrics.c`
  Verifies waiting/turnaround/response formulas, CPU utilization, throughput,
  context-switch propagation, and idle-time utilization behavior.

### Fuzzing

- `fuzz/fuzz_input.c`
  AFL++ harness for the workload parser. Reads stdin into a buffer and calls
  `input_load_buffer()`.

- `fuzz/fuzz_queue.c`
  AFL++ harness for FIFO and heap operations. Treats stdin bytes as queue/heap
  commands and exercises inserts, extracts, peeks, and empty checks.

- `fuzz/dictionaries/workload.dict`
  AFL dictionary tokens useful for mutating workload files.

- `fuzz/corpus/input/00_valid_minimal.txt`
  Minimal valid one-process workload seed.

- `fuzz/corpus/input/01_valid_comments.txt`
  Valid workload seed with a comment line.

- `fuzz/corpus/input/02_valid_rr_shape.txt`
  Valid three-process Round Robin-shaped workload seed.

- `fuzz/corpus/input/03_valid_whitespace.txt`
  Valid workload seed with tabs and extra spaces.

- `fuzz/corpus/input/04_invalid_empty.txt`
  Empty input seed.

- `fuzz/corpus/input/05_invalid_comment_only.txt`
  Comment-only input seed. Syntax is comment-only, but workload validation
  rejects it because no processes are loaded.

- `fuzz/corpus/input/06_invalid_truncated.txt`
  Invalid seed with a missing priority field.

- `fuzz/corpus/input/07_invalid_duplicate_pid.txt`
  Invalid seed with duplicate PID values.

- `fuzz/corpus/input/08_invalid_zero_burst.txt`
  Invalid seed with a zero burst time.

- `fuzz/corpus/input/09_invalid_negative_arrival.txt`
  Invalid seed with negative arrival time.

- `fuzz/corpus/input/10_invalid_extra_token.txt`
  Invalid seed with an extra token after the expected four fields.

- `fuzz/corpus/input/11_boundary_ints.txt`
  Boundary-value seed using large integer values.

- `fuzz/corpus/queue/00_empty.txt`
  Empty byte stream seed for the queue harness.

- `fuzz/corpus/queue/01_fifo_push.txt`
  Seed that mostly drives FIFO enqueue operations.

- `fuzz/corpus/queue/02_fifo_mix.txt`
  Seed that mixes FIFO enqueue/dequeue style operations.

- `fuzz/corpus/queue/03_heap_mix.txt`
  Seed that mixes heap insert/extract/peek operations.

- `fuzz/corpus/queue/04_combo.txt`
  Seed that drives all queue harness operation classes.

- `scripts/fuzz/run_baseline.sh`
  Helper script for timed AFL++ baseline runs. Builds the selected target,
  runs it for a duration, and prints stats such as execs, paths, crashes, and
  pending cases if `fuzzer_stats` exists.

- `scripts/os_process_logger.py`
  Cross-platform process sampler for macOS and Windows. It writes raw process
  samples, converts CPU-active processes into workload rows, optionally runs
  all scheduler algorithms, and can generate a dashboard from the exported
  results.

### Browser Dashboard Files

- `dashboard/index.html`
  Single-page browser application for editing workloads, choosing algorithms,
  running simulations, and viewing charts.

- `dashboard/style.css`
  Styling for the interactive dashboard.

- `dashboard/js/schedulers.js`
  Client-side implementations of FCFS, SJF, Round Robin, and priority
  scheduling.

- `dashboard/js/metrics.js`
  Client-side metric computation for dashboard results.

- `dashboard/js/gantt.js`
  Gantt chart rendering logic.

- `dashboard/js/charts.js`
  Algorithm comparison chart rendering.

- `dashboard/js/main.js`
  Dashboard state management, event handlers, input validation, and DOM
  orchestration.

### Python CSV Dashboard Files

- `ml/__init__.py`
  Marks the Python helper directory as a package.

- `ml/visualize_runs.py`
  Converts scheduler CSV exports into self-contained HTML dashboards with
  summary tables and bar charts.

- `ml/runs.csv`
  Example CSV dataset generated from simulator runs. It can be used as
  dashboard input.

- `ml/runs_dashboard.html`
  Generated dashboard for `ml/runs.csv`.

### Dashboard Tests In `ml/tests/`

- `ml/tests/test_generate.py`
  Verifies the C binary exists, CSV export creation works, expected columns are
  present, and exported numeric values are parseable.

- `ml/tests/test_visualize_runs.py`
  Verifies dashboard CSV parsing, per-algorithm averaging, and expected HTML
  report sections.

## Maintenance Guidance For Future Agents

- Keep C scheduler behavior changes covered by focused C tests under `tests/`.
- Keep browser dashboard logic aligned with the C scheduler rules.
- Keep CSV dashboard changes covered by
  `pytest -q ml/tests/test_visualize_runs.py`.
- Do not manually edit generated dashboards unless the task is specifically
  about generated output.
- Keep process logger output out of commits unless it is a deliberate example;
  personal process logs can reveal app usage.
- Be careful with scheduler tie breaks; tests expect deterministic PID ordering.
- If claiming fuzzing readiness, add actual campaign output and crash replay
  evidence, not only harness code.
- If claiming memory safety, run and document a leak/sanitizer pass.
