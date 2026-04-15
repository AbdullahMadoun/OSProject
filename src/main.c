#include "../include/input.h"
#include "../include/metrics.h"
#include "../include/scheduler.h"
#include "../include/visualization.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

static void print_usage(const char *prog)
{
    printf("Usage: %s [OPTIONS]\n\n", prog);
    printf("Options:\n");
    printf("  -f <file>     Load workload from file\n");
    printf("  -s <name>     Use sample workload: basic | rr | priority | edge\n");
    printf("  -a <algo>     Algorithm: fcfs | sjf | rr | priority | all\n");
    printf("  -q <int>      Round Robin quantum (default: 2)\n");
    printf("  -o <int>      Context switch overhead (default: 0)\n");
    printf("  -e <file>     Export metrics to CSV\n");
    printf("  -p            Enable TabPFN prediction mode\n");
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
    default:
        return;
    }

    sim_finalize(result);
}

static void build_json_request(char *buf, size_t size, int algo_id,
                               int n_procs, double avg_burst,
                               double std_burst, double avg_gap,
                               int max_priority, int quantum,
                               int ctx_overhead)
{
    snprintf(buf, size,
             "{\"algo_id\":%d,\"n_procs\":%d,"
             "\"avg_burst\":%.4f,\"std_burst\":%.4f,"
             "\"avg_arrival_gap\":%.4f,\"max_priority\":%d,"
             "\"quantum\":%d,\"ctx_overhead\":%d}\n",
             algo_id, n_procs, avg_burst, std_burst, avg_gap, max_priority,
             quantum, ctx_overhead);
}

static int predict_via_socket(const char *request, char *response,
                              size_t resp_size)
{
    int fd;
    ssize_t nread;
    struct sockaddr_un addr;

    fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd < 0) {
        return CS_ERR;
    }

    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, ML_SOCKET_PATH, sizeof(addr.sun_path) - 1);

    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        close(fd);
        return CS_ERR;
    }
    if (write(fd, request, strlen(request)) < 0) {
        close(fd);
        return CS_ERR;
    }

    nread = read(fd, response, resp_size - 1);
    close(fd);
    if (nread <= 0) {
        return CS_ERR;
    }

    response[nread] = '\0';
    return CS_OK;
}

static int predict_via_popen(const char *json_req_noline, char *response,
                             size_t resp_size)
{
    char cmd[ML_JSON_BUFSIZE + 128];
    FILE *pipe;
    size_t len;

    snprintf(cmd, sizeof(cmd), "python3 ml/predict_once.py '%s' 2>/dev/null",
             json_req_noline);
    pipe = popen(cmd, "r");
    if (pipe == NULL) {
        return CS_ERR;
    }
    if (fgets(response, (int)resp_size, pipe) == NULL) {
        pclose(pipe);
        return CS_ERR;
    }
    pclose(pipe);

    len = strlen(response);
    if (len > 0 && response[len - 1] == '\n') {
        response[len - 1] = '\0';
    }
    return CS_OK;
}

static int parse_prediction_response(const char *json, Metrics *m)
{
    const char *p;
    double ctx;

#define EXTRACT(field, member)                                             \
    do {                                                                   \
        p = strstr(json, "\"" field "\":");                                \
        if (p == NULL) {                                                   \
            return CS_ERR;                                                 \
        }                                                                  \
        if (sscanf(p + strlen("\"" field "\":"), "%lf", &(member)) != 1) {\
            return CS_ERR;                                                 \
        }                                                                  \
    } while (0)

    EXTRACT("avg_waiting", m->avg_waiting_time);
    EXTRACT("avg_turnaround", m->avg_turnaround_time);
    EXTRACT("avg_response", m->avg_response_time);
    EXTRACT("cpu_utilization", m->cpu_utilization);
    EXTRACT("throughput", m->throughput);
    EXTRACT("context_switches", ctx);
    m->context_switches = (int)ctx;

#undef EXTRACT

    if (strstr(json, "\"error\": null") != NULL) {
        return CS_OK;
    }
    if (strstr(json, "\"error\":null") != NULL) {
        return CS_OK;
    }
    return CS_ERR;
}

static int run_prediction(SchedAlgo algo, const Process *procs, int n,
                          const SimConfig *cfg, Metrics *predicted)
{
    double avg_burst = 0.0;
    double std_burst = 0.0;
    double avg_gap = 0.0;
    int max_priority = 0;
    char req_nl[ML_JSON_BUFSIZE];
    char req_nq[ML_JSON_BUFSIZE];
    char response[ML_JSON_BUFSIZE];
    int quantum = 0;
    int ok;

    metrics_workload_summary(procs, n, &avg_burst, &std_burst, &avg_gap,
                             &max_priority);
    if (algo == ALGO_RR) {
        quantum = cfg->quantum;
    }
    build_json_request(req_nl, sizeof(req_nl), (int)algo, n, avg_burst,
                       std_burst, avg_gap, max_priority, quantum,
                       cfg->ctx_overhead);

    strncpy(req_nq, req_nl, sizeof(req_nq));
    req_nq[sizeof(req_nq) - 1] = '\0';
    if (strlen(req_nq) > 0 && req_nq[strlen(req_nq) - 1] == '\n') {
        req_nq[strlen(req_nq) - 1] = '\0';
    }

    ok = predict_via_socket(req_nl, response, sizeof(response));
    if (ok != CS_OK) {
        ok = predict_via_popen(req_nq, response, sizeof(response));
    }
    if (ok != CS_OK) {
        fprintf(stderr,
                "[ML] Prediction failed. Is the model trained? "
                "Run: python3 ml/train.py\n");
        return CS_ERR;
    }

    memset(predicted, 0, sizeof(*predicted));
    return parse_prediction_response(response, predicted);
}

static int run_single_algo(SchedAlgo algo, Process *procs, int n,
                           const SimConfig *cfg, const char *export_path,
                           int predict_mode, Metrics *out_metrics)
{
    SimResult result;
    Metrics actual;
    Metrics predicted;
    int have_prediction = 0;

    if (predict_mode) {
        if (run_prediction(algo, procs, n, cfg, &predicted) == CS_OK) {
            have_prediction = 1;
            printf("Prediction ready for %s\n", algo_name(algo));
        }
    }

    schedule(algo, procs, n, cfg, &result);
    metrics_compute(procs, n, &result, &actual);
    viz_print_gantt(&result);
    metrics_print_table(procs, n, &actual, algo_name(algo));
    viz_print_metrics(&actual, algo);
    if (have_prediction) {
        viz_print_prediction(&predicted, &actual, algo);
    }
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
        ALGO_FCFS, ALGO_SJF, ALGO_RR, ALGO_PRIORITY
    };
    SimConfig cfg = {DEFAULT_QUANTUM, DEFAULT_CTX_OVERHEAD};
    const char *workload_file = NULL;
    const char *sample_name = NULL;
    const char *export_path = NULL;
    const char *algo_text = NULL;
    int predict_mode = 0;
    int n = 0;
    int opt;

    while ((opt = getopt(argc, argv, "f:s:a:q:o:e:ph")) != -1) {
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
        case 'p':
            predict_mode = 1;
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
                                export_path, predict_mode,
                                &compare_metrics[i]) != CS_OK) {
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
        if (run_single_algo(algo, procs, n, &cfg, export_path, predict_mode,
                            NULL) != CS_OK) {
            return 1;
        }
    }

    return 0;
}
