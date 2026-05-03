#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

static void suite_sjf_textbook(void)
{
    Process p[4];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 6, 0);
    process_init(&p[1], 2, 0, 8, 0);
    process_init(&p[2], 3, 0, 7, 0);
    process_init(&p[3], 4, 0, 3, 0);

    sim_result_init(&r);
    sched_sjf(p, 4, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 4, &r, &m);

    mu_assert_int_eq("P4 first (start=0)", 0, p[3].sim_start_time);
    mu_assert_int_eq("P4 completion=3", 3, p[3].sim_completion_time);
    mu_assert_int_eq("P1 completion=9", 9, p[0].sim_completion_time);
    mu_assert_int_eq("P3 completion=16", 16, p[2].sim_completion_time);
    mu_assert_int_eq("P2 completion=24", 24, p[1].sim_completion_time);
    mu_assert_double_near("avg wait=7.0", 7.0, m.avg_waiting_time, 0.01);
}

static void suite_sjf_nonpreemptive(void)
{
    Process p[2];
    SimConfig cfg = {0, 0};
    SimResult r;

    process_init(&p[0], 1, 0, 10, 0);
    process_init(&p[1], 2, 1, 1, 0);

    sim_result_init(&r);
    sched_sjf(p, 2, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("P1 runs first", 0, p[0].sim_start_time);
    mu_assert_int_eq("P1 completes at 10", 10, p[0].sim_completion_time);
    mu_assert_int_eq("P2 starts at 10", 10, p[1].sim_start_time);
}

static void suite_sjf_tiebreak(void)
{
    Process p[3];
    SimConfig cfg = {0, 0};
    SimResult r;

    process_init(&p[0], 3, 0, 5, 0);
    process_init(&p[1], 1, 0, 5, 0);
    process_init(&p[2], 2, 0, 5, 0);

    sim_result_init(&r);
    sched_sjf(p, 3, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("pid1 first", 0, p[1].sim_start_time);
    mu_assert_int_eq("pid2 second", 5, p[2].sim_start_time);
    mu_assert_int_eq("pid3 last", 10, p[0].sim_start_time);
}

static void suite_sjf_ctx_overhead(void)
{
    /*
     * Two processes, both at time 0.  P1 has shorter burst so it goes first.
     * With overhead=2 a 2-tick idle gap separates P1 and P2.
     *
     * Expected timeline:  [P1 0-3] [idle 3-5] [P2 5-10]
     */
    Process p[2];
    SimConfig cfg = {0, 2};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 3, 0);
    process_init(&p[1], 2, 0, 5, 0);

    sim_result_init(&r);
    sched_sjf(p, 2, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P1 starts at 0", 0, p[0].sim_start_time);
    mu_assert_int_eq("P1 done at 3", 3, p[0].sim_completion_time);
    mu_assert_int_eq("P2 starts at 5", 5, p[1].sim_start_time);
    mu_assert_int_eq("P2 done at 10", 10, p[1].sim_completion_time);
    mu_assert_int_eq("idle includes overhead", 2, r.idle_time);
}

int main(void)
{
    mu_suite(suite_sjf_textbook);
    mu_suite(suite_sjf_nonpreemptive);
    mu_suite(suite_sjf_tiebreak);
    mu_suite(suite_sjf_ctx_overhead);
    mu_summary();
}
