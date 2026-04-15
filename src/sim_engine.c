#include "../include/sim_engine.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void sim_gantt_append(SimResult *r, int pid, int start, int end)
{
    GanttEntry *last;

    assert(r != NULL);
    assert(start < end);

    if (r->gantt_len > 0) {
        last = &r->gantt[r->gantt_len - 1];
        if (last->pid == pid && last->end == start) {
            last->end = end;
            return;
        }
    }

    if (r->gantt_len >= MAX_GANTT_ENTRIES) {
        fprintf(stderr, "sim_gantt_append: gantt capacity exceeded\n");
        exit(1);
    }

    r->gantt[r->gantt_len].pid = pid;
    r->gantt[r->gantt_len].start = start;
    r->gantt[r->gantt_len].end = end;
    r->gantt_len++;
}

void sim_finalize(SimResult *r)
{
    int i;

    if (r == NULL) {
        return;
    }

    r->idle_time = 0;
    r->total_time = 0;

    for (i = 0; i < r->gantt_len; i++) {
        GanttEntry *entry = &r->gantt[i];

        if (entry->pid == -1) {
            r->idle_time += entry->end - entry->start;
        }
        if (entry->end > r->total_time) {
            r->total_time = entry->end;
        }
    }
}

void sim_result_init(SimResult *r)
{
    if (r == NULL) {
        return;
    }
    memset(r, 0, sizeof(*r));
}
