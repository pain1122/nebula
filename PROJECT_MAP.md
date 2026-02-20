# Project Map — Checkupino

## Backend
- Framework: Laravel (root)
- Entry: public/index.php
- Routes: routes/web.php, routes/api.php
- Key domains: checkups, reservations, reports, prescriptions, cms, blog

## Frontend
- Location: frontend/
- Framework: React + Vite
- Build output: frontend/dist

## Goal
- Local dev: Docker for Laravel + DB; React runs with Vite dev server (later dockerize if needed)
- Deploy: build React → serve static; Laravel serves API + CMS

## Environment
- Local: Docker (nginx+php-fpm+mysql+redis)
- Production: Linux host (TBD)
