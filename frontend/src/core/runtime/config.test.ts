import { describe, expect, it } from "vitest";
import {
  RuntimeConfigError,
  createRuntimeConfig,
  joinPath,
  joinUrl,
  normalizeRouterBase,
} from "./config";

describe("runtime configuration", () => {
  it("accepts the selected separate-origin production contract", () => {
    const config = createRuntimeConfig({
      BASE_URL: "/panel/",
      MODE: "production",
      PROD: true,
      DEV: false,
      VITE_API_BASE_URL: "https://api.example.com/api/",
      VITE_BACKEND_URL: "https://api.example.com/",
      VITE_DEFAULT_LOCALE: "fa",
      VITE_FALLBACK_LOCALE: "en",
    });

    expect(config).toEqual({
      apiBaseUrl: "https://api.example.com/api",
      backendOrigin: "https://api.example.com",
      defaultLocale: "fa",
      fallbackLocale: "en",
      isDevelopment: false,
      isProduction: true,
      mode: "production",
      routerBase: "/panel",
    });
  });

  it("uses the documented local backend when development values are missing", () => {
    expect(createRuntimeConfig({ MODE: "development", DEV: true })).toMatchObject({
      apiBaseUrl: "http://localhost:8080/api",
      backendOrigin: "http://localhost:8080",
      routerBase: "/",
    });
  });

  it("requires an explicit backend origin in production", () => {
    expect(() => createRuntimeConfig({ MODE: "production", PROD: true })).toThrowError(
      /VITE_BACKEND_URL is required/,
    );
  });

  it.each([
    ["a relative backend", { VITE_BACKEND_URL: "/backend" }, /absolute HTTP\(S\) URL/],
    [
      "a backend path",
      { VITE_BACKEND_URL: "http://localhost:8080/backend" },
      /origin without a path/,
    ],
    [
      "a different API origin",
      {
        VITE_BACKEND_URL: "http://localhost:8080",
        VITE_API_BASE_URL: "http://localhost:9000/api",
      },
      /must share/,
    ],
    [
      "a duplicated API suffix",
      {
        VITE_BACKEND_URL: "http://localhost:8080",
        VITE_API_BASE_URL: "http://localhost:8080/api/api",
      },
      /duplicated \/api\/api/,
    ],
    ["an invalid locale", { VITE_DEFAULT_LOCALE: "fa_IR!" }, /valid locale tag/],
  ])("rejects %s", (_label, environment, message) => {
    expect(() => createRuntimeConfig(environment)).toThrowError(message);
  });

  it("rejects insecure non-local production origins", () => {
    expect(() =>
      createRuntimeConfig({
        MODE: "production",
        PROD: true,
        VITE_BACKEND_URL: "http://api.example.com",
      }),
    ).toThrowError(/must use HTTPS/);
  });

  it.each([
    ["/", "/"],
    ["/panel/", "/panel"],
    ["panel/admin/", "/panel/admin"],
  ])("normalizes router base %s", (input, expected) => {
    expect(normalizeRouterBase(input)).toBe(expected);
  });

  it("rejects malformed and duplicated router bases", () => {
    expect(() => normalizeRouterBase("https://admin.example.com/panel")).toThrowError(
      RuntimeConfigError,
    );
    expect(() => normalizeRouterBase("/panel/panel/")).toThrowError(/duplicated/);
  });

  it("joins route paths without duplicating the router base", () => {
    expect(joinPath("/panel", "/panel/login")).toBe("/panel/login");
    expect(joinPath("/", "login")).toBe("/login");
  });

  it("joins endpoint URLs without duplicating the API segment", () => {
    expect(joinUrl("https://api.example.com/api", "/api/auth/me")).toBe(
      "https://api.example.com/api/auth/me",
    );
  });
});
