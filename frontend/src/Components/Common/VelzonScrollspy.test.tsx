import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VelzonScrollspy from "./VelzonScrollspy";

const setSectionGeometry = (section: HTMLElement, top: number, height = 300) => {
  Object.defineProperty(section, "offsetHeight", { configurable: true, value: height });
  section.getBoundingClientRect = vi.fn(() => ({
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    top,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }));
};

afterEach(() => {
  document.getElementById("first")?.remove();
  document.getElementById("second")?.remove();
  vi.restoreAllMocks();
});

describe("VelzonScrollspy", () => {
  it("preserves list classes and moves the active class with the visible section", () => {
    const firstSection = document.createElement("section");
    firstSection.id = "first";
    const secondSection = document.createElement("section");
    secondSection.id = "second";
    document.body.append(firstSection, secondSection);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    setSectionGeometry(firstSection, 10);
    setSectionGeometry(secondSection, 800);

    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    render(
      <VelzonScrollspy
        className="navbar-nav"
        currentClassName="active"
        items={["first", "second"]}
        offset={-18}
      >
        <li className="nav-item">First</li>
        <li className="nav-item">Second</li>
      </VelzonScrollspy>,
    );

    expect(screen.getByRole("list")).toHaveClass("navbar-nav");
    expect(screen.getByText("First")).toHaveClass("nav-item", "active");
    expect(screen.getByText("Second")).toHaveClass("nav-item");
    expect(screen.getByText("Second")).not.toHaveClass("active");

    setSectionGeometry(firstSection, -400);
    setSectionGeometry(secondSection, 10);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      frameCallbacks.shift()?.(0);
    });

    expect(screen.getByText("First")).not.toHaveClass("active");
    expect(screen.getByText("Second")).toHaveClass("nav-item", "active");
  });
});
