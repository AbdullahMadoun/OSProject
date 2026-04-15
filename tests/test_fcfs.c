#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

static void suite_all_at_zero(void)
{
    Process p[3];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 24, 0);
    process_init(&p[1], 2, 0, 3, 0);
    process_init(&p[2], 3, 0, 3, 0);

    sim_result_init(&r);
    sched_fcfs(p, 3, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 3, &r, &m);

    mu_assert_int_eq("P1 completion", 24, p[0].sim_completion_time);
    mu_assert_int_eq("P2 completion", 27, p[1].sim_completion_time);
    mu_assert_int_eq("P3 completion", 30, p[2].sim_completion_time);
    mu_assert_int_eq("P1 waiting", 0, p[0].sim_waiting_time);
    mu_assert_int_eq("P2 waiting", 24, p[1].sim_waiting_time);
    mu_assert_int_eq("P3 waiting", 27, p[2].sim_waiting_time);
    mu_assert_double_near("avg wait 17.0", 17.0, m.avg_waiting_time, 0.01);
    mu_assert_int_eq("0 ctx switches", 0, r.context_switches);
    mu_assert_double_near("cpu util 1.0", 1.0, m.cpu_utilization, 0.001);
}

static void suite_staggered_arrivals(void)
{
    Process p[3];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 5, 0);
    process_init(&p[1], 2, 3, 3, 0);
    process_init(&p[2], 3, 6, 2, 0);

    sim_result_init(&r);
    sched_fcfs(p, 3, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 3, &r, &m);

    mu_assert_int_eq("P1 done=5", 5, p[0].sim_completion_time);
    mu_assert_int_eq("P2 done=8", 8, p[1].sim_completion_time);
    mu_assert_int_eq("P3 done=10", 10, p[2].sim_completion_time);
    mu_assert_int_eq("P1 wait=0", 0, p[0].sim_waiting_time);
    mu_assert_int_eq("P2 wait=2", 2, p[1].sim_waiting_time);
    mu_assert_int_eq("P3 wait=2", 2, p[2].sim_waiting_time);
}

static void suite_single_process(void)
{
    Process p[1];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 5, 3, 0);
    sim_result_init(&r);
    sched_fcfs(p, 1, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 1, &r, &m);

    mu_assert_int_eq("completion=8", 8, p[0].sim_completion_time);
    mu_assert_int_eq("waiting=0", 0, p[0].sim_waiting_time);
    mu_assert_int_eq("response=0", 0, p[0].sim_response_time);
    mu_assert_double_near("throughput", 1.0 / 8.0, m.throughput, 0.001);
}

int main(void)
{
    mu_suite(suite_all_at_zero);
    mu_suite(suite_staggered_arrivals);
    mu_suite(suite_single_process);
    mu_summary();
}
