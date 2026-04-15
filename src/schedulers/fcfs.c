#include "../../include/scheduler.h"
#include <stddef.h>

static void sort_by_arrival(Process **order, int n)
{
    int i;
    int j;

    for (i = 1; i < n; i++) {
        Process *key = order[i];
        j = i - 1;
        while (j >= 0) {
            if (order[j]->arrival_time < key->arrival_time) {
                break;
            }
            if (order[j]->arrival_time == key->arrival_time &&
                order[j]->pid < key->pid) {
                break;
            }
            order[j + 1] = order[j];
            j--;
        }
        order[j + 1] = key;
    }
}

void sched_fcfs(Process *procs, int n, const SimConfig *cfg, SimResult *r)
{
    Process *order[MAX_PROCESSES];
    int current_time = 0;
    int i;
    int overhead = 0;
    int last_pid = -1;

    if (procs == NULL || r == NULL || n <= 0) {
        return;
    }
    if (cfg != NULL) {
        overhead = cfg->ctx_overhead;
    }

    for (i = 0; i < n; i++) {
        order[i] = &procs[i];
    }
    sort_by_arrival(order, n);

    for (i = 0; i < n; i++) {
        Process *cur = order[i];
        int start_time;
        int end_time;

        if (current_time < cur->arrival_time) {
            sim_gantt_append(r, -1, current_time, cur->arrival_time);
            current_time = cur->arrival_time;
        } else if (last_pid >= 0 && overhead > 0) {
            sim_gantt_append(r, -1, current_time, current_time + overhead);
            current_time += overhead;
        }

        cur->state = STATE_RUNNING;
        if (cur->sim_start_time == -1) {
            cur->sim_start_time = current_time;
        }

        start_time = current_time;
        end_time = current_time + cur->burst_time;
        sim_gantt_append(r, cur->pid, start_time, end_time);

        current_time = end_time;
        cur->remaining_time = 0;
        cur->sim_completion_time = current_time;
        cur->state = STATE_TERMINATED;
        last_pid = cur->pid;
    }
}
