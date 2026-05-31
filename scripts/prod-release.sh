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
DRY_RUN=false

timestamp="$(date +%Y%m%d%H%M%S)"
backup_app_dir=""
admin_backup_dir=""

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

run_in_app() {
  log "+ (cd $APP_DIR && $*)"
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi
  (cd "$APP_DIR" && "$@")
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

  if [ "$DRY_RUN" = false ]; then
    require_command tar
    require_command npm
    require_command systemctl
    require_command journalctl
    require_command curl

    [ "$(id -u)" -eq 0 ] || die "Please run as root on the production server"
    [ -f "$ARCHIVE_PATH" ] || die "Release archive not found: $ARCHIVE_PATH"
    tar -tzf "$ARCHIVE_PATH" >/dev/null
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

extract_release() {
  if [ -e "$APP_DIR" ]; then
    backup_app_dir="${APP_DIR}.bak.${timestamp}"
    run mv "$APP_DIR" "$backup_app_dir"
  fi

  run mkdir -p "$APP_DIR"
  run tar --warning=no-unknown-keyword -xzf "$ARCHIVE_PATH" -C "$APP_DIR" --strip-components="$TAR_STRIP_COMPONENTS"

  if [ "$DRY_RUN" = false ] && [ ! -f "$APP_DIR/package.json" ]; then
    die "package.json not found after extraction. Check archive layout or --strip-components."
  fi
}

install_and_verify() {
  run_in_app npm ci --include=optional
  run_in_app npm run check:native-deps
  run_in_app npm run typecheck
  run_in_app npm test

  if [ -n "$MIGRATION_COMMAND" ]; then
    run_shell "$MIGRATION_COMMAND"
  else
    log "MIGRATION_COMMAND is empty; skipping database migrations."
  fi
}

fix_permissions() {
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    run chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR"
  else
    log "Service user $SERVICE_USER does not exist; skipping chown."
  fi
}

start_and_check_api() {
  run systemctl daemon-reload
  run systemctl enable "$API_SERVICE"
  run systemctl start "$API_SERVICE"
  run systemctl status "$API_SERVICE" --no-pager
  run journalctl -u "$API_SERVICE" -n "$JOURNAL_LINES" --no-pager
  run curl -fsS "$API_HEALTH_URL"
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
  systemctl stop "$API_SERVICE" || true

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
  log "App dir: $APP_DIR"
  log "Admin web dir: $ADMIN_WEB_DIR"
  log "Admin API base: $ADMIN_API_BASE"

  backup_runtime
  stop_service
  extract_release
  install_and_verify
  fix_permissions
  start_and_check_api
  deploy_admin

  log "Production release completed."
  log "Previous app backup: ${backup_app_dir:-<none>}"
  log "Previous admin backup: ${admin_backup_dir:-<none>}"
}

main "$@"
