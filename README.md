# Nebula - Laravel + Passport Auth API (Dockerized)

This project is a secure Laravel 12 + Passport API environment, Dockerized for instant setup and deployment.

---

## 🚀 Quick Start (Local)

### 1. Clone the Repository
```bash
git clone https://github.com/pain1122/nebula.git
cd nebula
cd backend
## If in linux
mkdir -p database
touch database/database.sqlite
## If in powershell
New-Item -ItemType Directory -Force -Path .\backend\database
New-Item -ItemType File -Force -Path .\backend\database\database.sqlite

docker-compose up --build
docker exec -it nebula-backend-1 bash
composer install
php artisan key:generate
php artisan migrate
php artisan passport:install
php artisan passport:client --personal
php artisan passport:client --password
chmod 600 storage/oauth-*.key
chown www-data:www-data storage/oauth-*.key