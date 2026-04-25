(function () {
  "use strict";

  const ALGORITHMS = {
    fcfs: { key: "fcfs", label: "FCFS", longLabel: "First Come First Served" },
    sjf: { key: "sjf", label: "SJF", longLabel: "Shortest Job First" },
    rr: { key: "rr", label: "RR", longLabel: "Round Robin" },
    priority: { key: "priority", label: "Priority", longLabel: "Priority" }
  };

  function cloneProcesses(processes) {
    return processes.map((proc) => ({
      pid: Number(proc.pid),
      arrival: Number(proc.arrival),
      burst: Number(proc.burst),
      priority: Number(proc.priority),
      remaining: Number(proc.burst),
      start: null,
      completion: null
    }));
  }

  function byArrivalThenPid(a, b) {
    if (a.arrival !== b.arrival) return a.arrival - b.arrival;
    return a.pid - b.pid;
  }

  function pushSegment(timeline, pid, start, end, mergeAdjacent) {
    if (end <= start) return;
    const last = timeline[timeline.length - 1];
    if (mergeAdjacent && last && last.pid === pid && last.end === start) {
      last.end = end;
      last.duration = last.end - last.start;
      return;
    }
    timeline.push({ pid, start, end, duration: end - start });
  }

  function finalizeResult(algorithm, processes, timeline, contextSwitches) {
    const totalTime = timeline.reduce((max, item) => Math.max(max, item.end), 0);
    const idleTime = timeline.reduce((total, item) => {
      return total + (item.pid === -1 ? item.duration : 0);
    }, 0);

    return {
      algorithm,
      label: ALGORITHMS[algorithm].label,
      longLabel: ALGORITHMS[algorithm].longLabel,
      timeline,
      processes: processes
        .map((proc) => ({
          pid: proc.pid,
          arrival: proc.arrival,
          burst: proc.burst,
          priority: proc.priority,
          start: proc.start,
          completion: proc.completion
        }))
        .sort((a, b) => a.pid - b.pid),
      contextSwitches,
      totalTime,
      idleTime
    };
  }

  function scheduleFcfs(inputProcesses) {
    const processes = cloneProcesses(inputProcesses).sort(byArrivalThenPid);
    const timeline = [];
    let currentTime = 0;

    processes.forEach((proc) => {
      if (currentTime < proc.arrival) {
        pushSegment(timeline, -1, currentTime, proc.arrival, true);
        currentTime = proc.arrival;
      }
      proc.start = currentTime;
      currentTime += proc.burst;
      proc.remaining = 0;
      proc.completion = currentTime;
      pushSegment(timeline, proc.pid, proc.start, proc.completion, true);
    });

    return finalizeResult("fcfs", processes, timeline, 0);
  }

  function scheduleSjf(inputProcesses) {
    const processes = cloneProcesses(inputProcesses);
    const order = processes.slice().sort(byArrivalThenPid);
    const ready = [];
    const timeline = [];
    let currentTime = 0;
    let nextIndex = 0;
    let completed = 0;

    while (completed < processes.length) {
      while (nextIndex < order.length && order[nextIndex].arrival <= currentTime) {
        ready.push(order[nextIndex]);
        nextIndex += 1;
      }

      if (ready.length === 0) {
        const nextArrival = order[nextIndex].arrival;
        if (currentTime < nextArrival) {
          pushSegment(timeline, -1, currentTime, nextArrival, true);
          currentTime = nextArrival;
        }
        continue;
      }

      ready.sort((a, b) => {
        if (a.burst !== b.burst) return a.burst - b.burst;
        if (a.arrival !== b.arrival) return a.arrival - b.arrival;
        return a.pid - b.pid;
      });

      const proc = ready.shift();
      proc.start = currentTime;
      currentTime += proc.burst;
      proc.remaining = 0;
      proc.completion = currentTime;
      pushSegment(timeline, proc.pid, proc.start, proc.completion, true);
      completed += 1;
    }

    return finalizeResult("sjf", processes, timeline, 0);
  }

  function schedulePriority(inputProcesses) {
    const processes = cloneProcesses(inputProcesses);
    const order = processes.slice().sort(byArrivalThenPid);
    const ready = [];
    const timeline = [];
    let currentTime = 0;
    let nextIndex = 0;
    let completed = 0;

    while (completed < processes.length) {
      while (nextIndex < order.length && order[nextIndex].arrival <= currentTime) {
        ready.push(order[nextIndex]);
        nextIndex += 1;
      }

      if (ready.length === 0) {
        const nextArrival = order[nextIndex].arrival;
        if (currentTime < nextArrival) {
          pushSegment(timeline, -1, currentTime, nextArrival, true);
          currentTime = nextArrival;
        }
        continue;
      }

      ready.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.arrival !== b.arrival) return a.arrival - b.arrival;
        return a.pid - b.pid;
      });

      const proc = ready.shift();
      proc.start = currentTime;
      currentTime += proc.burst;
      proc.remaining = 0;
      proc.completion = currentTime;
      pushSegment(timeline, proc.pid, proc.start, proc.completion, true);
      completed += 1;
    }

    return finalizeResult("priority", processes, timeline, 0);
  }

  function scheduleRoundRobin(inputProcesses, quantum) {
    const safeQuantum = Math.max(1, Number(quantum) || 1);
    const processes = cloneProcesses(inputProcesses);
    const order = processes.slice().sort(byArrivalThenPid);
    const ready = [];
    const timeline = [];
    let currentTime = 0;
    let nextIndex = 0;
    let completed = 0;
    let contextSwitches = 0;
    let lastPid = -1;

    function enqueueArrivals() {
      while (nextIndex < order.length && order[nextIndex].arrival <= currentTime) {
        ready.push(order[nextIndex]);
        nextIndex += 1;
      }
    }

    while (completed < processes.length) {
      enqueueArrivals();

      if (ready.length === 0) {
        const nextArrival = order[nextIndex].arrival;
        if (currentTime < nextArrival) {
          pushSegment(timeline, -1, currentTime, nextArrival, true);
          currentTime = nextArrival;
        }
        continue;
      }

      const nextPid = ready[0].pid;
      if (lastPid >= 0 && lastPid !== nextPid) {
        contextSwitches += 1;
      }

      const proc = ready.shift();
      if (proc.start === null) {
        proc.start = currentTime;
      }

      const start = currentTime;
      const ticks = Math.min(proc.remaining, safeQuantum);
      currentTime += ticks;
      proc.remaining -= ticks;
      pushSegment(timeline, proc.pid, start, currentTime, false);

      enqueueArrivals();

      if (proc.remaining > 0) {
        ready.push(proc);
      } else {
        proc.completion = currentTime;
        completed += 1;
      }

      lastPid = proc.pid;
    }

    return finalizeResult("rr", processes, timeline, contextSwitches);
  }

  function runAlgorithm(algorithm, processes, options) {
    const config = options || {};
    if (algorithm === "fcfs") return scheduleFcfs(processes);
    if (algorithm === "sjf") return scheduleSjf(processes);
    if (algorithm === "rr") return scheduleRoundRobin(processes, config.quantum);
    if (algorithm === "priority") return schedulePriority(processes);
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  function runAllAlgorithms(processes, options) {
    return ["fcfs", "sjf", "rr", "priority"].map((algorithm) => {
      return runAlgorithm(algorithm, processes, options);
    });
  }

  window.SchedulerCore = {
    ALGORITHMS,
    runAlgorithm,
    runAllAlgorithms
  };
})();
