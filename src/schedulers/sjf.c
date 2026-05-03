#include "../../include/queue.h"
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

void sched_sjf(Process *procs, int n, const SimConfig *cfg, SimResult *r)
{
    Process *order[MAX_PROCESSES];
    MinHeap ready;
    int next_idx = 0;
    int completed = 0;
    int current_time = 0;
    int overhead = 0;
    int last_pid = -1;
    int i;

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
    heap_init(&ready, cmp_burst_time);

    while (completed < n) {
        while (next_idx < n &&
               order[next_idx]->arrival_time <= current_time) {
            order[next_idx]->state = STATE_READY;
            heap_insert(&ready, order[next_idx]);
            next_idx++;
        }

        if (heap_is_empty(&ready)) {
            int next_time = order[next_idx]->arrival_time;
            if (current_time < next_time) {
                sim_gantt_append(r, -1, current_time, next_time);
                current_time = next_time;
            }
            continue;
        }

        {
            Process *cur = heap_extract(&ready);
            int end_time;

            if (last_pid >= 0 && last_pid != cur->pid && overhead > 0) {
                sim_gantt_append(r, -1, current_time,
                                 current_time + overhead);
                current_time += overhead;
            }

            cur->state = STATE_RUNNING;
            if (cur->sim_start_time == -1) {
                cur->sim_start_time = current_time;
            }

            end_time = current_time + cur->burst_time;
            sim_gantt_append(r, cur->pid, current_time, end_time);
            current_time = end_time;

            cur->remaining_time = 0;
            cur->sim_completion_time = current_time;
            cur->state = STATE_TERMINATED;
            last_pid = cur->pid;
            completed++;
        }
    }
}
