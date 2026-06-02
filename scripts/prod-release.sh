#!/usr/bin/env bash
set -Eeuo pipefail

ARCHIVE_PATH="${ARCHIVE_PATH:-/opt/auction-platform.tar.gz}"
APP_DIR="${APP_DIR:-/opt/auction-platform-src}"
ADMIN_WEB_DIR="${ADMIN_WEB_DIR:-/var/www/auction-admin}"
API_SERVICE="${API_SERVICE:-auction-api}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3002/health}"
ADMIN_API_BASE="${ADMIN_API_BASE:-https://api-auction.toolmatrix.top}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
ENV_FILE="${ENV_FILE:-/etc/auction-api.env}"
NGINX_CONF="${NGINX_CONF:-/www/server/panel/vhost/nginx/auction-platform.conf}"
SERVICE_USER="${SERVICE_USER:-auction-api}"
SERVICE_GROUP="${SERVICE_GROUP:-auction-api}"
TAR_STRIP_COMPONENTS="${TAR_STRIP_COMPONENTS:-2}"
JOURNAL_LINES="${JOURNAL_LINES:-80}"
MIGRATION_COMMAND="${MIGRATION_COMMAND:-}"
DB_BACKUP_COMMAND="${DB_BACKUP_COMMAND:-}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"
ARCHIVE_PROJECT_PREFIX="${ARCHIVE_PROJECT_PREFIX:-products/auction-platform}"
SKIP_RELEASE_CONTENT_CHECK="${SKIP_RELEASE_CONTENT_CHECK:-false}"
DEPLOY_ADMIN="${DEPLOY_ADMIN:-true}"
DRY_RUN=false

timestamp="$(date +%Y%m%d%H%M%S)"
backup_app_dir=""
admin_backup_dir=""
api_release_completed=false
staging_app_dir=""
switch_started=false

required_release_files=(
  "package.json"
  "api/package.json"
  "api/src/config/env.ts"
  "api/src/modules/contentSafety/wechatContentSafety.service.ts"
  "api/src/modules/contentSafety/wechatMediaProxy.ts"
  "api/src/modules/contentSafety/wechatMediaProxy.routes.ts"
  "api/src/scripts/retryFailedImageChecks.ts"
  "scripts/prod-release.sh"
)

required_release_markers=(
  "api/package.json::content-safety:retry-failed-images"
  "api/src/config/env.ts::LOG_LEVEL"
  "api/src/modules/contentSafety/wechatContentSafety.service.ts::wechat_media_download_error"
  "api/src/modules/contentSafety/wechatContentSafety.service.ts::retryFailure"
  "api/src/modules/contentSafety/wechatContentSafety.service.ts::mediaCheck"
  "api/src/modules/contentSafety/wechatMediaProxy.ts::createWechatMediaCheckUrl"
  "api/src/modules/contentSafety/wechatMediaProxy.routes.ts::media-check-image"
  "api/src/scripts/retryFailedImageChecks.ts::manual_wechat_media_download_retry"
  "api/src/scripts/retryFailedImageChecks.ts::wechatMediaCheckUrlForImageCheck"
  "api/src/scripts/retryFailedImageChecks.ts::mediaCheckDetailForImageCheck"
)

