(function () {
  "use strict";

  const PID_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#e11d48", "#06b6d4"];
  const ALGO_COLORS = { fcfs: "#3b82f6", sjf: "#10b981", rr: "#f59e0b", priority: "#8b5cf6", you: "#00d4ff" };
  const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  function pidColor(pid) {
    return PID_PALETTE[(pid - 1) % PID_PALETTE.length];
  }

  const state = {
    processes: [],
    originalProcesses: [],
    timeline: [],
    currentTime: 0,
    stepQuantum: 1,
    allDone: false,
    started: false,
    hintPid: null,
    lastDispatchedPid: null
  };

  /* ── Process helpers ─────────────────────────────────────────────────────── */

  function readProcesses() {
    const rows = document.querySelectorAll("[data-process-row]");
    if (rows.length === 0) return null;
    let valid = true;
    const procs = [];
    rows.forEach((row) => {
      const f = {};
      row.querySelectorAll("[data-field]").forEach((inp) => {
        const v = parseInt(inp.value, 10);
        if (!Number.isFinite(v)) valid = false;
        f[inp.dataset.field] = v;
      });
      procs.push(f);
    });
    if (!valid) return null;
    return procs.map((f) => ({ pid: f.pid, arrival: f.arrival, burst: f.burst, priority: f.priority }));
  }

  function cloneForGame(procs) {
    return procs.map((p) => ({
      pid: p.pid, arrival: p.arrival, burst: p.burst, priority: p.priority,
      remaining: p.burst, start: null, completion: null
    }));
  }

  function getReadyQueue() {
    return state.processes
      .filter((p) => p.arrival <= state.currentTime && p.completion === null)
      .sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival || a.pid - b.pid);
  }

  function getNextArrival() {
    const pending = state.processes
      .filter((p) => p.arrival > state.currentTime && p.completion === null)
      .sort((a, b) => a.arrival - b.arrival);
    return pending.length > 0 ? pending[0].arrival : null;
  }

  function sjfHint(ready) {
    if (!ready.length) return null;
    return ready.reduce((best, p) =>
      p.remaining < best.remaining || (p.remaining === best.remaining && p.arrival < best.arrival) ? p : best
    , ready[0]);
  }

  function computeLiveAvgWait() {
    const done = state.processes.filter((p) => p.completion !== null);
    if (!done.length) return null;
    return done.reduce((sum, p) => sum + Math.max(0, p.completion - p.arrival - p.burst), 0) / done.length;
  }

  /* ── Game mechanics ──────────────────────────────────────────────────────── */

  function pushSegment(pid, start, end, kind) {
    if (end <= start) return;
    state.timeline.push({ pid, kind: kind || (pid === -1 ? "idle" : "process"), start, end, duration: end - start });
  }

  function autoAdvanceIdle() {
    while (!state.allDone) {
      const ready = getReadyQueue();
      if (ready.length > 0) break;
      const next = getNextArrival();
      if (next === null) break;
      pushSegment(-1, state.currentTime, next, "idle");
      state.currentTime = next;
    }
  }

  function dispatchProcess(pid) {
    if (state.allDone || !state.started) return;

    const proc = state.processes.find((p) => p.pid === pid);
    if (!proc || proc.completion !== null) return;
    if (!getReadyQueue().find((p) => p.pid === pid)) return;

    if (proc.start === null) proc.start = state.currentTime;

    const nextArrival = getNextArrival();
    const runFor = Math.min(
      state.stepQuantum,
      proc.remaining,
      nextArrival !== null ? nextArrival - state.currentTime : Infinity
    );

    if (runFor <= 0) {
      autoAdvanceIdle();
      render();
      return;
    }

    const sliceEnd = state.currentTime + runFor;

    // Count context switch
    if (state.lastDispatchedPid !== null && state.lastDispatchedPid !== pid) {
      state.contextSwitches = (state.contextSwitches || 0) + 1;
    }
    state.lastDispatchedPid = pid;

    pushSegment(pid, state.currentTime, sliceEnd);
    proc.remaining -= runFor;
    state.currentTime = sliceEnd;

    if (proc.remaining <= 0) proc.completion = state.currentTime;

    state.allDone = state.processes.every((p) => p.completion !== null);

    if (!state.allDone) autoAdvanceIdle();

    render();
    if (state.allDone) showResults();
  }

  function startGame() {
    const rawProcs = readProcesses();
    if (!rawProcs || rawProcs.length === 0) {
      const area = document.getElementById("btsGameArea");
      if (area) {
        area.classList.remove("hidden");
        area.innerHTML = `<div class="glass-card rounded-xl p-lg text-center text-error font-body-md py-8">
          Please define a valid workload in the Workload Definition section above first.
        </div>`;
      }
      return;
    }

    const stepEl = document.getElementById("btsStepSize");
    state.stepQuantum = stepEl ? Math.max(1, parseInt(stepEl.value, 10) || 1) : 1;

    state.originalProcesses = rawProcs;
    state.processes = cloneForGame(rawProcs);
    state.timeline = [];
    state.currentTime = 0;
    state.allDone = false;
    state.started = true;
    state.hintPid = null;
    state.lastDispatchedPid = null;
    state.contextSwitches = 0;

    // Advance past any idle time before first arrival
    const firstArrival = Math.min(...rawProcs.map((p) => p.arrival));
    if (firstArrival > 0) {
      pushSegment(-1, 0, firstArrival, "idle");
      state.currentTime = firstArrival;
    }

    document.getElementById("btsGameArea").classList.remove("hidden");
    document.getElementById("btsResults").classList.add("hidden");

    const btn = document.getElementById("btsStartButton");
    if (btn) btn.textContent = "Restart";

    render();
  }

  /* ── Rendering ───────────────────────────────────────────────────────────── */

  function render() {
    renderStats();
    renderReadyQueue();
    renderTimeline();
    renderProcessTable();
  }

  function renderStats() {
    const el = (id) => document.getElementById(id);
    if (el("btsClock")) el("btsClock").textContent = `${state.currentTime} ms`;
    const done = state.processes.filter((p) => p.completion !== null).length;
    if (el("btsCompleted")) el("btsCompleted").textContent = `${done} / ${state.processes.length}`;
    const avg = computeLiveAvgWait();
    if (el("btsAvgWait")) el("btsAvgWait").textContent = avg !== null ? `${avg.toFixed(2)} ms` : "—";
  }

  function renderReadyQueue() {
    const container = document.getElementById("btsReadyQueue");
    const hintBtn = document.getElementById("btsHintButton");
    if (!container) return;

    const ready = getReadyQueue();
    const hint = sjfHint(ready);
    state.hintPid = hint ? hint.pid : null;

    if (ready.length === 0) {
      container.innerHTML = state.allDone
        ? `<p class="text-on-surface-variant font-body-md py-4 text-center w-full">All processes finished! 🎉</p>`
        : `<p class="text-on-surface-variant font-body-md py-4">CPU idle — advancing to next arrival…</p>`;
      if (hintBtn) hintBtn.classList.add("hidden");
      return;
    }

    if (hintBtn) hintBtn.classList.remove("hidden");

    container.innerHTML = ready.map((p) => {
      const color = pidColor(p.pid);
      const pct = Math.max(6, Math.round((p.remaining / p.burst) * 100));
      return `
        <button class="bts-process-card" data-dispatch-pid="${p.pid}" style="--card-color:${color}">
          <div class="flex items-center justify-between mb-3">
            <span class="font-display text-h1 font-bold leading-none" style="color:${color}">P${p.pid}</span>
            <span class="text-[10px] font-mono text-on-surface-variant bg-surface-container/60 rounded-full px-2 py-0.5 border border-white/10">
              arr&nbsp;${p.arrival}
            </span>
          </div>
          <div class="w-full bg-surface-container-lowest rounded-full h-2 mb-2.5 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="flex justify-between text-xs font-mono text-on-surface-variant">
            <span>${p.remaining} ms left</span>
            <span>pri ${p.priority}</span>
          </div>
        </button>`;
    }).join("");

    container.querySelectorAll("[data-dispatch-pid]").forEach((btn) => {
      btn.addEventListener("click", () => dispatchProcess(Number(btn.dataset.dispatchPid)));
    });
  }

  function renderTimeline() {
    const container = document.getElementById("btsMiniTimeline");
    if (!container || !state.timeline.length) {
      if (container) container.innerHTML = `<p class="text-on-surface-variant text-sm font-mono py-2">Timeline will appear here…</p>`;
      return;
    }

    const totalTime = Math.max(state.currentTime, 1);
    const trackWidth = Math.max(600, totalTime * 30);

    const blocks = state.timeline.map((seg) => {
      const w = Math.max(Math.round((seg.duration / totalTime) * trackWidth), 14);
      if (seg.kind === "idle") {
        return `<div class="bts-tl-block bts-tl-idle" style="width:${w}px" title="Idle ${seg.start}–${seg.end}"></div>`;
      }
      const color = pidColor(seg.pid);
      return `
        <div class="bts-tl-block" style="width:${w}px;background:linear-gradient(135deg,${color}99,${color});border-color:${color}50" title="P${seg.pid}: ${seg.start}–${seg.end}">
          <span style="color:#fff">P${seg.pid}</span>
          <small>${seg.start}-${seg.end}</small>
        </div>`;
    }).join("");

    const ticks = [];
    for (let t = 0; t <= totalTime; t++) {
      if (t === 0 || t % Math.max(1, Math.floor(totalTime / 10)) === 0 || t === totalTime) {
        ticks.push(`<span style="position:absolute;left:${Math.round((t / totalTime) * trackWidth)}px;transform:translateX(-50%)">${t}</span>`);
      }
    }

    container.innerHTML = `
      <div style="min-width:${trackWidth}px">
        <div style="display:flex;height:40px">${blocks}</div>
        <div style="position:relative;height:16px;font-size:10px;color:var(--color-on-surface-variant,#888);font-family:monospace;margin-top:4px">
          ${ticks.join("")}
        </div>
      </div>`;
  }

  function renderProcessTable() {
    const tbody = document.getElementById("btsProcessTableBody");
    if (!tbody) return;

    tbody.innerHTML = state.processes.map((p) => {
      const color = pidColor(p.pid);
      const isDone = p.completion !== null;
      const isReady = !isDone && p.arrival <= state.currentTime;
      const isPending = !isDone && !isReady;
      const wait = isDone ? Math.max(0, p.completion - p.arrival - p.burst) : "—";
      const stateLabel = isDone ? "Done" : isReady ? "Ready" : "Pending";
      const stateClass = isDone ? "bts-state-done" : isReady ? "bts-state-ready" : "bts-state-pending";

      return `
        <tr class="border-b border-white/5 transition-opacity ${isDone ? "opacity-50" : ""}">
          <td class="px-3 py-2 font-bold" style="color:${color}">P${p.pid}</td>
          <td class="px-3 py-2 text-center font-mono text-sm">${p.remaining}</td>
          <td class="px-3 py-2 text-center font-mono text-sm">${p.arrival}</td>
          <td class="px-3 py-2 text-center font-mono text-sm">${p.priority}</td>
          <td class="px-3 py-2 text-center"><span class="${stateClass}">${stateLabel}</span></td>
          <td class="px-3 py-2 text-center font-mono text-sm">${typeof wait === "number" ? wait + " ms" : "—"}</td>
        </tr>`;
    }).join("");
  }

  /* ── Results ─────────────────────────────────────────────────────────────── */

  function showResults() {
    const n = state.processes.length;
    const userAvgWait = state.processes.reduce((sum, p) =>
      sum + Math.max(0, p.completion - p.arrival - p.burst), 0) / n;

    const algoResults = window.SchedulerCore.runAllAlgorithms(state.originalProcesses, { quantum: 2, ctxOverhead: 0 });
    const ranking = algoResults.map((r) => ({
      algorithm: r.algorithm,
      label: r.label,
      avgWait: r.processes.reduce((sum, p) => sum + (p.completion - p.arrival - p.burst), 0) / n
    }));
    ranking.push({ algorithm: "you", label: "You", avgWait: userAvgWait });
    ranking.sort((a, b) => a.avgWait - b.avgWait);

    const rank = ranking.findIndex((c) => c.algorithm === "you") + 1;
    const medal = MEDALS[rank - 1] || "";
    const best = ranking[0].avgWait;
    const ratio = userAvgWait / Math.max(best, 0.001);
    const grade = ratio < 1.05 ? "A+" : ratio < 1.2 ? "A" : ratio < 1.4 ? "B" : ratio < 1.6 ? "C" : "D";
    const gradeColor = grade.startsWith("A") ? "#10b981" : grade === "B" ? "#f59e0b" : "#ef4444";
    const worst = ranking[ranking.length - 1].avgWait;

    const resultsEl = document.getElementById("btsResults");
    if (!resultsEl) return;

    resultsEl.innerHTML = `
      <div class="glass-card noise-bg rounded-xl p-lg">
        <div class="absolute inset-0 noise-overlay pointer-events-none rounded-xl"></div>
        <div class="content-relative flex flex-col gap-lg">

          <div class="text-center">
            <p class="text-7xl mb-3 select-none">${medal}</p>
            <h3 class="font-display text-display text-on-surface">You ranked ${rank} of ${ranking.length}</h3>
            <p class="font-mono-stats text-mono-stats text-on-surface-variant mt-2">
              Your avg wait time:&nbsp;
              <span class="font-bold text-primary">${userAvgWait.toFixed(2)} ms</span>
              &nbsp;·&nbsp; Grade:&nbsp;
              <span class="font-bold text-xl" style="color:${gradeColor}">${grade}</span>
            </p>
          </div>

          <div class="flex flex-col gap-3">
            ${ranking.map((c, i) => {
              const isYou = c.algorithm === "you";
              const color = ALGO_COLORS[c.algorithm] || "#94a3b8";
              const barPct = worst > 0 ? Math.max(10, Math.round((1 - (c.avgWait - best) / Math.max(worst - best, 0.001)) * 100)) : 100;
              return `
                <div class="flex items-center gap-4 rounded-xl px-4 py-3 border transition-all
                            ${isYou ? "border-primary/40 bg-primary/8 shadow-[0_0_20px_rgba(0,212,255,0.08)]" : "border-white/8 bg-surface-container-low/40"}">
                  <span class="text-2xl w-8 text-center select-none">${MEDALS[i] || "·"}</span>
                  <div class="w-1 h-8 rounded-full flex-shrink-0" style="background:${color}"></div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold ${isYou ? "text-primary" : "text-on-surface"}">
                      ${isYou ? "👤 You" : c.label}
                    </div>
                    <div class="w-full bg-surface-container-lowest rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div class="h-full rounded-full transition-all" style="width:${barPct}%;background:${color}"></div>
                    </div>
                  </div>
                  <div class="text-right font-mono font-bold text-sm" style="color:${color}">${c.avgWait.toFixed(2)} ms</div>
                </div>`;
            }).join("")}
          </div>

          <button id="btsPlayAgainButton"
                  class="w-full py-3 px-6 rounded-xl bg-primary-container text-on-primary-container font-h2 text-[17px] font-semibold
                         hover:bg-tertiary-container hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">refresh</span>
            Play Again
          </button>

        </div>
      </div>`;

    resultsEl.classList.remove("hidden");
    setTimeout(() => resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);

    document.getElementById("btsPlayAgainButton").addEventListener("click", startGame);
  }

  /* ── Hint ────────────────────────────────────────────────────────────────── */

  function showHint() {
    if (state.hintPid === null) return;
    const btn = document.getElementById("btsHintButton");
    const cards = document.querySelectorAll(".bts-process-card");

    cards.forEach((card) => {
      if (Number(card.dataset.dispatchPid) === state.hintPid) {
        card.classList.add("bts-hint-glow");
        setTimeout(() => card.classList.remove("bts-hint-glow"), 2200);
      }
    });

    if (btn) {
      btn.textContent = `💡 SJF picks P${state.hintPid}`;
      setTimeout(() => { btn.innerHTML = `<span class="material-symbols-outlined text-sm align-middle" style="font-variation-settings:'FILL' 1">lightbulb</span>&nbsp;Hint`; }, 2200);
    }
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */

  function init() {
    const startBtn = document.getElementById("btsStartButton");
    if (startBtn) startBtn.addEventListener("click", startGame);

    const hintBtn = document.getElementById("btsHintButton");
    if (hintBtn) hintBtn.addEventListener("click", showHint);

    const stepEl = document.getElementById("btsStepSize");
    if (stepEl) {
      stepEl.addEventListener("change", () => {
        state.stepQuantum = Math.max(1, parseInt(stepEl.value, 10) || 1);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  window.BtsMode = { startGame };
})();
