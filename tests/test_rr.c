#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

static void suite_rr_textbook(void)
{
    Process p[3];
    SimConfig cfg = {4, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 24, 0);
    process_init(&p[1], 2, 0, 3, 0);
    process_init(&p[2], 3, 0, 3, 0);

    sim_result_init(&r);
    sched_rr(p, 3, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 3, &r, &m);

    mu_assert_int_eq("P1 completion=30", 30, p[0].sim_completion_time);
    mu_assert_int_eq("P2 completion=7", 7, p[1].sim_completion_time);
    mu_assert_int_eq("P3 completion=10", 10, p[2].sim_completion_time);
    mu_assert_double_near("avg wait=5.67", 5.67, m.avg_waiting_time, 0.02);
}

static void suite_rr_partial_quantum(void)
{
    Process p[2];
    SimConfig cfg = {4, 0};
    SimResult r;

    process_init(&p[0], 1, 0, 2, 0);
    process_init(&p[1], 2, 0, 6, 0);

    sim_result_init(&r);
    sched_rr(p, 2, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("P1 done at 2", 2, p[0].sim_completion_time);
    mu_assert_int_eq("P2 done at 8", 8, p[1].sim_completion_time);
}

static void suite_rr_arrival_during_quantum(void)
{
    Process p[2];
    SimConfig cfg = {3, 0};
    SimResult r;

    process_init(&p[0], 1, 0, 5, 0);
    process_init(&p[1], 2, 2, 3, 0);

    sim_result_init(&r);
    sched_rr(p, 2, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("P1 done at 8", 8, p[0].sim_completion_time);
    mu_assert_int_eq("P2 done at 6", 6, p[1].sim_completion_time);
}

static void suite_rr_context_switches(void)
{
    Process p[2];
    SimConfig cfg = {2, 0};
    SimResult r;

    process_init(&p[0], 1, 0, 4, 0);
    process_init(&p[1], 2, 0, 4, 0);

    sim_result_init(&r);
    sched_rr(p, 2, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("3 ctx switches", 3, r.context_switches);
}

int main(void)
{
    mu_suite(suite_rr_textbook);
    mu_suite(suite_rr_partial_quantum);
    mu_suite(suite_rr_arrival_during_quantum);
    mu_suite(suite_rr_context_switches);
    mu_summary();
}