usage() {
  cat <<'USAGE'
Usage:
  scripts/prod-release.sh [options]

Options:
  --archive PATH          Release archive path. Default: /opt/auction-platform.tar.gz
  --app-dir PATH          Application source directory. Default: /opt/auction-platform-src
  --admin-web-dir PATH    Admin web root. Default: /var/www/auction-admin
  --api-base URL          VITE_API_BASE for admin build. Default: https://api-auction.toolmatrix.top
  --health-url URL        API health check URL. Default: http://127.0.0.1:3002/health
  --service NAME          systemd service name. Default: auction-api
  --backup-dir PATH       Runtime backup directory. Default: /root/backups
  --strip-components N    tar --strip-components value. Default: 2
  --dry-run               Print planned operations without changing files or services
  -h, --help              Show this help

Environment:
  DB_BACKUP_COMMAND       Optional command to back up the database before release.
  MIGRATION_COMMAND       Optional command to run explicit database migrations.
  ROLLBACK_ON_FAILURE     true/false. Default: true.
  SERVICE_USER            Runtime owner for app files. Default: auction-api.
  SERVICE_GROUP           Runtime group for app files. Default: auction-api.
  ARCHIVE_PROJECT_PREFIX  Source prefix inside the archive. Default: products/auction-platform.
  SKIP_RELEASE_CONTENT_CHECK
                         true/false. Default: false. Only use true for deliberate rollback to an older package.
  DEPLOY_ADMIN            true/false. Default: true. Set false for backend-only releases.

Notes:
  Database migrations are intentionally not run by default. For releases without
  schema changes, upload /opt/auction-platform.tar.gz and run this script as root.
USAGE
}

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

run() {
  log "+ $*"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi
  "$@"
}

run_shell() {
  log "+ $*"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi
  bash -lc "$*"
}

run_in_dir() {
  local dir="$1"
  shift
  log "+ (cd $dir && $*)"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi
  (cd "$dir" && "$@")
}

run_in_app() {
  run_in_dir "$APP_DIR" "$@"
}

run_in_staging() {
  [ -n "$staging_app_dir" ] || die "Staging app directory is not initialized"
  run_in_dir "$staging_app_dir" "$@"
}

run_admin_build() {
  log "+ (cd $APP_DIR && VITE_API_BASE=$ADMIN_API_BASE npm run build --workspace @auction/admin)"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi
  (cd "$APP_DIR" && VITE_API_BASE="$ADMIN_API_BASE" npm run build --workspace @auction/admin)
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

archive_member_path() {
  local relative_path="${1#/}"
  printf '%s/%s' "${ARCHIVE_PROJECT_PREFIX%/}" "$relative_path"
}

archive_contains_file() {
  tar -tzf "$ARCHIVE_PATH" "$(archive_member_path "$1")" >/dev/null 2>&1
}

archive_file_contains() {
  tar -xOf "$ARCHIVE_PATH" "$(archive_member_path "$1")" | grep -q -- "$2"
}

directory_file_contains() {
  local root_dir="$1"
  local file="$2"
  local pattern="$3"
  grep -q -- "$pattern" "$root_dir/$file"
}

archive_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$ARCHIVE_PATH" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}'
  else
    printf '<sha256 tool unavailable>'
  fi
}

verify_archive_contents() {
  if [ "$SKIP_RELEASE_CONTENT_CHECK" = "true" ]; then
    log "SKIP_RELEASE_CONTENT_CHECK=true; skipping release archive content checks."
    return 0
  fi

  for file in "${required_release_files[@]}"; do
    archive_contains_file "$file" || die "Release archive is missing required file: $(archive_member_path "$file")"
  done

  local marker file pattern
  for marker in "${required_release_markers[@]}"; do
    file="${marker%%::*}"
    pattern="${marker#*::}"
    archive_file_contains "$file" "$pattern" || die "Release archive is missing marker '$pattern' in $(archive_member_path "$file")"
  done
}

verify_release_script_matches_archive() {
  if [ "$SKIP_RELEASE_CONTENT_CHECK" = "true" ]; then
    return 0
  fi
  if ! command -v sha256sum >/dev/null 2>&1; then
    log "sha256sum is unavailable; skipping release script self-check."
    return 0
  fi

  local running_script="${BASH_SOURCE[0]}"
  [ -f "$running_script" ] || return 0

  local archive_hash running_hash
  archive_hash="$(tar -xOf "$ARCHIVE_PATH" "$(archive_member_path "scripts/prod-release.sh")" | sha256sum | awk '{print $1}')"
  running_hash="$(sha256sum "$running_script" | awk '{print $1}')"
  if [ "$archive_hash" != "$running_hash" ]; then
    die "Release script does not match scripts/prod-release.sh inside $ARCHIVE_PATH. Extract and run the script from the new archive to avoid deploying with stale release logic."
  fi
}

