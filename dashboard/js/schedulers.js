(function () {
  "use strict";

  const PID_IDLE = -1;
  const PID_OVERHEAD = -2;

  const ALGORITHMS = {
    fcfs: { key: "fcfs", label: "FCFS", longLabel: "First Come First Served" },
    sjf: { key: "sjf", label: "SJF", longLabel: "Shortest Job First" },
    rr: { key: "rr", label: "RR", longLabel: "Round Robin" },
    priority: { key: "priority", label: "Priority", longLabel: "Priority" },
    mlfq: { key: "mlfq", label: "MLFQ", longLabel: "Multilevel Feedback Queue" },
    srtf: { key: "srtf", label: "SRTF", longLabel: "Shortest Remaining Time First" },
    priorityp: { key: "priorityp", label: "P-Priority", longLabel: "Preemptive Priority" }
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

  function scheduleSrtf(inputProcesses, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);

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

    function pickShortest() {
      if (!ready.length) return null;
      return ready.reduce((best, p) => {
        if (p.remaining < best.remaining) return p;
        if (p.remaining === best.remaining && p.arrival < best.arrival) return p;
        if (p.remaining === best.remaining && p.arrival === best.arrival && p.pid < best.pid) return p;
        return best;
      }, ready[0]);
    }

    while (completed < processes.length) {
      enqueueArrivals();

      const proc = pickShortest();

      if (!proc) {
        const nextArrival = order[nextIndex].arrival;
        pushSegment(timeline, PID_IDLE, currentTime, nextArrival, true, "idle");
        currentTime = nextArrival;
        continue;
      }

      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
        enqueueArrivals();
      }

      ready.splice(ready.indexOf(proc), 1);
      if (proc.start === null) proc.start = currentTime;

      const nextArrival = nextIndex < order.length ? order[nextIndex].arrival : Infinity;
      const runUntil = Math.min(currentTime + proc.remaining, nextArrival);
      const ran = runUntil - currentTime;

      proc.remaining -= ran;
      pushSegment(timeline, proc.pid, currentTime, runUntil, true);
      currentTime = runUntil;

      enqueueArrivals();

      if (proc.remaining <= 0) {
        proc.completion = currentTime;
        completed += 1;
      } else {
        ready.push(proc);
      }

      lastDispatchedPid = proc.pid;
    }

    return finalizeResult("srtf", processes, timeline, contextSwitches);
  }

  function schedulePreemptivePriority(inputProcesses, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);
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

    function pickHighestPriority() {
      if (!ready.length) return null;
      return ready.reduce((best, p) => {
        if (p.priority < best.priority) return p;
        if (p.priority === best.priority && p.arrival < best.arrival) return p;
        if (p.priority === best.priority && p.arrival === best.arrival && p.pid < best.pid) return p;
        return best;
      }, ready[0]);
    }

    while (completed < processes.length) {
      enqueueArrivals();
      const proc = pickHighestPriority();

      if (!proc) {
        const nextArrival = order[nextIndex].arrival;
        pushSegment(timeline, -1, currentTime, nextArrival, true, "idle");
        currentTime = nextArrival;
        continue;
      }

      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
        enqueueArrivals();
      }

      ready.splice(ready.indexOf(proc), 1);
      if (proc.start === null) proc.start = currentTime;

      const nextArrival = nextIndex < order.length ? order[nextIndex].arrival : Infinity;
      const runUntil = Math.min(currentTime + proc.remaining, nextArrival);
      proc.remaining -= (runUntil - currentTime);
      pushSegment(timeline, proc.pid, currentTime, runUntil, true);
      currentTime = runUntil;

      enqueueArrivals();

      if (proc.remaining <= 0) {
        proc.completion = currentTime;
        completed += 1;
      } else {
        ready.push(proc);
      }

      lastDispatchedPid = proc.pid;
    }

    return finalizeResult("priorityp", processes, timeline, contextSwitches);
  }

  function scheduleMlfq(inputProcesses, options) {
    const config = options || {};
    const ctxOverhead = Math.max(0, Number(config.ctxOverhead) || 0);
    const q0Quantum = Math.max(1, Number(config.q0Quantum) || 2);
    const q1Quantum = Math.max(1, Number(config.q1Quantum) || 4);
    // Q2 = FCFS (unlimited)

    const processes = cloneProcesses(inputProcesses).map((p) => ({ ...p, queueLevel: 0 }));
    const order = processes.slice().sort(byArrivalThenPid);
    const queues = [[], [], []];
    const quantums = [q0Quantum, q1Quantum, Infinity];
    const timeline = [];
    let currentTime = 0;
    let nextIndex = 0;
    let completed = 0;
    let contextSwitches = 0;
    let lastDispatchedPid = null;

    function enqueueArrivals() {
      while (nextIndex < order.length && order[nextIndex].arrival <= currentTime) {
        queues[0].push(order[nextIndex]);
        nextIndex += 1;
      }
    }

    function pickNext() {
      for (let q = 0; q < queues.length; q++) {
        if (queues[q].length > 0) return { proc: queues[q].shift(), qLevel: q };
      }
      return null;
    }

    while (completed < processes.length) {
      enqueueArrivals();
      const next = pickNext();

      if (!next) {
        if (nextIndex < order.length) {
          const nextArrival = order[nextIndex].arrival;
          pushSegment(timeline, PID_IDLE, currentTime, nextArrival, true, "idle");
          currentTime = nextArrival;
        }
        continue;
      }

      const { proc, qLevel } = next;
      const quantum = quantums[qLevel];

      if (lastDispatchedPid !== null && lastDispatchedPid !== proc.pid) {
        contextSwitches += 1;
        currentTime = applyContextOverhead(timeline, currentTime, ctxOverhead);
        enqueueArrivals();
      }

      if (proc.start === null) proc.start = currentTime;

      const sliceStart = currentTime;
      const planned = quantum === Infinity ? proc.remaining : Math.min(proc.remaining, quantum);
      let runUntil = sliceStart + planned;
      let wasPreempted = false;

      // Higher-priority preemption: if currently in Q1 or Q2 and a new process arrives before the slice ends
      if (qLevel > 0 && nextIndex < order.length) {
        const nextArrival = order[nextIndex].arrival;
        if (nextArrival < runUntil) {
          runUntil = nextArrival;
          wasPreempted = true;
        }
      }

      const ran = runUntil - sliceStart;
      proc.remaining -= ran;
      pushSegment(timeline, proc.pid, sliceStart, runUntil, false);
      timeline[timeline.length - 1].queueLevel = qLevel;
      currentTime = runUntil;

      enqueueArrivals();

      if (proc.remaining <= 0) {
        proc.completion = currentTime;
        completed += 1;
      } else if (wasPreempted) {
        // Put preempted process back at front of its current queue
        queues[qLevel].unshift(proc);
      } else {
        // Exhausted quantum → demote
        const nextLevel = Math.min(qLevel + 1, 2);
        proc.queueLevel = nextLevel;
        queues[nextLevel].push(proc);
      }

      lastDispatchedPid = proc.pid;
    }

    return finalizeResult("mlfq", processes, timeline, contextSwitches);
  }

  function runAlgorithm(algorithm, processes, options) {
    const config = options || {};
    if (algorithm === "fcfs") return scheduleFcfs(processes, config);
    if (algorithm === "sjf") return scheduleSjf(processes, config);
    if (algorithm === "rr") return scheduleRoundRobin(processes, config.quantum, config);
    if (algorithm === "priority") return schedulePriority(processes, config);
    if (algorithm === "mlfq") return scheduleMlfq(processes, config);
    if (algorithm === "srtf") return scheduleSrtf(processes, config);
    if (algorithm === "priorityp") return schedulePreemptivePriority(processes, config);
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  function runAllAlgorithms(processes, options) {
    return ["fcfs", "sjf", "rr", "priority", "srtf", "priorityp", "mlfq"].map((algorithm) => {
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
