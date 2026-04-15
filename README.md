# CPU Scheduler

## Critical Status

This repository is not finished enough to treat as "guaranteed correct" or
submission-ready. The current state is useful, tested, and pushable, but it
still has material gaps:

- The passing test suite only proves the executed cases passed. It does not
  prove the scheduler is impossible to break on unseen inputs.
- The zero-leak requirement is still unproven because `valgrind` was not
  available in the WSL environment used for verification.
- AFL++ campaigns have not been executed yet. The harnesses, starter corpora,
  and strategy below are now in place, but no real coverage run has been
  validated with ASAN or UBSAN.
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

## TabPFN Client Setup

For the official `tabpfn-client` path, initialize and cache a token once:

```sh
python3 ml/init_tabpfn_client.py
```

Then train with the official client explicitly:

```sh
python3 ml/train.py --backend tabpfn-client
```

If no token is available, `python3 ml/train.py --backend auto` will fall back
to a dummy regressor for smoke testing only.

## Python Tests

```sh
pytest -q ml/tests
```

## Run

```sh
./cpu_scheduler -s basic -a all
./cpu_scheduler -f workloads/sample_rr.txt -a rr -q 4
```

## Fuzzing

This section is intentionally conceptual first and tool second. The repo has
`AFL++`-style harnesses today, but the goal here is to understand why fuzzing
works, what makes a target high-yield, and how to build a seed strategy that
fits this project instead of copying generic advice.

The recommendations in this section were cross-checked against primary sources
on April 15, 2026. See `References` at the end.

### What Fuzzing Is

Fuzzing is a dynamic testing technique: you run real code with many generated
inputs and look for executions that violate a correctness policy. That policy
can be "the program must not crash", but in serious campaigns it is usually
broader: no sanitizer finding, no assertion failure, no invariant violation,
and no semantic disagreement with another implementation.

Compared with unit tests:

- Unit tests are example-based. You hand-pick inputs and expected outputs.
- Fuzzing is search-based. You define a target plus an oracle, then let the
  fuzzer explore a much larger input space automatically.
- Unit tests are good at pinning down known behavior. Fuzzing is good at
  finding the weird corners you did not think to write by hand.

Compared with property-based testing:

- Property-based testing also generates many inputs, but it usually starts from
  a developer-written generator that tries to stay inside the intended domain.
- Fuzzing is more willing to explore malformed or only partly valid inputs.
- The techniques overlap heavily. A property can be the oracle for a fuzzer,
  and a fuzz campaign can use generators or grammars.

Concrete example:

- `tests/test_input.c` checks a few known cases for `input_load_file()`.
- A parser fuzz target for the same function keeps generating workloads such as
  empty files, truncated lines, duplicated PIDs, huge integers, comment-only
  files, and almost-valid workloads with one mutated field.

Rule of thumb:

- Unit tests prove the examples you wrote; fuzzing explores the examples you
  forgot.

### Black-Box, Grey-Box, and White-Box

Black-box fuzzing treats the program like a closed box. It sees only coarse
outcomes such as crash, timeout, or exit status. It is simple and portable, but
it wastes effort because it has little signal about whether a mutation made
progress.

Grey-box fuzzing adds lightweight runtime feedback, usually code coverage or
comparison information. It does not reason symbolically about the whole
program; it just asks, "did this input reach a new edge, block, or branch?"
That small amount of feedback is enough to guide mutation strongly.

White-box fuzzing uses much richer program knowledge, often symbolic execution,
constraint solving, or path reasoning. It can solve difficult checks, but it is
far more expensive and harder to scale.

Grey-box coverage-guided fuzzing became dominant in practice because it hits
the best throughput-to-guidance tradeoff:

- Black-box fuzzing is fast but too blind on structured targets.
- White-box fuzzing is smart but expensive and brittle.
- Grey-box fuzzing keeps the execution rate high while still learning where new
  behavior lies.

Concrete example:

- For `src/input.c`, a black-box fuzzer would keep trying random bytes and see
  mostly parse errors.
