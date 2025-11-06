#!/bin/bash
set -e
PORT=${PORT:-5174}
IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || ipconfig getifaddr en2 || echo "127.0.0.1")
URLS=(
	"http://127.0.0.1:${PORT}/"          # loopback IPv4 (spesso funziona su iOS Simulator)
	"http://[::1]:${PORT}/"               # loopback IPv6 (se il dev server ascolta su ::1)
	"http://${IP}:${PORT}/"               # IP LAN del Mac
)

for u in "${URLS[@]}"; do
	xcrun simctl openurl booted "$u" 2>/dev/null || true
	echo "Simulator URL tried: $u"
done
