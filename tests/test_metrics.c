#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/sim_engine.h"

static void suite_formula_correctness(void)
{
    Process p[2];
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 5, 0);
    process_init(&p[1], 2, 2, 3, 0);

    p[0].sim_start_time = 0;
    p[0].sim_completion_time = 5;
    p[1].sim_start_time = 5;
    p[1].sim_completion_time = 8;

    sim_result_init(&r);
    r.total_time = 8;
    r.idle_time = 0;
    r.context_switches = 1;

    metrics_compute(p, 2, &r, &m);

    mu_assert_int_eq("P1 turnaround=5", 5, p[0].sim_turnaround_time);
    mu_assert_int_eq("P2 turnaround=6", 6, p[1].sim_turnaround_time);
    mu_assert_int_eq("P1 waiting=0", 0, p[0].sim_waiting_time);
    mu_assert_int_eq("P2 waiting=3", 3, p[1].sim_waiting_time);
    mu_assert_int_eq("P1 response=0", 0, p[0].sim_response_time);
    mu_assert_int_eq("P2 response=3", 3, p[1].sim_response_time);
    mu_assert_double_near("avg wait=1.5", 1.5, m.avg_waiting_time, 0.01);
    mu_assert_double_near("avg trt=5.5", 5.5, m.avg_turnaround_time, 0.01);
    mu_assert_double_near("avg rsp=1.5", 1.5, m.avg_response_time, 0.01);
    mu_assert_double_near("cpu_util=1.0", 1.0, m.cpu_utilization, 0.001);
    mu_assert_double_near("throughput", 2.0 / 8.0, m.throughput, 0.001);
    mu_assert_int_eq("ctx switches", 1, m.context_switches);
}

static void suite_idle_time(void)
{
    Process p[1];
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 5, 3, 0);
    p[0].sim_start_time = 5;
    p[0].sim_completion_time = 8;

    sim_result_init(&r);
    r.total_time = 8;
    r.idle_time = 5;

    metrics_compute(p, 1, &r, &m);
    mu_assert_double_near("cpu_util=3/8", 3.0 / 8.0, m.cpu_utilization,
                          0.001);
}

int main(void)
{
    mu_suite(suite_formula_correctness);
    mu_suite(suite_idle_time);
    mu_summary();
}
