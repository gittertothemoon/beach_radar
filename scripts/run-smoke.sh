#!/bin/sh
set -e

PORT=${PORT:-3000}
HOST=${HOST:-127.0.0.1}
BASE_URL=${BASE_URL:-http://$HOST:$PORT}
WAITLIST_PATH=${WAITLIST_PATH:-/waitlist/index.html}

HOST="$HOST" node scripts/serve-static.mjs > /tmp/waitlist-static.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

READY=0
I=0
while [ $I -lt 40 ]; do
  if curl -fsS "$BASE_URL$WAITLIST_PATH" > /dev/null; then
    READY=1
    break
  fi
  I=$((I+1))
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Static server did not become ready" >&2
  echo "--- static server log ---" >&2
  tail -n 200 /tmp/waitlist-static.log >&2 || true
  exit 1
fi

BASE_URL="$BASE_URL" WAITLIST_PATH="$WAITLIST_PATH" npm run test:waitlist:smoke
