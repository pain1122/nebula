# syntax=docker/dockerfile:1.7

FROM node:24.19.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ARG VITE_BACKEND_URL
ARG VITE_API_BASE_URL=
ARG VITE_DEFAULT_LOCALE=fa
ARG VITE_FALLBACK_LOCALE=en

ENV VITE_BACKEND_URL=${VITE_BACKEND_URL} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_DEFAULT_LOCALE=${VITE_DEFAULT_LOCALE} \
    VITE_FALLBACK_LOCALE=${VITE_FALLBACK_LOCALE}

RUN if [ -z "${VITE_BACKEND_URL}" ] || [ "${VITE_BACKEND_URL}" = "https://api.example.com" ]; then \
        echo "VITE_BACKEND_URL must name the deployed Laravel API origin" >&2; \
        exit 1; \
    fi; \
    npm run build

FROM nginx:1.27-alpine AS admin

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/panel

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
