import { act, render, screen, waitFor } from "@testing-library/react";
import { Dropdown, DropdownToggle, DropdownItem } from "reactstrap";
import { beforeEach, describe, expect, it } from "vitest";
import { changeProductLanguage } from "../../i18n";
import DirectionalDropdownMenu from "./DirectionalDropdownMenu";

describe("logical dropdown placement", () => {
  beforeEach(async () => {
    await changeProductLanguage("en");
  });
  it.each(["down", "start", "end"] as const)(
    "mirrors %s Popper geometry while preserving the same menu and content",
    async (direction) => {
      render(
        <Dropdown isOpen toggle={() => {}} direction={direction}>
          <DropdownToggle>Menu</DropdownToggle>
          <DirectionalDropdownMenu end>
            <DropdownItem>Item</DropdownItem>
          </DirectionalDropdownMenu>
        </Dropdown>,
      );
      const item = screen.getByRole("menuitem", { name: "Item" }),
        menu = item.closest(".dropdown-menu");
      const expected =
        direction === "down" ? "bottom-end" : direction === "start" ? "left-end" : "right-end";
      await waitFor(() => expect(menu).toHaveAttribute("data-popper-placement", expected));
      await act(() => changeProductLanguage("fa"));
      const mirrored =
        direction === "down"
          ? "bottom-start"
          : direction === "start"
            ? "right-start"
            : "left-start";
      await waitFor(() => expect(menu).toHaveAttribute("data-popper-placement", mirrored));
      expect(screen.getByRole("menuitem", { name: "Item" })).toBe(item);
      await act(() => changeProductLanguage("en"));
      await waitFor(() => expect(menu).toHaveAttribute("data-popper-placement", expected));
    },
  );
});
