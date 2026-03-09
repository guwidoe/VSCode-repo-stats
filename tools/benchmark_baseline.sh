#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESULT_DIR="${REPO_DIR}/.bench-results"
BASELINE_DIR="${RESULT_DIR}/baselines"
HISTORY_FILE="${RESULT_DIR}/history.tsv"
LATEST_FILE="${RESULT_DIR}/latest-baseline"
TMP_DIR="${RESULT_DIR}/tmp"

usage() {
  cat <<'EOF'
Usage:
  tools/benchmark_baseline.sh save <baseline-name> [-- benchmark-args...]
  tools/benchmark_baseline.sh record [-- benchmark-args...]
  tools/benchmark_baseline.sh compare <baseline-name> [-- benchmark-args...]
  tools/benchmark_baseline.sh compare-prev [-- benchmark-args...]
  tools/benchmark_baseline.sh list
  tools/benchmark_baseline.sh history
  tools/benchmark_baseline.sh latest
  tools/benchmark_baseline.sh previous

Commands:
  save         Run analysis benchmarks and save/refresh a named baseline.
  record       Save a baseline for the current commit using <branch>-<shortsha>.
  compare      Run analysis benchmarks and compare against a saved baseline.
  compare-prev Compare the current workspace against the previously recorded baseline.
  list         List saved baseline names.
  history      Show recorded baseline history.
  latest       Print the latest recorded baseline name.
  previous     Print the previous recorded baseline name.
EOF
}

sanitize_name() {
  printf '%s' "$1" | tr '/[:space:]' '--' | tr -cd '[:alnum:]._-'
}

git_branch() {
  if git -C "${REPO_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "${REPO_DIR}" rev-parse --abbrev-ref HEAD
    return
  fi
  printf 'unknown-branch\n'
}

git_commit() {
  if git -C "${REPO_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "${REPO_DIR}" rev-parse HEAD
    return
  fi
  printf 'unknown-commit\n'
}

git_shortsha() {
  if git -C "${REPO_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "${REPO_DIR}" rev-parse --short HEAD
    return
  fi
  printf 'unknown\n'
}

git_subject() {
  if git -C "${REPO_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "${REPO_DIR}" log -1 --pretty=%s | tr '\t\n' '  '
    return
  fi
  printf 'unknown subject\n'
}

current_baseline_name() {
  local branch shortsha
  branch="$(git_branch)"
  shortsha="$(git_shortsha)"
  if [[ "${branch}" == "HEAD" ]]; then
    branch="detached"
  fi
  printf '%s\n' "$(sanitize_name "${branch}")-${shortsha}"
}

