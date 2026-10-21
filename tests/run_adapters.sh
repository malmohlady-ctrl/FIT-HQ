#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
cat tests/stubs.js tests/prelude.js data.js adapters.js app.js nutrition.js workouts.js progress.js extras.js tests/adapters_check.js > /tmp/adapters_all.js
node /tmp/adapters_all.js
