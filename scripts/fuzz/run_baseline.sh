#!/usr/bin/env bash
set -eu

target="input"
duration="600"
mode="asan"
out_root="build/afl-baseline"

while [ "$#" -gt 0 ]; do
    case "$1" in
        --target)
            target="$2"
            shift 2
            ;;
        --duration)
            duration="$2"
            shift 2
            ;;
        --mode)
            mode="$2"
            shift 2
            ;;
        --out-root)
            out_root="$2"
            shift 2
            ;;
        *)
            echo "unknown arg: $1" >&2
            exit 1
            ;;
    esac
done

if [ "$target" != "input" ] && [ "$target" != "queue" ]; then
    echo "--target must be input or queue" >&2
    exit 1
fi

if [ "$mode" != "asan" ] && [ "$mode" != "fast" ]; then
    echo "--mode must be asan or fast" >&2
    exit 1
fi

if ! command -v afl-fuzz >/dev/null 2>&1; then
    echo "afl-fuzz not found in PATH" >&2
    exit 1
fi

if [ "$mode" = "asan" ]; then
    make fuzz-build-asan
else
    make fuzz-build-fast
fi

bin="build/fuzz/fuzz_${target}"
seed_dir="fuzz/corpus/${target}"
dict_opt=""
if [ "$target" = "input" ]; then
    dict_opt="-x fuzz/dictionaries/workload.dict"
fi

if [ ! -x "$bin" ]; then
    echo "missing target binary: $bin" >&2
    exit 1
fi

ts="$(date +%Y%m%d-%H%M%S)"
out_dir="${out_root}/${target}-${mode}-${ts}"
mkdir -p "$out_root"

echo "[baseline] target=$target mode=$mode duration=${duration}s"
echo "[baseline] seeds=$seed_dir out=$out_dir"

set +e
afl-fuzz -m none -i "$seed_dir" -o "$out_dir" -V "$duration" \
    $dict_opt -- "$bin"
rc=$?
set -e

stats_file="${out_dir}/default/fuzzer_stats"
if [ -f "$stats_file" ]; then
    execs_done="$(awk -F: '/^execs_done/{gsub(/ /,"",$2); print $2}' \
        "$stats_file")"
    execs_per_sec="$(awk -F: '/^execs_per_sec/{gsub(/ /,"",$2); print $2}' \
        "$stats_file")"
    paths_total="$(awk -F: '/^paths_total/{gsub(/ /,"",$2); print $2}' \
        "$stats_file")"
    unique_crashes="$(awk -F: '/^unique_crashes/{gsub(/ /,"",$2); print $2}' \
        "$stats_file")"
    pending_total="$(awk -F: '/^pending_total/{gsub(/ /,"",$2); print $2}' \
        "$stats_file")"

    echo "[baseline] done rc=$rc"
    echo "[baseline] execs_done=${execs_done:-unknown}"
    echo "[baseline] execs_per_sec=${execs_per_sec:-unknown}"
    echo "[baseline] paths_total=${paths_total:-unknown}"
    echo "[baseline] unique_crashes=${unique_crashes:-unknown}"
    echo "[baseline] pending_total=${pending_total:-unknown}"
    echo "[baseline] stats=$stats_file"
else
    echo "[baseline] no fuzzer_stats found (rc=$rc)"
fi

exit 0
