#!/bin/bash

cp .env.example .env
touch database/database.sqlite
php artisan key:generate
php artisan migrate --force
php artisan passport:install --force
php artisan passport:client --personal
