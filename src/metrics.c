#include "../include/metrics.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

static void sort_by_arrival(const Process *procs, int n,
                            const Process **sorted)
{
    int i;
    int j;

    for (i = 0; i < n; i++) {
        sorted[i] = &procs[i];
    }

    for (i = 1; i < n; i++) {
        const Process *key = sorted[i];
        j = i - 1;
        while (j >= 0) {
            if (sorted[j]->arrival_time < key->arrival_time) {
                break;
            }
            if (sorted[j]->arrival_time == key->arrival_time &&
                sorted[j]->pid < key->pid) {
                break;
            }
            sorted[j + 1] = sorted[j];
            j--;
        }
        sorted[j + 1] = key;
    }
}

static const char *metrics_algo_label(SchedAlgo algo)
{
    switch (algo) {
    case ALGO_FCFS:
        return "fcfs";
    case ALGO_SJF:
        return "sjf";
    case ALGO_RR:
        return "rr";
    case ALGO_PRIORITY:
        return "priority";
    default:
        return "unknown";
    }
}

void metrics_compute(Process *procs, int n, const SimResult *r, Metrics *m)
{
    int i;
    double sum_wait = 0.0;
    double sum_turn = 0.0;
    double sum_resp = 0.0;

    if (procs == NULL || r == NULL || m == NULL || n <= 0) {
        return;
    }

    memset(m, 0, sizeof(*m));

    for (i = 0; i < n; i++) {
        procs[i].sim_turnaround_time =
            procs[i].sim_completion_time - procs[i].arrival_time;
        procs[i].sim_waiting_time =
            procs[i].sim_turnaround_time - procs[i].burst_time;
        procs[i].sim_response_time =
            procs[i].sim_start_time - procs[i].arrival_time;

        sum_wait += procs[i].sim_waiting_time;
        sum_turn += procs[i].sim_turnaround_time;
        sum_resp += procs[i].sim_response_time;
    }

    m->avg_waiting_time = sum_wait / (double)n;
    m->avg_turnaround_time = sum_turn / (double)n;
    m->avg_response_time = sum_resp / (double)n;
    if (r->total_time > 0) {
        m->cpu_utilization =
            (r->total_time - r->idle_time) / (double)r->total_time;
        m->throughput = n / (double)r->total_time;
    }
    m->context_switches = r->context_switches;
    m->total_time = r->total_time;
}

void metrics_print_table(const Process *procs, int n, const Metrics *m,
                         const char *algo_label)
{
    int i;

    if (procs == NULL || m == NULL || algo_label == NULL) {
        return;
    }

    printf("\nMetrics for %s\n", algo_label);
    printf("PID ARR BUR PRI START DONE WAIT TURN RESP\n");
    for (i = 0; i < n; i++) {
        printf("%3d %3d %3d %3d %5d %4d %4d %4d %4d\n",
               procs[i].pid, procs[i].arrival_time, procs[i].burst_time,
               procs[i].priority, procs[i].sim_start_time,
               procs[i].sim_completion_time, procs[i].sim_waiting_time,
               procs[i].sim_turnaround_time, procs[i].sim_response_time);
    }

    printf("avg_wait=%.2f avg_turn=%.2f avg_resp=%.2f util=%.2f thr=%.2f "
           "ctx=%d total=%d\n",
           m->avg_waiting_time, m->avg_turnaround_time,
           m->avg_response_time, m->cpu_utilization, m->throughput,
           m->context_switches, m->total_time);
}

void metrics_workload_summary(const Process *procs, int n, double *avg_burst,
                              double *std_burst, double *avg_gap,
                              int *max_priority)
{
    const Process *sorted[MAX_PROCESSES];
    double burst_sum = 0.0;
    double burst_var = 0.0;
    double gap_sum = 0.0;
    double burst_mean;
    int i;

    if (procs == NULL || n <= 0 || avg_burst == NULL || std_burst == NULL ||
        avg_gap == NULL || max_priority == NULL) {
        return;
    }

    sort_by_arrival(procs, n, sorted);

    *max_priority = procs[0].priority;
    for (i = 0; i < n; i++) {
        burst_sum += procs[i].burst_time;
        if (procs[i].priority > *max_priority) {
            *max_priority = procs[i].priority;
        }
    }

    burst_mean = burst_sum / (double)n;
    for (i = 0; i < n; i++) {
        double diff = procs[i].burst_time - burst_mean;
        burst_var += diff * diff;
    }

    *avg_burst = burst_mean;
    *std_burst = sqrt(burst_var / (double)n);
    if (n > 1) {
        for (i = 1; i < n; i++) {
            gap_sum +=
                sorted[i]->arrival_time - sorted[i - 1]->arrival_time;
        }
        *avg_gap = gap_sum / (double)(n - 1);
    } else {
        *avg_gap = 0.0;
    }
}

int metrics_export_csv(const Process *procs, int n, const SimConfig *cfg,
                       const Metrics *m, SchedAlgo algo,
                       const char *filepath)
{
    FILE *check;
    FILE *out;
    int exists = 0;
    int quantum = 0;
    double avg_burst = 0.0;
    double std_burst = 0.0;
    double avg_gap = 0.0;
    int max_priority = 0;

    if (procs == NULL || cfg == NULL || m == NULL || filepath == NULL) {
        fprintf(stderr, "metrics_export_csv: invalid arguments\n");
        return CS_ERR;
    }

    metrics_workload_summary(procs, n, &avg_burst, &std_burst, &avg_gap,
                             &max_priority);
    if (algo == ALGO_RR) {
        quantum = cfg->quantum;
    }

    check = fopen(filepath, "r");
    if (check != NULL) {
        exists = 1;
        fclose(check);
    }

    out = fopen(filepath, "a");
    if (out == NULL) {
        fprintf(stderr, "metrics_export_csv: failed to open '%s'\n",
                filepath);
        return CS_ERR;
    }

    if (!exists) {
        fprintf(out,
                "algo,n_procs,avg_burst,std_burst,avg_arrival_gap,"
                "max_priority,quantum,ctx_overhead,avg_waiting,"
                "avg_turnaround,avg_response,cpu_utilization,"
                "throughput,context_switches\n");
    }

    fprintf(out,
            "%s,%d,%.6f,%.6f,%.6f,%d,%d,%d,%.6f,%.6f,%.6f,%.6f,%.6f,%d\n",
            metrics_algo_label(algo), n, avg_burst, std_burst, avg_gap,
            max_priority, quantum, cfg->ctx_overhead,
            m->avg_waiting_time, m->avg_turnaround_time,
            m->avg_response_time, m->cpu_utilization, m->throughput,
            m->context_switches);

    fclose(out);
    return CS_OK;
}
