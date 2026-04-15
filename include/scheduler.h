#ifndef SCHEDULER_H
#define SCHEDULER_H

#include "process.h"
#include "sim_engine.h"

typedef enum {
    ALGO_FCFS = 0,
    ALGO_SJF = 1,
    ALGO_RR = 2,
    ALGO_PRIORITY = 3,
    ALGO_COUNT = 4
} SchedAlgo;

/** Reset processes, dispatch the selected algorithm, and finalize the result. */
void schedule(SchedAlgo algo, Process *procs, int n,
              const SimConfig *cfg, SimResult *result);

/** Run the FCFS scheduler. */
void sched_fcfs(Process *procs, int n, const SimConfig *cfg, SimResult *r);

/** Run the non-preemptive SJF scheduler. */
void sched_sjf(Process *procs, int n, const SimConfig *cfg, SimResult *r);

/** Run the Round Robin scheduler. */
void sched_rr(Process *procs, int n, const SimConfig *cfg, SimResult *r);

/** Run the non-preemptive priority scheduler. */
void sched_priority(Process *procs, int n, const SimConfig *cfg,
                    SimResult *r);

/** Return the algorithm display name. */
const char *algo_name(SchedAlgo a);

/** Convert a string to an algorithm enum, or ALGO_COUNT if invalid. */
SchedAlgo algo_from_str(const char *s);

#endif /* SCHEDULER_H */
