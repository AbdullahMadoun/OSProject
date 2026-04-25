(function () {
  "use strict";

  const METRIC_DEFINITIONS = [
    { key: "avgWaiting", label: "Avg Waiting", unit: "ms", direction: "lower", digits: 2 },
    { key: "avgTurnaround", label: "Avg Turnaround", unit: "ms", direction: "lower", digits: 2 },
    { key: "avgResponse", label: "Avg Response", unit: "ms", direction: "lower", digits: 2 },
    { key: "utilization", label: "CPU Utilization", unit: "%", direction: "higher", digits: 1 },
    { key: "throughput", label: "Throughput", unit: "P/ms", direction: "higher", digits: 3 },
    { key: "contextSwitches", label: "Context Switches", unit: "", direction: "lower", digits: 0 }
  ];

  function formatMetric(value, definition) {
    const formatted = window.DashboardMetrics.formatNumber(value, definition.digits);
    if (!definition.unit) return formatted;
    return `${formatted} ${definition.unit}`;
  }

  function findBest(metricsList, definition) {
    const values = metricsList.map((metrics) => metrics[definition.key]);
    const bestValue = definition.direction === "higher" ? Math.max(...values) : Math.min(...values);
    const winners = metricsList.filter((metrics) => Math.abs(metrics[definition.key] - bestValue) < 0.000001);
    return { bestValue, winners };
  }

  function renderGroupedBars(metricsList, chartContainer) {
    if (!chartContainer) return;
    chartContainer.innerHTML = METRIC_DEFINITIONS.map((definition) => {
      const values = metricsList.map((metrics) => metrics[definition.key]);
      const maxValue = Math.max(...values, 0.000001);
      const best = findBest(metricsList, definition);

      const bars = metricsList.map((metrics) => {
        const height = Math.max(6, (metrics[definition.key] / maxValue) * 100);
        const isBest = best.winners.some((winner) => winner.algorithm === metrics.algorithm);
        const color = window.GanttRenderer.getAlgorithmColor(metrics.algorithm);

        return `
          <div class="comparison-bar-wrap">
            <div class="comparison-tooltip">${metrics.label}: ${formatMetric(metrics[definition.key], definition)}</div>
            ${isBest ? '<span class="material-symbols-outlined comparison-trophy" style="font-variation-settings:\'FILL\' 1;">emoji_events</span>' : ""}
            <div class="comparison-bar" style="height:${height}%; --bar-color:${color};"></div>
          </div>`;
      }).join("");

      return `
        <div class="comparison-metric-group">
          <div class="comparison-bars">${bars}</div>
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase text-center">${definition.label}</span>
        </div>`;
    }).join("");
  }

  function renderComparisonTable(metricsList, tableContainer) {
    if (!tableContainer) return;

    const headers = metricsList.map((metrics) => `
      <th class="font-label-caps text-label-caps text-on-surface-variant py-sm px-md uppercase tracking-wider">
        ${metrics.label}
      </th>`).join("");

    const rows = METRIC_DEFINITIONS.map((definition) => {
      const best = findBest(metricsList, definition);
      const winnerLabel = best.winners.length === metricsList.length
        ? "All"
        : best.winners.map((metrics) => metrics.label).join(" / ");

      const cells = metricsList.map((metrics) => {
        const isBest = best.winners.some((winner) => winner.algorithm === metrics.algorithm);
        return `
          <td class="py-md px-md ${isBest ? "best-cell" : ""}">
            ${formatMetric(metrics[definition.key], definition)}
          </td>`;
      }).join("");

      return `
        <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
          <td class="py-md px-md text-on-surface-variant font-body-md">${definition.label}</td>
          ${cells}
          <td class="py-md px-md">
            <span class="winner-badge">${winnerLabel}</span>
          </td>
        </tr>`;
    }).join("");

    tableContainer.innerHTML = `
      <table class="w-full text-left border-collapse min-w-[920px]">
        <thead>
          <tr class="border-b border-white/10">
            <th class="font-label-caps text-label-caps text-on-surface-variant py-sm px-md uppercase tracking-wider">Metric</th>
            ${headers}
            <th class="font-label-caps text-label-caps text-on-surface-variant py-sm px-md uppercase tracking-wider">Winner</th>
          </tr>
        </thead>
        <tbody class="font-mono-stats text-mono-stats text-on-surface">
          ${rows}
        </tbody>
      </table>`;
  }

  function renderComparison(results, chartContainer, tableContainer) {
    const metricsList = results.map((result) => window.DashboardMetrics.computeMetrics(result));
    renderGroupedBars(metricsList, chartContainer);
    renderComparisonTable(metricsList, tableContainer);
    return metricsList;
  }

  window.ComparisonRenderer = {
    METRIC_DEFINITIONS,
    renderComparison,
    findBest,
    formatMetric
  };
})();
