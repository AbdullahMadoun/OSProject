#ifndef VISUALIZATION_H
#define VISUALIZATION_H

#include "metrics.h"
#include "process.h"
#include "scheduler.h"
#include "sim_engine.h"

/** Print the static Gantt chart for a completed run. */
void viz_print_gantt(const SimResult *r);

/** Print a live single-line status update. */
void viz_live_tick(int current_time, int running_pid, const int *ready_pids,
                   int ready_count);

/** Refresh the terminal view for a live simulation state. */
void viz_refresh_full(const SimResult *r, int current_time,
                      const Process *procs, int n, int running_pid,
                      SchedAlgo algo);

/** Print the aggregate metrics dashboard. */
void viz_print_metrics(const Metrics *m, SchedAlgo algo);

/** Print a side-by-side comparison across all algorithms. */
void viz_print_comparison(const Metrics metrics[ALGO_COUNT],
                          const SchedAlgo algos[ALGO_COUNT]);

/** Print predicted versus actual metrics for one algorithm. */
void viz_print_prediction(const Metrics *predicted, const Metrics *actual,
                          SchedAlgo algo);

#endif /* VISUALIZATION_H */
