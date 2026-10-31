export interface RuntimeEnvironment {
  readonly BASE_URL?: string;
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly PROD?: boolean;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  readonly VITE_FALLBACK_LOCALE?: string;
}

export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly backendOrigin: string;
  readonly defaultLocale: string;
  readonly fallbackLocale: string;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly mode: string;
  readonly routerBase: string;
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(`Invalid frontend runtime configuration: ${message}`);
    this.name = "RuntimeConfigError";
  }
}

const DEVELOPMENT_BACKEND_ORIGIN = "http://localhost:8080";
const DEFAULT_LOCALE = "fa";
const DEFAULT_FALLBACK_LOCALE = "en";
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const pathSegments = (value: string, name: string) => {
  if (value.includes("\\") || value.includes("?") || value.includes("#")) {
    throw new RuntimeConfigError(`${name} must be a plain URL path.`);
  }

  const segments = value.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new RuntimeConfigError(`${name} cannot contain dot segments.`);
  }

  return segments;
};

const appendWithoutOverlap = (existing: string[], incoming: string[]) => {
  const maximumOverlap = Math.min(existing.length, incoming.length);
  let overlap = 0;

  for (let length = maximumOverlap; length > 0; length -= 1) {
    const tail = existing.slice(-length);
    const head = incoming.slice(0, length);
    if (tail.every((segment, index) => segment === head[index])) {
      overlap = length;
      break;
    }
  }

  return [...existing, ...incoming.slice(overlap)];
};

export const joinPath = (basePath: string, ...pathParts: string[]) => {
  let segments = pathSegments(basePath, "base path");

  for (const part of pathParts) {
    segments = appendWithoutOverlap(segments, pathSegments(part, "path part"));
  }

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

const parseHttpUrl = (name: string, value: string) => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new RuntimeConfigError(`${name} must be an absolute HTTP(S) URL.`);
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new RuntimeConfigError(`${name} must use HTTP or HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new RuntimeConfigError(`${name} cannot contain credentials.`);
  }
  if (parsed.search || parsed.hash) {
    throw new RuntimeConfigError(`${name} cannot contain a query or fragment.`);
  }

  return parsed;
};

export const joinUrl = (baseUrl: string, ...pathParts: string[]) => {
  const parsed = parseHttpUrl("base URL", baseUrl);
  const path = joinPath(parsed.pathname, ...pathParts);

  return new URL(path, `${parsed.origin}/`).toString().replace(/\/$/, path === "/" ? "/" : "");
};

export const normalizeRouterBase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(":")) {
    throw new RuntimeConfigError("BASE_URL must be an absolute path such as / or /panel/.");
  }

  const segments = pathSegments(trimmed, "BASE_URL");
  if (segments.some((segment, index) => index > 0 && segment === segments[index - 1])) {
    throw new RuntimeConfigError("BASE_URL contains a duplicated adjacent path segment.");
  }

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

const normalizeLocale = (name: string, value: string | undefined, fallback: string) => {
  const locale = value?.trim() || fallback;
  if (!LOCALE_PATTERN.test(locale)) {
    throw new RuntimeConfigError(`${name} must be a valid locale tag.`);
  }

  return locale;
};

const isLoopback = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export const createRuntimeConfig = (environment: RuntimeEnvironment): RuntimeConfig => {
  const mode = environment.MODE?.trim() || (environment.PROD ? "production" : "development");
  const isProduction = environment.PROD ?? mode === "production";
  const isDevelopment = environment.DEV ?? mode === "development";

  if (isProduction && isDevelopment) {
    throw new RuntimeConfigError("DEV and PROD cannot both be true.");
  }

  const configuredBackendOrigin = environment.VITE_BACKEND_URL?.trim();
  if (isProduction && !configuredBackendOrigin) {
    throw new RuntimeConfigError("VITE_BACKEND_URL is required for production builds.");
  }

  const backend = parseHttpUrl(
    "VITE_BACKEND_URL",
    configuredBackendOrigin || DEVELOPMENT_BACKEND_ORIGIN,
  );
  if (backend.pathname !== "/") {
    throw new RuntimeConfigError("VITE_BACKEND_URL must be an origin without a path.");
  }
  if (isProduction && backend.protocol !== "https:" && !isLoopback(backend.hostname)) {
    throw new RuntimeConfigError("VITE_BACKEND_URL must use HTTPS outside local development.");
  }

  const configuredApiBase = environment.VITE_API_BASE_URL?.trim();
  const api = parseHttpUrl(
    "VITE_API_BASE_URL",
    configuredApiBase || joinUrl(backend.origin, "api"),
  );
  if (api.origin !== backend.origin) {
    throw new RuntimeConfigError(
      "VITE_API_BASE_URL must share the VITE_BACKEND_URL origin for credentialed delivery.",
    );
  }

  const apiSegments = pathSegments(api.pathname, "VITE_API_BASE_URL");
  if (apiSegments.length === 0 || apiSegments[apiSegments.length - 1] !== "api") {
    throw new RuntimeConfigError("VITE_API_BASE_URL must end with exactly one /api segment.");
  }
  if (
    apiSegments.length > 1 &&
    apiSegments[apiSegments.length - 2] === apiSegments[apiSegments.length - 1]
  ) {
    throw new RuntimeConfigError("VITE_API_BASE_URL cannot contain a duplicated /api/api suffix.");
  }

  return Object.freeze({
    apiBaseUrl: api.toString().replace(/\/$/, ""),
    backendOrigin: backend.origin,
    defaultLocale: normalizeLocale(
      "VITE_DEFAULT_LOCALE",
      environment.VITE_DEFAULT_LOCALE,
      DEFAULT_LOCALE,
    ),
    fallbackLocale: normalizeLocale(
      "VITE_FALLBACK_LOCALE",
      environment.VITE_FALLBACK_LOCALE,
      DEFAULT_FALLBACK_LOCALE,
    ),
    isDevelopment,
    isProduction,
    mode,
    routerBase: normalizeRouterBase(environment.BASE_URL || "/"),
  });
};

const viteEnvironment: RuntimeEnvironment = import.meta.env;

export const runtimeConfig = createRuntimeConfig(viteEnvironment);
