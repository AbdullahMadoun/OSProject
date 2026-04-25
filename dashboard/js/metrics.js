(function () {
  "use strict";

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  function computeMetrics(result) {
    const processMetrics = result.processes.map((proc) => {
      const turnaround = proc.completion - proc.arrival;
      const waiting = turnaround - proc.burst;
      const response = proc.start - proc.arrival;

      return {
        pid: proc.pid,
        arrival: proc.arrival,
        burst: proc.burst,
        priority: proc.priority,
        start: proc.start,
        completion: proc.completion,
        waiting,
        turnaround,
        response
      };
    });

    const totalTime = result.totalTime || 0;
    const idleTime = result.idleTime || 0;
    const overheadTime = result.overheadTime || 0;
    const busyTime = result.busyTime != null
      ? result.busyTime
      : Math.max(0, totalTime - idleTime - overheadTime);
    const utilization = totalTime > 0 ? (busyTime / totalTime) * 100 : 0;
    const throughput = totalTime > 0 ? processMetrics.length / totalTime : 0;

    return {
      algorithm: result.algorithm,
      label: result.label,
      longLabel: result.longLabel,
      totalTime,
      idleTime,
      overheadTime,
      busyTime,
      contextSwitches: result.contextSwitches || 0,
      processMetrics,
      avgWaiting: average(processMetrics.map((proc) => proc.waiting)),
      avgTurnaround: average(processMetrics.map((proc) => proc.turnaround)),
      avgResponse: average(processMetrics.map((proc) => proc.response)),
      utilization,
      throughput
    };
  }

  function formatNumber(value, digits) {
    const precision = digits == null ? 2 : digits;
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(precision).replace(/\.?0+$/, "");
  }

  window.DashboardMetrics = {
    computeMetrics,
    formatNumber
  };
})();
