import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const frontendRoot = process.cwd();
const workspaceRoot = path.resolve(frontendRoot, "..");
const readFrontend = (relativePath: string) =>
  readFileSync(path.join(frontendRoot, relativePath), "utf8");
const readWorkspace = (relativePath: string) =>
  readFileSync(path.join(workspaceRoot, relativePath), "utf8");

describe("standalone admin delivery contract", () => {
  it("builds the frontend independently with the approved runtime and API origin", () => {
    const dockerfile = readFrontend("Dockerfile");

    expect(dockerfile).toContain("FROM node:24.19.0-alpine AS build");
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain('[ -z "${VITE_BACKEND_URL}" ]');
    expect(dockerfile).toContain('[ "${VITE_BACKEND_URL}" = "https://api.example.com" ]');
    expect(dockerfile).toContain("VITE_BACKEND_URL must name the deployed Laravel API origin");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).toContain("FROM nginx:1.27-alpine AS admin");
    expect(dockerfile).toContain("COPY --from=build /app/dist /usr/share/nginx/html/panel");
  });

  it("serves only the canonical panel SPA and never falls back missing assets", () => {
    const nginx = readFrontend("nginx/default.conf");

    expect(nginx).toContain("absolute_redirect off;");
    expect(nginx).toMatch(/location = \/ \{\s*return 308 \/panel\/;/);
    expect(nginx).toMatch(/location = \/panel \{\s*return 308 \/panel\/;/);
    expect(nginx).toMatch(
      /location \^~ \/panel\/assets\/ \{\s*try_files \$uri =404;[\s\S]*immutable/,
    );
    expect(nginx).toMatch(/location ~ \^\/panel\/.+\\\.\[\^\/\]\+\$ \{\s*try_files \$uri =404;/);
    expect(nginx).toMatch(/location \/panel\/ \{\s*try_files \$uri \/panel\/index\.html;/);
    expect(nginx).toMatch(/location \/ \{\s*return 404;/);
  });

  it("keeps the admin service separate and derives its backend from the Laravel origin", () => {
    const compose = readWorkspace("docker-compose.prod.yml");
    const productionEnvironment = readWorkspace(".env.production.example");
    const frontendEnvironment = readFrontend(".env.production.example");

    expect(compose).toMatch(/admin:\s+image: \$\{CHECKUPINO_ADMIN_IMAGE/);
    expect(compose).toContain("context: ./frontend");
    expect(compose).toContain(
      "VITE_BACKEND_URL: ${APP_URL:?APP_URL must be the deployed Laravel API origin}",
    );
    expect(compose).toContain('"${ADMIN_HTTP_PORT:-3000}:80"');
    expect(productionEnvironment).toContain("APP_URL=https://api.example.com");
    expect(productionEnvironment).toContain("CORS_ALLOWED_ORIGINS=https://admin.example.com");
    expect(productionEnvironment).toContain("SANCTUM_STATEFUL_DOMAINS=admin.example.com");
    expect(frontendEnvironment).toContain("VITE_BACKEND_URL=https://api.example.com");
    expect(frontendEnvironment).toContain("VITE_API_BASE_URL=https://api.example.com/api");
  });

  it("ships the retained offline artwork locally", () => {
    const offlinePage = readFrontend("src/pages/AuthenticationInner/Errors/Offlinepage.tsx");

    expect(offlinePage).toContain("assets/images/auth-offline.gif");
    expect(offlinePage).not.toContain("img.themesbrand.com");
  });
});
