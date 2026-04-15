#ifndef METRICS_H
#define METRICS_H

#include "config.h"
#include "process.h"
#include "scheduler.h"
#include "sim_engine.h"

/** Aggregate performance metrics for one simulation run. */
typedef struct {
    double avg_waiting_time;
    double avg_turnaround_time;
    double avg_response_time;
    double cpu_utilization;
    double throughput;
    int context_switches;
    int total_time;
} Metrics;

/** Compute per-process and aggregate metrics for a completed simulation run. */
void metrics_compute(Process *procs, int n, const SimResult *r, Metrics *m);

/** Print a formatted per-process table and aggregate summary. */
void metrics_print_table(const Process *procs, int n, const Metrics *m,
                         const char *algo_label);

/** Export one simulation run as a CSV row, creating the header if needed. */
int metrics_export_csv(const Process *procs, int n, const SimConfig *cfg,
                       const Metrics *m, SchedAlgo algo,
                       const char *filepath);

/** Compute workload summary statistics used by export and prediction. */
void metrics_workload_summary(const Process *procs, int n, double *avg_burst,
                              double *std_burst, double *avg_gap,
                              int *max_priority);

#endif /* METRICS_H */
