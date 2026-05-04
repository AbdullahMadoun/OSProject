(function () {
  "use strict";

  const ALGO_ORDER = ["fcfs", "sjf", "rr", "priority"];

  const ALGO_LONG_NAMES = {
    fcfs: "First Come First Served",
    sjf: "Shortest Job First",
    rr: "Round Robin",
    priority: "Priority"
  };

  const ALGO_COLORS = {
    fcfs: "#3b82f6",
    sjf: "#10b981",
    rr: "#f59e0b",
    priority: "#8b5cf6"
  };

  const SPEED_INTERVALS = { slow: 700, normal: 350, fast: 100 };
  const MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

  const state = {
    results: [],
    clock: 0,
    maxTime: 0,
    timer: null,
    running: false,
    finishOrder: []
  };

  /* ── DOM helpers ─────────────────────────────────────────────────────────── */

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
    return procs.map((f) => ({
      pid: f.pid,
      arrival: f.arrival,
      burst: f.burst,
      priority: f.priority
    }));
  }

  function getQuantum() {
    const el = document.getElementById("quantumInput");
    return el ? Math.max(1, parseInt(el.value, 10) || 2) : 2;
  }

  function getCtxOverhead() {
    const el = document.getElementById("ctxInput");
    return el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
  }

  /* ── Stats ───────────────────────────────────────────────────────────────── */

  function statsAt(result, t) {
    const done = result.processes.filter(
      (p) => p.completion !== null && p.completion <= t
    );
    const avgWait =
      done.length > 0
        ? done.reduce((s, p) => s + (p.completion - p.arrival - p.burst), 0) /
          done.length
        : null;
    return {
      done: done.length,
      total: result.processes.length,
      avgWait,
      finished: t >= result.totalTime
    };
  }

  /* ── Rendering ───────────────────────────────────────────────────────────── */

  function renderLanes(t) {
    const container = document.getElementById("raceLanesContainer");
    if (!container || !state.results.length) return;

    container.innerHTML = state.results
      .map((result) => {
        const stats = statsAt(result, t);
        const pct =
          result.totalTime > 0
            ? Math.min(100, (t / result.totalTime) * 100).toFixed(1)
            : 100;
        const color = ALGO_COLORS[result.algorithm];
        const pos = state.finishOrder.indexOf(result.algorithm);
        const medal = pos >= 0 ? MEDALS[pos] : "";
        const waitStr =
          stats.avgWait !== null ? `${stats.avgWait.toFixed(2)} ms` : "—";

        const chipHtml = stats.finished
          ? `<span class="px-2 py-1 rounded-full text-xs font-bold bg-secondary-fixed/20 text-secondary-fixed border border-secondary-fixed/30 whitespace-nowrap">${medal}&nbsp;Done · ${result.totalTime} ms</span>`
          : `<span class="px-2 py-1 rounded-full text-xs font-semibold border" style="border-color:${color}60;color:${color}">● Racing</span>`;

        return `
        <div class="glass-card noise-bg rounded-xl p-lg flex flex-col gap-md relative overflow-hidden"
             style="border-top:3px solid ${color}">
          <div class="absolute inset-0 noise-overlay pointer-events-none rounded-xl"></div>
          <div class="content-relative flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">
                ${ALGO_LONG_NAMES[result.algorithm]}
              </p>
              <h3 class="font-display text-h1 font-bold leading-none" style="color:${color}">
                ${result.label}
              </h3>
            </div>
            ${chipHtml}
          </div>
          <div class="content-relative w-full bg-surface-container-lowest rounded-full h-3 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-150"
                 style="width:${pct}%;background:linear-gradient(90deg,${color}cc,${color});box-shadow:0 0 8px ${color}80">
            </div>
          </div>
          <div class="content-relative grid grid-cols-2 gap-sm">
            <div class="bg-surface-container-low/60 rounded-lg px-md py-sm">
              <p class="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Processes</p>
              <p class="font-mono-stats text-h2 text-on-surface leading-none">
                ${stats.done}<span class="text-on-surface-variant text-mono-stats"> / ${stats.total}</span>
              </p>
            </div>
            <div class="bg-surface-container-low/60 rounded-lg px-md py-sm">
              <p class="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Avg Waiting</p>
              <p class="font-mono-stats text-h2 text-on-surface leading-none">${waitStr}</p>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  function updateClock(t) {
    const el = document.getElementById("raceClockDisplay");
    if (el) el.textContent = `${t} / ${state.maxTime} ms`;
  }

  function renderPodium() {
    const el = document.getElementById("racePodium");
    if (!el) return;

    const ranking = state.results
      .map((r) => {
        const s = statsAt(r, r.totalTime);
        return {
          algorithm: r.algorithm,
          label: r.label,
          avgWait: s.avgWait || 0,
          totalTime: r.totalTime
        };
      })
      .sort((a, b) => a.avgWait - b.avgWait);

    el.innerHTML = `
      <div class="glass-card noise-bg rounded-xl p-lg">
        <div class="content-relative">
          <h3 class="font-h2 text-h2 text-on-surface mb-lg text-center flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL' 1">emoji_events</span>
            Race Complete — Final Rankings
          </h3>
          <div class="flex flex-col gap-md">
            ${ranking
              .map((r, i) => {
                const color = ALGO_COLORS[r.algorithm];
                return `
              <div class="flex items-center gap-lg bg-surface-container-low/50 rounded-xl px-lg py-md border"
                   style="border-color:${color}40;${i === 0 ? `box-shadow:0 0 24px ${color}25` : ""}">
                <span class="text-4xl select-none">${MEDALS[i]}</span>
                <div class="w-1 h-10 rounded-full flex-shrink-0" style="background:${color}"></div>
                <div class="flex-1 min-w-0">
                  <div class="font-h2 text-h2 text-on-surface">${r.label}</div>
                  <div class="font-mono-stats text-mono-stats text-on-surface-variant truncate">
                    ${ALGO_LONG_NAMES[r.algorithm]}
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Avg Waiting</div>
                  <div class="font-mono-stats text-h2 font-bold" style="color:${color}">
                    ${r.avgWait.toFixed(2)} ms
                  </div>
                </div>
                <div class="text-right hidden sm:block">
                  <div class="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Total Time</div>
                  <div class="font-mono-stats text-h2 text-on-surface">${r.totalTime} ms</div>
                </div>
              </div>`;
              })
              .join("")}
          </div>
        </div>
      </div>`;

    el.classList.remove("hidden");
  }

  /* ── Race control ────────────────────────────────────────────────────────── */

  function setButtonState(running) {
    const btn = document.getElementById("raceStartButton");
    if (!btn) return;
    if (running) {
      btn.innerHTML =
        '<span class="material-symbols-outlined">stop</span> Stop';
      btn.classList.add("race-btn-stop");
      btn.classList.remove("race-btn-start");
    } else {
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">flag</span> ${state.results.length ? "Restart Race" : "Start Race"}`;
      btn.classList.add("race-btn-start");
      btn.classList.remove("race-btn-stop");
    }
  }

  function stopRace() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.running = false;
    setButtonState(false);
  }

  function tick() {
    state.clock += 1;

    state.results.forEach((r) => {
      if (
        state.clock >= r.totalTime &&
        !state.finishOrder.includes(r.algorithm)
      ) {
        state.finishOrder.push(r.algorithm);
      }
    });

    renderLanes(state.clock);
    updateClock(state.clock);

    if (state.clock >= state.maxTime) {
      stopRace();
      renderPodium();
    }
  }

  function startRace() {
    const processes = readProcesses();
    if (!processes || processes.length === 0) {
      const container = document.getElementById("raceLanesContainer");
      if (container) {
        container.innerHTML = `
          <div class="glass-card rounded-xl p-lg col-span-full text-center text-error font-body-md py-8">
            Please define a valid workload in the Workload Definition section above first.
          </div>`;
      }
      return;
    }

    const options = { quantum: getQuantum(), ctxOverhead: getCtxOverhead() };
    const results = window.SchedulerCore.runAllAlgorithms(processes, options);

    stopRace();
    state.results = results;
    state.clock = 0;
    state.maxTime = results.reduce((m, r) => Math.max(m, r.totalTime), 0);
    state.finishOrder = [];

    const podium = document.getElementById("racePodium");
    if (podium) podium.classList.add("hidden");

    renderLanes(0);
    updateClock(0);

    const speedEl = document.getElementById("raceSpeedSelect");
    const speedKey = speedEl ? speedEl.value : "normal";
    const interval = SPEED_INTERVALS[speedKey] || 350;

    state.running = true;
    setButtonState(true);
    state.timer = setInterval(tick, interval);
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */

  function init() {
    const btn = document.getElementById("raceStartButton");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (state.running) {
        stopRace();
      } else {
        startRace();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  window.RaceMode = { startRace, stopRace };
})();
