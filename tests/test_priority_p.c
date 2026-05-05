#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

/* P1(arr=0,pri=2,burst=10), P2(arr=2,pri=1,burst=4)
 * At t=2, P2 arrives with priority 1 < P1's priority 2 → preempt.
 * P1 runs 0-2, P2 runs 2-6, P1 resumes 6-14.
 * P1 wait = completion - arrival - burst = 14 - 0 - 10 = 4.
 * P2 wait = 6 - 2 - 4 = 0. Avg = 2. */
static void suite_pp_preempts_lower_priority(void)
{
    Process p[2];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 10, 2);
    process_init(&p[1], 2, 2,  4, 1);

    sim_result_init(&r);
    sched_priority_p(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P1 start=0",       0,  p[0].sim_start_time);
    mu_assert_int_eq("P2 start=2",       2,  p[1].sim_start_time);
    mu_assert_int_eq("P2 completion=6",  6,  p[1].sim_completion_time);
    mu_assert_int_eq("P1 completion=14", 14, p[0].sim_completion_time);
    mu_assert_double_near("avg wait=2.0", 2.0, m.avg_waiting_time, 0.01);
}

/* P1(arr=0,pri=1,burst=8), P2(arr=4,pri=2,burst=4)
 * P2 arrives at t=4 with lower priority (2 > 1) — no preemption.
 * P1 runs 0-8, P2 runs 8-12. */
static void suite_pp_no_preempt_lower_priority(void)
{
    Process p[2];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 8, 1);
    process_init(&p[1], 2, 4, 4, 2);

    sim_result_init(&r);
    sched_priority_p(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P1 completion=8",  8,  p[0].sim_completion_time);
    mu_assert_int_eq("P2 completion=12", 12, p[1].sim_completion_time);
    mu_assert_double_near("avg wait=2.0", 2.0, m.avg_waiting_time, 0.01);
}

/* Single process: trivial. */
static void suite_pp_single(void)
{
    Process p[1];
    SimConfig cfg = {0, 0};
    SimResult r;

    process_init(&p[0], 1, 3, 5, 0);

    sim_result_init(&r);
    sched_priority_p(p, 1, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("start=3",      3, p[0].sim_start_time);
    mu_assert_int_eq("completion=8", 8, p[0].sim_completion_time);
}

/* Context switch overhead with preemption. Same as first test but overhead=1.
 * P1 0-2, idle 2-3 (ctx), P2 3-7, idle 7-8 (ctx), P1 8-16.
 * P2 wait=3-2-4=-3? No: wait=completion-arrival-burst=7-2-4=1.
 * P1 wait=16-0-10=6. Avg=3.5. */
static void suite_pp_ctx_overhead(void)
{
    Process p[2];
    SimConfig cfg = {0, 1};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 10, 2);
    process_init(&p[1], 2, 2,  4, 1);

    sim_result_init(&r);
    sched_priority_p(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("ctx switches=2",   2,  r.context_switches);
    mu_assert_int_eq("P2 start=3",       3,  p[1].sim_start_time);
    mu_assert_int_eq("P2 completion=7",  7,  p[1].sim_completion_time);
    mu_assert_int_eq("P1 completion=16", 16, p[0].sim_completion_time);
    mu_assert_double_near("avg wait=3.5", 3.5, m.avg_waiting_time, 0.01);
}

int main(void)
{
    suite_pp_preempts_lower_priority();
    suite_pp_no_preempt_lower_priority();
    suite_pp_single();
    suite_pp_ctx_overhead();
    printf("All Preemptive Priority tests passed.\n");
    return 0;
}
