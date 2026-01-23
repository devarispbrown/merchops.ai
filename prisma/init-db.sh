#!/bin/sh
# ============================================================================
# MerchOps - PostgreSQL Initialization Script
# Runs on first container startup to configure the database
# ============================================================================

set -e

echo "Initializing MerchOps database..."

# Create extensions if needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID generation
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Enable pgcrypto for encryption functions
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Log successful initialization
    SELECT 'Database initialized successfully' AS status;
EOSQL

echo "Database initialization complete."
