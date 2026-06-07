#!/bin/sh
set -eu

cd /var/www

mkdir -p \
    storage/app/public \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

if [ ! -L public/storage ]; then
    php artisan storage:link >/dev/null 2>&1 || true
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

if [ "${CACHE_LARAVEL:-false}" = "true" ]; then
    php artisan config:cache
    php artisan view:cache
fi

exec docker-php-entrypoint "$@"
