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

static void enqueue_ready(FIFOQueue *ready, Process **order, int n,
                          int *next_idx, int current_time)
{
    while (*next_idx < n && order[*next_idx]->arrival_time <= current_time) {
        order[*next_idx]->state = STATE_READY;
        fifo_enqueue(ready, order[*next_idx]);
        (*next_idx)++;
    }
}

void sched_rr(Process *procs, int n, const SimConfig *cfg, SimResult *r)
{
    Process *order[MAX_PROCESSES];
    FIFOQueue ready;
    int current_time = 0;
    int completed = 0;
    int next_idx = 0;
    int quantum = DEFAULT_QUANTUM;
    int overhead = 0;
    int last_pid = -1;
    int i;

    if (procs == NULL || r == NULL || n <= 0) {
        return;
    }
    if (cfg != NULL) {
        if (cfg->quantum > 0) {
            quantum = cfg->quantum;
        }
        overhead = cfg->ctx_overhead;
    }

    for (i = 0; i < n; i++) {
        order[i] = &procs[i];
    }
    sort_by_arrival(order, n);
    fifo_init(&ready);

    while (completed < n) {
        Process *cur;
        int ticks;
        int start_time;
        int next_pid;

        enqueue_ready(&ready, order, n, &next_idx, current_time);
        if (fifo_is_empty(&ready)) {
            int next_time = order[next_idx]->arrival_time;
            if (current_time < next_time) {
                sim_gantt_append(r, -1, current_time, next_time);
                current_time = next_time;
            }
            continue;
        }

        next_pid = ready.head->proc->pid;
        if (last_pid >= 0 && last_pid != next_pid) {
            r->context_switches++;
            if (overhead > 0) {
                sim_gantt_append(r, -1, current_time, current_time + overhead);
                current_time += overhead;
                enqueue_ready(&ready, order, n, &next_idx, current_time);
            }
        }

        cur = fifo_dequeue(&ready);
        cur->state = STATE_RUNNING;
        if (cur->sim_start_time == -1) {
            cur->sim_start_time = current_time;
        }

        ticks = (cur->remaining_time < quantum) ? cur->remaining_time
                                                : quantum;
        start_time = current_time;
        current_time += ticks;
        cur->remaining_time -= ticks;
        sim_gantt_append(r, cur->pid, start_time, current_time);

        enqueue_ready(&ready, order, n, &next_idx, current_time);

        if (cur->remaining_time > 0) {
            cur->state = STATE_READY;
            fifo_enqueue(&ready, cur);
        } else {
            cur->sim_completion_time = current_time;
            cur->state = STATE_TERMINATED;
            completed++;
        }

        last_pid = cur->pid;
    }

    fifo_destroy(&ready);
}
