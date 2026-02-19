#!/usr/bin/env bash
set -euo pipefail

# Must be run from backend folder
ROOT_DIR="$(cd .. && pwd)"

#Helpers
source "${ROOT_DIR}/dev/common.sh"

#path to environment vars
ENV_FILE="./.env"

ensure_docker_ready
require_file "./docker-compose.yml"
echo "[redis] Starting Redis (build + up)..."
compose_up_here "${ENV_FILE}" "true"