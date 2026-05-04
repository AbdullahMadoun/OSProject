(function () {
  "use strict";

  const ALGO_COLORS = { fcfs: "#3b82f6", sjf: "#10b981", rr: "#f59e0b", priority: "#8b5cf6" };
  const ALGO_LABELS = { fcfs: "FCFS", sjf: "SJF", rr: "Round Robin", priority: "Priority" };

  /* ── Workload generators ─────────────────────────────────────────────────── */

  const GENERATORS = {
    fcfs: {
      weakness: "Convoy Effect",
      icon: "local_shipping",
      tagline: "One slow truck blocks the whole highway.",
      description:
        "A long CPU-bound process arrives at t=0 and locks the CPU. Every short process that arrives a moment later must wait for the entire burst to finish — FCFS has no way to reorder them.",
      generate(intensity) {
        const longBurst = { mild: 8, moderate: 16, extreme: 26 }[intensity];
        const n = { mild: 3, moderate: 4, extreme: 5 }[intensity];
        const procs = [{ pid: 1, arrival: 0, burst: longBurst, priority: 3 }];
        for (let i = 0; i < n; i++) {
          procs.push({ pid: i + 2, arrival: 1, burst: 2, priority: 2 });
        }
        return procs;
      }
    },

    sjf: {
      weakness: "Starvation",
      icon: "hourglass_empty",
      tagline: "Short jobs never let the long one start.",
      description:
        "A long process sits in the ready queue, but every few milliseconds a new 1 ms process arrives. SJF always prefers the shorter job — so the long process waits indefinitely, revealing the algorithm's starvation risk.",
      generate(intensity) {
        const shortCount = { mild: 4, moderate: 6, extreme: 9 }[intensity];
        const longBurst = { mild: 14, moderate: 20, extreme: 28 }[intensity];
        const procs = [{ pid: 1, arrival: 0, burst: longBurst, priority: 1 }];
        for (let i = 1; i < shortCount; i++) {
          procs.push({ pid: i + 1, arrival: i * 2, burst: 1, priority: 2 });
        }
        return procs;
      }
    },

    rr: {
      weakness: "Context-Switch Storm",
      icon: "sync",
      tagline: "Every job gets sliced — nobody finishes fast.",
      description:
        "All processes have identical, large bursts that aren't divisible by the quantum. Round Robin slices each one repeatedly, producing the maximum number of context switches. SJF or FCFS would complete each job cleanly.",
      generate(intensity) {
        const n = { mild: 3, moderate: 4, extreme: 5 }[intensity];
        const burst = { mild: 9, moderate: 13, extreme: 17 }[intensity];
        const procs = [];
        for (let i = 0; i < n; i++) {
          procs.push({ pid: i + 1, arrival: 0, burst: burst, priority: i + 1 });
        }
        return procs;
      }
    },

    priority: {
      weakness: "Priority Inversion",
      icon: "swap_vert",
      tagline: "The scheduler works on the wrong jobs.",
      description:
        "High-priority processes (low number) have very long bursts; low-priority ones are short. Priority scheduling binds the CPU to the longest jobs first, inflating the average wait for the fast processes that could have been done early.",
      generate(intensity) {
        const n = { mild: 4, moderate: 5, extreme: 6 }[intensity];
        const longBurst = { mild: 10, moderate: 14, extreme: 20 }[intensity];
        const procs = [];
        const halfN = Math.ceil(n / 2);
        for (let i = 0; i < n; i++) {
          const isHigh = i < halfN;
          procs.push({
            pid: i + 1,
            arrival: i,
            burst: isHigh ? longBurst : 2,
            priority: isHigh ? 1 : 4
          });
        }
        return procs;
      }
    }
  };

  /* ── State ───────────────────────────────────────────────────────────────── */

  let victim = "fcfs";
  let intensity = "moderate";
  let lastGenerated = null;

  /* ── Core generate + preview ─────────────────────────────────────────────── */

  function generate() {
    const gen = GENERATORS[victim];
    if (!gen) return;

    lastGenerated = gen.generate(intensity);

    // Run all 4 classic algorithms for the comparison
    const options = { quantum: 2, ctxOverhead: 0 };
    const results = window.SchedulerCore.runAllAlgorithms(lastGenerated, options);
    const n = lastGenerated.length;

    const stats = results.map((r) => ({
      algorithm: r.algorithm,
      label: r.label,
      avgWait: r.processes.reduce((sum, p) => sum + (p.completion - p.arrival - p.burst), 0) / n
    }));

    renderPreview(gen, stats);
  }

  function renderPreview(gen, stats) {
    const preview = document.getElementById("adversarialPreview");
    if (!preview) return;

    const victimStat = stats.find((s) => s.algorithm === victim);
    const bestStat = stats.reduce((b, s) => (s.avgWait < b.avgWait ? s : b), stats[0]);
    const maxWait = Math.max(...stats.map((s) => s.avgWait), 0.1);
    const ratio = victimStat.avgWait / Math.max(bestStat.avgWait, 0.001);

    const bars = stats
      .slice()
      .sort((a, b) => b.avgWait - a.avgWait)
      .map((s) => {
        const isVictim = s.algorithm === victim;
        const pct = Math.max(Math.round((s.avgWait / maxWait) * 100), 5);
        const color = isVictim ? "#ef4444" : ALGO_COLORS[s.algorithm];
        return `
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono w-16 text-right shrink-0 ${isVictim ? "text-red-400 font-bold" : "text-on-surface-variant"}">${s.label}</span>
            <div class="flex-1 bg-surface-container-lowest rounded-full h-6 overflow-hidden">
              <div class="h-full rounded-full flex items-center px-2.5 transition-all duration-700"
                   style="width:${pct}%;background:${color}${isVictim ? "" : "bb"}">
                <span class="text-[10px] font-mono text-white/95 whitespace-nowrap">${s.avgWait.toFixed(2)} ms</span>
              </div>
            </div>
            ${isVictim
              ? `<span class="text-xs text-red-400 font-bold shrink-0">💀 ${ratio.toFixed(1)}×</span>`
              : `<span class="w-12 shrink-0"></span>`}
          </div>`;
      })
      .join("");

    preview.innerHTML = `
      <div class="border-t border-white/10 pt-5 flex flex-col gap-5">

        <div class="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl p-4">
          <span class="material-symbols-outlined text-red-400 text-xl mt-0.5 shrink-0" style="font-variation-settings:'FILL' 1">bug_report</span>
          <p class="text-sm text-on-surface leading-relaxed">
            <span class="font-bold text-red-400">${ALGO_LABELS[victim]}</span> averages
            <span class="font-bold text-red-400">${victimStat.avgWait.toFixed(2)} ms</span> waiting time —
            <span class="font-bold text-red-400">${ratio.toFixed(1)}×</span> worse than
            <span class="font-bold text-emerald-400">${bestStat.label}</span> at
            <span class="font-bold text-emerald-400">${bestStat.avgWait.toFixed(2)} ms</span>.
          </p>
        </div>

        <div class="flex flex-col gap-2.5">${bars}</div>

        <button id="adversarialLoadBtn"
                class="w-full py-3 px-4 rounded-xl bg-red-500/12 border border-red-500/30 text-red-400
                       font-semibold hover:bg-red-500/22 hover:-translate-y-0.5 transition-all
                       flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-sm">upload</span>
          Load into simulator
        </button>
      </div>`;

    preview.classList.remove("hidden");
    document.getElementById("adversarialLoadBtn").addEventListener("click", loadWorkload);
  }

  /* ── Load into table ─────────────────────────────────────────────────────── */

  function loadWorkload() {
    if (!lastGenerated || typeof window._dashSetPreset !== "function") return;
    window._dashSetPreset(lastGenerated);
    document.getElementById("input").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── UI helpers ──────────────────────────────────────────────────────────── */

  function setVictim(algo) {
    victim = algo;
    lastGenerated = null;

    document.querySelectorAll("[data-victim]").forEach((btn) => {
      btn.classList.toggle("adv-victim-active", btn.dataset.victim === algo);
    });

    const gen = GENERATORS[algo];
    const tagEl = document.getElementById("adversarialTagline");
    const descEl = document.getElementById("adversarialDescription");
    if (tagEl && gen) tagEl.textContent = gen.tagline;
    if (descEl && gen) descEl.textContent = gen.description;

    const preview = document.getElementById("adversarialPreview");
    if (preview) preview.classList.add("hidden");
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */

  function init() {
    document.querySelectorAll("[data-victim]").forEach((btn) => {
      btn.addEventListener("click", () => setVictim(btn.dataset.victim));
    });

    const intensityEl = document.getElementById("adversarialIntensity");
    if (intensityEl) {
      intensityEl.addEventListener("change", () => {
        intensity = intensityEl.value;
        lastGenerated = null;
        const preview = document.getElementById("adversarialPreview");
        if (preview) preview.classList.add("hidden");
      });
    }

    const generateBtn = document.getElementById("adversarialGenerateBtn");
    if (generateBtn) generateBtn.addEventListener("click", generate);

    // Seed initial description
    setVictim("fcfs");
  }

  document.addEventListener("DOMContentLoaded", init);
  window.AdversarialGen = { generate, loadWorkload };
})();
