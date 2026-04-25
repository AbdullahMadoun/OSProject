(function () {
  "use strict";

  const PID_IDLE = -1;
  const PID_OVERHEAD = -2;

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

  function segmentKindFromPid(pid) {
    if (pid === PID_IDLE) return "idle";
    if (pid === PID_OVERHEAD) return "overhead";
    return "process";
  }

  function pushSegment(timeline, pid, start, end, mergeAdjacent, kind) {
    if (end <= start) return;
    const segmentKind = kind || segmentKindFromPid(pid);
    const last = timeline[timeline.length - 1];
    if (mergeAdjacent && last && last.pid === pid &&
        last.kind === segmentKind && last.end === start) {
      last.end = end;
      last.duration = last.end - last.start;
      return;
    }
    timeline.push({ pid, kind: segmentKind, start, end, duration: end - start });
  }

  function applyContextOverhead(timeline, currentTime, ctxOverhead) {
    if (ctxOverhead <= 0) return currentTime;
    const start = currentTime;
    const end = currentTime + ctxOverhead;
    pushSegment(timeline, PID_OVERHEAD, start, end, true, "overhead");
    return end;
  }

  function finalizeResult(algorithm, processes, timeline, contextSwitches) {
    const totalTime = timeline.reduce((max, item) => Math.max(max, item.end), 0);
    const idleTime = timeline.reduce((total, item) => {
      return total + (item.kind === "idle" ? item.duration : 0);
    }, 0);
    const overheadTime = timeline.reduce((total, item) => {
      return total + (item.kind === "overhead" ? item.duration : 0);
    }, 0);
    const busyTime = Math.max(0, totalTime - idleTime - overheadTime);

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
      idleTime,
      overheadTime,
      busyTime
    };
  }

  function scheduleFcfs(inputProcesses, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);
    const processes = cloneProcesses(inputProcesses).sort(byArrivalThenPid);
    const timeline = [];
    let contextSwitches = 0;
    let lastDispatchedPid = null;
    let currentTime = 0;

    processes.forEach((proc) => {
      if (currentTime < proc.arrival) {
        pushSegment(timeline, PID_IDLE, currentTime, proc.arrival, true, "idle");
        currentTime = proc.arrival;
      }

      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
      }

      proc.start = currentTime;
      currentTime += proc.burst;
      proc.remaining = 0;
      proc.completion = currentTime;
      pushSegment(timeline, proc.pid, proc.start, proc.completion, true);
      lastDispatchedPid = proc.pid;
    });

    return finalizeResult("fcfs", processes, timeline, contextSwitches);
  }

  function scheduleSjf(inputProcesses, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);
    const processes = cloneProcesses(inputProcesses);
    const order = processes.slice().sort(byArrivalThenPid);
    const ready = [];
    const timeline = [];
    let contextSwitches = 0;
    let lastDispatchedPid = null;
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
          pushSegment(timeline, PID_IDLE, currentTime, nextArrival, true, "idle");
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
      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
      }
      proc.start = currentTime;
      currentTime += proc.burst;
      proc.remaining = 0;
      proc.completion = currentTime;
      pushSegment(timeline, proc.pid, proc.start, proc.completion, true);
      lastDispatchedPid = proc.pid;
      completed += 1;
    }

    return finalizeResult("sjf", processes, timeline, contextSwitches);
  }

  function schedulePriority(inputProcesses, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);
    const processes = cloneProcesses(inputProcesses);
    const order = processes.slice().sort(byArrivalThenPid);
    const ready = [];
    const timeline = [];
    let contextSwitches = 0;
    let lastDispatchedPid = null;
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
          pushSegment(timeline, PID_IDLE, currentTime, nextArrival, true, "idle");
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
      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
      }
      proc.start = currentTime;
      currentTime += proc.burst;
      proc.remaining = 0;
      proc.completion = currentTime;
      pushSegment(timeline, proc.pid, proc.start, proc.completion, true);
      lastDispatchedPid = proc.pid;
      completed += 1;
    }

    return finalizeResult("priority", processes, timeline, contextSwitches);
  }

  function scheduleRoundRobin(inputProcesses, quantum, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);
    const safeQuantum = Math.max(1, Number(quantum) || 1);
    const processes = cloneProcesses(inputProcesses);
    const order = processes.slice().sort(byArrivalThenPid);
    const ready = [];
    const timeline = [];
    let currentTime = 0;
    let nextIndex = 0;
    let completed = 0;
    let contextSwitches = 0;
    let lastDispatchedPid = null;

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
          pushSegment(timeline, PID_IDLE, currentTime, nextArrival, true, "idle");
          currentTime = nextArrival;
        }
        continue;
      }

      const proc = ready.shift();
      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
        enqueueArrivals();
      }

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

      lastDispatchedPid = proc.pid;
    }

    return finalizeResult("rr", processes, timeline, contextSwitches);
  }

  function runAlgorithm(algorithm, processes, options) {
    const config = options || {};
    if (algorithm === "fcfs") return scheduleFcfs(processes, config);
    if (algorithm === "sjf") return scheduleSjf(processes, config);
    if (algorithm === "rr") return scheduleRoundRobin(processes, config.quantum, config);
    if (algorithm === "priority") return schedulePriority(processes, config);
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  function runAllAlgorithms(processes, options) {
    return ["fcfs", "sjf", "rr", "priority"].map((algorithm) => {
      return runAlgorithm(algorithm, processes, options);
    });
  }

  window.SchedulerCore = {
    ALGORITHMS,
    PID_IDLE,
    PID_OVERHEAD,
    runAlgorithm,
    runAllAlgorithms
  };
})();
