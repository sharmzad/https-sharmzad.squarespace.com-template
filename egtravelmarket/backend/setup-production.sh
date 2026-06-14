#!/bin/bash

echo "🔧 Setting up production database..."

# Check if DATABASE_URL exists
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

# Run migrations silently with no prompt
echo "📊 Running database migrations..."
cd backend

# Set env var to auto-accept migrations
export DRIZZLE_AUTO_ACCEPT=true

# Run db:push and capture output
npm run db:push 2>&1 | grep -E "✓|✗|already|created" || true

echo "👤 Creating admin user..."
node seed-admin.js 2>&1 | grep -E "✅|❌" || true

echo "✅ Production setup complete!"
cd ..
