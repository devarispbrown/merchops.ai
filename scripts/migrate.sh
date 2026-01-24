#!/bin/bash
# Migration script for production deployments
# Handles failed migrations and applies new ones

set -e

echo "🔄 Running database migrations..."

# Mark the failed migration as rolled back (ignore errors if it doesn't exist)
echo "📋 Checking for failed migrations to resolve..."
npx prisma migrate resolve --rolled-back 20260123_add_performance_indexes 2>/dev/null || true

# Apply all pending migrations
echo "🚀 Applying pending migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete!"