- A grey-box fuzzer notices that some seeds reach deeper validation logic,
  preserve those seeds, and mutates them more heavily.
- A white-box system could in principle solve the parser's branch conditions,
  but that extra machinery is not justified for a parser this small.

Rule of thumb:

- If you can instrument the target cheaply, use grey-box fuzzing first.

### Mutation-Based, Generative, and Hybrid Fuzzing

Mutation-based fuzzing starts from one or more seed inputs and mutates them:
bit flips, byte flips, insertions, deletions, splicing, integer arithmetic,
dictionary token insertion, and so on. It is easy to deploy and very effective
when seeds already exercise meaningful structure.

Generative fuzzing synthesizes inputs from a grammar, model, or generator. It
is strongest when the format is deeply structured and random mutation spends
most of its time being rejected by the parser.

Modern systems often combine them:

- Generate a mostly valid structure.
- Mutate the boundary fields, lengths, counts, magic values, and state
  transitions that are most likely to expose bugs.

Concrete example:

- A generator for this project could emit valid workload lines of the form
  `pid arrival burst priority`.
- Mutation then flips specific fields to `0`, `-1`, duplicate values, very
  large values, extra tokens, or truncated lines.

Rule of thumb:

- If the target rejects almost everything near the parser front door, add
  structure. If it already accepts a fair amount of mutated input, mutation is
  usually enough.

### Target Selection

Good fuzz targets are code paths that consume attacker-controlled input and can
be driven cheaply and deterministically. In practice this usually means:

- parsers
- decoders
- protocol handlers
- format converters
- archive readers
- image or media libraries
- state machines that consume untrusted bytes

Library-style APIs and in-process targets are preferred over full CLI programs
because they are faster, easier to reset, and easier to reason about. A fuzzer
wants to spend CPU time inside the target logic, not in process startup, option
parsing, terminal printing, or unrelated I/O.

For this repository, the target ranking is:

1. `src/input.c` via `fuzz/fuzz_input.c`
2. `src/queue.c` via `fuzz/fuzz_queue.c`
3. A future in-process scheduler invariant harness that fuzzes `schedule()`
   directly

Why `input_load_file()` is the best current target:

- It consumes attacker-controlled text.
- It has parsing and validation logic.
- It handles integers, whitespace, comments, malformed lines, and duplicate
  identifiers.
- Parsers are classic high-yield fuzz targets.

Why `queue.c` is secondary:

- It is simpler and less input-shaped.
- The current harness is mostly a stateful API exerciser, which is useful, but
  less likely than the parser to expose realistic input-validation mistakes.

What is low-yield here:

- Fuzzing `src/main.c` as a whole CLI.
- Fuzzing visualization output.
- Fuzzing the ML socket path as part of the hot loop.

Those paths add startup cost, side effects, and non-essential complexity.

Concrete example:

- Fuzz `input_load_file()` directly, not `./cpu_scheduler -f fuzzed.txt -a rr`.

Rule of thumb:

- Fuzz the narrowest boundary that still consumes untrusted input.

### Seed Corpus Fundamentals

A seed corpus is the initial set of inputs from which a mutational fuzzer
starts. Seed quality matters because the first seeds define the early search
space. A strong corpus reaches distinct code regions with as little redundancy
as possible.

Research and industrial practice both point to the same broad lesson: a small,
coverage-optimized corpus often outperforms a huge redundant corpus. Large
corpora look comforting, but they slow calibration, synchronization, trimming,
and mutation scheduling while repeatedly mutating near-duplicate inputs.

For this repository, the right answer is not "more workload files". The parser
format is simple, so a tiny, intentional corpus beats a giant pile of similar
text files.

This repo now includes starter corpora:

- `fuzz/corpus/input/`
- `fuzz/corpus/queue/`
- `fuzz/dictionaries/workload.dict`

The parser starter corpus is deliberately mixed:

- real valid workloads from the project shape
- tiny synthetic valid inputs
- edge-case valid formatting
- invalid but near-valid workloads
- empty and comment-only files
- boundary integers

Concrete example:

