#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

print_usage() {
  cat <<'USAGE'
Opnix installer

Usage: ./install.sh [options]

Options:
  -y, --yes, --non-interactive   Run without interactive prompts (assumes defaults)
      --mode <new|existing>      Force wizard mode (overrides auto detection)
      --skip-wizard              Skip running the setup wizard (directories still prepared)
  -h, --help                     Show this help message
USAGE
}

log_info() {
  printf '[opnix] %s\n' "$1"
}

log_error() {
  printf '[opnix] ERROR: %s\n' "$1" >&2
}

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command '$1' not found in PATH."
    exit 1
  fi
}

validate_node_version() {
  local version major
  version="$(node -v 2>/dev/null | sed 's/^v//')"
  major="${version%%.*}"
  if [[ -z "$major" ]]; then
    log_error "Unable to determine Node.js version."
    exit 1
  fi
  if (( major < 18 )); then
    log_error "Node.js 18 or newer is required (found v$version)."
    exit 1
  fi
}

parse_args() {
  WIZARD_MODE=""
  NON_INTERACTIVE=0
  SKIP_WIZARD=0

  while (($#)); do
    case "$1" in
      -y|--yes|--non-interactive)
        NON_INTERACTIVE=1
        shift
        ;;
      --mode)
        if [[ $# -lt 2 ]]; then
          log_error "--mode requires an argument."
          exit 1
        fi
        WIZARD_MODE="$2"
        shift 2
        ;;
      --mode=*)
        WIZARD_MODE="${1#*=}"
        shift
        ;;
      --skip-wizard)
        SKIP_WIZARD=1
        shift
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
      *)
        log_error "Unknown argument: $1"
        print_usage
        exit 1
        ;;
    esac
  done

  if [[ -n "$WIZARD_MODE" ]]; then
    WIZARD_MODE="${WIZARD_MODE,,}"
    if [[ "$WIZARD_MODE" != "new" && "$WIZARD_MODE" != "existing" ]]; then
      log_error "Invalid mode '$WIZARD_MODE'. Expected 'new' or 'existing'."
      exit 1
    fi
  fi
}

prepare_environment() {
  ensure_command node
  ensure_command npm
  validate_node_version
}

run_installer() {
  local bundle_path=".opnix/runtime/bundle.tar.gz"

  if (( NON_INTERACTIVE )); then
    export OPNIX_INSTALL_NON_INTERACTIVE=1
  fi
  if [[ -n "$WIZARD_MODE" ]]; then
    export OPNIX_INSTALL_MODE="$WIZARD_MODE"
  fi
  if (( SKIP_WIZARD )); then
    export OPNIX_INSTALL_SKIP_WIZARD=1
  fi

  if [[ -f "$bundle_path" ]]; then
    log_info "Runtime bundle archive detected at $bundle_path (will unpack if required)."
  fi

  log_info "Starting neon installation CLI..."
  node "scripts/installCli.js"
}

main() {
  parse_args "$@"
  prepare_environment
  run_installer
  log_info "Installer finished. Use 'npm start' to launch the server."
}

main "$@"
