#!/bin/bash
set -e

echo "🚀 Starting BannerGen..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.query('SELECT 1').then(() => {
      console.log('Database ready');
      pool.end();
      process.exit(0);
    }).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "✅ Database connected"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Database connection failed after $MAX_RETRIES attempts"
  exit 1
fi

# Run migrations
echo "📦 Running migrations..."
cd backend
npm run migrate

# Check if this is the first run (no users)
USER_COUNT=$(node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT COUNT(*) FROM users').then(r => {
    console.log(r.rows[0].count);
    pool.end();
  }).catch(() => {
    console.log('0');
  });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "👥 No users found, running seed..."
  npm run seed || echo "Seeding skipped (may already be done)"
fi

# Start the server
echo "🎉 Starting server..."
exec node src/index.js
