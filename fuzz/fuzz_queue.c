#include "../include/process.h"
#include "../include/queue.h"
#include <stdio.h>

int main(void)
{
    unsigned char buf[4096];
    size_t nread;
    FIFOQueue q;
    MinHeap h;
    Process procs[32];
    int next_proc = 0;
    size_t i;

    for (i = 0; i < 32; i++) {
        process_init(&procs[i], (int)i + 1, (int)i % 7,
                     ((int)i % 5) + 1, (int)i % 4);
    }

    fifo_init(&q);
    heap_init(&h, cmp_burst_time);
    nread = fread(buf, 1, sizeof(buf), stdin);

    for (i = 0; i < nread; i++) {
        unsigned char op = buf[i] % 6;

        switch (op) {
        case 0:
            fifo_enqueue(&q, &procs[next_proc % 32]);
            next_proc++;
            break;
        case 1:
            (void)fifo_dequeue(&q);
            break;
        case 2:
            heap_insert(&h, &procs[next_proc % 32]);
            next_proc++;
            break;
        case 3:
            (void)heap_extract(&h);
            break;
        case 4:
            (void)heap_peek(&h);
            break;
        default:
            (void)fifo_is_empty(&q);
            break;
        }
    }

    fifo_destroy(&q);
    return 0;
}
