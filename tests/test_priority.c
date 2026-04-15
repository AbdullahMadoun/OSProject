#include "minunit.h"
#include "../include/metrics.h"
#include "../include/process.h"
#include "../include/scheduler.h"

static void suite_priority_textbook(void)
{
    Process p[5];
    SimConfig cfg = {0, 0};
    SimResult r;
    Metrics m;

    process_init(&p[0], 1, 0, 10, 3);
    process_init(&p[1], 2, 0, 1, 1);
    process_init(&p[2], 3, 0, 2, 4);
    process_init(&p[3], 4, 0, 1, 5);
    process_init(&p[4], 5, 0, 5, 2);

    sim_result_init(&r);
    sched_priority(p, 5, &cfg, &r);
    sim_finalize(&r);
    metrics_compute(p, 5, &r, &m);

    mu_assert_int_eq("P2 start=0", 0, p[1].sim_start_time);
    mu_assert_int_eq("P2 done=1", 1, p[1].sim_completion_time);
    mu_assert_int_eq("P5 done=6", 6, p[4].sim_completion_time);
    mu_assert_int_eq("P1 done=16", 16, p[0].sim_completion_time);
    mu_assert_int_eq("P3 done=18", 18, p[2].sim_completion_time);
    mu_assert_int_eq("P4 done=19", 19, p[3].sim_completion_time);
    mu_assert_double_near("avg wait=8.2", 8.2, m.avg_waiting_time, 0.05);
}

static void suite_priority_tiebreak(void)
{
    Process p[2];
    SimConfig cfg = {0, 0};
    SimResult r;

    process_init(&p[0], 2, 0, 3, 1);
    process_init(&p[1], 1, 0, 3, 1);

    sim_result_init(&r);
    sched_priority(p, 2, &cfg, &r);
    sim_finalize(&r);

    mu_assert_int_eq("lower pid first", 0, p[1].sim_start_time);
}

int main(void)
{
    mu_suite(suite_priority_textbook);
    mu_suite(suite_priority_tiebreak);
    mu_summary();
}
