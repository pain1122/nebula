FROM php:8.3-fpm

COPY docker/medical-content/build-qpdf.sh /tmp/checkupino-build-qpdf.sh

# System deps
RUN apt-get update && apt-get install -y \
    git unzip zip curl ca-certificates cmake g++ pkg-config util-linux \
    libzip-dev libpng-dev libjpeg62-turbo-dev libonig-dev libxml2-dev libssl-dev zlib1g-dev \
    && docker-php-ext-configure gd --with-jpeg \
    && docker-php-ext-install pdo_mysql mbstring zip exif pcntl bcmath gd \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && sh /tmp/checkupino-build-qpdf.sh \
    && rm /tmp/checkupino-build-qpdf.sh \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# RUN usermod -u 1000 www-data && groupmod -g 1000 www-data
