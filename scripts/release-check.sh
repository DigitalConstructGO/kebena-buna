#!/usr/bin/env bash
#
# Everything a build must pass before it ships, in the order that fails fastest:
#
#   1. types        svelte-check (0 errors)
#   2. unit tests   vitest — pricing, bundles, discounts, cells, schemas…
#   3. build        npm run build (skipped with --use-build: deploy.sh has just built)
#   4. bundle       npm run verify:build — build/ runs without node_modules
#
#   npm run release:check
#   npm run release:check -- --use-build
#
# The browser tests (`npm run test:e2e`) are not part of it: they place real orders in the local
# database, which is the one the server was first loaded from. Run them by hand before a deploy
# that changes checkout or payments.
set -euo pipefail
cd "$(dirname "$0")/.."

USE_BUILD=0
for arg in "$@"; do
	case "$arg" in
	--use-build) USE_BUILD=1 ;;
	*)
		echo "unknown option: $arg" >&2
		exit 2
		;;
	esac
done

STEP=""
STARTED=$(date +%s)
step() {
	STEP="$1"
	printf '\n\033[1m→ %s\033[0m\n' "$1"
}
failed() {
	printf '\n\033[1;31m✗ Release check failed at: %s\033[0m\n' "$STEP" >&2
	echo "  Nothing was shipped." >&2
}
trap failed ERR

step "Types (svelte-check)"
npm run check --silent

step "Unit tests"
npm run test:unit --silent -- --run

if [ "$USE_BUILD" = 0 ]; then
	step "Build"
	npm run build --silent
else
	step "Using the build just made"
	[ -f build/handler.js ] || {
		echo "build/ has no handler.js" >&2
		false
	}
	echo "   ok"
fi

step "Bundle is self-contained"
npm run verify:build --silent

trap - ERR
printf '\n\033[1;32m✓ Every check passed in %ss — this build may ship.\033[0m\n' "$(($(date +%s) - STARTED))"
