#!/bin/sh
set -e

# مزامنة مخطط قاعدة البيانات عند الإقلاع (ينشئ الجداول أول مرة)
if [ -n "$DATABASE_URL" ]; then
  echo "syncing database schema..."
  node node_modules/prisma/build/index.js db push --skip-generate
fi

exec node server.js
