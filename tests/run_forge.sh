#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
cat tests/stubs.js tests/prelude.js data.js app.js nutrition.js workouts.js progress.js extras.js tests/forge_check.js > /tmp/forge_all.js
node /tmp/forge_all.js
