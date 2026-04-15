#ifndef PROCESS_H
#define PROCESS_H

#include "config.h"

/** Every possible state a simulated process can occupy. */
typedef enum {
    STATE_NEW = 0,
    STATE_READY = 1,
    STATE_RUNNING = 2,
    STATE_TERMINATED = 3
} ProcessState;

/**
 * Complete descriptor for one simulated process.
 * Fields prefixed with sim_ are set during simulation; all others are set at
 * load time and must not be mutated by schedulers except remaining_time and
 * state.
 */
typedef struct {
    int pid;
    int arrival_time;
    int burst_time;
    int priority;

    int remaining_time;
    ProcessState state;

    int sim_start_time;
    int sim_completion_time;
    int sim_waiting_time;
    int sim_turnaround_time;
    int sim_response_time;
} Process;

/** Initialize all fields to safe defaults. Must be called before use. */
void process_init(Process *p, int pid, int arrival, int burst, int priority);

/**
 * Reset only simulation-output fields so the same process array can be reused
 * for another algorithm run.
 */
void process_reset(Process *p);

/** Human-readable state label. Never returns NULL. */
const char *process_state_str(ProcessState s);

#endif /* PROCESS_H */
