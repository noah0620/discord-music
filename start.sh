#!/bin/sh
set -e
echo "Starting Lavalink..."
java -jar /app/Lavalink.jar --spring.config.location=/app/application.yml &
LAVA_PID=$!

echo "Waiting for Lavalink..."
i=0
until curl -fsS -H "Authorization: ${LAVALINK_PASSWORD:-change-me}" http://127.0.0.1:2333/version >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -gt 60 ]; then
    echo "Lavalink did not become ready."
    kill "$LAVA_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 2
done

echo "Lavalink ready. Starting Discord bot..."
node /app/src/index.js
STATUS=$?
kill "$LAVA_PID" 2>/dev/null || true
exit "$STATUS"
