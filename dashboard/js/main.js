(function () {
  "use strict";

  const PRESETS = {
    basic: [
      { pid: 1, arrival: 0, burst: 6, priority: 2 },
      { pid: 2, arrival: 2, burst: 4, priority: 1 },
      { pid: 3, arrival: 4, burst: 8, priority: 3 },
      { pid: 4, arrival: 6, burst: 3, priority: 4 }
    ],
    rr: [
      { pid: 1, arrival: 0, burst: 5, priority: 0 },
      { pid: 2, arrival: 1, burst: 3, priority: 0 },
      { pid: 3, arrival: 2, burst: 8, priority: 0 },
      { pid: 4, arrival: 3, burst: 6, priority: 0 }
    ],
    priority: [
      { pid: 1, arrival: 0, burst: 10, priority: 3 },
      { pid: 2, arrival: 0, burst: 1, priority: 1 },
      { pid: 3, arrival: 0, burst: 2, priority: 4 },
      { pid: 4, arrival: 0, burst: 1, priority: 5 },
      { pid: 5, arrival: 0, burst: 5, priority: 2 }
    ],
    edge: [
      { pid: 1, arrival: 5, burst: 3, priority: 1 }
    ],
    mixed: [
      { pid: 1, arrival: 0, burst: 6, priority: 3 },
      { pid: 2, arrival: 2, burst: 2, priority: 1 },
      { pid: 3, arrival: 4, burst: 8, priority: 4 },
      { pid: 4, arrival: 5, burst: 3, priority: 2 },
      { pid: 5, arrival: 8, burst: 5, priority: 1 },
      { pid: 6, arrival: 10, burst: 1, priority: 5 }
    ]
  };

  const state = {
    selectedAlgorithm: "fcfs",
    lastResults: [],
    revealObserver: null,
    playbackTime: 0,
    playbackMaxTime: 0,
    playbackTimer: null,
    isPlaybackRunning: false,
    ganttLabelBase: ""
  };

  const els = {};

  function cacheElements() {
    [
      "processRows",
      "sampleSelect",
      "addProcessButton",
      "clearProcessButton",
      "runSimulationButton",
      "runAllButton",
      "quantumPanel",
      "quantumInput",
      "quantumValue",
      "ctxInput",
      "ctxValue",
      "validationMessage",
      "ganttContainer",
      "ganttLegend",
      "ganttAlgorithmLabel",
      "playbackPrevious",
      "playbackPlay",
      "playbackPlayIcon",
      "playbackNext",
      "playbackReset",
      "playbackClock",
      "metricsAlgorithmLabel",
      "comparisonSection",
      "comparisonPlaceholder",
      "comparisonContent",
      "comparisonChart",
      "comparisonTable",
      "avgWaitingValue",
      "avgTurnaroundValue",
      "avgResponseValue",
      "cpuUtilValue",
      "cpuUtilRing",
      "throughputValue",
      "contextSwitchesValue",
      "metricsTableBody"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function clonePreset(key) {
    return PRESETS[key].map((proc) => ({ ...proc }));
  }

  function renderProcessRows(processes) {
    els.processRows.innerHTML = processes.map((proc, index) => `
      <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-outline-variant/10 transition-all duration-200 table-row-hover group relative" data-process-row>
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary-container opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div class="col-span-2 relative">
          <label class="sr-only" for="process-${index}-pid">PID</label>
          <input id="process-${index}-pid" class="process-input text-tertiary-fixed" data-field="pid" type="number" step="1" min="1" value="${proc.pid}">
        </div>
        <div class="col-span-3 relative">
          <label class="sr-only" for="process-${index}-arrival">Arrival Time</label>
          <input id="process-${index}-arrival" class="process-input" data-field="arrival" type="number" step="1" min="0" value="${proc.arrival}">
        </div>
        <div class="col-span-3 relative">
          <label class="sr-only" for="process-${index}-burst">Burst Time</label>
          <input id="process-${index}-burst" class="process-input" data-field="burst" type="number" step="1" min="1" value="${proc.burst}">
        </div>
        <div class="col-span-3 relative">
          <label class="sr-only" for="process-${index}-priority">Priority</label>
          <input id="process-${index}-priority" class="process-input" data-field="priority" type="number" step="1" min="0" value="${proc.priority}">
        </div>
        <div class="col-span-1 flex justify-end">
          <button id="remove-process-${index}" class="remove-process-button text-on-surface-variant/50 hover:text-error transition-colors p-1 rounded-full hover:bg-error/10" type="button" data-index="${index}" aria-label="Remove process P${proc.pid}">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>`).join("");

    validateProcessTable();
  }

  function readRawProcesses() {
    return Array.from(document.querySelectorAll("[data-process-row]")).map((row) => {
      const fields = {};
      row.querySelectorAll("[data-field]").forEach((input) => {
        fields[input.dataset.field] = input.value;
      });
      return fields;
    });
  }

  function parseInteger(value) {
    if (String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isInteger(number)) return null;
    return number;
  }

  function validateProcessTable() {
    const rows = Array.from(document.querySelectorAll("[data-process-row]"));
    const parsed = [];
    const pidCounts = new Map();
    const messages = [];

    rows.forEach((row) => {
      const proc = {};
      row.querySelectorAll("[data-field]").forEach((input) => {
        input.classList.remove("invalid-input");
        proc[input.dataset.field] = parseInteger(input.value);
      });
      parsed.push({ row, proc });
      if (proc.pid !== null) {
        pidCounts.set(proc.pid, (pidCounts.get(proc.pid) || 0) + 1);
      }
    });

    let isValid = rows.length > 0;

    parsed.forEach(({ row, proc }) => {
      const checks = {
        pid: proc.pid !== null && proc.pid >= 1 && pidCounts.get(proc.pid) === 1,
        arrival: proc.arrival !== null && proc.arrival >= 0,
        burst: proc.burst !== null && proc.burst >= 1,
        priority: proc.priority !== null && proc.priority >= 0
      };

      Object.keys(checks).forEach((field) => {
        const input = row.querySelector(`[data-field="${field}"]`);
        if (!checks[field]) {
          input.classList.add("invalid-input");
          isValid = false;
        }
      });
    });

    if (rows.length === 0) {
      messages.push("Add at least one process.");
    }
    if (!isValid && rows.length > 0) {
      messages.push("PIDs must be unique and positive. Arrival and priority must be 0 or greater. Burst must be 1 or greater.");
    }

    els.validationMessage.textContent = messages.join(" ");
    els.runSimulationButton.disabled = !isValid;
    els.runSimulationButton.classList.toggle("run-disabled", !isValid);
    if (els.runAllButton) {
      els.runAllButton.disabled = !isValid;
      els.runAllButton.classList.toggle("run-disabled", !isValid);
    }
    return isValid;
  }

  function getValidatedProcesses() {
    if (!validateProcessTable()) return null;
    return readRawProcesses().map((proc) => ({
      pid: parseInteger(proc.pid),
      arrival: parseInteger(proc.arrival),
      burst: parseInteger(proc.burst),
      priority: parseInteger(proc.priority)
    }));
  }

  function addProcess() {
    const currentRows = readRawProcesses();
    const maxPid = currentRows.reduce((max, proc) => {
      const pid = parseInteger(proc.pid);
      return pid && pid > max ? pid : max;
    }, 0);
    currentRows.push({ pid: maxPid + 1, arrival: 0, burst: 1, priority: 0 });
    renderProcessRows(currentRows);
  }

  function removeProcess(index) {
    const currentRows = readRawProcesses();
    currentRows.splice(index, 1);
    renderProcessRows(currentRows);
  }

  function clearProcesses() {
    renderProcessRows([]);
  }

  function setPreset(key) {
    renderProcessRows(clonePreset(key));
    els.sampleSelect.value = key;
  }

  function stopPlayback() {
    if (state.playbackTimer) {
      clearInterval(state.playbackTimer);
      state.playbackTimer = null;
    }
    state.isPlaybackRunning = false;
    if (els.playbackPlayIcon) {
      els.playbackPlayIcon.textContent = "play_arrow";
    }
  }

  function setAlgorithm(algorithm) {
    state.selectedAlgorithm = algorithm;
    stopPlayback();

    document.querySelectorAll("[data-algorithm]").forEach((button) => {
      const isActive = button.dataset.algorithm === algorithm;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    const showQuantum = algorithm === "rr" || algorithm === "all";
    els.quantumPanel.classList.toggle("hidden", !showQuantum);
    updateComparisonVisibility(false);
  }

  function getQuantum() {
    const value = parseInteger(els.quantumInput.value);
    const quantum = Math.min(20, Math.max(1, value || 2));
    els.quantumInput.value = quantum;
    els.quantumValue.textContent = `${quantum} ms`;
    return quantum;
  }

  function getCtxOverhead() {
    const value = parseInteger(els.ctxInput.value);
    const overhead = Math.min(20, Math.max(0, value || 0));
    els.ctxInput.value = overhead;
    els.ctxValue.textContent = `${overhead} ms`;
    return overhead;
  }

  function updateComparisonVisibility(hasAllResults) {
    const isAll = state.selectedAlgorithm === "all";
    els.comparisonContent.classList.toggle("hidden", !(isAll && hasAllResults));
    els.comparisonPlaceholder.classList.toggle("hidden", isAll && hasAllResults);
  }

  function updateMetricsCards(metrics) {
    els.avgWaitingValue.textContent = window.DashboardMetrics.formatNumber(metrics.avgWaiting, 2);
    els.avgTurnaroundValue.textContent = window.DashboardMetrics.formatNumber(metrics.avgTurnaround, 2);
    els.avgResponseValue.textContent = window.DashboardMetrics.formatNumber(metrics.avgResponse, 2);
    els.cpuUtilValue.textContent = `${window.DashboardMetrics.formatNumber(metrics.utilization, 1)}%`;
    els.throughputValue.textContent = window.DashboardMetrics.formatNumber(metrics.throughput, 3);
    els.contextSwitchesValue.textContent = String(metrics.contextSwitches);

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, metrics.utilization));
    els.cpuUtilRing.style.strokeDasharray = String(circumference);
    els.cpuUtilRing.style.strokeDashoffset = String(circumference * (1 - clamped / 100));
  }

  function updateMetricsTable(metrics) {
    els.metricsTableBody.innerHTML = metrics.processMetrics.map((proc) => `
      <tr class="transition-all duration-200 table-row-hover group">
        <td class="px-6 py-4"><span class="bg-surface-variant px-2 py-1 rounded text-primary-container">P${proc.pid}</span></td>
        <td class="px-6 py-4 text-on-surface-variant">${proc.arrival}</td>
        <td class="px-6 py-4 text-on-surface-variant">${proc.burst}</td>
        <td class="px-6 py-4 text-on-surface-variant">${proc.priority}</td>
        <td class="px-6 py-4 text-on-surface-variant">${proc.start}</td>
        <td class="px-6 py-4 text-on-surface-variant">${proc.completion}</td>
        <td class="px-6 py-4 text-right"><span class="text-secondary-fixed bg-secondary-fixed/10 px-2 py-1 rounded border border-secondary-fixed/20 shadow-[0_0_10px_rgba(82,255,172,0.1)]">${proc.waiting}</span></td>
        <td class="px-6 py-4 text-right">${proc.turnaround}</td>
        <td class="px-6 py-4 text-right">${proc.response}</td>
      </tr>`).join("");
  }

  function updateMetrics(result, mode) {
    const metrics = window.DashboardMetrics.computeMetrics(result);
    const qualifier = mode === "all" ? `${result.label} baseline - compare all below` : result.longLabel;
    els.metricsAlgorithmLabel.textContent = qualifier;
    updateMetricsCards(metrics);
    updateMetricsTable(metrics);
  }

  function updatePlaybackUI() {
    const shownTime = Math.max(0, Math.min(state.playbackMaxTime, Math.floor(state.playbackTime)));

    if (els.playbackClock) {
      els.playbackClock.textContent = `${shownTime} / ${state.playbackMaxTime} ms`;
    }

    if (els.playbackPlayIcon) {
      els.playbackPlayIcon.textContent = state.isPlaybackRunning ? "pause" : "play_arrow";
    }

    const labelSuffix = ` - Playback ${Math.floor(shownTime)}/${state.playbackMaxTime} ms`;
    els.ganttAlgorithmLabel.textContent = `${state.ganttLabelBase}${labelSuffix}`;
  }

  function renderPlaybackFrame() {
    if (!state.lastResults.length) return;
    const mode = state.selectedAlgorithm === "all" ? "all" : "single";
    window.GanttRenderer.renderGanttCharts(
      state.lastResults,
      els.ganttContainer,
      els.ganttLegend,
      mode,
      state.playbackTime
    );
    updatePlaybackUI();
    observeRevealElements();
  }

  function setPlaybackTime(timeValue) {
    const clamped = Math.max(0, Math.min(state.playbackMaxTime, Number(timeValue) || 0));
    state.playbackTime = clamped;
    renderPlaybackFrame();
  }

  function startPlayback() {
    if (!state.lastResults.length) return;

    if (state.playbackTime >= state.playbackMaxTime) {
      state.playbackTime = 0;
    }

    stopPlayback();
    state.isPlaybackRunning = true;
    updatePlaybackUI();
    state.playbackTimer = setInterval(() => {
      if (state.playbackTime >= state.playbackMaxTime) {
        stopPlayback();
        updatePlaybackUI();
        return;
      }
      state.playbackTime += 1;
      renderPlaybackFrame();
    }, 420);
  }

  function togglePlayback() {
    if (!state.lastResults.length) return;
    if (state.isPlaybackRunning) {
      stopPlayback();
      updatePlaybackUI();
      return;
    }
    startPlayback();
  }

  function stepPlayback(delta) {
    if (!state.lastResults.length) return;
    stopPlayback();
    setPlaybackTime(state.playbackTime + delta);
  }

  function resetPlayback() {
    if (!state.lastResults.length) return;
    stopPlayback();
    setPlaybackTime(0);
  }

  function runSimulation() {
    const processes = getValidatedProcesses();
    if (!processes) return;

    stopPlayback();

    const quantum = getQuantum();
    const ctxOverhead = getCtxOverhead();
    const mode = state.selectedAlgorithm;
    const options = { quantum, ctxOverhead };

    const results = mode === "all"
      ? window.SchedulerCore.runAllAlgorithms(processes, options)
      : [window.SchedulerCore.runAlgorithm(mode, processes, options)];

    state.lastResults = results;
    state.playbackMaxTime = results.reduce((max, result) => Math.max(max, result.totalTime), 0);
    state.playbackTime = state.playbackMaxTime;

    const primaryResult = results[0];
    state.ganttLabelBase = mode === "all"
      ? `All algorithms - RR q=${quantum} - CS overhead=${ctxOverhead}ms`
      : `${primaryResult.longLabel}${primaryResult.algorithm === "rr" ? ` - q=${quantum}` : ""} - CS overhead=${ctxOverhead}ms`;

    renderPlaybackFrame();
    updateMetrics(primaryResult, mode === "all" ? "all" : "single");

    if (mode === "all") {
      window.ComparisonRenderer.renderComparison(results, els.comparisonChart, els.comparisonTable);
      updateComparisonVisibility(true);
    } else {
      updateComparisonVisibility(false);
    }

    observeRevealElements();
  }

  function runAllAlgorithmsNow() {
    if (!validateProcessTable()) return;
    setAlgorithm("all");
    runSimulation();
  }

  function observeRevealElements() {
    const revealElements = document.querySelectorAll(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    if (!state.revealObserver) {
      state.revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            state.revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
    }

    revealElements.forEach((element) => state.revealObserver.observe(element));
  }

  function bindEvents() {
    els.processRows.addEventListener("input", validateProcessTable);
    els.processRows.addEventListener("click", (event) => {
      const button = event.target.closest(".remove-process-button");
      if (button) {
        removeProcess(Number(button.dataset.index));
      }
    });

    els.addProcessButton.addEventListener("click", addProcess);
    els.clearProcessButton.addEventListener("click", clearProcesses);
    els.sampleSelect.addEventListener("change", (event) => setPreset(event.target.value));
    els.runSimulationButton.addEventListener("click", runSimulation);
    if (els.runAllButton) {
      els.runAllButton.addEventListener("click", runAllAlgorithmsNow);
    }
    els.quantumInput.addEventListener("input", getQuantum);
    els.ctxInput.addEventListener("input", getCtxOverhead);

    els.playbackPlay.addEventListener("click", togglePlayback);
    els.playbackPrevious.addEventListener("click", () => stepPlayback(-1));
    els.playbackNext.addEventListener("click", () => stepPlayback(1));
    els.playbackReset.addEventListener("click", resetPlayback);

    document.querySelectorAll("[data-algorithm]").forEach((button) => {
      button.addEventListener("click", () => setAlgorithm(button.dataset.algorithm));
    });

    document.querySelectorAll("[data-load-sample]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.loadSample;
        setPreset(key);
        document.getElementById("input").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function init() {
    cacheElements();
    bindEvents();
    renderProcessRows(clonePreset("basic"));
    setAlgorithm("fcfs");
    getQuantum();
    getCtxOverhead();
    observeRevealElements();
    runSimulation();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
