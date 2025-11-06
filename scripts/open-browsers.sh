#!/bin/bash
set -e
PORT=${PORT:-5174}
# Open Chrome to 127.0.0.1 to avoid IPv6/host mapping issues
open -a "Google Chrome" "http://127.0.0.1:${PORT}/" || true
# Open iOS Simulator Safari via our helper script
PORT=${PORT} bash "$(dirname "$0")/start-sim.sh" || true
