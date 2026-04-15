#include "../include/process.h"
#include <stddef.h>

void process_init(Process *p, int pid, int arrival, int burst, int priority)
{
    if (p == NULL) {
        return;
    }

    p->pid = pid;
    p->arrival_time = arrival;
    p->burst_time = burst;
    p->priority = priority;

    p->remaining_time = burst;
    p->state = STATE_NEW;

    p->sim_start_time = -1;
    p->sim_completion_time = 0;
    p->sim_waiting_time = 0;
    p->sim_turnaround_time = 0;
    p->sim_response_time = 0;
}

void process_reset(Process *p)
{
    if (p == NULL) {
        return;
    }

    p->remaining_time = p->burst_time;
    p->state = STATE_NEW;
    p->sim_start_time = -1;
    p->sim_completion_time = 0;
    p->sim_waiting_time = 0;
    p->sim_turnaround_time = 0;
    p->sim_response_time = 0;
}

const char *process_state_str(ProcessState s)
{
    switch (s) {
    case STATE_NEW:
        return "NEW";
    case STATE_READY:
        return "READY";
    case STATE_RUNNING:
        return "RUNNING";
    case STATE_TERMINATED:
        return "TERMINATED";
    default:
        return "UNKNOWN";
    }
}
