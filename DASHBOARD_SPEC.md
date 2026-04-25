# CPU Scheduler Dashboard — Build Specification

## Overview

Build a single-page interactive web dashboard for the CPU Scheduling Simulator.
The dashboard must reimplement the four scheduling algorithms (FCFS, SJF,
Round Robin, Priority) in JavaScript so it runs entirely in the browser with
zero backend. All visualization is client-side.

The app lives in a new directory: `dashboard/` at the project root.
Use **vanilla HTML + CSS + JavaScript only** — no frameworks, no build tools,
no npm. One `index.html`, one `style.css`, one or more `.js` files.

---

## Design System

- **Theme:** Dark mode. Background `#0a0e1a`. Cards `rgba(255,255,255,0.04)`
  with `backdrop-filter: blur(12px)` and `1px solid rgba(255,255,255,0.08)` border.
- **Accent gradient:** `linear-gradient(135deg, #3b82f6, #06b6d4, #10b981)` (blue → cyan → teal).
- **Font:** `Inter` from Google Fonts, fallback `system-ui, sans-serif`.
- **Algorithm colors (consistent everywhere):**
  - FCFS = `#3b82f6` (blue)
  - SJF = `#10b981` (green)
  - RR = `#f59e0b` (amber)
  - Priority = `#8b5cf6` (purple)
- **Border radius:** 12px for cards, 8px for inputs/buttons.
- **Transitions:** all interactive elements get `transition: all 0.2s ease`.

---

## Page Sections (Single Page, Scroll-Based)

### Section 1 — Hero / Header

- App title: **"CPU Scheduler Simulator"**
- Subtitle: "Interactive scheduling algorithm visualizer"
- A top nav bar with anchor links: **Input · Gantt · Metrics · Compare**
- The nav bar should become sticky on scroll with a blur background.

### Section 2 — Workload Input

- An **editable table** for processes with columns:
  `PID | Arrival Time | Burst Time | Priority`
- Start with 4 pre-populated rows (the `sample_basic.txt` workload):
  - P1: arrival=0, burst=6, priority=2
  - P2: arrival=2, burst=4, priority=1
  - P3: arrival=4, burst=8, priority=3
  - P4: arrival=6, burst=3, priority=4
- An **"Add Process"** button that appends a new row (auto-increment PID).
- A **"Remove"** button (trash icon) on each row.
- A **Sample Workloads** dropdown with presets: Basic, Round Robin, Priority, Edge Case.
  Selecting one replaces the table contents with the matching `workloads/` data.
- **Algorithm selector:** a segmented toggle bar with 5 options:
  `FCFS | SJF | RR | Priority | All`
- When **RR** is selected (or All), show a **Quantum** number input (default 2, min 1, max 20).
- A large **"Run Simulation"** button with the accent gradient.
- **Validation:** highlight invalid cells in red. Burst must be ≥1, arrival ≥0,
  priority ≥0, PIDs must be unique and ≥1.

### Section 3 — Gantt Chart

- A horizontal, color-coded Gantt timeline drawn on an **HTML5 Canvas** or
  with styled `<div>` blocks.
- Each process block shows the PID label inside it.
- Idle time (no process running) shown as a striped/hatched dark gray block.
- A numbered **time axis** below the chart with tick marks at each time unit.
- A **legend** mapping each PID to its color.
- When "All" is selected, show **4 Gantt charts stacked vertically**, one per
  algorithm, each labeled.

### Section 4 — Metrics Dashboard

- **6 stat cards** in a responsive grid (3 columns on desktop, 2 on tablet, 1 mobile):
  1. Avg Waiting Time — icon: ⏳
  2. Avg Turnaround Time — icon: 🔄
  3. Avg Response Time — icon: ⚡
  4. CPU Utilization — shown as a **circular progress ring** (e.g., "94%")
  5. Throughput — icon: 📊
  6. Context Switches — icon: 🔀
- Below the cards: a **detailed process table** with columns:
  `PID | Arrival | Burst | Priority | Start | Completion | Waiting | Turnaround | Response`
- Computed exactly as the C simulator does:
  - `turnaround = completion - arrival`
  - `waiting = turnaround - burst`
  - `response = start - arrival`
  - `utilization = (total_time - idle_time) / total_time`
  - `throughput = n_procs / total_time`

