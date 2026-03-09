#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_ENV_FILE="${SCRIPT_DIR}/remote_benchmark.env"
DEFAULT_WAIT_POLL_SECONDS=10

usage() {
  cat <<'EOF'
Usage:
  tools/remote_benchmark_async.sh check
  tools/remote_benchmark_async.sh start [record|compare-prev|save <name>|compare <name>] [-- benchmark-args...]
  tools/remote_benchmark_async.sh status <run-id>
  tools/remote_benchmark_async.sh tail <run-id> [lines]
  tools/remote_benchmark_async.sh wait <run-id>
  tools/remote_benchmark_async.sh fetch <run-id>
  tools/remote_benchmark_async.sh list
  tools/remote_benchmark_async.sh latest
  tools/remote_benchmark_async.sh cancel <run-id>

Defaults:
  - start with no explicit benchmark command runs `record` asynchronously on the remote machine.
  - This script reuses tools/remote_benchmark.env for SSH/rsync/remote env configuration.

Notes:
  - Benchmark jobs are serialized remotely behind a single exclusive lock.
  - Optional idle gating can wait for low remote load before a benchmark starts.
  - Each run uses an immutable snapshot so later local edits do not affect the measured code.
EOF
}

load_env() {
  local env_file="${REPO_STATS_REMOTE_ENV_FILE_LOCAL:-${DEFAULT_ENV_FILE}}"
  if [[ -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    source "${env_file}"
  fi
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "required variable ${name} is not set" >&2
    exit 1
  fi
}

sanitize_name() {
  printf '%s' "$1" | tr '/[:space:]' '--' | tr -cd '[:alnum:]._-'
}

setup_config() {
  load_env
  require_var REPO_STATS_REMOTE_SSH_TARGET
  require_var REPO_STATS_REMOTE_STAGE_DIR
  require_var REPO_STATS_REMOTE_MACHINE_NAME

  REPO_STATS_REMOTE_SSH_BIN="${REPO_STATS_REMOTE_SSH_BIN:-ssh}"
  REPO_STATS_REMOTE_RSYNC_BIN="${REPO_STATS_REMOTE_RSYNC_BIN:-rsync}"
  REPO_STATS_REMOTE_RSYNC_SSH="${REPO_STATS_REMOTE_RSYNC_SSH:-${REPO_STATS_REMOTE_SSH_BIN}}"
  REPO_STATS_REMOTE_MACHINE_NAME="$(sanitize_name "${REPO_STATS_REMOTE_MACHINE_NAME}")"
  REPO_STATS_REMOTE_BENCH_IDLE_MAX_LOAD1="${REPO_STATS_REMOTE_BENCH_IDLE_MAX_LOAD1:-}"
  REPO_STATS_REMOTE_BENCH_IDLE_POLL_SECONDS="${REPO_STATS_REMOTE_BENCH_IDLE_POLL_SECONDS:-30}"
  REPO_STATS_REMOTE_BENCH_IDLE_STREAK="${REPO_STATS_REMOTE_BENCH_IDLE_STREAK:-1}"

  REMOTE_WORKER_DIR="${REPO_STATS_REMOTE_STAGE_DIR%/}/VSCode-repo-stats"
  REMOTE_BENCH_ROOT="${REPO_STATS_REMOTE_STAGE_DIR%/}/repo-stats-benchmark"
  REMOTE_RUNS_DIR="${REMOTE_BENCH_ROOT}/runs"
  REMOTE_SHARED_RESULTS_DIR="${REMOTE_BENCH_ROOT}/shared/.bench-results"
  REMOTE_LOCK_FILE="${REMOTE_BENCH_ROOT}/benchmark.lock"
  LOCAL_MACHINE_DIR="${REPO_DIR}/.bench-results/remotes/${REPO_STATS_REMOTE_MACHINE_NAME}"
  LOCAL_RUNS_DIR="${LOCAL_MACHINE_DIR}/benchmark-runs"
}

remote_run_root() {
  local run_id="$1"
  printf '%s\n' "${REMOTE_RUNS_DIR}/${run_id}"
}

remote_run_snapshot_root() {
  local run_id="$1"
  printf '%s\n' "$(remote_run_root "${run_id}")/snapshot"
}

remote_run_worker_dir() {
  local run_id="$1"
  printf '%s\n' "$(remote_run_snapshot_root "${run_id}")/VSCode-repo-stats"
}

remote_log_path() {
  local run_id="$1"
  printf '%s\n' "$(remote_run_root "${run_id}")/benchmark.log"
}

remote_status_path() {
  local run_id="$1"
  printf '%s\n' "$(remote_run_root "${run_id}")/status"
}

remote_pid_path() {
  local run_id="$1"
  printf '%s\n' "$(remote_run_root "${run_id}")/pid"
}

stage_remote_base() {
  echo "[repo-stats][remote] staging repo on ${REPO_STATS_REMOTE_SSH_TARGET}:${REPO_STATS_REMOTE_STAGE_DIR}"
  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" \
    "mkdir -p '${REMOTE_WORKER_DIR}' '${REMOTE_RUNS_DIR}' '${REMOTE_SHARED_RESULTS_DIR}'"

  "${REPO_STATS_REMOTE_RSYNC_BIN}" -az --delete -e "${REPO_STATS_REMOTE_RSYNC_SSH}" \
    --exclude .git \
    --exclude node_modules \
    --exclude webview-ui/node_modules \
    --exclude out \
    --exclude .bench-results \
    --exclude .vscode-test \
    --exclude .pi \
    --exclude '*.vsix' \
    "${REPO_DIR}/" \
    "${REPO_STATS_REMOTE_SSH_TARGET}:${REMOTE_WORKER_DIR}/"
}

stage_remote_run_snapshot() {
  local run_id="$1"
  local snapshot_worker_dir
  snapshot_worker_dir="$(remote_run_worker_dir "${run_id}")"

  echo "[repo-stats][remote] staging immutable snapshot for run ${run_id}"
  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" \
    "mkdir -p '${snapshot_worker_dir}'"

  "${REPO_STATS_REMOTE_RSYNC_BIN}" -az --delete -e "${REPO_STATS_REMOTE_RSYNC_SSH}" \
    --exclude .git \
    --exclude node_modules \
    --exclude webview-ui/node_modules \
    --exclude out \
    --exclude .bench-results \
    --exclude .vscode-test \
    --exclude .pi \
    --exclude '*.vsix' \
    "${REPO_DIR}/" \
    "${REPO_STATS_REMOTE_SSH_TARGET}:${snapshot_worker_dir}/"
}

latest_run() {
  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" \
    "bash -lc 'if [[ -d \"${REMOTE_RUNS_DIR}\" ]]; then ls -1 \"${REMOTE_RUNS_DIR}\" | sort | tail -n 1; fi'"
}

fetch_shared_results() {
  mkdir -p "${LOCAL_MACHINE_DIR}/shared-results"
  if "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" test -d "${REMOTE_SHARED_RESULTS_DIR}"; then
    "${REPO_STATS_REMOTE_RSYNC_BIN}" -az -e "${REPO_STATS_REMOTE_RSYNC_SSH}" \
      "${REPO_STATS_REMOTE_SSH_TARGET}:${REMOTE_SHARED_RESULTS_DIR}/" \
      "${LOCAL_MACHINE_DIR}/shared-results/"
    echo "[repo-stats][remote] mirrored shared results to ${LOCAL_MACHINE_DIR}/shared-results"
  fi
}

fetch_run() {
  local run_id="$1"
  mkdir -p "${LOCAL_RUNS_DIR}/${run_id}"
  if "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" test -d "$(remote_run_root "${run_id}")"; then
    "${REPO_STATS_REMOTE_RSYNC_BIN}" -az -e "${REPO_STATS_REMOTE_RSYNC_SSH}" \
      "${REPO_STATS_REMOTE_SSH_TARGET}:$(remote_run_root "${run_id}")/" \
      "${LOCAL_RUNS_DIR}/${run_id}/"
    echo "[repo-stats][remote] mirrored benchmark run to ${LOCAL_RUNS_DIR}/${run_id}"
  fi
}

remote_status() {
  local run_id="$1"
  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" bash -s -- \
    "$(remote_status_path "${run_id}")" \
    "$(remote_pid_path "${run_id}")" <<'REMOTE'
set -euo pipefail
status_path="$1"
pid_path="$2"
if [[ ! -f "$status_path" ]]; then
  echo "exists=0"
  exit 0
fi
cat "$status_path"
if [[ -f "$pid_path" ]]; then
  pid="$(cat "$pid_path")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "process_alive=1"
  else
    echo "process_alive=0"
  fi
else
  echo "process_alive=0"
fi
REMOTE
}

print_status() {
  local run_id="$1"
  local status_output
  status_output="$(remote_status "${run_id}")"
  if ! grep -q '^exists=1$' <<<"${status_output}"; then
    echo "[repo-stats][remote] unknown benchmark run ${run_id}" >&2
    exit 1
  fi
  printf '%s\n' "${status_output}" | grep -v '^exists='
}

wait_for_run() {
  local run_id="$1"
  local poll_seconds="${REPO_STATS_REMOTE_BENCH_WAIT_POLL_SECONDS:-${DEFAULT_WAIT_POLL_SECONDS}}"

  while true; do
    local status_output status_value
    status_output="$(remote_status "${run_id}")"
    if ! grep -q '^exists=1$' <<<"${status_output}"; then
      echo "[repo-stats][remote] unknown benchmark run ${run_id}" >&2
      exit 1
    fi

    status_value="$(printf '%s\n' "${status_output}" | awk -F= '$1=="status" { print $2 }')"
    printf '%s\n' "${status_output}" | grep -E '^(run_id|bench_command|status|queued_at|started_at|finished_at|exit_code|remote_log|process_alive)=' || true

    case "${status_value}" in
      completed)
        fetch_run "${run_id}"
        fetch_shared_results
        return 0
        ;;
      failed|cancelled)
        fetch_run "${run_id}"
        fetch_shared_results
        return 1
        ;;
      *)
        sleep "${poll_seconds}"
        ;;
    esac
  done
}

