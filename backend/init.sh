#!/bin/bash

# Exit on any error
set -e

# Create .env if not exists
[ ! -f .env ] && cp .env.example .env

# Generate app key if not exists
if ! grep -q "APP_KEY=" .env || grep -q "APP_KEY=$" .env; then
    php artisan key:generate
fi

# Wait for the DB to be ready (PostgreSQL)
until php artisan migrate --force; do
  echo "Waiting for DB to be ready..."
  sleep 3
done

# Only install passport clients if DB is empty
if [ ! -f storage/oauth-private.key ]; then
  php artisan passport:install --force
fi

# Fix permissions for passport keys
chmod 600 storage/oauth-*.key
chown www-data:www-data storage/oauth-*.key

# Create personal access client
if ! php artisan passport:client --personal --name="Local Personal Access Client" --no-interaction | grep -q "Client ID"; then
    echo "Failed to create personal access client"
fi