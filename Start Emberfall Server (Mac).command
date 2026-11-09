#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."; open https://nodejs.org; read -p "Press Enter to close"; exit 1; fi
echo "Starting Emberfall... keep this window open while people play."
(sleep 1.5; open http://localhost:8080) &
node server.js
