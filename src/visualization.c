#include "../include/visualization.h"
#include <math.h>
#include <stdio.h>

static const char *pid_color(int pid)
{
    switch (pid % 6) {
    case 0:
        return ANSI_GREEN;
    case 1:
        return ANSI_YELLOW;
    case 2:
        return ANSI_BLUE;
    case 3:
        return ANSI_MAGENTA;
    case 4:
        return ANSI_CYAN;
    default:
        return ANSI_WHITE;
    }
}

static void print_metric_cell(double value, int highlight)
{
    if (highlight) {
        printf(ANSI_GREEN ANSI_BOLD "%10.2f" ANSI_RESET, value);
    } else {
        printf("%10.2f", value);
    }
}

static void print_int_cell(int value, int highlight)
{
    if (highlight) {
        printf(ANSI_GREEN ANSI_BOLD "%10d" ANSI_RESET, value);
    } else {
        printf("%10d", value);
    }
}

void viz_print_gantt(const SimResult *r)
{
    int i;

    if (r == NULL) {
        return;
    }

    printf("\nGantt chart\n");
    for (i = 0; i < r->gantt_len; i++) {
        const GanttEntry *entry = &r->gantt[i];
        const char *color = (entry->pid == -1) ? ANSI_RED
                                               : pid_color(entry->pid);

        if (entry->pid == -1) {
            printf("%s| IDLE %d-%d |%s", color, entry->start, entry->end,
                   ANSI_RESET);
        } else {
            printf("%s| P%d %d-%d |%s", color, entry->pid, entry->start,
                   entry->end, ANSI_RESET);
        }
    }
    printf("\n");

    if (r->total_time > 0) {
        int t;
        printf("Ticks:");
        for (t = 0; t <= r->total_time; t++) {
            if (t % GANTT_TICK_INTERVAL == 0) {
                printf(" %d", t);
            }
        }
        printf("\n");
    }
}

void viz_live_tick(int current_time, int running_pid, const int *ready_pids,
                   int ready_count)
{
    int i;

    printf("\rtime=%d running=", current_time);
    if (running_pid >= 0) {
        printf("P%d", running_pid);
    } else {
        printf("IDLE");
    }
    printf(" ready=[");
    for (i = 0; i < ready_count; i++) {
        if (i > 0) {
            printf(",");
        }
        printf("%d", ready_pids[i]);
    }
    printf("]");
    fflush(stdout);
}

void viz_refresh_full(const SimResult *r, int current_time,
                      const Process *procs, int n, int running_pid,
                      SchedAlgo algo)
{
    int i;

    if (r == NULL || procs == NULL) {
        return;
    }

    printf("\033[%dA", r->gantt_len + n + 4);
    printf("Algorithm: %s\n", algo_name(algo));
    printf("Current time: %d  Running: ", current_time);
    if (running_pid >= 0) {
        printf("P%d\n", running_pid);
    } else {
        printf("IDLE\n");
    }
    viz_print_gantt(r);
    for (i = 0; i < n; i++) {
        printf("P%d %-10s rem=%d\n", procs[i].pid,
               process_state_str(procs[i].state), procs[i].remaining_time);
    }
}

void viz_print_metrics(const Metrics *m, SchedAlgo algo)
{
    if (m == NULL) {
        return;
    }

    printf("Metrics (%s)\n", algo_name(algo));
    printf("  avg waiting    : %.2f\n", m->avg_waiting_time);
    printf("  avg turnaround : %.2f\n", m->avg_turnaround_time);
    printf("  avg response   : %.2f\n", m->avg_response_time);
    printf("  cpu utilization: %.2f\n", m->cpu_utilization);
    printf("  throughput     : %.2f\n", m->throughput);
    printf("  ctx switches   : %d\n", m->context_switches);
    printf("  total time     : %d\n", m->total_time);
}

void viz_print_comparison(const Metrics metrics[ALGO_COUNT],
                          const SchedAlgo algos[ALGO_COUNT])
{
    int i;
    double best_wait = metrics[0].avg_waiting_time;
    double best_turn = metrics[0].avg_turnaround_time;
    double best_resp = metrics[0].avg_response_time;
    double best_util = metrics[0].cpu_utilization;
    double best_thr = metrics[0].throughput;
    int best_ctx = metrics[0].context_switches;

    for (i = 1; i < ALGO_COUNT; i++) {
        if (metrics[i].avg_waiting_time < best_wait) {
            best_wait = metrics[i].avg_waiting_time;
        }
        if (metrics[i].avg_turnaround_time < best_turn) {
            best_turn = metrics[i].avg_turnaround_time;
        }
        if (metrics[i].avg_response_time < best_resp) {
            best_resp = metrics[i].avg_response_time;
        }
        if (metrics[i].cpu_utilization > best_util) {
            best_util = metrics[i].cpu_utilization;
        }
        if (metrics[i].throughput > best_thr) {
            best_thr = metrics[i].throughput;
        }
        if (metrics[i].context_switches < best_ctx) {
            best_ctx = metrics[i].context_switches;
        }
    }

    printf("\nComparison\n");
    printf("%-10s %10s %10s %10s %10s %10s %10s\n", "algo", "wait",
           "turn", "resp", "util", "thr", "ctx");
    for (i = 0; i < ALGO_COUNT; i++) {
        printf("%-10s ", algo_name(algos[i]));
        printf(" ");
        print_metric_cell(metrics[i].avg_waiting_time,
                          fabs(metrics[i].avg_waiting_time - best_wait) <
                              1e-9);
        printf(" ");
        print_metric_cell(metrics[i].avg_turnaround_time,
                          fabs(metrics[i].avg_turnaround_time - best_turn) <
                              1e-9);
        printf(" ");
        print_metric_cell(metrics[i].avg_response_time,
                          fabs(metrics[i].avg_response_time - best_resp) <
                              1e-9);
        printf(" ");
        print_metric_cell(metrics[i].cpu_utilization,
                          fabs(metrics[i].cpu_utilization - best_util) <
                              1e-9);
        printf(" ");
        print_metric_cell(metrics[i].throughput,
                          fabs(metrics[i].throughput - best_thr) < 1e-9);
        printf(" ");
        print_int_cell(metrics[i].context_switches,
                       metrics[i].context_switches == best_ctx);
        printf("\n");
    }
}

void viz_print_prediction(const Metrics *predicted, const Metrics *actual,
                          SchedAlgo algo)
{
    if (predicted == NULL || actual == NULL) {
        return;
    }

    printf("\nPrediction vs actual (%s)\n", algo_name(algo));
    printf("%-16s %12s %12s\n", "metric", "predicted", "actual");
    printf("%-16s %12.2f %12.2f\n", "avg_waiting",
           predicted->avg_waiting_time, actual->avg_waiting_time);
    printf("%-16s %12.2f %12.2f\n", "avg_turnaround",
           predicted->avg_turnaround_time, actual->avg_turnaround_time);
    printf("%-16s %12.2f %12.2f\n", "avg_response",
           predicted->avg_response_time, actual->avg_response_time);
    printf("%-16s %12.2f %12.2f\n", "cpu_utilization",
           predicted->cpu_utilization, actual->cpu_utilization);
    printf("%-16s %12.2f %12.2f\n", "throughput",
           predicted->throughput, actual->throughput);
    printf("%-16s %12d %12d\n", "context_switches",
           predicted->context_switches, actual->context_switches);
}
