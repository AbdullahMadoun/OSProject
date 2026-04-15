#ifndef CONFIG_H
#define CONFIG_H

#define MAX_PROCESSES 256
#define MAX_GANTT_ENTRIES 4096
#define MAX_LINE_LEN 256
#define MAX_LABEL_LEN 64

#define DEFAULT_QUANTUM 2
#define DEFAULT_CTX_OVERHEAD 0

#define GANTT_UNIT_WIDTH 2
#define GANTT_TICK_INTERVAL 5

#define ANSI_RESET "\033[0m"
#define ANSI_BOLD "\033[1m"
#define ANSI_RED "\033[31m"
#define ANSI_GREEN "\033[32m"
#define ANSI_YELLOW "\033[33m"
#define ANSI_BLUE "\033[34m"
#define ANSI_MAGENTA "\033[35m"
#define ANSI_CYAN "\033[36m"
#define ANSI_WHITE "\033[37m"

#define ML_SOCKET_PATH "/tmp/cpu_scheduler_predict.sock"
#define ML_MODEL_PATH "ml/tabpfn_models.pkl"
#define ML_JSON_BUFSIZE 1024

#define CS_OK 0
#define CS_ERR -1

#endif /* CONFIG_H */
