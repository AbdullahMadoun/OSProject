CC := gcc
CSTD := -std=c11
WARN := -Wall -Wextra -Wpedantic
DEFS := -D_POSIX_C_SOURCE=200809L
INC := -Iinclude
CFLAGS := $(CSTD) $(WARN) $(DEFS) $(INC)
LDFLAGS := -lm

BIN := cpu_scheduler
TEST_BIN_DIR := build/tests

CORE_SRCS := \
	src/process.c \
	src/queue.c \
	src/input.c \
	src/sim_engine.c \
	src/metrics.c \
	src/visualization.c \
	src/schedulers/fcfs.c \
	src/schedulers/sjf.c \
	src/schedulers/rr.c \
	src/schedulers/priority.c

BIN_SRCS := src/main.c $(CORE_SRCS)

TEST_BINS := \
	$(TEST_BIN_DIR)/test_process \
	$(TEST_BIN_DIR)/test_queue \
	$(TEST_BIN_DIR)/test_input \
	$(TEST_BIN_DIR)/test_fcfs \
	$(TEST_BIN_DIR)/test_sjf \
	$(TEST_BIN_DIR)/test_rr \
	$(TEST_BIN_DIR)/test_priority \
	$(TEST_BIN_DIR)/test_metrics

.PHONY: all clean test test-c ml-tests

all: $(BIN)

$(BIN): $(BIN_SRCS)
	$(CC) $(CFLAGS) -o $@ $(BIN_SRCS) $(LDFLAGS)

$(TEST_BIN_DIR):
	mkdir -p $(TEST_BIN_DIR)

$(TEST_BIN_DIR)/test_process: tests/test_process.c src/process.c | \
	$(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_process.c src/process.c $(LDFLAGS)

$(TEST_BIN_DIR)/test_queue: tests/test_queue.c src/process.c src/queue.c | \
	$(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_queue.c src/process.c src/queue.c \
		$(LDFLAGS)

$(TEST_BIN_DIR)/test_input: tests/test_input.c src/process.c src/input.c | \
	$(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_input.c src/process.c src/input.c \
		$(LDFLAGS)

$(TEST_BIN_DIR)/test_fcfs: tests/test_fcfs.c src/process.c src/queue.c \
	src/sim_engine.c src/metrics.c src/schedulers/fcfs.c | \
	$(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_fcfs.c src/process.c src/queue.c \
		src/sim_engine.c src/metrics.c src/schedulers/fcfs.c $(LDFLAGS)

$(TEST_BIN_DIR)/test_sjf: tests/test_sjf.c src/process.c src/queue.c \
	src/sim_engine.c src/metrics.c src/schedulers/sjf.c | \
	$(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_sjf.c src/process.c src/queue.c \
		src/sim_engine.c src/metrics.c src/schedulers/sjf.c $(LDFLAGS)

$(TEST_BIN_DIR)/test_rr: tests/test_rr.c src/process.c src/queue.c \
	src/sim_engine.c src/metrics.c src/schedulers/rr.c | $(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_rr.c src/process.c src/queue.c \
		src/sim_engine.c src/metrics.c src/schedulers/rr.c $(LDFLAGS)

$(TEST_BIN_DIR)/test_priority: tests/test_priority.c src/process.c \
	src/queue.c src/sim_engine.c src/metrics.c src/schedulers/priority.c | \
	$(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_priority.c src/process.c src/queue.c \
		src/sim_engine.c src/metrics.c src/schedulers/priority.c \
		$(LDFLAGS)

$(TEST_BIN_DIR)/test_metrics: tests/test_metrics.c src/process.c \
	src/sim_engine.c src/metrics.c | $(TEST_BIN_DIR)
	$(CC) $(CFLAGS) -o $@ tests/test_metrics.c src/process.c \
		src/sim_engine.c src/metrics.c $(LDFLAGS)

test-c: $(TEST_BINS)
	./$(TEST_BIN_DIR)/test_process
	./$(TEST_BIN_DIR)/test_queue
	./$(TEST_BIN_DIR)/test_input
	./$(TEST_BIN_DIR)/test_fcfs
	./$(TEST_BIN_DIR)/test_sjf
	./$(TEST_BIN_DIR)/test_rr
	./$(TEST_BIN_DIR)/test_priority
	./$(TEST_BIN_DIR)/test_metrics

test: all test-c
	python3 -m pytest -q ml/tests

ml-tests:
	python3 -m pytest -q ml/tests

clean:
	rm -rf $(BIN) $(TEST_BIN_DIR) ml/__pycache__ ml/tests/__pycache__
