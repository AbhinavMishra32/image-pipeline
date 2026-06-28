#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLOUD_INIT_FILE="$ROOT_DIR/deploy/cloud-init.docker.yml"
COMPOSE_FILES=(-f deploy/docker-compose.prod.yml)
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/image_pipeline_do}"
REMOTE_DIR="${REMOTE_DIR:-/opt/image-pipeline}"

DROPLET_NAME="${DROPLET_NAME:-image-pipeline-prod}"
DO_REGION="${DO_REGION:-blr1}"
DO_SIZE="${DO_SIZE:-s-2vcpu-4gb}"
DO_IMAGE="${DO_IMAGE:-ubuntu-24-04-x64}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command doctl
require_command ssh
require_command ssh-keygen
require_command tar
require_command mktemp
require_command python3
require_command curl

read_remote_env_default() {
  local key="$1"
  local remote_env_file
  remote_env_file="$2"

  ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" \
    "test -f '$remote_env_file' && awk -F= '\$1 == \"$key\" { sub(/^[^=]*=/, \"\"); print; exit }' '$remote_env_file'" \
    2>/dev/null || true
}

if [[ -z "${DO_API_TOKEN:-}" ]]; then
  echo "Set DO_API_TOKEN in your environment before running this script." >&2
  exit 1
fi

if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Set OPENROUTER_API_KEY in your environment before running this script." >&2
  exit 1
fi

doctl auth init -t "$DO_API_TOKEN" >/dev/null

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "$DROPLET_NAME"
fi

SSH_KEY_NAME="${DROPLET_NAME}-key"
SSH_KEY_ID="$(doctl compute ssh-key list --format ID,Name --no-header | awk -v name="$SSH_KEY_NAME" '$2 == name { print $1; exit }')"

if [[ -z "$SSH_KEY_ID" ]]; then
  doctl compute ssh-key import "$SSH_KEY_NAME" --public-key-file "${SSH_KEY_PATH}.pub" >/dev/null
  SSH_KEY_ID="$(doctl compute ssh-key list --format ID,Name --no-header | awk -v name="$SSH_KEY_NAME" '$2 == name { print $1; exit }')"
fi

if [[ -z "$SSH_KEY_ID" ]]; then
  echo "Unable to resolve DigitalOcean SSH key ID." >&2
  exit 1
fi

if doctl compute droplet list --format Name --no-header | grep -Fxq "$DROPLET_NAME"; then
  echo "Droplet $DROPLET_NAME already exists. Reusing it."
else
  doctl compute droplet create "$DROPLET_NAME" \
    --region "$DO_REGION" \
    --size "$DO_SIZE" \
    --image "$DO_IMAGE" \
    --ssh-keys "$SSH_KEY_ID" \
    --user-data-file "$CLOUD_INIT_FILE" \
    --enable-monitoring \
    --wait >/dev/null
fi

DROPLET_IP="$(doctl compute droplet list --format Name,PublicIPv4 --no-header | awk -v name="$DROPLET_NAME" '$1 == name { print $2; exit }')"

if [[ -z "$DROPLET_IP" ]]; then
  echo "Unable to determine droplet IP." >&2
  exit 1
fi

echo "Droplet IP: $DROPLET_IP"
echo "Waiting for SSH..."

for _ in {1..60}; do
  if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "echo ready" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

if ! ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "echo ready" >/dev/null 2>&1; then
  echo "Droplet SSH is not ready." >&2
  exit 1
fi

REMOTE_ENV_FILE="$REMOTE_DIR/.env.production"

echo "Waiting for first boot provisioning..."

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "
  set -euo pipefail
  if command -v cloud-init >/dev/null 2>&1; then
    cloud-init status --wait || true
  fi
  for _ in \$(seq 1 120); do
    if ! fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && ! fuser /var/lib/apt/lists/lock >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y docker.io docker-compose-v2
  systemctl enable docker
  systemctl start docker
  docker --version
  docker compose version
"