- `fuzz/corpus/input/00_valid_minimal.txt` reaches the basic happy path.
- `07_invalid_duplicate_pid.txt` forces validation logic.
- `10_invalid_extra_token.txt` exercises strict parsing.
- `11_boundary_ints.txt` is useful because integer boundaries are often where
  parser assumptions fail.

Rule of thumb:

- Prefer diverse behavior over large file counts.

### Building a Practical Seed Corpus

Build seed corpora in this order:

1. Collect real valid inputs from tests, fixtures, samples, and production-like
   examples.
2. Add tiny synthetic inputs that each exercise one specific feature.
3. Add edge cases: empty, one-line, max-ish values, duplicated identifiers,
   truncated records, malformed suffixes, odd whitespace, and comments.
4. Minimize the corpus while preserving coverage.

For this repository, a good parser corpus comes from:

- `workloads/sample_basic.txt`
- `workloads/sample_rr.txt`
- `workloads/sample_priority.txt`
- `workloads/sample_edge.txt`
- `tests/test_input.c`
- small handcrafted files in `fuzz/corpus/input/`

Recommended seed categories for `input_load_file()`:

- Valid one-process workload
- Valid multi-process workload
- Same-arrival workloads
- Whitespace-heavy workloads
- Empty file
- Comment-only file
- Missing field
- Duplicate PID
- Zero burst
- Negative arrival or priority
- Extra trailing token
- Boundary integer values

Recommended seed categories for `fuzz_queue.c`:

- Empty input
- Mostly enqueue/dequeue
- Mostly heap operations
- Mixed FIFO and heap activity

Concrete example:

- For the parser, one seed should exist solely to prove that blank lines and
  comments are skipped without accidentally suppressing the next real process.

Rule of thumb:

- Every seed should have a reason to exist. If you cannot state the branch or
  behavior it contributes, it probably does not belong in the corpus.

### Corpus Minimization

After collecting seeds, minimize them. Minimization keeps the smallest set of
inputs that still preserves the observable behavior you care about, usually
coverage.

Tool examples:

- `afl-cmin` for AFL++
- `-merge=1` for libFuzzer-style harnesses

For the current parser harness:

```sh
afl-cmin -i fuzz/corpus/input -o build/cmin-input -- build/fuzz/fuzz_input
```

For a future `libFuzzer`-style in-process harness:

```sh
mkdir -p build/cmin-input
./fuzz_input_libfuzzer -merge=1 build/cmin-input fuzz/corpus/input
```

Why minimization matters:

- fewer files to calibrate
- fewer redundant mutations
- faster synchronization across workers
- higher useful exec/sec

Concrete example:

- Ten near-identical valid workload files are usually worse than three files
  that separately cover comments, valid records, and validation failures.

Rule of thumb:

- Minimize before long campaigns and minimize again after the corpus grows.

### Why More Files Is Not Always Better

A large redundant corpus slows fuzzing in at least three ways:

- More startup and calibration work
- More time spent mutating inputs that explore the same behavior
- More synchronization overhead in multi-worker campaigns

This is especially important in this project because the parser grammar is
small. Hundreds of similar text files mostly mean hundreds of ways to spend CPU
time rediscovering the same parser path.

Concrete example:

- A thousand workload files scraped from a generator are inferior to a minimized
  corpus that isolates the handful of features the parser actually distinguishes.

Rule of thumb:

- Big corpora are raw material, not the finished product.

### Mutation Strategies

Common mutation operators include:

- bit flips
- byte flips
- byte insertion and deletion
- block duplication
- splicing two seeds together
- arithmetic on integer fields
- dictionary-based token insertion

Coverage-guided fuzzing uses feedback to decide which mutated inputs are worth
keeping and which seeds deserve more energy. Inputs that hit new edges or other
interesting instrumentation signals stay in the corpus; the rest are discarded.

For this parser, the most useful mutations are not exotic:

- changing digits inside integer fields
- adding or removing whitespace
- inserting `#`
- truncating after the third integer
- duplicating a whole valid line
- appending an extra token to an otherwise valid line

The queue target is much less structured. There, tiny byte-level mutations can
already rearrange operation sequences enough to matter.

