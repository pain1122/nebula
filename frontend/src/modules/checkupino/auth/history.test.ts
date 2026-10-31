import { afterEach, describe, expect, it, vi } from "vitest";
import { installSessionHistoryGuard } from "./history";

const cleanups: Array<() => void> = [];
const root = () => {
  const element = document.createElement("div");
  element.id = "private-history-test";
  element.textContent = "Synthetic private record";
  document.body.append(element);
  cleanups.push(() => element.remove());
  return element;
};
const transition = (type: "pagehide" | "pageshow", persisted: boolean) =>
  window.dispatchEvent(new PageTransitionEvent(type, { persisted }));
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

describe("session browser-history guard", () => {
  it("leaves initial loads and ordinary navigation unchanged", () => {
    const element = root(),
      reload = vi.fn<() => void>();
    cleanups.push(installSessionHistoryGuard(window, () => element, reload));
    transition("pageshow", false);
    transition("pagehide", false);
    expect(element.hidden).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("hides the app before a document is retained in browser history", () => {
    const element = root(),
      reload = vi.fn<() => void>();
    cleanups.push(installSessionHistoryGuard(window, () => element, reload));
    transition("pagehide", true);
    expect(element.hidden).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it("hides a restored app synchronously before restarting session bootstrap", () => {
    const element = root(),
      hiddenAtReload: boolean[] = [],
      reload = vi.fn<() => void>(() => {
        hiddenAtReload.push(element.hidden === true);
      });
    cleanups.push(installSessionHistoryGuard(window, () => element, reload));
    transition("pageshow", true);
    expect(element.hidden).toBe(true);
    expect(hiddenAtReload).toEqual([true]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("revalidates a restored document even when its app root is absent", () => {
    const reload = vi.fn<() => void>();
    cleanups.push(installSessionHistoryGuard(window, () => null, reload));
    transition("pageshow", true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("removes both lifecycle listeners when disposed", () => {
    const element = root(),
      reload = vi.fn<() => void>();
    const dispose = installSessionHistoryGuard(window, () => element, reload);
    dispose();
    transition("pagehide", true);
    transition("pageshow", true);
    expect(element.hidden).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