existing_postgres_db="${POSTGRES_DB:-$(read_remote_env_default POSTGRES_DB "$REMOTE_ENV_FILE")}"
existing_postgres_user="${POSTGRES_USER:-$(read_remote_env_default POSTGRES_USER "$REMOTE_ENV_FILE")}"
existing_postgres_password="${POSTGRES_PASSWORD:-$(read_remote_env_default POSTGRES_PASSWORD "$REMOTE_ENV_FILE")}"
existing_minio_root_user="${MINIO_ROOT_USER:-$(read_remote_env_default MINIO_ROOT_USER "$REMOTE_ENV_FILE")}"
existing_minio_root_password="${MINIO_ROOT_PASSWORD:-$(read_remote_env_default MINIO_ROOT_PASSWORD "$REMOTE_ENV_FILE")}"
existing_minio_bucket="${MINIO_BUCKET:-$(read_remote_env_default MINIO_BUCKET "$REMOTE_ENV_FILE")}"
existing_jwt_secret="${JWT_SECRET:-$(read_remote_env_default JWT_SECRET "$REMOTE_ENV_FILE")}"
existing_database_url="${DATABASE_URL:-$(read_remote_env_default DATABASE_URL "$REMOTE_ENV_FILE")}"
existing_redis_url="${REDIS_URL:-$(read_remote_env_default REDIS_URL "$REMOTE_ENV_FILE")}"
existing_cors_origins="${CORS_ORIGINS:-$(read_remote_env_default CORS_ORIGINS "$REMOTE_ENV_FILE")}"
existing_auth_rate_limit_max="${AUTH_RATE_LIMIT_MAX:-$(read_remote_env_default AUTH_RATE_LIMIT_MAX "$REMOTE_ENV_FILE")}"
existing_auth_rate_limit_window_ms="${AUTH_RATE_LIMIT_WINDOW_MS:-$(read_remote_env_default AUTH_RATE_LIMIT_WINDOW_MS "$REMOTE_ENV_FILE")}"
existing_upload_rate_limit_max="${UPLOAD_RATE_LIMIT_MAX:-$(read_remote_env_default UPLOAD_RATE_LIMIT_MAX "$REMOTE_ENV_FILE")}"
existing_upload_rate_limit_window_ms="${UPLOAD_RATE_LIMIT_WINDOW_MS:-$(read_remote_env_default UPLOAD_RATE_LIMIT_WINDOW_MS "$REMOTE_ENV_FILE")}"

POSTGRES_DB="${existing_postgres_db:-image_pipeline}"
POSTGRES_USER="${existing_postgres_user:-image_pipeline}"
POSTGRES_PASSWORD="${existing_postgres_password:-$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(24))
PY
)}"
MINIO_ROOT_USER="${existing_minio_root_user:-minioadmin}"
MINIO_ROOT_PASSWORD="${existing_minio_root_password:-$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(24))
PY
)}"
MINIO_BUCKET="${existing_minio_bucket:-media}"
JWT_SECRET="${existing_jwt_secret:-$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)}"
OPENROUTER_CAPTION_MODEL="${OPENROUTER_CAPTION_MODEL:-openrouter/free}"
OPENROUTER_LABEL_MODEL="${OPENROUTER_LABEL_MODEL:-openrouter/free}"
OPENROUTER_SAFETY_MODEL="${OPENROUTER_SAFETY_MODEL:-nvidia/nemotron-3.5-content-safety:free}"
DATABASE_URL="${existing_database_url:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}}"
REDIS_URL="${existing_redis_url:-redis://redis:6379}"
CORS_ORIGINS="${existing_cors_origins:-http://${DROPLET_IP}}"
AUTH_RATE_LIMIT_MAX="${existing_auth_rate_limit_max:-10}"
AUTH_RATE_LIMIT_WINDOW_MS="${existing_auth_rate_limit_window_ms:-60000}"
UPLOAD_RATE_LIMIT_MAX="${existing_upload_rate_limit_max:-30}"
UPLOAD_RATE_LIMIT_WINDOW_MS="${existing_upload_rate_limit_window_ms:-60000}"

ENV_FILE="$(mktemp)"
cat >"$ENV_FILE" <<EOF
JWT_SECRET=${JWT_SECRET}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
OPENROUTER_CAPTION_MODEL=${OPENROUTER_CAPTION_MODEL}
OPENROUTER_LABEL_MODEL=${OPENROUTER_LABEL_MODEL}
OPENROUTER_SAFETY_MODEL=${OPENROUTER_SAFETY_MODEL}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
CORS_ORIGINS=${CORS_ORIGINS}
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_BUCKET=${MINIO_BUCKET}
AUTH_RATE_LIMIT_MAX=${AUTH_RATE_LIMIT_MAX}
AUTH_RATE_LIMIT_WINDOW_MS=${AUTH_RATE_LIMIT_WINDOW_MS}
UPLOAD_RATE_LIMIT_MAX=${UPLOAD_RATE_LIMIT_MAX}
UPLOAD_RATE_LIMIT_WINDOW_MS=${UPLOAD_RATE_LIMIT_WINDOW_MS}
EOF

echo "Copying repository to droplet..."

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "mkdir -p '$REMOTE_DIR'"
tar \
  --disable-copyfile \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude=".turbo" \
  --exclude="dist" \
  -czf - -C "$ROOT_DIR" . \
  | ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "tar -xzf - -C '$REMOTE_DIR'"

cat "$ENV_FILE" \
  | ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "cat > '$REMOTE_DIR/.env.production'"

rm -f "$ENV_FILE"

echo "Building and starting the stack..."

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "root@$DROPLET_IP" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  docker compose --project-directory . --env-file .env.production ${COMPOSE_FILES[*]} up --build -d
"

echo "Waiting for health check..."

for _ in {1..60}; do
  if curl -fsS "http://$DROPLET_IP/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

curl -fsS "http://$DROPLET_IP/api/health"
echo
echo "Deployment finished."
echo "App URL: http://$DROPLET_IP"
echo "Seeded login: admin@example.com / password123"
