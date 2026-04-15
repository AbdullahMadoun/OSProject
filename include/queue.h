#ifndef QUEUE_H
#define QUEUE_H

#include "process.h"

typedef struct QNode {
    Process *proc;
    struct QNode *next;
} QNode;

typedef struct {
    QNode *head;
    QNode *tail;
    int size;
} FIFOQueue;

/** Initialize the FIFO queue to the empty state. */
void fifo_init(FIFOQueue *q);

/** Append a process to the tail of the FIFO queue. */
void fifo_enqueue(FIFOQueue *q, Process *p);

/** Remove and return the process at the head of the queue. */
Process *fifo_dequeue(FIFOQueue *q);

/** Return non-zero if the FIFO queue is empty. */
int fifo_is_empty(const FIFOQueue *q);

/** Free all internal queue nodes without freeing the Process objects. */
void fifo_destroy(FIFOQueue *q);

/** Snapshot up to max PIDs from head to tail into out. */
int fifo_snapshot(const FIFOQueue *q, int *out, int max);

/** Return <0 if a should come before b, >0 if b before a, 0 if equal. */
typedef int (*HeapCmp)(const Process *a, const Process *b);

typedef struct {
    Process *data[MAX_PROCESSES];
    int size;
    HeapCmp cmp;
} MinHeap;

/** Initialize the min-heap with the provided comparator. */
void heap_init(MinHeap *h, HeapCmp cmp);

/** Insert a process into the min-heap. */
void heap_insert(MinHeap *h, Process *p);

/** Return the minimum element without removing it, or NULL if empty. */
Process *heap_peek(const MinHeap *h);

/** Remove and return the minimum element, or NULL if empty. */
Process *heap_extract(MinHeap *h);

/** Return non-zero if the heap is empty. */
int heap_is_empty(const MinHeap *h);

/** Snapshot up to max PIDs in heap order into out. */
int heap_snapshot(const MinHeap *h, int *out, int max);

/** Comparator for burst time with required tie-break behavior. */
int cmp_burst_time(const Process *a, const Process *b);

/** Comparator for priority with required tie-break behavior. */
int cmp_priority(const Process *a, const Process *b);

#endif /* QUEUE_H */
