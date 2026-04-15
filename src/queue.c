#include "../include/queue.h"
#include <stdio.h>
#include <stdlib.h>

static int compare_with_tiebreak(HeapCmp cmp, const Process *a,
                                 const Process *b)
{
    int rc = 0;

    if (cmp != NULL) {
        rc = cmp(a, b);
    }
    if (rc != 0) {
        return rc;
    }
    if (a->arrival_time != b->arrival_time) {
        return a->arrival_time - b->arrival_time;
    }
    return a->pid - b->pid;
}

static void heap_swap(Process **a, Process **b)
{
    Process *tmp = *a;
    *a = *b;
    *b = tmp;
}

void fifo_init(FIFOQueue *q)
{
    if (q == NULL) {
        return;
    }
    q->head = NULL;
    q->tail = NULL;
    q->size = 0;
}

void fifo_enqueue(FIFOQueue *q, Process *p)
{
    QNode *node;

    if (q == NULL || p == NULL) {
        return;
    }

    node = malloc(sizeof(*node));
    if (node == NULL) {
        fprintf(stderr, "fifo_enqueue: malloc failed\n");
        exit(1);
    }

    node->proc = p;
    node->next = NULL;

    if (q->tail != NULL) {
        q->tail->next = node;
    } else {
        q->head = node;
    }

    q->tail = node;
    q->size++;
}

Process *fifo_dequeue(FIFOQueue *q)
{
    Process *proc;
    QNode *node;

    if (q == NULL || q->head == NULL) {
        return NULL;
    }

    node = q->head;
    proc = node->proc;
    q->head = node->next;
    if (q->head == NULL) {
        q->tail = NULL;
    }
    q->size--;
    free(node);
    return proc;
}

int fifo_is_empty(const FIFOQueue *q)
{
    return q == NULL || q->size == 0;
}

void fifo_destroy(FIFOQueue *q)
{
    if (q == NULL) {
        return;
    }
    while (!fifo_is_empty(q)) {
        (void)fifo_dequeue(q);
    }
}

int fifo_snapshot(const FIFOQueue *q, int *out, int max)
{
    const QNode *node;
    int count = 0;

    if (q == NULL || out == NULL || max <= 0) {
        return 0;
    }

    node = q->head;
    while (node != NULL && count < max) {
        out[count++] = node->proc->pid;
        node = node->next;
    }
    return count;
}

void heap_init(MinHeap *h, HeapCmp cmp)
{
    if (h == NULL) {
        return;
    }
    h->size = 0;
    h->cmp = cmp;
}

void heap_insert(MinHeap *h, Process *p)
{
    int idx;

    if (h == NULL || p == NULL) {
        return;
    }
    if (h->size >= MAX_PROCESSES) {
        fprintf(stderr, "heap_insert: heap capacity exceeded\n");
        exit(1);
    }

    idx = h->size++;
    h->data[idx] = p;

    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (compare_with_tiebreak(h->cmp, h->data[idx],
                                  h->data[parent]) >= 0) {
            break;
        }
        heap_swap(&h->data[idx], &h->data[parent]);
        idx = parent;
    }
}

Process *heap_peek(const MinHeap *h)
{
    if (h == NULL || h->size == 0) {
        return NULL;
    }
    return h->data[0];
}

Process *heap_extract(MinHeap *h)
{
    Process *top;
    int idx = 0;

    if (h == NULL || h->size == 0) {
        return NULL;
    }

    top = h->data[0];
    h->size--;
    if (h->size == 0) {
        return top;
    }

    h->data[0] = h->data[h->size];
    while (1) {
        int left = (2 * idx) + 1;
        int right = left + 1;
        int smallest = idx;

        if (left < h->size &&
            compare_with_tiebreak(h->cmp, h->data[left],
                                  h->data[smallest]) < 0) {
            smallest = left;
        }
        if (right < h->size &&
            compare_with_tiebreak(h->cmp, h->data[right],
                                  h->data[smallest]) < 0) {
            smallest = right;
        }
        if (smallest == idx) {
            break;
        }
        heap_swap(&h->data[idx], &h->data[smallest]);
        idx = smallest;
    }

    return top;
}

int heap_is_empty(const MinHeap *h)
{
    return h == NULL || h->size == 0;
}

int heap_snapshot(const MinHeap *h, int *out, int max)
{
    int i;
    int count;

    if (h == NULL || out == NULL || max <= 0) {
        return 0;
    }

    count = (h->size < max) ? h->size : max;
    for (i = 0; i < count; i++) {
        out[i] = h->data[i]->pid;
    }
    return count;
}

int cmp_burst_time(const Process *a, const Process *b)
{
    return a->burst_time - b->burst_time;
}

int cmp_priority(const Process *a, const Process *b)
{
    return a->priority - b->priority;
}
