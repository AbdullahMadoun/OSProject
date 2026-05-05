(function () {
  "use strict";

  const CYCLE_MS = 16000;

  const ROUNDS = [
    { key: "basic",    label: "Basic Workload" },
    { key: "mixed",    label: "Mixed Workload" },
    { key: "rr",       label: "RR-Friendly Workload" },
    { key: "priority", label: "Priority Workload" }
  ];

  let kioskTimer    = null;
  let countdownTick = null;
  let roundIndex    = 0;
  let active        = false;

  /* ── progress bar ─────────────────────────────────────────────────────── */

  function animateProgress() {
    const bar = document.getElementById("kioskProgressBar");
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.width = "0%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = `width ${CYCLE_MS}ms linear`;
        bar.style.width = "100%";
      });
    });
  }

  function startCountdown() {
    if (countdownTick) clearInterval(countdownTick);
    let secs = Math.ceil(CYCLE_MS / 1000);
    const el = document.getElementById("kioskCountdown");
    if (el) el.textContent = secs;
    countdownTick = setInterval(() => {
      secs = Math.max(0, secs - 1);
      if (el) el.textContent = secs;
    }, 1000);
  }

  /* ── one kiosk round ──────────────────────────────────────────────────── */

  function runRound() {
    const round = ROUNDS[roundIndex % ROUNDS.length];
    roundIndex++;

    const label = document.getElementById("kioskLabel");
    if (label) {
      label.textContent = `${round.label} — all 7 algorithms`;
    }

    animateProgress();
    startCountdown();

    if (window._dashRunKiosk) window._dashRunKiosk(round.key);

    const gantt = document.getElementById("gantt");
    if (gantt) gantt.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── enter / exit ─────────────────────────────────────────────────────── */

  function enter() {
    if (active) return;
    active = true;
    roundIndex = 0;
    document.body.classList.add("kiosk-mode");
    const bar = document.getElementById("kioskBar");
    if (bar) bar.classList.remove("hidden");
    runRound();
    kioskTimer = setInterval(runRound, CYCLE_MS);
  }

  function exit() {
    if (!active) return;
    active = false;
    document.body.classList.remove("kiosk-mode");
    const bar = document.getElementById("kioskBar");
    if (bar) bar.classList.add("hidden");
    clearInterval(kioskTimer);
    clearInterval(countdownTick);
    kioskTimer = countdownTick = null;
    const progressBar = document.getElementById("kioskProgressBar");
    if (progressBar) {
      progressBar.style.transition = "none";
      progressBar.style.width = "0%";
    }
  }

  /* ── init ─────────────────────────────────────────────────────────────── */

  function init() {
    const enterBtn = document.getElementById("kioskButton");
    if (enterBtn) enterBtn.addEventListener("click", enter);

    const exitBtn = document.getElementById("kioskExitButton");
    if (exitBtn) exitBtn.addEventListener("click", exit);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && active) exit();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  window.KioskMode = { enter, exit };
})();
