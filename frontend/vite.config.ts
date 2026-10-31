/// <reference types="vitest/config" />

import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import directionMirror from "./scripts/direction-mirror.mjs";

const redirectBarePanelBase = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => {
  const requestUrl = request.url;
  const isPageRequest = request.method === "GET" || request.method === "HEAD";

  if (isPageRequest && (requestUrl === "/panel" || requestUrl?.startsWith("/panel?"))) {
    const query = requestUrl.slice("/panel".length);
    response.statusCode = 307;
    response.setHeader("Location", `/panel/${query}`);
    response.end();
    return;
  }

  next();
};

const canonicalPanelBase = (): Plugin => ({
  name: "checkupino:canonical-panel-base",
  configureServer(server) {
    server.middlewares.use(redirectBarePanelBase);
  },
  configurePreviewServer(server) {
    server.middlewares.use(redirectBarePanelBase);
  },
});

export default defineConfig({
  base: "/panel/",
  plugins: [canonicalPanelBase(), react()],
  css: {
    postcss: { plugins: [directionMirror()] },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  define: {
    global: "globalThis",
  },
  test: {
    // Bound jsdom concurrency so editor imports do not starve the five-second test deadline.
    maxWorkers: 2,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
