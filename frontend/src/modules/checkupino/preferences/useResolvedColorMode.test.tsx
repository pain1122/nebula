import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ColorPreference } from "../../../core";
import { useResolvedColorMode } from "./useResolvedColorMode";

const ColorModeProbe = ({ preference }: { preference: ColorPreference }) => {
  const resolvedMode = useResolvedColorMode(preference);
  return <output>{resolvedMode}</output>;
};

describe("resolved shell color mode", () => {
  it("subscribes only in System mode and follows OS changes", () => {
    let matches = false;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const addEventListener = vi.fn<
      (type: string, listener: EventListenerOrEventListenerObject) => void
    >((_type, listener) => {
      listeners.add(listener);
    });
    const removeEventListener = vi.fn<
      (type: string, listener: EventListenerOrEventListenerObject) => void
    >((_type, listener) => {
      listeners.delete(listener);
    });
    const mediaQuery = {
      get matches() {
        return matches;
      },
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mediaQuery),
    );

    const { rerender, unmount } = render(<ColorModeProbe preference="system" />);
    expect(screen.getByText("light")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "light");
    expect(addEventListener).toHaveBeenCalledOnce();
    expect(listeners).toHaveLength(1);

    matches = true;
    act(() => {
      for (const listener of listeners) {
        if (typeof listener === "function") listener(new Event("change"));
        else listener.handleEvent(new Event("change"));
      }
    });
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "dark");

    rerender(<ColorModeProbe preference="light" />);
    expect(listeners).toHaveLength(0);
    expect(document.documentElement).toHaveAttribute("data-bs-theme", "light");

    matches = false;
    act(() => {
      for (const listener of listeners) {
        if (typeof listener === "function") listener(new Event("change"));
        else listener.handleEvent(new Event("change"));
      }
    });
    expect(screen.getByText("light")).toBeInTheDocument();

    unmount();
    expect(removeEventListener).toHaveBeenCalledOnce();
  });
});
