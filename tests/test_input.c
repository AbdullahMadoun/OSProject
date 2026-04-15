#include "minunit.h"
#include "../include/input.h"
#include <stdio.h>
#include <string.h>

#define TMPFILE "/tmp/cs_test_workload.txt"

static void write_tmp(const char *content)
{
    FILE *f = fopen(TMPFILE, "w");

    if (!f) {
        perror("fopen");
        return;
    }

    fputs(content, f);
    fclose(f);
}

static void suite_valid(void)
{
    Process p[10];
    int n;

    write_tmp("# header comment\n"
              "1  0  5  2\n"
              "2  1  3  1\n"
              "3  4  8  3\n");
    n = input_load_file(TMPFILE, p, 10);

    mu_assert_int_eq("3 processes", 3, n);
    mu_assert_int_eq("P1 pid", 1, p[0].pid);
    mu_assert_int_eq("P1 arrival", 0, p[0].arrival_time);
    mu_assert_int_eq("P1 burst", 5, p[0].burst_time);
    mu_assert_int_eq("P1 priority", 2, p[0].priority);
    mu_assert_int_eq("P1 remaining==burst", 5, p[0].remaining_time);
    mu_assert_int_eq("P3 burst", 8, p[2].burst_time);
}

static void suite_reject_negative_burst(void)
{
    Process p[10];
    int n;

    write_tmp("1 0 -3 0\n");
    n = input_load_file(TMPFILE, p, 10);
    mu_assert("negative burst rejected", n == CS_ERR || n == 0);
}

static void suite_reject_zero_burst(void)
{
    Process p[10];
    int n;

    write_tmp("1 0 0 0\n");
    n = input_load_file(TMPFILE, p, 10);
    mu_assert("zero burst rejected", n == CS_ERR || n == 0);
}

static void suite_reject_duplicate_pid(void)
{
    Process p[10];
    int n;

    write_tmp("1 0 5 0\n1 2 3 0\n");
    n = input_load_file(TMPFILE, p, 10);
    mu_assert("duplicate pid rejected", n == CS_ERR);
}

static void suite_comments_and_blanks(void)
{
    Process p[10];
    int n;

    write_tmp("\n# skip\n  \n1 0 4 0\n\n# skip2\n2 1 2 0\n");
    n = input_load_file(TMPFILE, p, 10);
    mu_assert_int_eq("2 procs, skipped blanks/comments", 2, n);
}

static void suite_samples(void)
{
    Process p[MAX_PROCESSES];

    mu_assert("basic", input_load_sample("basic", p, MAX_PROCESSES) > 0);
    mu_assert("rr", input_load_sample("rr", p, MAX_PROCESSES) > 0);
    mu_assert("priority",
              input_load_sample("priority", p, MAX_PROCESSES) > 0);
    mu_assert("edge", input_load_sample("edge", p, MAX_PROCESSES) > 0);
    mu_assert("unknown",
              input_load_sample("unknown", p, MAX_PROCESSES) == CS_ERR);
}

static void suite_buffer_valid(void)
{
    const char *payload =
        "# header\n"
        "1 0 5 2\n"
        "2 1 3 1\n";
    Process p[10];
    int n = input_load_buffer(payload, strlen(payload), p, 10);

    mu_assert_int_eq("buffer valid count", 2, n);
    mu_assert_int_eq("buffer p1 pid", 1, p[0].pid);
    mu_assert_int_eq("buffer p2 burst", 3, p[1].burst_time);
}

static void suite_buffer_rejects_nul(void)
{
    char payload[] = {'1', ' ', '0', ' ', '5', ' ', '0', '\0', '\n'};
    Process p[10];
    int n = input_load_buffer(payload, sizeof(payload), p, 10);

    mu_assert("buffer rejects NUL", n == CS_ERR);
}

static void suite_buffer_rejects_extra_token(void)
{
    const char *payload = "1 0 5 0 x\n";
    Process p[10];
    int n = input_load_buffer(payload, strlen(payload), p, 10);

    mu_assert("buffer rejects extra token", n == CS_ERR);
}

int main(void)
{
    mu_suite(suite_valid);
    mu_suite(suite_reject_negative_burst);
    mu_suite(suite_reject_zero_burst);
    mu_suite(suite_reject_duplicate_pid);
    mu_suite(suite_comments_and_blanks);
    mu_suite(suite_samples);
    mu_suite(suite_buffer_valid);
    mu_suite(suite_buffer_rejects_nul);
    mu_suite(suite_buffer_rejects_extra_token);
    mu_summary();
}
