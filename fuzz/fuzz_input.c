#include "../include/input.h"
#include <stdio.h>

int main(void)
{
    char buf[8192];
    int ch;
    size_t len = 0;
    Process procs[MAX_PROCESSES];

    while ((ch = getchar()) != EOF) {
        if (len < sizeof(buf)) {
            buf[len++] = (char)ch;
        }
    }

    (void)input_load_buffer(buf, len, procs, MAX_PROCESSES);
    return 0;
}
