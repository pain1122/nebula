import { describe, expect, it } from "vitest";

import {
  applyColorPreference,
  normalizeColorPreference,
  resolveColorPreference,
} from "./colorMode";

describe("color preference", () => {
  it("uses the operating-system choice only for System", () => {
    expect(resolveColorPreference("system", true)).toBe("dark");
    expect(resolveColorPreference("system", false)).toBe("light");
    expect(resolveColorPreference("light", true)).toBe("light");
    expect(resolveColorPreference("dark", false)).toBe("dark");
  });

  it("defaults missing or stale values to System", () => {
    expect(normalizeColorPreference(undefined)).toBe("system");
    expect(normalizeColorPreference("legacy-auto")).toBe("system");
    expect(normalizeColorPreference("dark")).toBe("dark");
  });

  it("applies only the resolved mode to the document", () => {
    expect(applyColorPreference(document.documentElement, "system", true)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    expect(applyColorPreference(document.documentElement, "light", true)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "light");
  });
});
