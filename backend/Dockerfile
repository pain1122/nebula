# Use official PHP 8.2 FPM image
FROM php:8.2-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git curl zip unzip libpng-dev libonig-dev libxml2-dev libzip-dev \
    npm nodejs sqlite3

# Set working directory
WORKDIR /var/www

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy all app files
COPY . .

# Install PHP dependencies
RUN composer install --no-interaction --prefer-dist
RUN chmod +x ./init.sh && ./init.sh
# Set proper permissions
RUN chown -R www-data:www-data /var/www \
    && chmod -R 755 /var/www/storage

EXPOSE 9000

CMD ["php-fpm"]
