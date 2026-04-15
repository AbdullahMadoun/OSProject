#include "minunit.h"
#include "../include/process.h"

static void suite_init(void)
{
    Process p;

    process_init(&p, 3, 2, 7, 1);
    mu_assert_int_eq("pid", 3, p.pid);
    mu_assert_int_eq("arrival", 2, p.arrival_time);
    mu_assert_int_eq("burst", 7, p.burst_time);
    mu_assert_int_eq("priority", 1, p.priority);
    mu_assert_int_eq("remaining==burst", 7, p.remaining_time);
    mu_assert_int_eq("state NEW", STATE_NEW, p.state);
    mu_assert_int_eq("start_time -1", -1, p.sim_start_time);
    mu_assert_int_eq("completion 0", 0, p.sim_completion_time);
    mu_assert_int_eq("waiting 0", 0, p.sim_waiting_time);
    mu_assert_int_eq("turnaround 0", 0, p.sim_turnaround_time);
    mu_assert_int_eq("response 0", 0, p.sim_response_time);
}

static void suite_reset(void)
{
    Process p;

    process_init(&p, 1, 0, 10, 2);
    p.remaining_time = 4;
    p.state = STATE_TERMINATED;
    p.sim_start_time = 2;
    p.sim_completion_time = 12;
    p.sim_waiting_time = 2;
    p.sim_turnaround_time = 12;
    p.sim_response_time = 2;

    process_reset(&p);

    mu_assert_int_eq("remaining restored", 10, p.remaining_time);
    mu_assert_int_eq("state NEW", STATE_NEW, p.state);
    mu_assert_int_eq("start -1", -1, p.sim_start_time);
    mu_assert_int_eq("completion 0", 0, p.sim_completion_time);
    mu_assert_int_eq("pid unchanged", 1, p.pid);
    mu_assert_int_eq("arrival unchanged", 0, p.arrival_time);
    mu_assert_int_eq("burst unchanged", 10, p.burst_time);
    mu_assert_int_eq("priority unchanged", 2, p.priority);
}

int main(void)
{
    mu_suite(suite_init);
    mu_suite(suite_reset);
    mu_summary();
}
