#ifndef SIM_ENGINE_H
#define SIM_ENGINE_H

#include "config.h"
#include "process.h"

/** One contiguous CPU assignment in the execution timeline. */
typedef struct {
    int pid;
    int start;
    int end;
} GanttEntry;

/** Complete output of a single simulation run. */
typedef struct {
    GanttEntry gantt[MAX_GANTT_ENTRIES];
    int gantt_len;
    int context_switches;
    int total_time;
    int idle_time;
} SimResult;

/** Parameters shared by all scheduling algorithms. */
typedef struct {
    int quantum;
    int ctx_overhead;
} SimConfig;

/** Append or merge a Gantt segment into the simulation result timeline. */
void sim_gantt_append(SimResult *r, int pid, int start, int end);

/** Compute idle time and context switches from the finalized Gantt chart. */
void sim_finalize(SimResult *r);

/** Initialize a SimResult to zero. */
void sim_result_init(SimResult *r);

#endif /* SIM_ENGINE_H */
