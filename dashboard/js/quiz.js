(function () {
  "use strict";

  const ALGO_KEYS = ["fcfs", "sjf", "rr", "priority", "mlfq", "srtf"];

  const ALGO_LABELS = {
    fcfs: "FCFS", sjf: "SJF", rr: "RR",
    priority: "Priority", mlfq: "MLFQ", srtf: "SRTF"
  };

  const ALGO_LONG = {
    fcfs: "First Come First Served",
    sjf: "Shortest Job First",
    rr: "Round Robin",
    priority: "Priority Scheduling",
    mlfq: "Multilevel Feedback Queue",
    srtf: "Shortest Remaining Time First"
  };

  const ALGO_HINT = {
    fcfs: "Processes run in arrival order — no peeking at burst or priority.",
    sjf: "Shortest burst wins each slot. Longer jobs wait their turn.",
    rr: "Equal time slices rotate through every process in order.",
    priority: "Lowest priority number dispatched first regardless of burst.",
    mlfq: "New arrivals start in Q0; each quantum exhausted drops them a level.",
    srtf: "Preempts the running job the moment a shorter-remaining one arrives."
  };

  // Anonymous PID-based colors — NOT algorithm colors, so they don't give it away.
  const PID_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
    "#ec4899", "#06b6d4", "#f97316", "#84cc16"
  ];

  const PRESETS = [
    [
      { pid: 1, arrival: 0, burst: 6, priority: 2 },
      { pid: 2, arrival: 2, burst: 4, priority: 1 },
      { pid: 3, arrival: 4, burst: 8, priority: 3 },
      { pid: 4, arrival: 6, burst: 3, priority: 4 }
    ],
    [
      { pid: 1, arrival: 0, burst: 6, priority: 3 },
      { pid: 2, arrival: 2, burst: 2, priority: 1 },
      { pid: 3, arrival: 4, burst: 8, priority: 4 },
      { pid: 4, arrival: 5, burst: 3, priority: 2 },
      { pid: 5, arrival: 8, burst: 5, priority: 1 }
    ],
    [
      { pid: 1, arrival: 0, burst: 5, priority: 0 },
      { pid: 2, arrival: 1, burst: 3, priority: 0 },
      { pid: 3, arrival: 2, burst: 8, priority: 0 },
      { pid: 4, arrival: 3, burst: 6, priority: 0 }
    ],
    [
      { pid: 1, arrival: 0, burst: 10, priority: 3 },
      { pid: 2, arrival: 0, burst: 1, priority: 1 },
      { pid: 3, arrival: 0, burst: 2, priority: 4 },
      { pid: 4, arrival: 0, burst: 1, priority: 5 },
      { pid: 5, arrival: 0, burst: 5, priority: 2 }
    ],
    [
      { pid: 1, arrival: 0, burst: 4, priority: 2 },
      { pid: 2, arrival: 1, burst: 4, priority: 3 },
      { pid: 3, arrival: 2, burst: 4, priority: 1 },
      { pid: 4, arrival: 3, burst: 4, priority: 4 }
    ]
  ];

  const state = {
    score: 0,
    total: 0,
    streak: 0,
    bestStreak: 0,
    answered: false,
    round: 0
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function getChoices(correct) {
    const others = shuffle(ALGO_KEYS.filter((k) => k !== correct)).slice(0, 3);
    return shuffle([correct, ...others]);
  }

  /* ── Gantt render (PID colors, no algorithm label) ──────────────────────── */

  function renderQuizGantt(result) {
    const container = document.getElementById("quizGantt");
    if (!container) return;

    const totalTime = result.totalTime;
    const unitWidth = totalTime <= 28 ? 44 : totalTime <= 60 ? 32 : 24;
    const trackWidth = Math.max(640, totalTime * unitWidth);

    const step = totalTime <= 20 ? 1 : totalTime <= 50 ? 2 : 5;
    const ticks = [];
    for (let t = 0; t <= totalTime; t += step) {
      ticks.push(
        `<span class="absolute text-[10px] font-mono text-slate-500" style="left:${t * unitWidth}px;transform:translateX(-50%)">${t}</span>`
      );
    }

    const blocks = result.timeline.map((seg) => {
      const left = seg.start * unitWidth;
      const w = seg.duration * unitWidth;
      if (seg.kind === "idle" || seg.kind === "overhead") {
        return `<div class="absolute top-0 bottom-0 flex items-center justify-center text-[10px] font-mono text-slate-600 border-r border-slate-700/30"
                     style="left:${left}px;width:${w}px;background:rgba(255,255,255,0.025)">
                  ${w > 28 ? (seg.kind === "idle" ? "idle" : "ctx") : ""}
                </div>`;
      }
      const color = PID_COLORS[(seg.pid - 1) % PID_COLORS.length];
      return `<div class="absolute top-0 bottom-0 flex items-center justify-center text-[11px] font-bold text-white border-r border-black/30"
                   style="left:${left}px;width:${w}px;background:${color}cc">
                ${w >= 18 ? `P${seg.pid}` : ""}
              </div>`;
    }).join("");

    const legend = result.processes.map((p) =>
      `<span class="flex items-center gap-1.5 text-xs font-mono text-on-surface-variant">
         <span class="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background:${PID_COLORS[(p.pid - 1) % PID_COLORS.length]}"></span>
         P${p.pid}&nbsp;arr=${p.arrival}&nbsp;burst=${p.burst}&nbsp;pri=${p.priority}
       </span>`
    ).join("");

    container.innerHTML = `
      <div class="overflow-x-auto pb-1">
        <div class="relative" style="width:${trackWidth}px">
          <div class="relative h-11 rounded overflow-hidden bg-surface-container-low/40 border border-white/10 mb-5">
            ${blocks}
          </div>
          <div class="relative h-4">${ticks.join("")}</div>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">${legend}</div>`;
  }

  /* ── Choices ─────────────────────────────────────────────────────────────── */

  function renderChoices(choices, correct) {
    const container = document.getElementById("quizChoices");
    if (!container) return;
    container.innerHTML = choices.map((algo) => `
      <button class="quiz-choice-btn" data-algo="${algo}" type="button">
        <span class="text-base font-bold leading-tight">${ALGO_LABELS[algo]}</span>
        <span class="text-[11px] text-on-surface-variant leading-tight mt-0.5">${ALGO_LONG[algo]}</span>
      </button>`).join("");

    container.querySelectorAll(".quiz-choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleAnswer(btn.dataset.algo, correct));
    });
  }

  /* ── Answer handling ─────────────────────────────────────────────────────── */

  function handleAnswer(chosen, correct) {
    if (state.answered) return;
    state.answered = true;
    state.total++;

    const isCorrect = chosen === correct;
    if (isCorrect) {
      state.score++;
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      state.streak = 0;
    }

    updateScoreDisplay();

    document.querySelectorAll(".quiz-choice-btn").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.algo === correct) btn.classList.add("quiz-correct");
      else if (btn.dataset.algo === chosen) btn.classList.add("quiz-wrong");
    });

    const fb = document.getElementById("quizFeedback");
    const fbContent = document.getElementById("quizFeedbackContent");
    if (fb && fbContent) {
      fb.classList.remove("hidden");
      if (isCorrect) {
        const streakMsg = state.streak >= 3
          ? `&nbsp;<span class="text-yellow-400">🔥 ${state.streak} in a row!</span>` : "";
        fbContent.innerHTML = `
          <div class="quiz-feedback-correct">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings:'FILL' 1">check_circle</span>
            <span>Correct!&nbsp;<strong>${ALGO_LONG[correct]}</strong>${streakMsg}</span>
          </div>
          <p class="text-xs text-on-surface-variant mt-2 ml-8">${ALGO_HINT[correct]}</p>`;
      } else {
        fbContent.innerHTML = `
          <div class="quiz-feedback-wrong">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings:'FILL' 1">cancel</span>
            <span>That was&nbsp;<strong>${ALGO_LONG[correct]}</strong> — you picked <strong>${ALGO_LONG[chosen]}</strong>.</span>
          </div>
          <p class="text-xs text-on-surface-variant mt-2 ml-8">${ALGO_HINT[correct]}</p>`;
      }
    }

    const nextBtn = document.getElementById("quizNextRound");
    if (nextBtn) nextBtn.classList.remove("hidden");
  }

  /* ── Score display ───────────────────────────────────────────────────────── */

  function updateScoreDisplay() {
    const pct = state.total > 0 ? Math.round((state.score / state.total) * 100) : 0;
    const el = (id) => document.getElementById(id);
    if (el("quizScore")) el("quizScore").textContent = state.score;
    if (el("quizTotal")) el("quizTotal").textContent = state.total;
    if (el("quizStreak")) el("quizStreak").textContent = state.streak;
    if (el("quizPct")) el("quizPct").textContent = `${pct}%`;
    if (el("quizBestStreak")) el("quizBestStreak").textContent = state.bestStreak;
  }

  /* ── New round ───────────────────────────────────────────────────────────── */

  function nextRound() {
    const processes = pick(PRESETS).map((p) => ({ ...p }));
    const algo = pick(ALGO_KEYS);
    const options = { quantum: 2, ctxOverhead: 0, q0Quantum: 2, q1Quantum: 4 };
    const result = window.SchedulerCore.runAlgorithm(algo, processes, options);

    state.answered = false;
    state.round++;

    const roundEl = document.getElementById("quizRound");
    if (roundEl) roundEl.textContent = `Round ${state.round}`;

    const fb = document.getElementById("quizFeedback");
    if (fb) fb.classList.add("hidden");

    const nextBtn = document.getElementById("quizNextRound");
    if (nextBtn) nextBtn.classList.add("hidden");

    renderQuizGantt(result);
    renderChoices(getChoices(algo), algo);
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */

  function init() {
    const startBtn = document.getElementById("quizStartButton");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        const overlay = document.getElementById("quizStartOverlay");
        if (overlay) overlay.classList.add("hidden");
        const arena = document.getElementById("quizArena");
        if (arena) arena.classList.remove("hidden");
        nextRound();
      });
    }

    const nextBtn = document.getElementById("quizNextRound");
    if (nextBtn) nextBtn.addEventListener("click", nextRound);
  }

  document.addEventListener("DOMContentLoaded", init);
  window.QuizMode = { nextRound };
})();