split_benchmark_args() {
  local -n __out_ref="$1"
  shift
  __out_ref=()
  if [[ $# -gt 0 && "$1" == "--" ]]; then
    shift
  fi
  while [[ $# -gt 0 ]]; do
    __out_ref+=("$1")
    shift
  done
}

bench_args_string() {
  if [[ $# -eq 0 ]]; then
    printf ''
    return
  fi

  local joined=""
  local arg
  for arg in "$@"; do
    if [[ -n "${joined}" ]]; then
      joined+=" "
    fi
    joined+="$(printf '%q' "${arg}")"
  done
  printf '%s' "${joined}"
}

ensure_layout() {
  mkdir -p "${BASELINE_DIR}" "${TMP_DIR}"
  if [[ ! -f "${HISTORY_FILE}" ]]; then
    printf 'saved_at\tbaseline\tgit_commit\tgit_shortsha\tgit_branch\tgit_subject\tbench_args\n' > "${HISTORY_FILE}"
  fi
}

record_history_entry() {
  local name="$1"
  shift || true

  ensure_layout
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(date -Is)" \
    "${name}" \
    "$(git_commit)" \
    "$(git_shortsha)" \
    "$(git_branch)" \
    "$(git_subject)" \
    "$(bench_args_string "$@")" >> "${HISTORY_FILE}"
  printf '%s\n' "${name}" > "${LATEST_FILE}"
}

write_meta_json() {
  local out_dir="$1"
  local name="$2"
  shift 2 || true

  BASELINE_NAME="${name}" \
  OUT_DIR="${out_dir}" \
  SAVED_AT="$(date -Is)" \
  GIT_COMMIT="$(git_commit)" \
  GIT_SHORTSHA="$(git_shortsha)" \
  GIT_BRANCH="$(git_branch)" \
  GIT_SUBJECT="$(git_subject)" \
  BENCH_ARGS="$(bench_args_string "$@")" \
  BENCH_HOSTNAME="$(hostname 2>/dev/null || true)" \
  BENCH_UNAME="$(uname -a 2>/dev/null || true)" \
  BENCH_NODE="$(node -v 2>/dev/null || true)" \
  python3 - <<'PY'
import json
import os
from pathlib import Path

meta = {
    "baseline": os.environ["BASELINE_NAME"],
    "saved_at": os.environ["SAVED_AT"],
    "git_commit": os.environ["GIT_COMMIT"],
    "git_shortsha": os.environ["GIT_SHORTSHA"],
    "git_branch": os.environ["GIT_BRANCH"],
    "git_subject": os.environ["GIT_SUBJECT"],
    "bench_args": os.environ["BENCH_ARGS"],
    "hostname": os.environ.get("BENCH_HOSTNAME", ""),
    "uname": os.environ.get("BENCH_UNAME", ""),
    "node": os.environ.get("BENCH_NODE", ""),
}
Path(os.environ["OUT_DIR"], "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
PY
}

run_analysis_benchmark() {
  local output_path="$1"
  shift || true
  (
    cd "${REPO_DIR}"
    node ./tools/analysis_benchmark.js run --output "${output_path}" "$@"
  )
}

save_baseline() {
  local name="$1"
  shift || true
  local out_dir="${BASELINE_DIR}/${name}"
  local json_file="${out_dir}/benchmark.json"
  local log_file="${out_dir}/benchmark.log"

  ensure_layout
  rm -rf "${out_dir}"
  mkdir -p "${out_dir}"

  echo "[repo-stats] saving benchmark baseline: ${name}"
  echo "[repo-stats] log: ${log_file}"
  run_analysis_benchmark "${json_file}" "$@" | tee "${log_file}"
  write_meta_json "${out_dir}" "${name}" "$@"
  record_history_entry "${name}" "$@"
}

compare_baseline() {
  local name="$1"
  shift || true
  local baseline_dir="${BASELINE_DIR}/${name}"
  local baseline_json="${baseline_dir}/benchmark.json"
  local current_json="${TMP_DIR}/compare-current-$(date +%s).json"

  if [[ ! -f "${baseline_json}" ]]; then
    echo "baseline '${name}' not found at ${baseline_json}" >&2
    exit 1
  fi

  echo "[repo-stats] comparing against benchmark baseline: ${name}"
  run_analysis_benchmark "${current_json}" "$@"
  node "${REPO_DIR}/tools/benchmark_compare.js" \
    "${baseline_json}" \
    "${current_json}" \
    --warn-pct "${BENCH_COMPARE_WARN_PCT:-5}" \
    --fail-pct "${BENCH_COMPARE_FAIL_PCT:-15}" \
    --min-phase-ms "${BENCH_COMPARE_MIN_PHASE_MS:-10}"
}

latest_baseline() {
  if [[ -f "${LATEST_FILE}" ]]; then
    cat "${LATEST_FILE}"
  fi
}

previous_baseline() {
  if [[ ! -f "${HISTORY_FILE}" ]]; then
    return
  fi
  awk 'NR > 1 { print $2 }' "${HISTORY_FILE}" | tail -n 2 | head -n 1
}

command="${1:-}"
if [[ -z "${command}" ]]; then
  usage
  exit 1
fi
shift || true

case "${command}" in
  save)
    if [[ $# -lt 1 ]]; then
      echo "save requires a baseline name" >&2
      exit 1
    fi
    baseline_name="$(sanitize_name "$1")"
    shift
    bench_args=()
    split_benchmark_args bench_args "$@"
    save_baseline "${baseline_name}" "${bench_args[@]}"
    ;;
  record)
    bench_args=()
    split_benchmark_args bench_args "$@"
    save_baseline "$(current_baseline_name)" "${bench_args[@]}"
    ;;
  compare)
    if [[ $# -lt 1 ]]; then
      echo "compare requires a baseline name" >&2
      exit 1
    fi
    baseline_name="$(sanitize_name "$1")"
    shift
    bench_args=()
    split_benchmark_args bench_args "$@"
    compare_baseline "${baseline_name}" "${bench_args[@]}"
    ;;
  compare-prev)
    bench_args=()
    split_benchmark_args bench_args "$@"
    previous="$(previous_baseline)"
    if [[ -z "${previous}" ]]; then
      echo "not enough benchmark history recorded yet" >&2
      exit 1
    fi
    compare_baseline "${previous}" "${bench_args[@]}"
    ;;
  list)
    ensure_layout
    if [[ -d "${BASELINE_DIR}" ]]; then
      find "${BASELINE_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
    fi
    ;;
  history)
    ensure_layout
    cat "${HISTORY_FILE}"
    ;;
  latest)
    latest_baseline
    ;;
  previous)
    previous_baseline
    ;;
  *)
    usage
    exit 1
    ;;
esac
