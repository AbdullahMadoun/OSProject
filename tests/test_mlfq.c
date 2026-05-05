#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

/* P1(arr=0,burst=4), P2(arr=0,burst=2), q0=2
 * Both arrive at t=0. Q0 order by pid: P1 then P2.
 * P1 Q0 0-2 (remaining=2) → demote to Q1.
 * P2 Q0 2-4 (remaining=0) → done. completion=4.
 * P1 Q1 4-6 (remaining=0, q1=4 but only 2 left) → done. completion=6.
 * P1 wait=6-0-4=2. P2 wait=4-0-2=2. Avg=2. */
static void suite_mlfq_basic_demotion(void)
{
    Process p[2];
    SimConfig cfg = {2, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 4, 0);
    process_init(&p[1], 2, 0, 2, 0);

    sim_result_init(&r);
    sched_mlfq(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P2 completion=4", 4, p[1].sim_completion_time);
    mu_assert_int_eq("P1 completion=6", 6, p[0].sim_completion_time);
    mu_assert_double_near("avg wait=2.0", 2.0, m.avg_waiting_time, 0.01);
}

/* Single process: runs through Q0 then Q1 then Q2 until done. */
static void suite_mlfq_single_long(void)
{
    Process p[1];
    SimConfig cfg = {2, 0};
    SimResult r;

    process_init(&p[0], 1, 0, 7, 0);

    sim_result_init(&r);
    sched_mlfq(p, 1, &cfg, &r);
    sim_finalize(&r);

    /* Q0: 0-2 (2ms), Q1: 2-6 (4ms, q1=4), Q2: 6-7 (1ms FCFS) */
    mu_assert_int_eq("start=0",       0, p[0].sim_start_time);
    mu_assert_int_eq("completion=7",  7, p[0].sim_completion_time);
}

/* Short process completes in Q0 without demotion. */
static void suite_mlfq_completes_in_q0(void)
{
    Process p[1];
    SimConfig cfg = {4, 0};
    SimResult r;

    process_init(&p[0], 1, 2, 3, 0);

    sim_result_init(&r);
    sched_mlfq(p, 1, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("start=2",      2, p[0].sim_start_time);
    mu_assert_int_eq("completion=5", 5, p[0].sim_completion_time);
}

/* P1(arr=0,burst=6) in Q0/Q1, P2(arr=3,burst=2) arrives mid-Q0.
 * q0=4. P1 starts Q0 at t=0. P2 arrives at t=3 < t=4 (P1's slice end).
 * P1 is in Q0 so it is NOT preempted (only Q1/Q2 get preempted by new arrivals).
 * P1 completes its Q0 slice 0-4 (remaining=2), → demote Q1.
 * P2 in Q0: runs 4-6 (remaining=0) → done. completion=6.
 * P1 in Q1: runs 6-8 (remaining=0) → done. completion=8.
 * P1 wait=8-0-6=2. P2 wait=6-3-2=1. Avg=1.5. */
static void suite_mlfq_no_preempt_q0(void)
{
    Process p[2];
    SimConfig cfg = {4, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 6, 0);
    process_init(&p[1], 2, 3, 2, 0);

    sim_result_init(&r);
    sched_mlfq(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P2 completion=6", 6, p[1].sim_completion_time);
    mu_assert_int_eq("P1 completion=8", 8, p[0].sim_completion_time);
    mu_assert_double_near("avg wait=1.5", 1.5, m.avg_waiting_time, 0.01);
}

int main(void)
{
    suite_mlfq_basic_demotion();
    suite_mlfq_single_long();
    suite_mlfq_completes_in_q0();
    suite_mlfq_no_preempt_q0();
    printf("All MLFQ tests passed.\n");
    return 0;
}
