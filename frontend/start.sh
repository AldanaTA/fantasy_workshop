
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd .. && pwd)"
# shellcheck disable=SC1090
source "${ROOT_DIR}/dev/common.sh"

ENV_FILE="./.env"

ensure_docker_ready
require_file "./docker-compose.yml"
require_file "${ENV_FILE}"

echo "[frontend] Starting frontend (build + up)..."
compose_up_here "${ENV_FILE}" "true"

echo "[frontend] Status:"
docker compose ps
