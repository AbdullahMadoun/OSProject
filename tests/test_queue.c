#include "minunit.h"
#include "../include/queue.h"

static void suite_fifo_order(void)
{
    FIFOQueue q;
    Process p[4];
    int i;

    fifo_init(&q);
    mu_assert("empty on init", fifo_is_empty(&q));

    for (i = 0; i < 4; i++) {
        process_init(&p[i], i + 1, i, 5, 0);
    }

    fifo_enqueue(&q, &p[0]);
    fifo_enqueue(&q, &p[1]);
    fifo_enqueue(&q, &p[2]);
    fifo_enqueue(&q, &p[3]);
    mu_assert_int_eq("size 4", 4, q.size);

    for (i = 0; i < 4; i++) {
        mu_assert_int_eq("FIFO order", i + 1, fifo_dequeue(&q)->pid);
    }

    mu_assert("empty after drain", fifo_is_empty(&q));
    mu_assert("dequeue empty = NULL", fifo_dequeue(&q) == NULL);
    fifo_destroy(&q);
}

static void suite_fifo_snapshot(void)
{
    FIFOQueue q;
    Process p[3];
    int out[3];
    int n;
    int i;

    fifo_init(&q);
    for (i = 0; i < 3; i++) {
        process_init(&p[i], i + 10, 0, 1, 0);
    }

    fifo_enqueue(&q, &p[0]);
    fifo_enqueue(&q, &p[1]);
    fifo_enqueue(&q, &p[2]);

    n = fifo_snapshot(&q, out, 3);
    mu_assert_int_eq("snapshot count", 3, n);
    mu_assert_int_eq("snap[0]=10", 10, out[0]);
    mu_assert_int_eq("snap[1]=11", 11, out[1]);
    mu_assert_int_eq("snap[2]=12", 12, out[2]);
    fifo_destroy(&q);
}

static void suite_heap_burst_order(void)
{
    MinHeap h;
    int bursts[] = {8, 3, 5, 1, 6};
    Process p[5];
    int i;
    int prev = -1;

    heap_init(&h, cmp_burst_time);
    for (i = 0; i < 5; i++) {
        process_init(&p[i], i + 1, 0, bursts[i], 0);
        heap_insert(&h, &p[i]);
    }

    while (!heap_is_empty(&h)) {
        int b = heap_extract(&h)->burst_time;
        mu_assert("burst ascending", b >= prev);
        prev = b;
    }
}

static void suite_heap_priority_order(void)
{
    MinHeap h;
    int pris[] = {4, 1, 3, 2};
    Process p[4];
    int i;

    heap_init(&h, cmp_priority);
    for (i = 0; i < 4; i++) {
        process_init(&p[i], i + 1, 0, 5, pris[i]);
        heap_insert(&h, &p[i]);
    }

    mu_assert_int_eq("priority 1 extracted first", 1,
                     heap_extract(&h)->priority);
    mu_assert_int_eq("priority 2 next", 2, heap_extract(&h)->priority);
}

static void suite_heap_tiebreak(void)
{
    MinHeap h;
    Process p[3];

    heap_init(&h, cmp_burst_time);
    process_init(&p[0], 3, 0, 5, 0);
    process_init(&p[1], 1, 0, 5, 0);
    process_init(&p[2], 2, 0, 5, 0);

    heap_insert(&h, &p[0]);
    heap_insert(&h, &p[1]);
    heap_insert(&h, &p[2]);

    mu_assert_int_eq("lowest pid first", 1, heap_extract(&h)->pid);
    mu_assert_int_eq("pid 2 second", 2, heap_extract(&h)->pid);
    mu_assert_int_eq("pid 3 last", 3, heap_extract(&h)->pid);
}

int main(void)
{
    mu_suite(suite_fifo_order);
    mu_suite(suite_fifo_snapshot);
    mu_suite(suite_heap_burst_order);
    mu_suite(suite_heap_priority_order);
    mu_suite(suite_heap_tiebreak);
    mu_summary();
}