Concrete example:

- Start from `1 0 5 2\n` and mutate only one field to produce
  `1 0 0 2\n`, `1 -1 5 2\n`, `1 0 5 2 x\n`, or two copies of the same line.

Rule of thumb:

- On text formats, mutate the syntax boundaries, not just random interior bits.

### Grammar- or Model-Based Fuzzing

Grammar- or model-based fuzzing becomes valuable when the target expects a rich
structure and blind mutation rarely reaches beyond the format checks. A grammar
lets the fuzzer produce syntactically valid skeletons; a model can encode
relationships such as length fields, state transitions, or checksums.

This repository's workload format is simple enough that heavy grammar machinery
is optional, not mandatory. The parser accepts four whitespace-separated
integers plus comments and blank lines. That is easy to express with a tiny
generator if needed, but the current mutation-based strategy should already go
far.

Where generation would help here is a future scheduler harness:

- generate arrays of `Process`
- keep them valid enough to run through `schedule()`
- then mutate arrival ties, identical bursts, quantum values, and priority
  distributions around interesting boundaries

Concrete example:

- Generate a valid 5-process Round Robin workload, then mutate only one field
  so that two processes share the same arrival time and one has a burst of `1`.

Rule of thumb:

- Invest in generators when deep logic is gated behind structure, not when the
  structure is already trivial.

### Hybrid Seed Strategy for This Repository

The best seed plan for this project is hybrid:

- Start with a tiny, curated, mostly valid parser corpus.
- Include a few intentionally invalid near-miss seeds.
- Use a small dictionary for parser syntax.
- Periodically minimize.
- Run one short empty-seed side campaign as a shallow-bug probe, but do not use
  empty seed as the main parser strategy.

Why the empty seed is not the main answer here:

- `input_load_file()` consumes a structured text format.
- Valid line shapes help reach deeper validation and error-handling branches.
- Empty seed may still quickly expose shallow no-input bugs, but it should be a
  side experiment, not the long campaign.

What to do in practice:

1. Main parser campaign: minimized curated corpus.
2. Short parser side campaign: empty seed only.
3. Queue campaign: tiny corpus or even empty seed is acceptable because the
   target is much less structured.

Concrete example:

- Use `fuzz/corpus/input/` for the main `fuzz_input.c` run and a single empty
  file for a short "shallow bug" comparison run.

Rule of thumb:

- Structured parser: engineer seeds. Unstructured byte consumer: tiny seeds are
  often enough.

### Sanitizers, Oracles, and What Counts as a Bug

Fuzzing is only as good as its bug oracle. A bug oracle is the condition that
marks an execution as bad or interesting.

Default oracles:

- crash
- sanitizer violation
- assertion failure
- timeout or hang

In C and C++, sanitizers dramatically increase bug-finding power because many
memory errors and forms of undefined behavior do not produce reliable crashes on
their own.

Useful sanitizers:

- `ASAN` for heap/stack/global memory safety issues
- `UBSAN` for undefined behavior such as signed overflow or invalid shifts
- `MSAN` for uninitialized-memory use
- `LSAN` for leak detection when practical

General semantic oracle examples:

- parse -> serialize -> parse round trips
- decompression/compression consistency
- differential testing between two implementations

Repository-specific oracle ideas:

- Parser harness: the code must never crash, assert, or trip a sanitizer for
  any file, valid or invalid.
- Future scheduler harness: after `schedule()`, every process should terminate,
  no PID except `-1` should appear in the Gantt chart unless it came from the
  input set, `total busy CPU time == sum(burst_time)`, and computed times
  should remain internally consistent.

Concrete example:

- If a future scheduler harness finds a case where waiting time becomes
  negative, that is a logic bug even if no memory sanitizer fires.

Rule of thumb:

- Sanitizers find memory bugs; custom invariants find logic bugs. Use both.

### Harness Design and Determinism

A fuzzing harness is the bridge between the fuzzer and the target code. A good
harness:

- is deterministic
- tolerates any input
- avoids unnecessary global state
- cleans up all allocations and resources each iteration
- keeps networking, sleeps, and unrelated I/O out of the hot path