remote_check() {
  stage_remote_base
  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" bash -s -- \
    "${REMOTE_WORKER_DIR}" \
    "${REPO_STATS_REMOTE_ENV_FILE:-}" <<'REMOTE'
set -euo pipefail
remote_worker_dir="$1"
remote_env_file="$2"
if [[ -n "$remote_env_file" && -f "$remote_env_file" ]]; then
  # shellcheck disable=SC1090
  . "$remote_env_file" >/dev/null 2>&1
fi
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
echo "[repo-stats][remote] host: $(hostname)"
echo "[repo-stats][remote] uname: $(uname -a)"
command -v git >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
command -v python3 >/dev/null
node -v
npm -v
python3 -V
cd "$remote_worker_dir"
expected_lock_hash="$(sha256sum package-lock.json | awk '{print $1}')"
installed_lock_hash=""
if [[ -f node_modules/.repo-stats-package-lock.sha ]]; then
  installed_lock_hash="$(cat node_modules/.repo-stats-package-lock.sha)"
fi
if [[ ! -d node_modules || "$installed_lock_hash" != "$expected_lock_hash" ]]; then
  npm ci --ignore-scripts >/dev/null
  printf '%s\n' "$expected_lock_hash" > node_modules/.repo-stats-package-lock.sha
fi
REMOTE
}

