CC := gcc
CSTD := -std=c11
WARN := -Wall -Wextra -Wpedantic
DEFS := -D_POSIX_C_SOURCE=200809L
INC := -Iinclude
CFLAGS := $(CSTD) $(WARN) $(DEFS) $(INC)
LDFLAGS := -lm

BIN := cpu_scheduler
TEST_BIN_DIR := build/tests
FUZZ_BIN_DIR := build/fuzz
FUZZ_OUT_DIR := build/afl
FUZZ_SCRIPT := scripts/fuzz/run_baseline.sh
FUZZ_CC := afl-clang-fast

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
.PHONY: fuzz-build fuzz-build-asan fuzz-build-fast
.PHONY: fuzz-input fuzz-queue fuzz-cmin fuzz-tmin
.PHONY: fuzz-baseline-input fuzz-baseline-queue

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

$(FUZZ_BIN_DIR):
	mkdir -p $(FUZZ_BIN_DIR)

fuzz-build-asan: | $(FUZZ_BIN_DIR)
	AFL_USE_ASAN=1 AFL_USE_UBSAN=1 AFL_LLVM_LAF_ALL=1 \
	$(FUZZ_CC) $(CFLAGS) -o $(FUZZ_BIN_DIR)/fuzz_input \
		fuzz/fuzz_input.c src/input.c src/process.c $(LDFLAGS)
	AFL_USE_ASAN=1 AFL_USE_UBSAN=1 AFL_LLVM_LAF_ALL=1 \
	$(FUZZ_CC) $(CFLAGS) -o $(FUZZ_BIN_DIR)/fuzz_queue \
		fuzz/fuzz_queue.c src/process.c src/queue.c $(LDFLAGS)

fuzz-build-fast: | $(FUZZ_BIN_DIR)
	AFL_LLVM_LAF_ALL=1 \
	$(FUZZ_CC) $(CFLAGS) -o $(FUZZ_BIN_DIR)/fuzz_input \
		fuzz/fuzz_input.c src/input.c src/process.c $(LDFLAGS)
	AFL_LLVM_LAF_ALL=1 \
	$(FUZZ_CC) $(CFLAGS) -o $(FUZZ_BIN_DIR)/fuzz_queue \
		fuzz/fuzz_queue.c src/process.c src/queue.c $(LDFLAGS)

fuzz-build: fuzz-build-asan

fuzz-input: fuzz-build-asan
	afl-fuzz -m none -i fuzz/corpus/input -o $(FUZZ_OUT_DIR)/input \
		-x fuzz/dictionaries/workload.dict -- $(FUZZ_BIN_DIR)/fuzz_input

fuzz-queue: fuzz-build-asan
	afl-fuzz -m none -i fuzz/corpus/queue -o $(FUZZ_OUT_DIR)/queue \
		-- $(FUZZ_BIN_DIR)/fuzz_queue

fuzz-cmin: fuzz-build-fast
	afl-cmin -i $(FUZZ_OUT_DIR)/input/default/queue \
		-o $(FUZZ_OUT_DIR)/input-cmin -- $(FUZZ_BIN_DIR)/fuzz_input

fuzz-tmin: fuzz-build-asan
	@if [ -z "$(IN)" ]; then \
		echo "usage: make fuzz-tmin IN=path/to/crash OUT=path/to/minimized"; \
		exit 1; \
	fi
	@if [ -z "$(OUT)" ]; then \
		echo "usage: make fuzz-tmin IN=path/to/crash OUT=path/to/minimized"; \
		exit 1; \
	fi
	afl-tmin -i "$(IN)" -o "$(OUT)" -- $(FUZZ_BIN_DIR)/fuzz_input

fuzz-baseline-input: fuzz-build-asan
	bash $(FUZZ_SCRIPT) --target input --duration 600

fuzz-baseline-queue: fuzz-build-asan
	bash $(FUZZ_SCRIPT) --target queue --duration 600

clean:
	rm -rf $(BIN) $(TEST_BIN_DIR) $(FUZZ_BIN_DIR) ml/__pycache__ \
		ml/tests/__pycache__
