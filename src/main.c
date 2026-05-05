#include "../include/input.h"
#include "../include/metrics.h"
#include "../include/scheduler.h"
#include "../include/visualization.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void print_usage(const char *prog)
{
    printf("Usage: %s [OPTIONS]\n\n", prog);
    printf("Options:\n");
    printf("  -f <file>     Load workload from file\n");
    printf("  -s <name>     Use sample workload: basic | rr | priority | edge\n");
    printf("  -a <algo>     Algorithm: fcfs | sjf | srtf | rr | priority | priorityp | mlfq | all\n");
    printf("  -q <int>      Round Robin quantum (default: 2)\n");
    printf("  -o <int>      Context switch overhead (default: 0)\n");
    printf("  -e <file>     Export metrics to CSV\n");
    printf("  -h            Show this help\n");
}

static int parse_non_negative(const char *text, int *out)
{
    char *end = NULL;
    long value;

    if (text == NULL || out == NULL) {
        return CS_ERR;
    }

    value = strtol(text, &end, 10);
    if (*text == '\0' || end == NULL || *end != '\0' || value < 0 ||
        value > 2147483647L) {
        return CS_ERR;
    }

    *out = (int)value;
    return CS_OK;
}

const char *algo_name(SchedAlgo a)
{
    switch (a) {
    case ALGO_FCFS:
        return "fcfs";
    case ALGO_SJF:
        return "sjf";
    case ALGO_RR:
        return "rr";
    case ALGO_PRIORITY:
        return "priority";
    case ALGO_SRTF:
        return "srtf";
    case ALGO_PRIORITY_P:
        return "priorityp";
    case ALGO_MLFQ:
        return "mlfq";
    default:
        return "unknown";
    }
}

SchedAlgo algo_from_str(const char *s)
{
    if (s == NULL) {
        return ALGO_COUNT;
    }
    if (strcmp(s, "fcfs") == 0) {
        return ALGO_FCFS;
    }
    if (strcmp(s, "sjf") == 0) {
        return ALGO_SJF;
    }
    if (strcmp(s, "rr") == 0) {
        return ALGO_RR;
    }
    if (strcmp(s, "priority") == 0) {
        return ALGO_PRIORITY;
    }
    if (strcmp(s, "srtf") == 0) {
        return ALGO_SRTF;
    }
    if (strcmp(s, "priorityp") == 0) {
        return ALGO_PRIORITY_P;
    }
    if (strcmp(s, "mlfq") == 0) {
        return ALGO_MLFQ;
    }
    return ALGO_COUNT;
}

void schedule(SchedAlgo algo, Process *procs, int n, const SimConfig *cfg,
              SimResult *result)
{
    int i;

    if (procs == NULL || cfg == NULL || result == NULL || n <= 0) {
        return;
    }

    sim_result_init(result);
    for (i = 0; i < n; i++) {
        process_reset(&procs[i]);
    }

    switch (algo) {
    case ALGO_FCFS:
        sched_fcfs(procs, n, cfg, result);
        break;
    case ALGO_SJF:
        sched_sjf(procs, n, cfg, result);
        break;
    case ALGO_RR:
        sched_rr(procs, n, cfg, result);
        break;
    case ALGO_PRIORITY:
        sched_priority(procs, n, cfg, result);
        break;
    case ALGO_SRTF:
        sched_srtf(procs, n, cfg, result);
        break;
    case ALGO_PRIORITY_P:
        sched_priority_p(procs, n, cfg, result);
        break;
    case ALGO_MLFQ:
        sched_mlfq(procs, n, cfg, result);
        break;
    default:
        return;
    }

    sim_finalize(result);
}

static int run_single_algo(SchedAlgo algo, Process *procs, int n,
                           const SimConfig *cfg, const char *export_path,
                           Metrics *out_metrics)
{
    SimResult result;
    Metrics actual;

    schedule(algo, procs, n, cfg, &result);
    metrics_compute(procs, n, &result, &actual);
    viz_print_gantt(&result);
    metrics_print_table(procs, n, &actual, algo_name(algo));
    viz_print_metrics(&actual, algo);
    if (export_path != NULL &&
        metrics_export_csv(procs, n, cfg, &actual, algo, export_path) !=
            CS_OK) {
        return CS_ERR;
    }
    if (out_metrics != NULL) {
        *out_metrics = actual;
    }
    return CS_OK;
}

int main(int argc, char **argv)
{
    Process procs[MAX_PROCESSES];
    Metrics compare_metrics[ALGO_COUNT];
    SchedAlgo compare_algos[ALGO_COUNT] = {
        ALGO_FCFS, ALGO_SJF, ALGO_RR, ALGO_PRIORITY, ALGO_SRTF,
        ALGO_PRIORITY_P, ALGO_MLFQ
    };
    SimConfig cfg = {DEFAULT_QUANTUM, DEFAULT_CTX_OVERHEAD};
    const char *workload_file = NULL;
    const char *sample_name = NULL;
    const char *export_path = NULL;
    const char *algo_text = NULL;
    int n = 0;
    int opt;

    while ((opt = getopt(argc, argv, "f:s:a:q:o:e:h")) != -1) {
        switch (opt) {
        case 'f':
            workload_file = optarg;
            break;
        case 's':
            sample_name = optarg;
            break;
        case 'a':
            algo_text = optarg;
            break;
        case 'q':
            if (parse_non_negative(optarg, &cfg.quantum) != CS_OK ||
                cfg.quantum == 0) {
                fprintf(stderr, "Invalid quantum: %s\n", optarg);
                return 1;
            }
            break;
        case 'o':
            if (parse_non_negative(optarg, &cfg.ctx_overhead) != CS_OK) {
                fprintf(stderr, "Invalid context switch overhead: %s\n",
                        optarg);
                return 1;
            }
            break;
        case 'e':
            export_path = optarg;
            break;
        case 'h':
            print_usage(argv[0]);
            return 0;
        default:
            print_usage(argv[0]);
            return 1;
        }
    }

    if ((workload_file == NULL && sample_name == NULL) ||
        (workload_file != NULL && sample_name != NULL)) {
        fprintf(stderr, "Choose exactly one of -f or -s.\n");
        print_usage(argv[0]);
        return 1;
    }
    if (algo_text == NULL) {
        fprintf(stderr, "Algorithm is required.\n");
        print_usage(argv[0]);
        return 1;
    }

    if (workload_file != NULL) {
        n = input_load_file(workload_file, procs, MAX_PROCESSES);
    } else {
        n = input_load_sample(sample_name, procs, MAX_PROCESSES);
    }
    if (n == CS_ERR) {
        return 1;
    }

    if (strcmp(algo_text, "all") == 0) {
        int i;
        for (i = 0; i < ALGO_COUNT; i++) {
            if (run_single_algo(compare_algos[i], procs, n, &cfg,
                                export_path, &compare_metrics[i]) != CS_OK) {
                return 1;
            }
        }
        viz_print_comparison(compare_metrics, compare_algos);
        return 0;
    }

    {
        SchedAlgo algo = algo_from_str(algo_text);
        if (algo == ALGO_COUNT) {
            fprintf(stderr, "Unknown algorithm: %s\n", algo_text);
            return 1;
        }
        if (run_single_algo(algo, procs, n, &cfg, export_path, NULL) !=
            CS_OK) {
            return 1;
        }
    }

    return 0;
}
