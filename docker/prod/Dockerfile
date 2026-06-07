# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS assets
WORKDIR /app

COPY package.json package-lock.json vite.config.js postcss.config.js tailwind.config.js ./
COPY resources ./resources

RUN npm ci && npm run build

FROM composer:2 AS vendor
WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --no-scripts \
    --no-autoloader

COPY app ./app
COPY bootstrap ./bootstrap
COPY config ./config
COPY database ./database
COPY public ./public
COPY resources ./resources
COPY routes ./routes
COPY artisan composer.json composer.lock ./

RUN composer dump-autoload --no-dev --optimize --no-scripts

FROM php:8.3-fpm-alpine AS app

RUN set -eux; \
    apk add --no-cache ca-certificates curl libzip oniguruma unzip zip; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        linux-headers \
        oniguruma-dev \
        libpng-dev \
        libxml2-dev \
        libzip-dev; \
    docker-php-ext-install pdo_mysql mbstring zip exif pcntl bcmath opcache; \
    pecl install redis; \
    docker-php-ext-enable redis; \
    apk del .build-deps; \
    rm -rf /tmp/pear

WORKDIR /var/www

COPY --from=vendor /app /var/www
COPY --from=assets /app/public/build /var/www/public/build
COPY docker/prod/app/entrypoint.sh /usr/local/bin/checkupino-entrypoint

RUN chmod +x /usr/local/bin/checkupino-entrypoint \
    && mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && php artisan package:discover --ansi

ENTRYPOINT ["checkupino-entrypoint"]
CMD ["php-fpm"]

FROM nginx:1.27-alpine AS nginx

COPY docker/prod/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=vendor /app/public /var/www/public
COPY --from=assets /app/public/build /var/www/public/build