verify_extracted_release_contents() {
  local root_dir="${1:-$APP_DIR}"
  if [ "$SKIP_RELEASE_CONTENT_CHECK" = "true" ]; then
    log "SKIP_RELEASE_CONTENT_CHECK=true; skipping extracted release content checks."
    return 0
  fi

  for file in "${required_release_files[@]}"; do
    [ -f "$root_dir/$file" ] || die "Extracted release is missing required file: $root_dir/$file"
  done

  local marker file pattern
  for marker in "${required_release_markers[@]}"; do
    file="${marker%%::*}"
    pattern="${marker#*::}"
    directory_file_contains "$root_dir" "$file" "$pattern" || die "Extracted release is missing marker '$pattern' in $root_dir/$file"
  done
}

verify_active_release_contents() {
  log "Verifying active app directory contents: $APP_DIR"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi

  [ -d "$APP_DIR" ] || die "Active app directory does not exist after switch: $APP_DIR"
  verify_extracted_release_contents "$APP_DIR"
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --archive)
        ARCHIVE_PATH="${2:-}"
        shift 2
        ;;
      --app-dir)
        APP_DIR="${2:-}"
        shift 2
        ;;
      --admin-web-dir)
        ADMIN_WEB_DIR="${2:-}"
        shift 2
        ;;
      --api-base)
        ADMIN_API_BASE="${2:-}"
        shift 2
        ;;
      --health-url)
        API_HEALTH_URL="${2:-}"
        shift 2
        ;;
      --service)
        API_SERVICE="${2:-}"
        shift 2
        ;;
      --backup-dir)
        BACKUP_DIR="${2:-}"
        shift 2
        ;;
      --strip-components)
        TAR_STRIP_COMPONENTS="${2:-}"
        shift 2
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done
}

validate_config() {
  [ -n "$ARCHIVE_PATH" ] || die "--archive cannot be empty"
  [ -n "$APP_DIR" ] || die "--app-dir cannot be empty"
  [ -n "$ADMIN_WEB_DIR" ] || die "--admin-web-dir cannot be empty"
  [ -n "$ADMIN_API_BASE" ] || die "--api-base cannot be empty"
  [ -n "$API_HEALTH_URL" ] || die "--health-url cannot be empty"
  [ -n "$API_SERVICE" ] || die "--service cannot be empty"
  [[ "$TAR_STRIP_COMPONENTS" =~ ^[0-9]+$ ]] || die "--strip-components must be a non-negative integer"
  [ -n "$ARCHIVE_PROJECT_PREFIX" ] || die "ARCHIVE_PROJECT_PREFIX cannot be empty"
  [[ "$DEPLOY_ADMIN" == "true" || "$DEPLOY_ADMIN" == "false" ]] || die "DEPLOY_ADMIN must be true or false"

  if [ "$DRY_RUN" = false ]; then
    require_command tar
    require_command grep
    require_command awk
    require_command npm
    require_command readlink
    require_command systemctl
    require_command journalctl
    require_command curl
    require_command tr

    [ "$(id -u)" -eq 0 ] || die "Please run as root on the production server"
    [ -f "$ARCHIVE_PATH" ] || die "Release archive not found: $ARCHIVE_PATH"
    tar -tzf "$ARCHIVE_PATH" >/dev/null
    verify_archive_contents
    verify_release_script_matches_archive
  fi
}

