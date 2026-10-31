import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { changeProductLanguage } from "../../i18n";
import ReviewSlider from "./ReviewSlider";

describe("Swiper-backed vanilla review slider", () => {
  beforeEach(async () => {
    await changeProductLanguage("en");
  });

  it("renders the unchanged dashboard review inventory through the installed React wrapper", () => {
    const { container } = render(<ReviewSlider />);

    expect(container.querySelector(".swiper")).toBeInTheDocument();
    expect(container.querySelectorAll(".swiper-slide")).toHaveLength(4);
    expect(screen.getByText("Force Medicines")).toBeInTheDocument();
    expect(screen.getByText("Henry Baird")).toBeInTheDocument();
    expect(screen.getByText("Zoetic Fashion")).toBeInTheDocument();
    expect(screen.getByText("Nancy Martino")).toBeInTheDocument();
  });
  it("updates native direction on the same slider when the flag changes language", async () => {
    const { container } = render(<ReviewSlider />);
    const slider = container.querySelector(".swiper");
    await act(() => changeProductLanguage("fa"));
    await waitFor(() => expect(slider).toHaveAttribute("dir", "rtl"));
    expect(container.querySelector(".swiper")).toBe(slider);
    expect(slider).toHaveClass("swiper-rtl");
    expect(container.querySelectorAll(".swiper-slide")).toHaveLength(4);
    await act(() => changeProductLanguage("en"));
    await waitFor(() => expect(slider).toHaveAttribute("dir", "ltr"));
    expect(slider).not.toHaveClass("swiper-rtl");
  });
});