### Section 5 — Algorithm Comparison

- Only visible when "All" is selected.
- A **grouped bar chart** (use Canvas or styled divs) comparing all 4 algorithms
  across each metric.
- A **comparison table**: algorithms as columns, metrics as rows. The best
  (lowest for time metrics, highest for utilization/throughput) value in each
  row is highlighted with a green glow.
- A **"Winner"** badge per metric row showing which algorithm is best.

---

## Scheduling Algorithm Specifications

Reimplement these exactly as the C simulator does:

### FCFS (First Come First Served)
- Sort processes by arrival time, break ties by PID.
- Run each process to completion before starting the next.
- Insert idle time if next process hasn't arrived yet.

### SJF (Shortest Job First — Non-Preemptive)
- At each decision point (when CPU is free), pick the arrived process with
  the shortest burst time. Break ties: shortest burst → earliest arrival → lowest PID.
- Run chosen process to completion.

### Round Robin
- Use a FIFO ready queue.
- Run each process for at most `quantum` time units.
- If a process isn't finished, requeue it at the back.
- New arrivals are enqueued before the preempted process is requeued.
- Count a context switch when switching between different PIDs.

### Priority (Non-Preemptive)
- At each decision point, pick the arrived process with the lowest priority
  number (= highest priority). Break ties: lowest priority number → earliest
  arrival → lowest PID.
- Run chosen process to completion.

---

## File Structure

```
dashboard/
├── index.html        # Single page with all sections
├── style.css         # All styles
├── js/
│   ├── main.js       # App initialization, event listeners, DOM orchestration
│   ├── schedulers.js # All 4 scheduling algorithms (pure functions)
│   ├── gantt.js      # Gantt chart rendering logic
│   ├── metrics.js    # Metric computation
│   └── charts.js     # Bar chart and comparison rendering
└── README.md         # How to open (just open index.html in a browser)
```

---

## Non-Functional Requirements

- Must work by opening `index.html` directly in a browser (`file://` protocol).
  No server required.
- Responsive: usable on 1440px desktop down to 768px tablet.
- All interactive elements must have unique `id` attributes.
- Smooth scroll between sections when clicking nav links.
- The "Run Simulation" button should be disabled until at least 1 valid process
  exists.
- Use CSS animations for card entrance (fade + slide up on scroll into view).

---

## Success Criteria Checklist

After the build, verify ALL of the following:

1. **File structure exists:** `dashboard/index.html`, `dashboard/style.css`,
   `dashboard/js/main.js`, `dashboard/js/schedulers.js`, `dashboard/js/gantt.js`,
   `dashboard/js/metrics.js`, `dashboard/js/charts.js` all exist.

2. **Opens in browser:** `open dashboard/index.html` launches without errors
   in the browser console (check with DevTools).

3. **Process table works:**
   - The default 4-process workload is visible on load.
   - Clicking "Add Process" adds a new row.
   - Clicking "Remove" on a row deletes it.
   - Selecting a sample workload from the dropdown replaces the table.

4. **Validation works:**
   - Entering burst=0 or a negative arrival highlights the cell red.
   - Duplicate PIDs are flagged.
   - "Run Simulation" is disabled when validation fails.

5. **FCFS correctness:** Run the default Basic workload with FCFS.
   Expected results:
   - P1: start=0, completion=6, waiting=0, turnaround=6, response=0
   - P2: start=6, completion=10, waiting=4, turnaround=8, response=4
   - P3: start=10, completion=18, waiting=6, turnaround=14, response=6
   - P4: start=18, completion=21, waiting=12, turnaround=15, response=12

6. **RR correctness:** Run the default Basic workload with RR, quantum=2.
   Verify the Gantt chart shows interleaved execution blocks of max 2 units.

7. **Gantt chart renders:** A horizontal timeline with colored blocks appears
   in Section 3. Idle gaps (if any) are visually distinct.

8. **Metrics cards render:** All 6 stat cards show numeric values.
   CPU Utilization shows a circular progress ring.

9. **Comparison mode:** Selecting "All" and running shows:
   - 4 stacked Gantt charts.
   - A grouped bar chart.
   - A comparison table with highlighted best values.

10. **Visual quality:** Dark theme is applied. Cards have glassmorphism.
    Algorithm colors are consistent. Inter font loads. No unstyled/broken
    elements visible.