backup_runtime() {
  run mkdir -p "$BACKUP_DIR"

  if [ -n "$DB_BACKUP_COMMAND" ]; then
    run_shell "$DB_BACKUP_COMMAND"
  else
    log "DB_BACKUP_COMMAND is empty; skipping database backup."
  fi

  local backup_file="$BACKUP_DIR/auction_runtime_$timestamp.tar.gz"
  local entries=()
  [ -e "$APP_DIR" ] && entries+=("$APP_DIR")
  [ -e "$ENV_FILE" ] && entries+=("$ENV_FILE")
  [ -e "$NGINX_CONF" ] && entries+=("$NGINX_CONF")
  [ -e "$ADMIN_WEB_DIR" ] && entries+=("$ADMIN_WEB_DIR")

  if [ "${#entries[@]}" -eq 0 ]; then
    log "No runtime files found for tar backup."
    return 0
  fi

  log "+ tar -czf $backup_file ${entries[*]}"
  if [ "$DRY_RUN" = false ]; then
    tar -czf "$backup_file" "${entries[@]}"
  fi
}

stop_service() {
  log "+ systemctl stop $API_SERVICE || true"
  if [ "$DRY_RUN" = false ]; then
    systemctl stop "$API_SERVICE" || true
  fi
}

prepare_release() {
  staging_app_dir="${APP_DIR}.staging.${timestamp}"
  if [ -e "$staging_app_dir" ]; then
    die "Staging app directory already exists: $staging_app_dir"
  fi

  run mkdir -p "$staging_app_dir"
  run tar --warning=no-unknown-keyword -xzf "$ARCHIVE_PATH" -C "$staging_app_dir" --strip-components="$TAR_STRIP_COMPONENTS"

  if [ "$DRY_RUN" = false ] && [ ! -f "$staging_app_dir/package.json" ]; then
    die "package.json not found after extraction. Check archive layout or --strip-components."
  fi
  if [ "$DRY_RUN" = false ]; then
    verify_extracted_release_contents "$staging_app_dir"
  fi
}

install_and_verify() {
  run_in_staging npm ci --include=optional
  run_in_staging npm run check:native-deps
  run_in_staging npm run typecheck
  run_in_staging npm test
}

run_migrations() {
  if [ -n "$MIGRATION_COMMAND" ]; then
    run_shell "$MIGRATION_COMMAND"
  else
    log "MIGRATION_COMMAND is empty; skipping database migrations."
  fi
}

fix_permissions() {
  local target_dir="${1:-$APP_DIR}"
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    run chown -R "$SERVICE_USER:$SERVICE_GROUP" "$target_dir"
  else
    log "Service user $SERVICE_USER does not exist; skipping chown."
  fi
}

switch_release() {
  [ -n "$staging_app_dir" ] || die "Staging app directory is not initialized"
  switch_started=true
  stop_service

  if [ -e "$APP_DIR" ]; then
    backup_app_dir="${APP_DIR}.bak.${timestamp}"
    run mv "$APP_DIR" "$backup_app_dir"
  fi

  run mv "$staging_app_dir" "$APP_DIR"
  staging_app_dir=""
}

start_and_check_api() {
  run systemctl daemon-reload
  run systemctl enable "$API_SERVICE"
  run systemctl start "$API_SERVICE"
  run systemctl status "$API_SERVICE" --no-pager
  run journalctl -u "$API_SERVICE" -n "$JOURNAL_LINES" --no-pager
  run curl -fsS "$API_HEALTH_URL"
}

verify_service_runtime() {
  log "Verifying $API_SERVICE runtime cwd is $APP_DIR"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi

  local pid expected_cwd actual_cwd cmdline
  pid="$(systemctl show -p MainPID --value "$API_SERVICE" 2>/dev/null || true)"
  if ! [[ "$pid" =~ ^[0-9]+$ ]] || [ "$pid" -le 0 ]; then
    die "$API_SERVICE is not running after start; MainPID=$pid"
  fi

  expected_cwd="$(readlink -f "$APP_DIR")"
  actual_cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"

  if [ "$actual_cwd" != "$expected_cwd" ]; then
    die "$API_SERVICE is running from the wrong directory. pid=$pid expected_cwd=$expected_cwd actual_cwd=${actual_cwd:-<unavailable>} cmdline=${cmdline:-<unavailable>}"
  fi

  log "$API_SERVICE runtime pid: $pid"
  log "$API_SERVICE runtime cmdline: ${cmdline:-<unavailable>}"
  api_release_completed=true
}

