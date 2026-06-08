# 🖥️ CPU Scheduling Simulator

![Build Status](https://img.shields.io/badge/Build-Passing-success)
![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)
![Language](https://img.shields.io/badge/Language-C11-blue)

A fully featured CPU scheduling simulator written in **C11**, complete with a browser-based interactive dashboard, gamified visualization features, a complete test suite, CSV export, and AFL++ fuzzing support.

---

## ⚙️ Implemented Algorithms

| Algorithm | Key | Preemptive | C Impl | Dashboard |
|-----------|-----|------------|--------|-----------|
| **First Come First Served** | `fcfs` | No | ✅ | ✅ |
| **Shortest Job First** | `sjf` | No | ✅ | ✅ |
| **Round Robin** | `rr` | Yes (quantum) | ✅ | ✅ |
| **Priority** | `priority` | No | ✅ | ✅ |
| **Shortest Remaining Time First** | `srtf` | Yes | ✅ | ✅ |
| **Preemptive Priority** | `priorityp` | Yes | ✅ | ✅ |
| **Multilevel Feedback Queue** | `mlfq` | Yes | ✅ | ✅ |

> **Note:** All algorithms support context-switch overhead (`-o`), deterministic tie-breaking by arrival time then PID, and idle-time accounting.

---

## 🚀 Quick Start

Build the simulator and run the test suite:

```bash
make clean && make
make test-c
```

Run some sample workloads:

```bash
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
./cpu_scheduler -s basic -a all -e results.csv
```

Serve the browser dashboard locally:

```bash
cd dashboard && python3 -m http.server 8080
# Open http://localhost:8080 in your browser
```
*(You can also open `dashboard/index.html` directly using `file://`)*

---

## 📄 Final Phase 3 Report

The final submission report is available as `reports/phase3_final_report.pdf`.
Its LaTeX source is located in `reports/phase3_final_report.tex`, and the browser evidence screenshots used in the report are stored under `reports/assets/`.

---

## 🛠️ Build Requirements

**Required:**
- C compiler with C11 support
- `make`

**Optional:**
- Python 3 for helper scripts and Python tests
- `pytest` and `psutil` (via `requirements.txt`)
- AFL++ for fuzzing

```bash
python3 -m pip install -r requirements.txt
```

---

## 💻 Run The Simulator

Run all algorithms on the built-in basic workload:
```bash
./cpu_scheduler -s basic -a all
```

Run Round Robin with a custom quantum:
```bash
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
```

Run SRTF with context-switch overhead:
```bash
./cpu_scheduler -s basic -a srtf -o 1
```

Run MLFQ (quantum controls Q0 slice; Q1 = 2×Q0; Q2 = FCFS):
```bash
./cpu_scheduler -s mixed -a mlfq -q 2
```

Export a comparison CSV:
```bash
./cpu_scheduler -s basic -a all -e results.csv
```

**Command-line options:**
```text
-f <file>     Load workload from file
-s <name>     Use sample workload: basic | rr | priority | edge | mixed
-a <algo>     Algorithm: fcfs | sjf | rr | priority | srtf | priorityp | mlfq | all
-q <int>      Time quantum for RR / MLFQ Q0 (default: 2)
-o <int>      Context switch overhead in ms (default: 0)
-e <file>     Export metrics to CSV
-h            Show help
```

---

## 📂 Workload Format

Each process line has four integer fields: `pid arrival burst priority`

**Rules:**
- `pid` must be positive and unique.
- `arrival` must be zero or greater.
- `burst` must be greater than zero.
- `priority` must be zero or greater (lower number = higher priority).
- Blank lines and `#` comments are ignored.

**Example:**
```text
# pid arrival burst priority
1 0 6 2
2 2 4 1
3 4 8 3
4 6 3 4
```
Sample workloads are provided in `workloads/`.

---

## 📏 Scheduling Rules

- **FCFS:** Sorts by arrival, runs to completion.
- **SJF (non-preemptive):** Picks shortest burst ready process, runs to completion.
- **Round Robin:** FIFO ready queue, runs for `quantum` ticks max.
- **Priority (non-preemptive):** Picks lowest priority number, runs to completion.
- **SRTF (preemptive SJF):** Preempts running process if a shorter-remaining one arrives.
- **Preemptive Priority:** Preempts running process if a higher-priority one arrives.
- **MLFQ (3 queues):**
  - `Q0`: quantum = `-q` value (default 2); highest priority.
  - `Q1`: quantum = 2 × Q0; medium priority.
  - `Q2`: FCFS, lowest priority.
  - New arrivals preempt `Q1`/`Q2` processes.

---

## 📈 Metrics

**Per-process formulas:**
- `turnaround = completion - arrival`
- `waiting = turnaround - burst`
- `response = first_start - arrival`

**Aggregate metrics computed:** Average Waiting, Average Turnaround, Average Response, CPU Utilization, Throughput, Context Switches, Total Runtime / Idle Time.

---

## 🧪 Tests

11 C test suites (all passing). Run them via:
```bash
make test-c
```
Suites include: `test_process`, `test_queue`, `test_input`, `test_fcfs`, `test_sjf`, `test_rr`, `test_priority`, `test_srtf`, `test_priority_p`, `test_mlfq`, `test_metrics`.

Run Python helper tests:
```bash
python3 -m pytest -q tests_py
```

Run everything:
```bash
make test
```

---

## 🌐 Browser Dashboard

The dashboard in `dashboard/` is a no-build static app. Open `index.html` directly or serve it with an HTTP server.

**Core Views:**
- Editable process table with live validation.
- Gantt chart with step-by-step playback controls.
- Per-process and aggregate metrics cards.

**Interactive Features:**
- 🔍 **Why Inspector:** Click any Gantt block to see the ready queue decision criterion.
- 🏁 **Race Mode:** Runs all algorithms simultaneously and ranks them by average waiting time.
- 🎮 **Be the Scheduler:** Manually dispatch processes step-by-step.
- 😈 **Adversarial Generator:** Generates workloads exposing worst-case weaknesses.
- 🧠 **Guess the Algorithm Quiz:** Identify the algorithm from a blind Gantt chart.
- 📺 **Kiosk Mode:** Auto-cycles through workloads with animated playback.

---

## 📊 CSV Dashboard

Generate and visualize a comparison CSV:
```bash
./cpu_scheduler -s basic -a all -e results.csv
python3 scripts/visualize_runs.py results.csv -o results.html
```

---

## 🐛 Fuzzing

Requires AFL++:
```bash
make fuzz-build
make fuzz-baseline-input   # 10-minute input campaign
make fuzz-baseline-queue   # 10-minute queue campaign
```

---

## 📁 Project Layout

```text
include/                   # Public C headers
src/                       # C simulator implementation
src/schedulers/            # All 7 scheduler implementations
tests/                     # C unit tests (11 suites)
tests_py/                  # Python tests for helper scripts
workloads/                 # Sample workload files
dashboard/                 # Browser dashboard (no build step)
scripts/                   # Helper scripts and CSV-to-HTML generator
fuzz/                      # AFL++ harnesses, dictionaries, and corpora
reports/                   # Phase reports, final PDF, and evidence assets
```

---

## 🎓 Suggested Grading Flow

1. Read the workload format and scheduling rules above.
2. `make clean && make`
3. `make test-c` — all 11 suites should pass.
4. `./cpu_scheduler -s basic -a all`
5. `./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4`
6. `./cpu_scheduler -s basic -a srtf -o 1`
7. `./cpu_scheduler -s mixed -a mlfq -q 2`
8. `./cpu_scheduler -s basic -a all -e results.csv`
9. Open `dashboard/index.html` — try the Gantt playback, Why Inspector, and Quiz.
