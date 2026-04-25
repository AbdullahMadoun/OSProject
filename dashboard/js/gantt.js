(function () {
  "use strict";

  const ALGORITHM_COLORS = {
    fcfs: "#3b82f6",
    sjf: "#10b981",
    rr: "#f59e0b",
    priority: "#8b5cf6"
  };

  function getAlgorithmColor(algorithm) {
    return ALGORITHM_COLORS[algorithm] || "#3b82f6";
  }

  function getTrackWidth(totalTime) {
    const unitWidth = totalTime <= 28 ? 44 : totalTime <= 60 ? 32 : 24;
    return {
      unitWidth,
      width: Math.max(760, totalTime * unitWidth)
    };
  }

  function createLegend(results, legendContainer, mode) {
    if (!legendContainer) return;

    const idleItem = `
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full idle-dot border border-white/20"></div>
        <span class="font-mono-stats text-mono-stats text-on-surface-variant">Idle</span>
      </div>`;

    if (mode === "all") {
      legendContainer.innerHTML = results
        .map((result) => `
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style="background:${getAlgorithmColor(result.algorithm)}; color:${getAlgorithmColor(result.algorithm)}"></div>
            <span class="font-mono-stats text-mono-stats text-on-surface-variant">${result.label}</span>
          </div>`)
        .join("") + idleItem;
      return;
    }

    const pids = Array.from(new Set(results[0].processes.map((proc) => proc.pid))).sort((a, b) => a - b);
    legendContainer.innerHTML = pids
      .map((pid) => `
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style="background:${getAlgorithmColor(results[0].algorithm)}; color:${getAlgorithmColor(results[0].algorithm)}"></div>
          <span class="font-mono-stats text-mono-stats text-on-surface-variant">P${pid}</span>
        </div>`)
      .join("") + idleItem;
  }

  function renderAxis(totalTime, unitWidth) {
    const ticks = [];
    for (let time = 0; time <= totalTime; time += 1) {
      ticks.push(`
        <div class="time-tick" style="left:${time * unitWidth}px">
          <div class="w-px h-2 bg-outline-variant mb-1"></div>
          <span>${time}</span>
        </div>`);
    }
    return ticks.join("");
  }

  function renderBlocks(result, unitWidth) {
    return result.timeline
      .map((segment) => {
        const width = Math.max(segment.duration * unitWidth, 20);
        if (segment.pid === -1) {
          return `
            <div class="gantt-block idle-block" style="width:${width}px" title="Idle: ${segment.start}-${segment.end}">
              <span class="sr-only">Idle ${segment.start} to ${segment.end}</span>
            </div>`;
        }

        return `
          <div class="gantt-block algo-${result.algorithm}" style="width:${width}px" title="P${segment.pid}: ${segment.start}-${segment.end}">
            <span>P${segment.pid}</span>
            <small>${segment.start}-${segment.end}</small>
          </div>`;
      })
      .join("");
  }

  function renderSingleChart(result, stacked) {
    const totalTime = result.totalTime || 0;
    const track = getTrackWidth(totalTime);
    const chartTitle = stacked ? result.longLabel : "Master Gantt Chart";

    return `
      <article class="gantt-chart-card glass-card rounded-xl p-lg flex flex-col gap-md relative overflow-hidden reveal">
        <div class="absolute inset-0 noise-overlay pointer-events-none rounded-xl"></div>
        <div class="content-relative flex flex-col md:flex-row md:items-center justify-between gap-sm">
          <div>
            <h3 class="font-h2 text-h2 text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined" style="color:${getAlgorithmColor(result.algorithm)}">timeline</span>
              ${chartTitle}
            </h3>
            <p class="font-mono-stats text-mono-stats text-on-surface-variant mt-1">
              ${result.label} · Total ${totalTime} ms · Idle ${result.idleTime} ms · Context switches ${result.contextSwitches}
            </p>
          </div>
          <span class="algorithm-chip" style="--chip-color:${getAlgorithmColor(result.algorithm)}">${result.label}</span>
        </div>
        <div class="content-relative gantt-scroll overflow-x-auto pb-4">
          <div class="gantt-inner" style="min-width:${track.width}px; width:${track.width}px">
            <div class="gantt-track" style="min-width:${track.width}px; width:${track.width}px">
              ${renderBlocks(result, track.unitWidth)}
            </div>
            <div class="time-axis" style="min-width:${track.width}px; width:${track.width}px">
              ${renderAxis(totalTime, track.unitWidth)}
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderGanttCharts(results, container, legendContainer, mode) {
    if (!container) return;
    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="glass-card rounded-xl p-lg text-on-surface-variant">
          Run a simulation to render the timeline.
        </div>`;
      if (legendContainer) legendContainer.innerHTML = "";
      return;
    }

    createLegend(results, legendContainer, mode);
    container.innerHTML = results.map((result) => renderSingleChart(result, mode === "all")).join("");
  }

  window.GanttRenderer = {
    ALGORITHM_COLORS,
    getAlgorithmColor,
    renderGanttCharts
  };
})();
