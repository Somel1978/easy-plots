#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Usage: bash tools/package.sh [--output /path/to/artifact-directory]
npm run check
npm run spec:check
npm run review:check
python tests/browser/editor-smoke.py
python tools/package.py "$@"
