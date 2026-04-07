#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(cd "$SCRIPT_DIR/../api-worker" && pwd)"

echo "[1/1] Deploy Worker"
cd "$WORKER_DIR"
npm run deploy