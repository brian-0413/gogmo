#!/bin/bash
set -e

echo "🔧 Setting up database..."

# Push schema to database (idempotent)
echo "📋 Pushing Prisma schema..."
npx prisma db push --skip-generate

# Run seed (idempotent if using upsert, but our seed does deleteMany first)
# Only seed if explicitly requested via SEED_DB=true
if [ "$SEED_DB" = "true" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

echo "✅ Database setup complete!"

# Start the application
exec "$@"
