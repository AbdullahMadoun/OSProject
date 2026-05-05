#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

/* P1(arr=0,burst=8), P2(arr=4,burst=4)
 * At t=4, P2 arrives with rem=4 < P1.rem=4 — tie goes to P1 (earlier arrival).
 * P1 runs 0-8, P2 runs 8-12. P1 wait=0, P2 wait=4. Avg=2. */
static void suite_srtf_no_preemption_on_tie(void)
{
    Process p[2];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 8, 0);
    process_init(&p[1], 2, 4, 4, 0);

    sim_result_init(&r);
    sched_srtf(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P1 completion=8", 8, p[0].sim_completion_time);
    mu_assert_int_eq("P2 completion=12", 12, p[1].sim_completion_time);
    mu_assert_double_near("avg wait=2.0", 2.0, m.avg_waiting_time, 0.01);
}

/* P1(arr=0,burst=8), P2(arr=2,burst=4)
 * At t=2 P2 arrives rem=4 < P1.rem=6 → preempt.
 * P1 runs 0-2, P2 runs 2-6, P1 resumes 6-12.
 * P1 wait=4, P2 wait=0. Avg=2. */
static void suite_srtf_preempts_longer(void)
{
    Process p[2];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 8, 0);
    process_init(&p[1], 2, 2, 4, 0);

    sim_result_init(&r);
    sched_srtf(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P1 start=0", 0, p[0].sim_start_time);
    mu_assert_int_eq("P2 start=2", 2, p[1].sim_start_time);
    mu_assert_int_eq("P2 completion=6", 6, p[1].sim_completion_time);
    mu_assert_int_eq("P1 completion=12", 12, p[0].sim_completion_time);
    mu_assert_double_near("avg wait=2.0", 2.0, m.avg_waiting_time, 0.01);
}

/* Single process: trivial case — runs to completion. */
static void suite_srtf_single(void)
{
    Process p[1];
    SimConfig cfg = {0, 0};
    SimResult r;

    process_init(&p[0], 1, 3, 5, 0);

    sim_result_init(&r);
    sched_srtf(p, 1, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("start=3", 3, p[0].sim_start_time);
    mu_assert_int_eq("completion=8", 8, p[0].sim_completion_time);
}

/* Context switch overhead: same preemption scenario as suite_srtf_preempts_longer
 * but with overhead=1. Context switch adds 1 ms of idle before P2 and before P1 resumes.
 * P1 0-2, idle 2-3 (ctx), P2 3-7, idle 7-8 (ctx), P1 8-14.
 * P1 wait=14-0-8=6, P2 wait=3-2-4= -3? No that's wrong.
 * Wait: P2 wait = completion - arrival - burst = 7 - 2 - 4 = 1.
 * P1 wait = 14 - 0 - 8 = 6. Avg = 3.5 */
static void suite_srtf_ctx_overhead(void)
{
    Process p[2];
    SimConfig cfg = {0, 1};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 8, 0);
    process_init(&p[1], 2, 2, 4, 0);

    sim_result_init(&r);
    sched_srtf(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("ctx switches=2", 2, r.context_switches);
    mu_assert_int_eq("P2 start=3", 3, p[1].sim_start_time);
    mu_assert_int_eq("P2 completion=7", 7, p[1].sim_completion_time);
    mu_assert_int_eq("P1 completion=14", 14, p[0].sim_completion_time);
}

int main(void)
{
    suite_srtf_no_preemption_on_tie();
    suite_srtf_preempts_longer();
    suite_srtf_single();
    suite_srtf_ctx_overhead();
    printf("All SRTF tests passed.\n");
    return 0;
}
