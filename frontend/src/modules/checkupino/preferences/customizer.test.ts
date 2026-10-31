import { describe, expect, it, vi } from "vitest";
import { markCustomizerIntroduced, shouldIntroduceCustomizer } from "./customizer";

describe("per-account customizer introduction", () => {
  it("shows the introduction once per browser account and preserves other accounts' first visit", () => {
    expect(shouldIntroduceCustomizer("test-owner-first")).toBe(true);
    markCustomizerIntroduced("test-owner-first");
    expect(shouldIntroduceCustomizer("test-owner-first")).toBe(false);
    expect(localStorage.getItem("checkupino.customizer.seen.v1.test-owner-first")).toBe("1");
    expect(shouldIntroduceCustomizer("test-owner-second")).toBe(true);
    expect(shouldIntroduceCustomizer()).toBe(false);
  });
  it("respects a previously persisted visit after a new panel mount", () => {
    localStorage.setItem("checkupino.customizer.seen.v1.persisted-account", "1");
    expect(shouldIntroduceCustomizer("persisted-account")).toBe(false);
  });
  it("does not repeatedly introduce the panel in the current tab when storage is blocked", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(shouldIntroduceCustomizer("blocked-account")).toBe(true);
    markCustomizerIntroduced("blocked-account");
    expect(shouldIntroduceCustomizer("blocked-account")).toBe(false);
    get.mockRestore();
    set.mockRestore();
  });
});
