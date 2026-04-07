#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/../web" && pwd)"

echo "[1/1] Deploy frontend Next.js len Cloudflare Workers"
cd "$WEB_DIR"
npm run deploy:worker
