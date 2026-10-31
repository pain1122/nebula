import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import i18n, { changeProductLanguage } from "../../i18n";
import SearchOption from "./SearchOption";

afterEach(async () => {
  await changeProductLanguage("en");
});

describe("Velzon search localization", () => {
  it("updates existing search and menu text through the selected language", async () => {
    await changeProductLanguage("en");
    render(
      <MemoryRouter>
        <SearchOption />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText("Search ...")).toBeInTheDocument();
    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.getByText("Product Admin")).toBeInTheDocument();

    await changeProductLanguage("fa");

    expect(await screen.findByPlaceholderText("جستجو ...")).toBeInTheDocument();
    expect(screen.getByText("صفحه‌ها")).toBeInTheDocument();
    expect(screen.getByText("مدیریت محصول")).toBeInTheDocument();
    expect(i18n.language).toBe("fa");
    expect(document.documentElement.dir).toBe("rtl");
  });
});
