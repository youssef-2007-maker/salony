#!/usr/bin/env bash
# Salony dev launcher — starts the backend and Expo together.
# Run from the project root:  ./scripts/dev.sh
#
# What it does:
#   1. Installs root + backend deps if node_modules is missing
#   2. Seeds the SQLite DB on first run
#   3. Boots the backend (background) and Expo (foreground)
#   4. Tears down the backend cleanly when you press Ctrl-C
#
# If you've put AI keys in backend/.env, the AI Hairstyle / AI Marketing
# screens will go live. Otherwise the app runs in template-fallback mode.

set -euo pipefail
cd "$(dirname "$0")/.."

# ---- deps ----
if [ ! -d node_modules ]; then
  echo ">>> installing app deps"
  npm install
fi
if [ ! -d backend/node_modules ]; then
  echo ">>> installing backend deps"
  (cd backend && npm install)
fi

# If package.json mentions a dep that isn't actually in node_modules (e.g. we
# added a new one since the last install), `expo install` it now. This is the
# common case after pulling new code.
need_install=()
for dep in expo-image-picker expo-image-manipulator; do
  if ! grep -q "\"$dep\":" package.json; then continue; fi
  if [ ! -d "node_modules/$dep" ]; then need_install+=("$dep"); fi
done
if [ "${#need_install[@]}" -gt 0 ]; then
  echo ">>> installing missing Expo deps: ${need_install[*]}"
  npx expo install "${need_install[@]}"
fi

# ---- DB seed (first run only) ----
if [ ! -f backend/salony.db ]; then
  echo ">>> seeding SQLite database"
  (cd backend && node db.js --seed)
fi

# ---- load .env into the backend if present ----
BACKEND_ENV=""
if [ -f backend/.env ]; then
  echo ">>> loading backend/.env"
  set -a
  # shellcheck disable=SC1091
  source backend/.env
  set +a
fi

# ---- start backend in the background ----
echo ">>> starting backend on :${PORT:-4000}"
(cd backend && node server.js) &
BACKEND_PID=$!

cleanup() {
  echo
  echo ">>> stopping backend (pid $BACKEND_PID)"
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Give backend a beat to bind before Expo connects to it.
sleep 1

# ---- start Expo in the foreground ----
echo ">>> starting Expo (Ctrl-C stops everything)"
npx expo start
