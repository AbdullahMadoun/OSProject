(function () {
  "use strict";

  const ALGORITHM_COLORS = {
    fcfs: "#3b82f6",
    sjf: "#10b981",
    rr: "#f59e0b",
    priority: "#8b5cf6",
    mlfq: "#e11d48"
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

  function summarizeTimeline(timeline) {
    return timeline.reduce((summary, segment) => {
      if (segment.kind === "idle") {
        summary.idleTime += segment.duration;
      } else if (segment.kind === "overhead") {
        summary.overheadTime += segment.duration;
        summary.contextSwitches += 1;
      }
      summary.totalTime = Math.max(summary.totalTime, segment.end);
      return summary;
    }, { totalTime: 0, idleTime: 0, overheadTime: 0, contextSwitches: 0 });
  }

  function clipResultForPlayback(result, playbackTime) {
    if (!Number.isFinite(playbackTime)) return result;

    const cutoff = Math.max(0, Math.min(playbackTime, result.totalTime || 0));
    const clippedTimeline = result.timeline
      .filter((segment) => segment.start < cutoff)
      .map((segment) => ({
        ...segment,
        end: Math.min(segment.end, cutoff)
      }))
      .filter((segment) => segment.end > segment.start)
      .map((segment) => ({
        ...segment,
        duration: segment.end - segment.start
      }));

    const stats = summarizeTimeline(clippedTimeline);
    return {
      ...result,
      timeline: clippedTimeline,
      totalTime: stats.totalTime,
      idleTime: stats.idleTime,
      overheadTime: stats.overheadTime,
      busyTime: Math.max(0, stats.totalTime - stats.idleTime - stats.overheadTime),
      contextSwitches: stats.contextSwitches
    };
  }

  function createLegend(results, legendContainer, mode) {
    if (!legendContainer) return;

    const idleItem = `
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full idle-dot border border-white/20"></div>
        <span class="font-mono-stats text-mono-stats text-on-surface-variant">Idle</span>
      </div>`;
    const overheadItem = `
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full overhead-dot border border-white/20"></div>
        <span class="font-mono-stats text-mono-stats text-on-surface-variant">Context Switch</span>
      </div>`;

    if (mode === "all") {
      legendContainer.innerHTML = results
        .map((result) => `
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style="background:${getAlgorithmColor(result.algorithm)}; color:${getAlgorithmColor(result.algorithm)}"></div>
            <span class="font-mono-stats text-mono-stats text-on-surface-variant">${result.label}</span>
          </div>`)
        .join("") + idleItem + overheadItem;
      return;
    }

    const pids = Array.from(new Set(results[0].processes.map((proc) => proc.pid))).sort((a, b) => a - b);
    legendContainer.innerHTML = pids
      .map((pid) => `
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style="background:${getAlgorithmColor(results[0].algorithm)}; color:${getAlgorithmColor(results[0].algorithm)}"></div>
          <span class="font-mono-stats text-mono-stats text-on-surface-variant">P${pid}</span>
        </div>`)
      .join("") + idleItem + overheadItem;
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

  function renderBlocks(result, unitWidth, resultIdx) {
    return result.timeline
      .map((segment) => {
        const width = Math.max(segment.duration * unitWidth, 20);
        if (segment.kind === "idle") {
          return `
            <div class="gantt-block idle-block" style="width:${width}px" title="Idle: ${segment.start}-${segment.end}">
              <span class="sr-only">Idle ${segment.start} to ${segment.end}</span>
            </div>`;
        }

        if (segment.kind === "overhead") {
          return `
            <div class="gantt-block overhead-block" style="width:${width}px" title="Context switch: ${segment.start}-${segment.end}">
              <span>CS</span>
              <small>${segment.start}-${segment.end}</small>
            </div>`;
        }

        const qLevel = segment.queueLevel;
        const qSuffix = (result.algorithm === "mlfq" && qLevel !== undefined) ? ` algo-mlfq-q${qLevel}` : "";
        const qBadge = (result.algorithm === "mlfq" && qLevel !== undefined) ? `<em class="gantt-queue-badge">Q${qLevel}</em>` : "";
        const why = JSON.stringify({pid: segment.pid, start: segment.start, end: segment.end, algorithm: result.algorithm, ri: resultIdx, queueLevel: qLevel});
        return `
          <div class="gantt-block gantt-why-block algo-${result.algorithm}${qSuffix}" style="width:${width}px" title="P${segment.pid} [Q${qLevel ?? ""}]: ${segment.start}-${segment.end} · Click to inspect" data-why='${why}'>
            <span>P${segment.pid}${qBadge}</span>
            <small>${segment.start}-${segment.end}</small>
          </div>`;
      })
      .join("");
  }

  function renderSingleChart(result, stacked, resultIdx) {
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
              ${result.label} - Total ${totalTime} ms - Idle ${result.idleTime} ms - Overhead ${result.overheadTime || 0} ms - Context switches ${result.contextSwitches}
            </p>
          </div>
          <span class="algorithm-chip" style="--chip-color:${getAlgorithmColor(result.algorithm)}">${result.label}</span>
        </div>
        <div class="content-relative gantt-scroll overflow-x-auto pb-4">
          <div class="gantt-inner" style="min-width:${track.width}px; width:${track.width}px">
            <div class="gantt-track" style="min-width:${track.width}px; width:${track.width}px">
              ${renderBlocks(result, track.unitWidth, resultIdx)}
            </div>
            <div class="time-axis" style="min-width:${track.width}px; width:${track.width}px">
              ${renderAxis(totalTime, track.unitWidth)}
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderGanttCharts(results, container, legendContainer, mode, playbackTime) {
    if (!container) return;
    if (!results || results.length === 0) {
      container.innerHTML = `
        <div class="glass-card rounded-xl p-lg text-on-surface-variant">
          Run a simulation to render the timeline.
        </div>`;
      if (legendContainer) legendContainer.innerHTML = "";
      return;
    }

    const renderedResults = Number.isFinite(playbackTime)
      ? results.map((result) => clipResultForPlayback(result, playbackTime))
      : results;

    container.classList.toggle("gantt-all-grid", mode === "all");
    createLegend(renderedResults, legendContainer, mode);
    window._lastGanttResults = results;
    container.innerHTML = renderedResults.map((result, idx) => renderSingleChart(result, mode === "all", idx)).join("");
  }

  window.GanttRenderer = {
    ALGORITHM_COLORS,
    getAlgorithmColor,
    renderGanttCharts
  };
})();
