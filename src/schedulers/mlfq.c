#include "../../include/queue.h"
#include "../../include/scheduler.h"
#include <stddef.h>

static void sort_by_arrival_mlfq(Process **order, int n)
{
    int i, j;
    for (i = 1; i < n; i++) {
        Process *key = order[i];
        j = i - 1;
        while (j >= 0) {
            if (order[j]->arrival_time < key->arrival_time) break;
            if (order[j]->arrival_time == key->arrival_time &&
                order[j]->pid < key->pid) break;
            order[j + 1] = order[j];
            j--;
        }
        order[j + 1] = key;
    }
}

static void enqueue_arrivals_mlfq(FIFOQueue *q0, Process **order, int n,
                                   int *next_idx, int current_time)
{
    while (*next_idx < n &&
           order[*next_idx]->arrival_time <= current_time) {
        order[*next_idx]->state = STATE_READY;
        fifo_enqueue(q0, order[*next_idx]);
        (*next_idx)++;
    }
}

void sched_mlfq(Process *procs, int n, const SimConfig *cfg, SimResult *r)
{
    Process *order[MAX_PROCESSES];
    FIFOQueue queues[3];
    int quantums[3];
    int current_time = 0;
    int next_idx = 0;
    int completed = 0;
    int overhead = 0;
    int last_pid = -1;
    int q0q, i;

    if (procs == NULL || r == NULL || n <= 0) return;

    q0q = (cfg != NULL && cfg->quantum > 0) ? cfg->quantum : DEFAULT_QUANTUM;
    overhead = (cfg != NULL) ? cfg->ctx_overhead : 0;

    quantums[0] = q0q;
    quantums[1] = q0q * 2;
    quantums[2] = 0; /* 0 = FCFS (unlimited) */

    for (i = 0; i < n; i++) order[i] = &procs[i];
    sort_by_arrival_mlfq(order, n);
    for (i = 0; i < 3; i++) fifo_init(&queues[i]);

    while (completed < n) {
        Process *cur = NULL;
        int q_level = -1;
        int quantum, planned, run_until, ran;
        int was_preempted;

        enqueue_arrivals_mlfq(&queues[0], order, n, &next_idx, current_time);

        for (i = 0; i < 3; i++) {
            if (!fifo_is_empty(&queues[i])) {
                cur = fifo_dequeue(&queues[i]);
                q_level = i;
                break;
            }
        }

        if (cur == NULL) {
            if (next_idx < n) {
                int next_arr = order[next_idx]->arrival_time;
                sim_gantt_append(r, -1, current_time, next_arr);
                current_time = next_arr;
            }
            continue;
        }

        if (last_pid >= 0 && last_pid != cur->pid) {
            r->context_switches++;
            if (overhead > 0) {
                sim_gantt_append(r, -1, current_time,
                                 current_time + overhead);
                current_time += overhead;
                enqueue_arrivals_mlfq(&queues[0], order, n, &next_idx,
                                      current_time);
            }
        }

        if (cur->sim_start_time == -1) cur->sim_start_time = current_time;
        cur->state = STATE_RUNNING;

        quantum = quantums[q_level];
        planned = (quantum == 0) ? cur->remaining_time
                                 : (cur->remaining_time < quantum
                                        ? cur->remaining_time
                                        : quantum);
        run_until = current_time + planned;

        /* Q1/Q2: cap at next arrival so new Q0 arrivals can preempt */
        was_preempted = 0;
        if (q_level > 0 && next_idx < n) {
            int next_arr = order[next_idx]->arrival_time;
            if (next_arr < run_until) {
                run_until = next_arr;
                was_preempted = 1;
            }
        }

        ran = run_until - current_time;
        cur->remaining_time -= ran;
        sim_gantt_append(r, cur->pid, current_time, run_until);
        current_time = run_until;
        last_pid = cur->pid;

        enqueue_arrivals_mlfq(&queues[0], order, n, &next_idx, current_time);

        if (cur->remaining_time <= 0) {
            cur->sim_completion_time = current_time;
            cur->state = STATE_TERMINATED;
            completed++;
        } else if (was_preempted) {
            /* Return to same queue (back of queue is acceptable here) */
            cur->state = STATE_READY;
            fifo_enqueue(&queues[q_level], cur);
        } else {
            /* Quantum exhausted — demote */
            int next_level = (q_level < 2) ? q_level + 1 : 2;
            cur->state = STATE_READY;
            fifo_enqueue(&queues[next_level], cur);
        }
    }

    for (i = 0; i < 3; i++) fifo_destroy(&queues[i]);
}
