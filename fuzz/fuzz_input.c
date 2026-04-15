#include "../include/input.h"
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void)
{
    char template[] = "/tmp/cs_fuzz_input_XXXXXX";
    FILE *tmp;
    int fd;
    int ch;
    Process procs[MAX_PROCESSES];

    fd = mkstemp(template);
    if (fd < 0) {
        return 1;
    }

    tmp = fdopen(fd, "w");
    if (tmp == NULL) {
        close(fd);
        unlink(template);
        return 1;
    }

    while ((ch = getchar()) != EOF) {
        fputc(ch, tmp);
    }
    fclose(tmp);

    (void)input_load_file(template, procs, MAX_PROCESSES);
    unlink(template);
    return 0;
}
