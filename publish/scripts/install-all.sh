#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[1/4] npm install root package"
cd "$ROOT_DIR" && npm install

echo "[2/4] npm install apps/web"
cd "$ROOT_DIR/apps/web" && npm install

echo "[3/4] npm install apps/api"
cd "$ROOT_DIR/apps/api" && npm install

echo "[4/4] npm install publish components"
cd "$ROOT_DIR/publish/api-worker" && npm install
cd "$ROOT_DIR/publish/web" && npm install

echo "[OK] Install xong"