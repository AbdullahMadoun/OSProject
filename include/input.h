#ifndef INPUT_H
#define INPUT_H

#include "process.h"
#include <stddef.h>

/** Parse a workload text file into procs and return the loaded count. */
int input_load_file(const char *filepath, Process *procs, int max_procs);

/**
 * Parse a workload payload from memory.
 *
 * The payload format matches input_load_file(). Data does not need to be
 * NUL-terminated because len is explicit.
 */
int input_load_buffer(const char *data, size_t len, Process *procs,
                      int max_procs);

/** Load a compiled-in sample workload by name. */
int input_load_sample(const char *name, Process *procs, int max_procs);

/** Validate an already-loaded process array. */
int input_validate(const Process *procs, int n);

#endif /* INPUT_H */
