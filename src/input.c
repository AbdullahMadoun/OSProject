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

int input_load_file(const char *filepath, Process *procs, int max_procs)
{
    FILE *fp;
    char line[MAX_LINE_LEN];
    int count = 0;
    int line_no = 0;

    if (filepath == NULL || procs == NULL || max_procs < 1) {
        fprintf(stderr, "input_load_file: invalid arguments\n");
        return CS_ERR;
    }

    fp = fopen(filepath, "r");
    if (fp == NULL) {
        fprintf(stderr, "input_load_file: failed to open '%s'\n", filepath);
        return CS_ERR;
    }

    while (fgets(line, sizeof(line), fp) != NULL) {
        char *trimmed;
        int pid;
        int arrival;
        int burst;
        int priority;
        char extra;

        line_no++;
        trimmed = skip_ws(line);
        if (*trimmed == '\0' || *trimmed == '\n' || *trimmed == '#') {
            continue;
        }
        if (count >= max_procs) {
            fprintf(stderr, "input_load_file: too many processes\n");
            fclose(fp);
            return CS_ERR;
        }

        if (sscanf(trimmed, "%d %d %d %d %c", &pid, &arrival, &burst,
                   &priority, &extra) != 4) {
            fprintf(stderr, "input_load_file: parse error on line %d\n",
                    line_no);
            fclose(fp);
            return CS_ERR;
        }

        process_init(&procs[count], pid, arrival, burst, priority);
        count++;
    }

    fclose(fp);

    if (count < 1) {
        fprintf(stderr, "input_load_file: no processes loaded\n");
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
