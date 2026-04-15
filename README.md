# CPU Scheduler

## Critical Status

This repository is not finished enough to treat as "guaranteed correct" or
submission-ready. The current state is useful, tested, and pushable, but it
still has material gaps:

- The passing test suite only proves the executed cases passed. It does not
  prove the scheduler is impossible to break on unseen inputs.
- The zero-leak requirement is still unproven because `valgrind` was not
  available in the WSL environment used for verification.
- AFL++ fuzzing was not actually run. The harnesses exist and compile, but no
  real fuzz campaign has been executed with coverage, ASAN, or UBSAN.
- The ML layer is not yet a fully validated official TabPFN client workflow.
  The current committed model artifact was produced for smoke testing, not as a
  high-confidence trained predictive layer.
- The official `tabpfn-client` access-token path was installed, but it has not
  been fully validated end-to-end here against a live authenticated session.
- The current dataset and model artifacts are tiny smoke-test outputs, not a
  serious training corpus or a trustworthy benchmark.
- The project was implemented against the provided directive, but it has not
  been cross-audited line-by-line against the original course PDF in this repo.
- Visualization was functionally exercised, but not deeply validated across
  terminal types or large workloads.

If this is going to be submitted or presented as final, those gaps should be
closed first.

CPU scheduling simulator for FCFS, SJF, Round Robin, and non-preemptive
priority scheduling, with CSV export and an optional TabPFN-based prediction
layer.

## Build

```sh
make
```

## C Tests

```sh
make test-c
```

## Python Setup

```sh
python3 -m pip install -r requirements.txt
```

## Python Tests

```sh
pytest -q ml/tests
```

## Run

```sh
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
```
