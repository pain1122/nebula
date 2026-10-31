import { describe, expect, it } from "vitest";

import {
  LEGACY_LOCALE_STORAGE_KEY,
  PRODUCT_LOCALE_STORAGE_KEY,
  applyProductLocale,
  directionForProductLocale,
  formatProductDate,
  formatProductNumber,
  formatProductTimestamp,
  initializeProductLocale,
  normalizeNumericInput,
  readProductLocale,
} from "./localization";

describe("Checkupino localization preferences", () => {
  it("makes language the only direction authority", () => {
    expect(directionForProductLocale("fa")).toBe("rtl");
    expect(directionForProductLocale("en")).toBe("ltr");

    applyProductLocale(document.documentElement, "fa");
    expect(document.documentElement).toHaveAttribute("lang", "fa");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");

    applyProductLocale(document.documentElement, "en");
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });

  it("migrates a supported legacy locale into the versioned preference", () => {
    const values = new Map([[LEGACY_LOCALE_STORAGE_KEY, "en"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(initializeProductLocale(document.documentElement, storage, "fa")).toBe("en");
    expect(values.get(PRODUCT_LOCALE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });

  it("ignores unsupported stored/configured locales and falls back to Persian", () => {
    const storage = {
      getItem: () => "ar",
    };

    expect(readProductLocale(storage, "de")).toBe("fa");
  });

  it("normalizes Persian and Arabic-Indic input digits without changing other text", () => {
    expect(normalizeNumericInput("۰۹۱۲-٣٤٥۶۷۸۹")).toBe("0912-3456789");
  });

  it("localizes display numerals while leaving wire normalization explicit", () => {
    expect(formatProductNumber(123456, "fa")).toContain("۱۲۳");
    expect(formatProductNumber(123456, "en")).toContain("123");
  });

  it("renders date-only values without a timezone shift and uses the locale calendar", () => {
    expect(formatProductDate("2024-03-20", "fa")).toContain("۱۴۰۳");
    expect(formatProductDate("2024-03-20", "en")).toContain("2024");
    expect(() => formatProductDate("2024-02-31", "fa")).toThrow(RangeError);
  });

  it("renders timestamp instants in Tehran", () => {
    const faTimestamp = formatProductTimestamp("2026-01-01T21:00:00Z", "fa");
    const enTimestamp = formatProductTimestamp("2026-01-01T21:00:00Z", "en");

    expect(faTimestamp).toContain("۰۰:۳۰");
    expect(enTimestamp).toContain("00:30");
  });
});
