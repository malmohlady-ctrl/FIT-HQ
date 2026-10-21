#!/bin/sh
# FIT HQ logic tests: runs the real app code in node with DOM stubs.
cd "$(dirname "$0")/.." || exit 1
cat tests/stubs.js app.js nutrition.js progress.js tests/tests.js > /tmp/fithq_all.js
node /tmp/fithq_all.js
