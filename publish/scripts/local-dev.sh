#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[1/3] Chay frontend dev o nen"
cd "$ROOT_DIR"
npm run dev:web &
WEB_PID=$!

echo "[2/3] Chay api local o nen"
npm run dev:api &
API_PID=$!

cleanup() {
  kill "$WEB_PID" "$API_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "[3/3] Chay worker local o foreground"
cd "$ROOT_DIR/publish/api-worker"
npm run dev
