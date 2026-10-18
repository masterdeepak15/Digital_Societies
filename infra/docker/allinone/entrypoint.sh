#!/bin/bash
# First start: makes the data folders, creates secrets and the database. Every start: hands over to the supervisor.
set -euo pipefail

DATA=/data
CONF=$DATA/config/secrets.env
mkdir -p "$DATA"/{postgres,redis,minio,config,backups,caddy,caddy-config}

# ── Secrets: use what the owner set, else what was generated before, else make one (and remember it) ──
touch "$CONF"; chmod 600 "$CONF"
random() { head -c 64 /dev/urandom | base64 | tr -d '/+=\n' | head -c "${1:-48}"; }
secret() {            # secret NAME [length]
  local name=$1 len=${2:-48} current="${!1:-}"
  if [ -z "$current" ]; then
    current=$(grep -E "^${name}=" "$CONF" | head -1 | cut -d= -f2- || true)
    if [ -z "$current" ]; then current=$(random "$len"); echo "${name}=${current}" >> "$CONF"; fi
  fi
  export "$name=$current"
}
secret POSTGRES_PASSWORD
secret JWT_SECRET_KEY 64
secret QR_TOKEN_SECRET_KEY 64
secret JITSI_APP_SECRET 32
secret MINIO_ACCESS_KEY 20
secret MINIO_SECRET_KEY 40

# ── Settings the API reads (names follow its configuration sections) ──
export ASPNETCORE_URLS=http://127.0.0.1:5000
export ConnectionStrings__Postgres="Host=127.0.0.1;Port=5432;Database=digital_societies;Username=ds_app;Password=${POSTGRES_PASSWORD}"
export ConnectionStrings__Redis="127.0.0.1:6379"
export Jwt__Issuer="${JWT_ISSUER:-digital-societies}"
export Jwt__Audience="${JWT_AUDIENCE:-digital-societies-clients}"
export Jwt__SecretKey="$JWT_SECRET_KEY"
export QrToken__SecretKey="$QR_TOKEN_SECRET_KEY"
export AllowedOrigins__0="${DS_PUBLIC_URL:-http://localhost:8080}"
export Demo__Enabled="${DEMO_ENABLED:-false}"
export Notification__Email__Host="${SMTP_HOST:-}"
export Notification__Email__Port="${SMTP_PORT:-587}"
export Notification__Email__Security="${SMTP_SECURITY:-StartTls}"
export Notification__Email__Username="${SMTP_USERNAME:-}"
export Notification__Email__Password="${SMTP_PASSWORD:-}"
export Notification__Email__FromAddress="${SMTP_FROM_ADDRESS:-${SMTP_USERNAME:-}}"
export Notification__Email__FromName="${SMTP_FROM_NAME:-Digital Societies}"
export Notification__Sms__ApiKey="${MSG91_API_KEY:-}"
export Storage__Minio__Endpoint="127.0.0.1:9000"
export Storage__Minio__AccessKey="$MINIO_ACCESS_KEY"
export Storage__Minio__SecretKey="$MINIO_SECRET_KEY"
export Storage__Minio__UseSSL=false
export Storage__AccessKey="$MINIO_ACCESS_KEY"
export Storage__SecretKey="$MINIO_SECRET_KEY"
export Calling__Provider=JitsiMeet
export Calling__Jitsi__ServerUrl="${JITSI_SERVER_URL:-https://meet.jit.si}"
export Calling__Jitsi__AppSecret="$JITSI_APP_SECRET"
export MINIO_ROOT_USER="$MINIO_ACCESS_KEY" MINIO_ROOT_PASSWORD="$MINIO_SECRET_KEY"
export API_URL=http://127.0.0.1:5000

# ── Ownership: each part runs as its own low-privilege user ──
chown -R postgres:postgres "$DATA/postgres"; chmod 700 "$DATA/postgres"
chown -R redis:redis "$DATA/redis"
chown -R dsapp:dsapp "$DATA/minio" "$DATA/caddy" "$DATA/caddy-config"

# ── Database: created once, on the first start ──
if [ ! -s "$DATA/postgres/PG_VERSION" ]; then
  echo "[ds] first start: creating the database"
  pwfile=$(mktemp); printf '%s' "$POSTGRES_PASSWORD" > "$pwfile"; chown postgres "$pwfile"
  gosu postgres /usr/lib/postgresql/16/bin/initdb -D "$DATA/postgres" --username=ds_app --pwfile="$pwfile" \
      --auth-local=trust --auth-host=scram-sha-256 --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  rm -f "$pwfile"
  gosu postgres /usr/lib/postgresql/16/bin/pg_ctl -D "$DATA/postgres" -w -o "-c listen_addresses='' -c unix_socket_directories=/var/run/postgresql" start >/dev/null
  psql -h /var/run/postgresql -U ds_app -d postgres -v ON_ERROR_STOP=1 -q <<SQL
CREATE DATABASE digital_societies;
\connect digital_societies
CREATE SCHEMA IF NOT EXISTS identity;
ALTER DATABASE digital_societies SET app.current_society_id = '';
SQL
  gosu postgres /usr/lib/postgresql/16/bin/pg_ctl -D "$DATA/postgres" -w stop >/dev/null
  echo "[ds] database ready"
fi

echo "[ds] starting Digital Societies on port 8080 (data in $DATA)"
exec /usr/bin/supervisord -c /etc/supervisor/ds-supervisord.conf
