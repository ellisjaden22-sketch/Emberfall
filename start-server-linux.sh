#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Install Node.js (https://nodejs.org) first."; exit 1; }
(sleep 1.5; xdg-open http://localhost:8080 >/dev/null 2>&1) &
node server.js