In-process harnesses are preferred because they avoid process startup cost.
Persistent mode goes further by reusing a single process for many iterations,
which usually increases throughput dramatically.

Current harness assessment:

- `fuzz/fuzz_input.c` is good as a first boundary, but it is not ideal. It
  copies stdin to a temporary file and calls `input_load_file()`. That means
  file creation and deletion are in the hot path.
- `fuzz/fuzz_queue.c` is already closer to the right shape: it stays in process
  and drives an API directly.

Best next improvement for this repository:

- refactor the parser into an in-memory entrypoint such as
  `input_load_buffer()` or `input_load_stream()`
- then fuzz that API in persistent mode or with a `libFuzzer`-style
  `LLVMFuzzerTestOneInput()`

Poor harness patterns to avoid:

- reading clocks or random state unrelated to input
- printing heavily in the hot loop
- exiting on malformed input
- filtering out invalid inputs too aggressively before target logic sees them

Concrete example:

- Rejecting every line that does not begin with a digit in the harness would be
  a mistake; it would hide comment handling, whitespace handling, and malformed
  prefix logic from the fuzzer.

Rule of thumb:

- If setup costs more than the code under test, move the boundary inward.

### In-Process vs External Process Fuzzing

External-process fuzzing is often easier to bolt onto an existing CLI, but it
spends significant time on startup and teardown. In-process fuzzing drives a
library function directly inside the same address space.

Why in-process usually wins:

- much higher exec/sec
- better control over state reset
- easier integration with sanitizers
- easier corpus merging and regression re-execution

For this project:

- `fuzz_input.c` is currently external-process in spirit even though it is a
  dedicated harness, because it still pays for temp-file I/O.
- The ideal parser target is in-process.
- The queue target already behaves much more like an in-process harness.

Concrete example:

- `LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)` that directly
  parses bytes is better than `main()` that writes `Data` to `/tmp` first.

Rule of thumb:

- If a target can be expressed as "bytes in, library call, cleanup", it should
  be in-process.

### Coverage, Corpus Management, and Campaign Tuning

In fuzzing, coverage usually means the set of edges or basic blocks executed by
the target. Coverage is not the goal by itself, but it is a useful proxy for
exploration: if new inputs reach new edges, the campaign is still learning.

Modern fuzzers keep inputs that trigger new coverage and discard most others.
That is how the corpus evolves from a few seeds into a set of "interesting"
inputs.

Practical tuning parameters:

- timeout
- memory limit
- parallel workers
- persistent mode loop count
- sanitizer vs non-sanitizer builds
- dictionary use

What to watch during a real campaign:

- exec/sec
- corpus growth rate
- coverage growth rate
- crash count after deduplication
- stability or determinism indicators

Repository-specific tuning advice:

- Parser target should be much faster than the full CLI. If not, the harness is
  too expensive.
- Queue target should have very high exec/sec. If not, the harness is leaking
  or doing too much work per iteration.
- Use multiple workers with a shared minimized corpus once the single-worker
  setup is stable.

Concrete example:

- If corpus size keeps increasing but coverage stops moving, stop adding seeds
  and minimize before continuing.

Rule of thumb:

- Higher exec/sec is only useful if the target is deterministic and the corpus
  stays sharp.

### Crash Triage and Regression Tests

Raw fuzzing often yields many crash files, but many of them share the same root
cause. Fuzzers and triage tools usually cluster crashes by coverage or stack
shape to approximate uniqueness.

The normal workflow is:

1. Reproduce the crash on the same instrumented binary.
2. Minimize the crashing input while preserving the failure.
3. Debug the root cause.
4. Fix it.
5. Add the minimized reproducer as a regression test and often keep it in a
   maintained corpus.

Useful tools:

- `afl-tmin` for test-case minimization
- stack-trace or coverage-based crash grouping

Example commands:

```sh
afl-tmin -i crash_input -o minimized_crash -- build/fuzz/fuzz_input
build/fuzz/fuzz_input < minimized_crash
```

