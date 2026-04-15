#include "../include/input.h"
#include "../include/config.h"
#include <ctype.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    int pid;
    int arrival;
    int burst;
    int priority;
} SampleProc;

static const SampleProc SAMPLE_BASIC[] = {
    {1, 0, 8, 3},
    {2, 1, 4, 1},
    {3, 2, 9, 4},
    {4, 3, 5, 2}
};

static const SampleProc SAMPLE_RR[] = {
    {1, 0, 24, 0},
    {2, 0, 3, 0},
    {3, 0, 3, 0}
};

static const SampleProc SAMPLE_PRIORITY[] = {
    {1, 0, 10, 3},
    {2, 0, 1, 1},
    {3, 0, 2, 4},
    {4, 0, 1, 5},
    {5, 0, 5, 2}
};

static const SampleProc SAMPLE_EDGE[] = {
    {1, 5, 3, 0}
};

static int load_sample_array(const SampleProc *src, int count, Process *procs,
                             int max_procs)
{
    int i;

    if (procs == NULL || max_procs < count || count <= 0) {
        fprintf(stderr, "input_load_sample: insufficient process capacity\n");
        return CS_ERR;
    }

    for (i = 0; i < count; i++) {
        process_init(&procs[i], src[i].pid, src[i].arrival, src[i].burst,
                     src[i].priority);
    }

    if (input_validate(procs, count) != CS_OK) {
        return CS_ERR;
    }
    return count;
}

static char *skip_ws(char *s)
{
    while (*s != '\0' && isspace((unsigned char)*s)) {
        s++;
    }
    return s;
}

int input_validate(const Process *procs, int n)
{
    int i;
    int j;

    if (procs == NULL) {
        fprintf(stderr, "input_validate: procs is NULL\n");
        return CS_ERR;
    }
    if (n < 1 || n > MAX_PROCESSES) {
        fprintf(stderr, "input_validate: invalid process count %d\n", n);
        return CS_ERR;
    }

    for (i = 0; i < n; i++) {
        if (procs[i].pid <= 0) {
            fprintf(stderr, "input_validate: pid must be > 0\n");
            return CS_ERR;
        }
        if (procs[i].arrival_time < 0) {
            fprintf(stderr, "input_validate: arrival_time must be >= 0\n");
            return CS_ERR;
        }
        if (procs[i].burst_time <= 0) {
            fprintf(stderr, "input_validate: burst_time must be > 0\n");
            return CS_ERR;
        }
        if (procs[i].priority < 0) {
            fprintf(stderr, "input_validate: priority must be >= 0\n");
            return CS_ERR;
        }
        for (j = i + 1; j < n; j++) {
            if (procs[i].pid == procs[j].pid) {
                fprintf(stderr, "input_validate: duplicate pid %d\n",
                        procs[i].pid);
                return CS_ERR;
            }
        }
    }

    return CS_OK;
}

static int parse_line(char *line, int line_no, Process *procs, int *count,
                      int max_procs, const char *source)
{
    char *trimmed;
    int pid;
    int arrival;
    int burst;
    int priority;
    char extra;

    trimmed = skip_ws(line);
    if (*trimmed == '\0' || *trimmed == '\n' || *trimmed == '#') {
        return CS_OK;
    }
    if (*count >= max_procs) {
        fprintf(stderr, "%s: too many processes\n", source);
        return CS_ERR;
    }

    if (sscanf(trimmed, "%d %d %d %d %c", &pid, &arrival, &burst, &priority,
               &extra) != 4) {
        fprintf(stderr, "%s: parse error on line %d\n", source, line_no);
        return CS_ERR;
    }

    process_init(&procs[*count], pid, arrival, burst, priority);
    (*count)++;
    return CS_OK;
}

static int parse_payload(FILE *fp, const char *source, Process *procs,
                         int max_procs)
{
    char line[MAX_LINE_LEN];
    int count = 0;
    int line_no = 0;

    while (fgets(line, sizeof(line), fp) != NULL) {
        line_no++;
        if (parse_line(line, line_no, procs, &count, max_procs, source) !=
            CS_OK) {
            return CS_ERR;
        }
    }

    if (count < 1) {
        fprintf(stderr, "%s: no processes loaded\n", source);
        return CS_ERR;
    }
    if (input_validate(procs, count) != CS_OK) {
        return CS_ERR;
    }
    return count;
}

int input_load_file(const char *filepath, Process *procs, int max_procs)
{
    FILE *fp;
    int count;

    if (filepath == NULL || procs == NULL || max_procs < 1) {
        fprintf(stderr, "input_load_file: invalid arguments\n");
        return CS_ERR;
    }

    fp = fopen(filepath, "r");
    if (fp == NULL) {
        fprintf(stderr, "input_load_file: failed to open '%s'\n", filepath);
        return CS_ERR;
    }

    count = parse_payload(fp, "input_load_file", procs, max_procs);
    fclose(fp);
    return count;
}

int input_load_buffer(const char *data, size_t len, Process *procs,
                      int max_procs)
{
    char line[MAX_LINE_LEN];
    size_t i;
    size_t line_len = 0;
    int line_no = 0;
    int count = 0;

    if (data == NULL || procs == NULL || max_procs < 1) {
        fprintf(stderr, "input_load_buffer: invalid arguments\n");
        return CS_ERR;
    }

    for (i = 0; i < len; i++) {
        unsigned char ch = (unsigned char)data[i];

        if (ch == '\0') {
            fprintf(stderr, "input_load_buffer: NUL byte on line %d\n",
                    line_no + 1);
            return CS_ERR;
        }
        if (line_len + 1 >= sizeof(line)) {
            fprintf(stderr, "input_load_buffer: line %d too long\n",
                    line_no + 1);
            return CS_ERR;
        }

        line[line_len++] = (char)ch;
        if (ch == '\n') {
            line[line_len] = '\0';
            line_no++;
            if (parse_line(line, line_no, procs, &count, max_procs,
                           "input_load_buffer") != CS_OK) {
                return CS_ERR;
            }
            line_len = 0;
        }
    }

    if (line_len > 0) {
        line[line_len] = '\0';
        line_no++;
        if (parse_line(line, line_no, procs, &count, max_procs,
                       "input_load_buffer") != CS_OK) {
            return CS_ERR;
        }
    }

    if (count < 1) {
        fprintf(stderr, "input_load_buffer: no processes loaded\n");
        return CS_ERR;
    }
    if (input_validate(procs, count) != CS_OK) {
        return CS_ERR;
    }
    return count;
}

int input_load_sample(const char *name, Process *procs, int max_procs)
{
    if (name == NULL) {
        fprintf(stderr, "input_load_sample: sample name is NULL\n");
        return CS_ERR;
    }

    if (strcmp(name, "basic") == 0) {
        return load_sample_array(SAMPLE_BASIC, 4, procs, max_procs);
    }
    if (strcmp(name, "rr") == 0) {
        return load_sample_array(SAMPLE_RR, 3, procs, max_procs);
    }
    if (strcmp(name, "priority") == 0) {
        return load_sample_array(SAMPLE_PRIORITY, 5, procs, max_procs);
    }
    if (strcmp(name, "edge") == 0) {
        return load_sample_array(SAMPLE_EDGE, 1, procs, max_procs);
    }

    fprintf(stderr, "input_load_sample: unknown sample '%s'\n", name);
    return CS_ERR;
}
