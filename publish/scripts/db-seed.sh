#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[1/1] Seed Neon data"
echo "[INFO] Script se uu tien doc NEON_DATABASE_URL tu publish/api-worker/.dev.vars neu file ton tai."
cd "$ROOT_DIR"
node publish/data/import-to-neon.mjs