Severity thinking:

- memory corruption is usually high severity
- out-of-bounds reads can still matter
- assertion failures are real bugs even when not exploitable
- parse rejections without a crash are usually not bugs unless they violate the
  intended format rules

For this repository, confirmed parser crashes should become:

- a minimized reproducer in the fuzzing corpus or a dedicated regression
  directory
- a unit-style regression in `tests/test_input.c` when feasible

Concrete example:

- If a malformed workload line causes a sanitizer failure in `input_load_file`,
  the minimized input should be kept and replayed in CI after the fix.

Rule of thumb:

- Every real crash deserves a permanent reproducer.

### Seed Selection Research Insights

The most useful research result for this repository is simple: seed choice is
not a cosmetic detail. It materially changes coverage and bug-finding.

Key takeaways from the seed-selection literature:

- Minimized corpora consistently outperform large redundant corpora.
- Different minimizers may vary in exact corpus size, but minimizing at all is
  more important than picking a perfect minimizer.
- Empty seed can perform surprisingly well on some shallow bugs or unstructured
  inputs.
- Empty seed is a weak main strategy for structured formats where valid shape
  matters.

In the `Seed Selection for Successful Fuzzing` study, minimized corpora
outperformed singleton, empty, and very large seed sets overall, while empty
seed still occasionally found shallow bugs quickly. That matches the intuition
for this project:

- `input_load_file()` is structured enough that valid seed shape matters.
- `fuzz_queue.c` is unstructured enough that a very small seed set is fine.

When to invest heavily in seed engineering:

- parsers for structured formats
- targets with strict syntax
- targets where random bytes rarely get past the front end

When to invest less:

- byte-oriented state machines
- unstructured consumers
- targets where even empty seed quickly grows the corpus

Concrete example:

- Spend time curating parser seeds and minimizing them. Do not spend days
  collecting huge queue-operation corpora.

Rule of thumb:

- The more syntax the target expects, the more seed engineering pays off.

### Recommended Campaign for This Repository

If the goal is practical bug finding rather than theory, run fuzzing in this
order:

1. Build and fuzz the parser harness.
2. Minimize the resulting parser corpus.
3. Run a short empty-seed parser experiment for comparison.
4. Build and fuzz the queue harness.
5. Add a future scheduler-invariant harness to target logic bugs, not just
   memory-safety bugs.

Why this order is best:

- The parser is the clearest attacker-controlled boundary.
- The queue harness is cheap and worth keeping, but less exposed to realistic
  malformed external input.
- The scheduler core is where semantic oracles can find non-crashing logic
  mistakes, but it needs a dedicated harness to do it well.

Rule of thumb:

- Start with the highest-risk parsing boundary, then move inward toward logic.

### Suggested Build and Run Commands

These commands fit the current harnesses. They are Linux-oriented because the
project itself targets Linux.

Build parser and queue fuzzers:

```sh
mkdir -p build/fuzz

AFL_USE_ASAN=1 AFL_USE_UBSAN=1 AFL_LLVM_LAF_ALL=1 \
afl-clang-fast -std=c11 -Wall -Wextra -Wpedantic -D_POSIX_C_SOURCE=200809L \
  -Iinclude -o build/fuzz/fuzz_input \
  fuzz/fuzz_input.c src/input.c src/process.c

AFL_USE_ASAN=1 AFL_USE_UBSAN=1 AFL_LLVM_LAF_ALL=1 \
afl-clang-fast -std=c11 -Wall -Wextra -Wpedantic -D_POSIX_C_SOURCE=200809L \
  -Iinclude -o build/fuzz/fuzz_queue \
  fuzz/fuzz_queue.c src/process.c src/queue.c
```

Run the main parser campaign:

```sh
afl-fuzz -m none -i fuzz/corpus/input -o build/afl-input \
  -x fuzz/dictionaries/workload.dict -- build/fuzz/fuzz_input
```

Run a short empty-seed side campaign:

```sh
mkdir -p build/empty-only
cp fuzz/corpus/input/04_invalid_empty.txt build/empty-only/empty.txt

afl-fuzz -m none -i build/empty-only -o build/afl-input-empty \
  -- build/fuzz/fuzz_input
```