deploy_admin() {
  run_admin_build

  if [ -e "$ADMIN_WEB_DIR" ]; then
    admin_backup_dir="${ADMIN_WEB_DIR}.bak.${timestamp}"
    run mv "$ADMIN_WEB_DIR" "$admin_backup_dir"
  fi

  run mkdir -p "$ADMIN_WEB_DIR"
  run cp -a "$APP_DIR/admin/dist/." "$ADMIN_WEB_DIR/"
}

rollback() {
  local exit_code="$1"
  if [ "$exit_code" -eq 0 ] || [ "$DRY_RUN" = true ]; then
    return 0
  fi

  log "Release failed with exit code $exit_code."
  if [ "$ROLLBACK_ON_FAILURE" != "true" ]; then
    log "Automatic rollback is disabled. App backup: ${backup_app_dir:-<none>}; admin backup: ${admin_backup_dir:-<none>}."
    return 0
  fi

  log "Attempting automatic rollback."

  if [ "$api_release_completed" = true ]; then
    log "API release already passed health check; keeping new app directory and limiting rollback to admin assets."
    if [ -n "$admin_backup_dir" ] && [ -d "$admin_backup_dir" ]; then
      rm -rf "$ADMIN_WEB_DIR" || true
      mv "$admin_backup_dir" "$ADMIN_WEB_DIR" || true
    fi
    systemctl status "$API_SERVICE" --no-pager || true
    return 0
  fi

  if [ "$switch_started" != true ]; then
    log "Release failed before switching app directory; leaving current API runtime in place."
    if [ -n "$staging_app_dir" ] && [ -d "$staging_app_dir" ]; then
      rm -rf "$staging_app_dir" || true
    fi
    return 0
  fi

  systemctl stop "$API_SERVICE" || true

  if [ -n "$staging_app_dir" ] && [ -d "$staging_app_dir" ]; then
    rm -rf "$staging_app_dir" || true
  fi

  if [ -n "$backup_app_dir" ] && [ -d "$backup_app_dir" ]; then
    if [ -e "$APP_DIR" ]; then
      mv "$APP_DIR" "${APP_DIR}.failed.${timestamp}" || true
    fi
    mv "$backup_app_dir" "$APP_DIR" || true
    if id "$SERVICE_USER" >/dev/null 2>&1; then
      chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR" || true
    fi
  fi

  if [ -n "$admin_backup_dir" ] && [ -d "$admin_backup_dir" ]; then
    rm -rf "$ADMIN_WEB_DIR" || true
    mv "$admin_backup_dir" "$ADMIN_WEB_DIR" || true
  fi

  systemctl start "$API_SERVICE" || true
  systemctl status "$API_SERVICE" --no-pager || true
}

main() {
  parse_args "$@"
  validate_config
  trap 'rollback "$?"' EXIT

  log "Starting production release."
  log "Archive: $ARCHIVE_PATH"
  log "Archive sha256: $(archive_sha256)"
  log "App dir: $APP_DIR"
  log "Admin web dir: $ADMIN_WEB_DIR"
  log "Admin API base: $ADMIN_API_BASE"

  backup_runtime
  prepare_release
  install_and_verify
  fix_permissions "$staging_app_dir"
  switch_release
  verify_active_release_contents
  run_migrations
  start_and_check_api
  verify_service_runtime
  if [ "$DEPLOY_ADMIN" = "true" ]; then
    deploy_admin
  else
    log "DEPLOY_ADMIN=false; skipping admin build and static deployment."
  fi

  log "Production release completed."
  log "Previous app backup: ${backup_app_dir:-<none>}"
  log "Previous admin backup: ${admin_backup_dir:-<none>}"
}

main "$@"