start_run() {
  local bench_command="${1:-record}"
  shift || true
  local bench_name=""
  if [[ "${bench_command}" == "save" || "${bench_command}" == "compare" ]]; then
    bench_name="${1:-}"
    if [[ -z "${bench_name}" ]]; then
      echo "${bench_command} requires a benchmark baseline name" >&2
      exit 1
    fi
    shift
  fi
  local bench_args=("$@")
  local shortsha run_id snapshot_worker_dir
  shortsha="$(git -C "${REPO_DIR}" rev-parse --short HEAD)"
  run_id="$(date +%Y%m%dT%H%M%S)-${shortsha}"
  snapshot_worker_dir="$(remote_run_worker_dir "${run_id}")"

  stage_remote_base
  stage_remote_run_snapshot "${run_id}"

  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" bash -s -- \
    "${REMOTE_WORKER_DIR}" \
    "${snapshot_worker_dir}" \
    "$(remote_run_root "${run_id}")" \
    "$(remote_log_path "${run_id}")" \
    "$(remote_status_path "${run_id}")" \
    "$(remote_pid_path "${run_id}")" \
    "${REMOTE_SHARED_RESULTS_DIR}" \
    "${REMOTE_LOCK_FILE}" \
    "${run_id}" \
    "${bench_command}" \
    "${bench_name}" \
    "${REPO_STATS_REMOTE_ENV_FILE:-}" \
    "${REPO_STATS_REMOTE_BENCH_IDLE_MAX_LOAD1}" \
    "${REPO_STATS_REMOTE_BENCH_IDLE_POLL_SECONDS}" \
    "${REPO_STATS_REMOTE_BENCH_IDLE_STREAK}" \
    "${bench_args[@]}" <<'REMOTE'
set -euo pipefail

remote_worker_dir="$1"
snapshot_worker_dir="$2"
run_root="$3"
log_path="$4"
status_path="$5"
pid_path="$6"
shared_results_dir="$7"
lock_file="$8"
run_id="$9"
bench_command="${10}"
bench_name="${11}"
remote_env_file="${12}"
idle_max_load1="${13}"
idle_poll_seconds="${14}"
idle_streak="${15}"
shift 15
bench_args=("$@")
runner_path="${run_root}/runner.sh"

mkdir -p "$run_root" "$shared_results_dir"

if [[ -n "$remote_env_file" && -f "$remote_env_file" ]]; then
  # shellcheck disable=SC1090
  . "$remote_env_file" >/dev/null 2>&1
fi
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

mkdir -p "$remote_worker_dir"
expected_lock_hash="$(cd "$remote_worker_dir" && sha256sum package-lock.json | awk '{print $1}')"
installed_lock_hash=""
if [[ -f "$remote_worker_dir/node_modules/.repo-stats-package-lock.sha" ]]; then
  installed_lock_hash="$(cat "$remote_worker_dir/node_modules/.repo-stats-package-lock.sha")"
fi
if [[ ! -d "$remote_worker_dir/node_modules" || "$installed_lock_hash" != "$expected_lock_hash" ]]; then
  (cd "$remote_worker_dir" && npm ci --ignore-scripts >/dev/null)
  printf '%s\n' "$expected_lock_hash" > "$remote_worker_dir/node_modules/.repo-stats-package-lock.sha"
fi

rm -rf "$snapshot_worker_dir/node_modules"
ln -s "$remote_worker_dir/node_modules" "$snapshot_worker_dir/node_modules"
rm -rf "$snapshot_worker_dir/.bench-results"
ln -s "$shared_results_dir" "$snapshot_worker_dir/.bench-results"

cat > "$status_path" <<EOF
exists=1
run_id=${run_id}
bench_command=${bench_command}
status=queued
queued_at=$(date -Is)
started_at=
finished_at=
exit_code=
remote_log=${log_path}
EOF

cat > "$runner_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
run_root="$1"
status_path="$2"
log_path="$3"
lock_file="$4"
snapshot_worker_dir="$5"
bench_command="$6"
bench_name="$7"
remote_env_file="$8"
idle_max_load1="$9"
idle_poll_seconds="${10}"
idle_streak="${11}"
shift 11
bench_args=("$@")

write_status() {
  local status="$1"
  local started_at="$2"
  local finished_at="$3"
  local exit_code="$4"
  cat > "$status_path" <<STATUS
exists=1
run_id=$(awk -F= '$1=="run_id" { print $2 }' "$status_path")
bench_command=$bench_command
status=$status
queued_at=$(awk -F= '$1=="queued_at" { print $2 }' "$status_path")
started_at=$started_at
finished_at=$finished_at
exit_code=$exit_code
remote_log=$log_path
STATUS
}

wait_for_idle() {
  if [[ -z "$idle_max_load1" ]]; then
    return
  fi

  python3 - "$idle_max_load1" "$idle_poll_seconds" "$idle_streak" <<'PY'
import os
import sys
import time

max_load = float(sys.argv[1])
poll_seconds = int(sys.argv[2])
required_streak = int(sys.argv[3])
streak = 0
while True:
    load1 = os.getloadavg()[0]
    if load1 <= max_load:
        streak += 1
        if streak >= required_streak:
            break
    else:
        streak = 0
    time.sleep(poll_seconds)
PY
}

if [[ -n "$remote_env_file" && -f "$remote_env_file" ]]; then
  # shellcheck disable=SC1090
  . "$remote_env_file" >/dev/null 2>&1
fi
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

started_at=""
finished_at=""
exit_code=""
{
  exec 9>"$lock_file"
  flock 9
  wait_for_idle
  started_at="$(date -Is)"
  write_status "benchmarking" "$started_at" "" ""
  cd "$snapshot_worker_dir"
  cmd=(./tools/benchmark_baseline.sh "$bench_command")
  if [[ -n "$bench_name" ]]; then
    cmd+=("$bench_name")
  fi
  if [[ ${#bench_args[@]} -gt 0 ]]; then
    cmd+=(-- "${bench_args[@]}")
  fi
  if "${cmd[@]}"; then
    exit_code=0
  else
    exit_code=$?
  fi
  finished_at="$(date -Is)"
  if [[ "$exit_code" -eq 0 ]]; then
    write_status "completed" "$started_at" "$finished_at" "$exit_code"
  else
    write_status "failed" "$started_at" "$finished_at" "$exit_code"
  fi
  exit "$exit_code"
} >>"$log_path" 2>&1
EOF
chmod +x "$runner_path"
nohup bash "$runner_path" \
  "$run_root" \
  "$status_path" \
  "$log_path" \
  "$lock_file" \
  "$snapshot_worker_dir" \
  "$bench_command" \
  "$bench_name" \
  "$remote_env_file" \
  "$idle_max_load1" \
  "$idle_poll_seconds" \
  "$idle_streak" \
  "${bench_args[@]}" >/dev/null 2>&1 &
echo $! > "$pid_path"
echo "[repo-stats][remote] started benchmark run ${run_id}"
echo "[repo-stats][remote] pid: $(cat "$pid_path")"
echo "[repo-stats][remote] log: ${log_path}"
REMOTE

  echo "[repo-stats][remote] started benchmark run ${run_id}"
}

cancel_run() {
  local run_id="$1"
  "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" bash -s -- \
    "$(remote_status_path "${run_id}")" \
    "$(remote_pid_path "${run_id}")" <<'REMOTE'
set -euo pipefail
status_path="$1"
pid_path="$2"
if [[ ! -f "$status_path" ]]; then
  exit 1
fi
if [[ -f "$pid_path" ]]; then
  pid="$(cat "$pid_path")"
  kill "$pid" >/dev/null 2>&1 || true
fi
queued_at="$(awk -F= '$1=="queued_at" { print $2 }' "$status_path")"
run_id="$(awk -F= '$1=="run_id" { print $2 }' "$status_path")"
bench_command="$(awk -F= '$1=="bench_command" { print $2 }' "$status_path")"
remote_log="$(awk -F= '$1=="remote_log" { print $2 }' "$status_path")"
cat > "$status_path" <<EOF
exists=1
run_id=${run_id}
bench_command=${bench_command}
status=cancelled
queued_at=${queued_at}
started_at=
finished_at=$(date -Is)
exit_code=130
remote_log=${remote_log}
EOF
REMOTE
  echo "[repo-stats][remote] cancelled benchmark run ${run_id}"
}

setup_config
command="${1:-}"
if [[ -z "${command}" ]]; then
  usage
  exit 1
fi
shift || true

case "${command}" in
  check)
    remote_check
    ;;
  start)
    bench_command="${1:-record}"
    if [[ $# -gt 0 ]]; then
      shift
    fi
    bench_name=""
    case "${bench_command}" in
      save|compare)
        bench_name="${1:-}"
        if [[ -z "${bench_name}" ]]; then
          echo "${bench_command} requires a baseline name" >&2
          exit 1
        fi
        shift
        ;;
      record|compare-prev)
        ;;
      *)
        echo "unsupported async benchmark command: ${bench_command}" >&2
        exit 1
        ;;
    esac
    if [[ "${1:-}" == "--" ]]; then
      shift
    fi
    if [[ -n "${bench_name}" ]]; then
      start_run "${bench_command}" "${bench_name}" "$@"
    else
      start_run "${bench_command}" "$@"
    fi
    ;;
  status)
    if [[ $# -lt 1 ]]; then
      echo "status requires a run id" >&2
      exit 1
    fi
    print_status "$1"
    ;;
  tail)
    if [[ $# -lt 1 ]]; then
      echo "tail requires a run id" >&2
      exit 1
    fi
    lines="${2:-100}"
    "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" \
      "tail -n ${lines} -f '$(remote_log_path "$1")'"
    ;;
  wait)
    if [[ $# -lt 1 ]]; then
      echo "wait requires a run id" >&2
      exit 1
    fi
    wait_for_run "$1"
    ;;
  fetch)
    if [[ $# -lt 1 ]]; then
      echo "fetch requires a run id" >&2
      exit 1
    fi
    fetch_run "$1"
    fetch_shared_results
    ;;
  list)
    "${REPO_STATS_REMOTE_SSH_BIN}" "${REPO_STATS_REMOTE_SSH_TARGET}" \
      "bash -lc 'if [[ -d \"${REMOTE_RUNS_DIR}\" ]]; then ls -1 \"${REMOTE_RUNS_DIR}\" | sort; fi'"
    ;;
  latest)
    latest_run
    ;;
  cancel)
    if [[ $# -lt 1 ]]; then
      echo "cancel requires a run id" >&2
      exit 1
    fi
    cancel_run "$1"
    ;;
  *)
    usage
    exit 1
    ;;
esac