Run the queue campaign:

```sh
afl-fuzz -m none -i fuzz/corpus/queue -o build/afl-queue \
  -- build/fuzz/fuzz_queue
```

Minimize a grown parser corpus:

```sh
afl-cmin -i build/afl-input/default/queue -o build/afl-input-cmin \
  -- build/fuzz/fuzz_input
```

Note on sanitizer-heavy runs:

- AFL++ documents real memory-limit caveats with `ASAN` on 64-bit targets.
- In long campaigns it is common to use a fast non-sanitized build to grow the
  corpus and then replay or triage under sanitized builds.
- For this repository, a sensible approach is one sanitized parser worker plus
  faster non-sanitized workers once the harness is stable.

Concrete example:

- Use `ASAN+UBSAN` first to validate the harness and catch obvious memory bugs,
  then consider a longer non-sanitized throughput run that periodically replays
  its corpus under sanitizers.

Rule of thumb:

- First make the harness correct and stable, then make it fast.

### Common Pitfalls

- Over-filtering invalid inputs in the harness
- Treating giant corpora as automatically better
- Forgetting sanitizers
- Ignoring nondeterminism and state leakage
- Fuzzing the full CLI when a library boundary exists
- Stopping at crash discovery without triage or regression tests

Concrete example:

- If the parser harness special-cases away empty inputs before calling the
  parser, you lose exactly the behavior the fuzzer should test.

Rule of thumb:

- The harness should expose target code to bad inputs, not protect it from them.

### A Good Mental Model

The core fuzzing loop is:

1. Choose a narrow target with attacker-controlled input.
2. Build a deterministic harness.
3. Seed it with a small diverse corpus.
4. Run the fuzzer with sanitizers and coverage.
5. Watch coverage and exec/sec.
6. Minimize the corpus periodically.
7. Triage crashes and hangs.
8. Turn fixes into regression tests.
9. Feed good new seeds back into the maintained corpus.

For this repository, the practical mental model is:

1. Parser first.
2. Small curated corpus.
3. Minimize aggressively.
4. Empty-seed run only as a side experiment.
5. Queue second.
6. Add scheduler invariants next if you want logic-bug coverage.

Rule of thumb:

- Fuzzing is not one run; it is a feedback loop between target design, seeds,
  coverage, crash triage, and regression discipline.

### Keep Learning

The best next reading is:

- classic and modern fuzzing surveys
- AFL++ documentation, especially persistent mode and fuzzing-in-depth
- LLVM `libFuzzer` documentation
- seed-selection and mutation-strategy papers

If you want to level this repository up beyond "basic fuzz support", the single
highest-value engineering task is to refactor the parser to an in-memory API and
then add a scheduler-invariant harness for semantic bug oracles.

Rule of thumb:

- When coverage plateaus, do not only tune flags. Revisit target boundaries and
  oracles.

## References

Primary sources consulted on April 15, 2026:

- Manes et al., `The Art, Science, and Engineering of Fuzzing: A Survey`
  https://arxiv.org/abs/1812.00140
- Herrera et al., `Seed Selection for Successful Fuzzing`
  https://doi.org/10.1145/3460319.3464795
- AFL++ overview
  https://aflplus.plus/
- AFL++ persistent mode documentation
  https://github.com/AFLplusplus/AFLplusplus/blob/stable/instrumentation/README.persistent_mode.md
- AFL++ fuzzing-in-depth documentation
  https://aflplus.plus/docs/fuzzing_in_depth/
- AFL++ notes for ASAN
  https://aflplus.plus/docs/notes_for_asan/
- LLVM `libFuzzer` documentation
  https://llvm.org/docs/LibFuzzer.html
- Clang `MemorySanitizer` documentation
  https://clang.llvm.org/docs/MemorySanitizer.html
- Lyu et al., `MOPT: Optimized Mutation Scheduling for Fuzzers`
  https://www.usenix.org/conference/usenixsecurity19/presentation/lyu
