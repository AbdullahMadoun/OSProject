(function () {
  "use strict";

  const ALGO_NAMES = {
    fcfs: "First Come, First Served",
    sjf: "Shortest Job First",
    rr: "Round Robin",
    priority: "Priority",
    mlfq: "Multilevel Feedback Queue",
    srtf: "Shortest Remaining Time First",
    priorityp: "Preemptive Priority"
  };

  const ALGO_COLORS = {
    fcfs: "#3b82f6",
    sjf: "#10b981",
    rr: "#f59e0b",
    priority: "#8b5cf6",
    mlfq: "#e11d48",
    srtf: "#06b6d4",
    priorityp: "#f43f5e"
  };

  const MLFQ_QUEUE_COLORS = ["#f97316", "#a855f7", "#64748b"];

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ].join(",");
  }

  /* ── Ready-queue reconstruction ─────────────────────────────────────────── */

  function getReadyQueue(result, t) {
    return result.processes.filter(
      (p) => p.arrival <= t && p.completion > t
    );
  }

  function getRemainingAt(result, pid, t) {
    const proc = result.processes.find((p) => p.pid === pid);
    if (!proc) return 0;
    const ran = (result.timeline || [])
      .filter(
        (s) =>
          s.kind !== "idle" && s.kind !== "overhead" && s.pid === pid && s.end <= t
      )
      .reduce((sum, s) => sum + s.duration, 0);
    return Math.max(0, proc.burst - ran);
  }

  /* ── Algorithm-specific explanation ─────────────────────────────────────── */

  function buildExplanation(seg, result) {
    const chosen = result.processes.find((p) => p.pid === seg.pid);
    if (!chosen) return "No data available for this process.";

    const ready = getReadyQueue(result, seg.start);

    switch (seg.algorithm) {
      case "fcfs": {
        const earliest = ready.reduce(
          (best, p) =>
            p.arrival < best.arrival || (p.arrival === best.arrival && p.pid < best.pid)
              ? p
              : best,
          ready[0]
        );
        return earliest && earliest.pid === seg.pid
          ? `P${seg.pid} arrived first (t=${chosen.arrival}), so FCFS dispatches it immediately — no peeking at burst time or priority.`
          : `P${seg.pid} was next in the FIFO arrival queue (arrived t=${chosen.arrival}).`;
      }

      case "sjf": {
        const shortest = ready.reduce(
          (best, p) =>
            p.burst < best.burst || (p.burst === best.burst && p.arrival < best.arrival)
              ? p
              : best,
          ready[0]
        );
        const others = ready.filter((p) => p.pid !== seg.pid);
        const longerCount = others.filter((p) => p.burst >= chosen.burst).length;
        return `P${seg.pid} has the shortest burst (${chosen.burst} ms) among all ready processes.${longerCount > 0 ? ` ${longerCount} other process${longerCount > 1 ? "es were" : " was"} longer.` : ""}`;
      }

      case "rr": {
        const rem = getRemainingAt(result, seg.pid, seg.start);
        return `P${seg.pid} was the next process in the Round Robin circular queue with ${rem} ms still remaining out of its original ${chosen.burst} ms burst.`;
      }

      case "priority": {
        const best = ready.reduce(
          (b, p) =>
            p.priority < b.priority || (p.priority === b.priority && p.arrival < b.arrival)
              ? p
              : b,
          ready[0]
        );
        const rivals = ready.filter((p) => p.pid !== seg.pid && p.priority <= chosen.priority);
        return `P${seg.pid} holds the highest priority (value = ${chosen.priority}, lower = more urgent).${rivals.length > 0 ? ` Ties broken by earliest arrival.` : ""}`;
      }

      case "priorityp": {
        const rem = getRemainingAt(result, seg.pid, seg.start);
        const rivals = ready.filter((p) => p.pid !== seg.pid && p.priority <= chosen.priority);
        return `P${seg.pid} holds the highest priority (value = ${chosen.priority}, lower = more urgent) at t=${seg.start} with ${rem} ms remaining. Unlike non-preemptive priority, this scheduler interrupts any running process the moment a higher-priority one arrives.${rivals.length > 0 ? " Ties broken by earliest arrival." : ""}`;
      }

      case "srtf": {
        const rem = getRemainingAt(result, seg.pid, seg.start);
        const rivals = ready.filter((p) => p.pid !== seg.pid);
        const longerCount = rivals.filter((p) => {
          const r2 = getRemainingAt(result, p.pid, seg.start);
          return r2 >= rem;
        }).length;
        return `P${seg.pid} has the shortest remaining time (${rem} ms) at t=${seg.start}. SRTF preempts the running job the moment a shorter-remaining process arrives — unlike SJF, it never waits for the current job to finish.${longerCount > 0 ? ` ${longerCount} other process${longerCount > 1 ? "es were" : " was"} longer.` : ""}`;
      }

      case "mlfq": {
        const qLevel = seg.queueLevel !== undefined ? seg.queueLevel : "?";
        const qNames = ["Q0 — highest priority (shortest quantum)", "Q1 — medium priority", "Q2 — lowest priority (FCFS, no quantum limit)"];
        const rem = getRemainingAt(result, seg.pid, seg.start);
        return `P${seg.pid} was scheduled from ${qNames[qLevel] || `Q${qLevel}`} with ${rem} ms remaining. Processes start in Q0 and are demoted each time they exhaust their quantum without finishing — rewarding short CPU bursts.`;
      }

      default:
        return "Decision data unavailable.";
    }
  }

  /* ── Ready-queue table ───────────────────────────────────────────────────── */

  function sortForAlgo(ready, algorithm, result, t) {
    return [...ready].sort((a, b) => {
      switch (algorithm) {
        case "fcfs":
          return a.arrival - b.arrival || a.pid - b.pid;
        case "sjf":
          return a.burst - b.burst || a.arrival - b.arrival || a.pid - b.pid;
        case "rr":
          return a.arrival - b.arrival || a.pid - b.pid;
        case "priority":
        case "priorityp":
          return a.priority - b.priority || a.arrival - b.arrival || a.pid - b.pid;
        case "srtf": {
          const ra = getRemainingAt(result, a.pid, t);
          const rb = getRemainingAt(result, b.pid, t);
          return ra - rb || a.arrival - b.arrival || a.pid - b.pid;
        }
        default:
          return a.pid - b.pid;
      }
    });
  }

  function renderReadyTable(ready, chosenPid, seg, result) {
    if (!ready || ready.length === 0) {
      return `<p class="text-on-surface-variant text-sm italic">Ready queue was empty — only P${chosenPid} was running.</p>`;
    }

    const sorted = sortForAlgo(ready, seg.algorithm, result, seg.start);

    const rows = sorted
      .map((p, rank) => {
        const isChosen = p.pid === chosenPid;
        const rem = getRemainingAt(result, p.pid, seg.start);
        const rowBg = isChosen ? "inspector-row-winner" : "inspector-row";
        const crown = isChosen ? `<span class="ml-1 text-xs" aria-label="chosen">👑</span>` : "";
        return `
          <tr class="${rowBg}">
            <td class="px-3 py-2 font-semibold">
              <span class="inline-flex items-center gap-1">
                <span class="text-xs text-on-surface-variant w-4 text-right">${rank + 1}.</span>
                P${p.pid}${crown}
              </span>
            </td>
            <td class="px-3 py-2 text-center">${p.arrival}</td>
            <td class="px-3 py-2 text-center">${p.burst}</td>
            <td class="px-3 py-2 text-center">${rem}</td>
            <td class="px-3 py-2 text-center">${p.priority}</td>
          </tr>`;
      })
      .join("");

    return `
      <div class="rounded-xl overflow-hidden border border-white/10">
        <table class="w-full text-sm font-mono inspector-table">
          <thead>
            <tr class="border-b border-white/10 text-on-surface-variant">
              <th class="px-3 py-2 text-left">PID</th>
              <th class="px-3 py-2 text-center">Arrival</th>
              <th class="px-3 py-2 text-center">Burst</th>
              <th class="px-3 py-2 text-center">Remaining</th>
              <th class="px-3 py-2 text-center">Priority</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ── Panel open / close ──────────────────────────────────────────────────── */

  function setOverlay(visible) {
    const overlay = document.getElementById("whyInspectorOverlay");
    if (!overlay) return;
    if (visible) {
      overlay.classList.remove("opacity-0", "pointer-events-none");
      overlay.classList.add("opacity-100");
    } else {
      overlay.classList.add("opacity-0", "pointer-events-none");
      overlay.classList.remove("opacity-100");
    }
  }

  function openInspector(seg) {
    const panel = document.getElementById("whyInspectorPanel");
    if (!panel) return;

    const results = window._lastGanttResults;
    if (!results || !results[seg.ri]) return;

    const result = results[seg.ri];
    const ready = getReadyQueue(result, seg.start);
    const explanation = buildExplanation(seg, result);
    const baseColor = ALGO_COLORS[seg.algorithm] || "#3b82f6";
    const color = (seg.algorithm === "mlfq" && seg.queueLevel !== undefined)
      ? MLFQ_QUEUE_COLORS[seg.queueLevel] || baseColor
      : baseColor;
    const chosen = result.processes.find((p) => p.pid === seg.pid);

    const qSuffix = (seg.algorithm === "mlfq" && seg.queueLevel !== undefined)
      ? ` · Q${seg.queueLevel}` : "";
    document.getElementById("whyPanelTitle").textContent =
      `Why P${seg.pid} at t = ${seg.start}?${qSuffix}`;

    document.getElementById("whyPanelContent").innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mb-5">
        <span class="inspector-chip" style="--chip-color:${color}">${ALGO_NAMES[seg.algorithm]}</span>
        <span class="font-mono text-xs text-on-surface-variant bg-surface-container-low/60 rounded-full px-3 py-1 border border-white/10">
          t&nbsp;=&nbsp;${seg.start} → ${seg.end}
          &nbsp;·&nbsp;
          ${seg.end - seg.start} ms slot
        </span>
      </div>

      <div class="bg-surface-container-low/60 rounded-xl p-4 mb-5 border border-white/10 flex gap-3">
        <span class="material-symbols-outlined text-xl mt-0.5" style="color:${color};font-variation-settings:'FILL' 1">psychology</span>
        <p class="text-on-surface text-sm leading-relaxed">${explanation}</p>
      </div>

      ${chosen ? `
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="bg-surface-container-low/40 rounded-xl p-3 border border-white/10 text-center">
          <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Arrived</p>
          <p class="font-mono text-h2 font-bold text-on-surface">${chosen.arrival}</p>
        </div>
        <div class="bg-surface-container-low/40 rounded-xl p-3 border border-white/10 text-center">
          <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Burst</p>
          <p class="font-mono text-h2 font-bold text-on-surface">${chosen.burst} ms</p>
        </div>
        <div class="bg-surface-container-low/40 rounded-xl p-3 border border-white/10 text-center">
          <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Priority</p>
          <p class="font-mono text-h2 font-bold text-on-surface">${chosen.priority}</p>
        </div>
      </div>` : ""}

      <div>
        <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">queue</span>
          Ready Queue at t = ${seg.start}
          <span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-surface-container font-mono">${ready.length}</span>
        </p>
        ${renderReadyTable(ready, seg.pid, seg, result)}
      </div>`;

    panel.style.setProperty("--inspector-accent", color);
    panel.style.setProperty("--inspector-accent-rgb", hexToRgb(color));
    panel.classList.remove("translate-x-full");
    panel.classList.add("translate-x-0");
    setOverlay(true);
  }

  function closeInspector() {
    const panel = document.getElementById("whyInspectorPanel");
    if (!panel) return;
    panel.classList.add("translate-x-full");
    panel.classList.remove("translate-x-0");
    setOverlay(false);
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */

  function init() {
    document.addEventListener("click", (e) => {
      const block = e.target.closest("[data-why]");
      if (block) {
        try {
          openInspector(JSON.parse(block.dataset.why));
        } catch (_) {}
        return;
      }
      if (e.target.id === "whyInspectorOverlay") {
        closeInspector();
      }
    });

    const closeBtn = document.getElementById("whyInspectorClose");
    if (closeBtn) closeBtn.addEventListener("click", closeInspector);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeInspector();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  window.WhyInspector = { open: openInspector, close: closeInspector };
})();
