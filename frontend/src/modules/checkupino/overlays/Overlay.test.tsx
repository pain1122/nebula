import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { applyProductLocale } from "../preferences/localization";
import { Dialog, Drawer } from "./Overlay";

const DialogFixture = ({ busy = false }: { readonly busy?: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        باز کردن
      </button>
      <Dialog
        busy={busy}
        description="توضیح عملیات"
        footer={<button type="button">تأیید</button>}
        onClose={() => setOpen(false)}
        open={open}
        title="عنوان پنجره"
      >
        <button type="button">گزینه میانی</button>
      </Dialog>
    </>
  );
};

describe("overlay primitives", () => {
  it("supports an opt-in Bootstrap large dialog while preserving the default width", () => {
    const close = vi.fn<() => void>();
    const view = render(
      <Dialog open title="Default" onClose={close}>
        Content
      </Dialog>,
    );
    expect(screen.getByRole("dialog").querySelector(".modal-dialog")).not.toHaveClass("modal-lg");
    view.rerender(
      <Dialog open title="Working hours" size="lg" onClose={close}>
        Content
      </Dialog>,
    );
    expect(screen.getByRole("dialog").querySelector(".modal-dialog")).toHaveClass("modal-lg");
  });
  it("traps focus, closes with Escape, and returns focus to the opener", async () => {
    const user = userEvent.setup();
    render(<DialogFixture />);

    const opener = screen.getByRole("button", { name: "باز کردن" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "عنوان پنجره" });
    const close = screen.getAllByRole("button", { name: "بستن" })[1];
    const confirm = screen.getByRole("button", { name: "تأیید" });
    expect(close).toHaveFocus();

    confirm.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(dialog).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("suppresses close interactions while a mutation is busy", async () => {
    const user = userEvent.setup();
    render(<DialogFixture busy />);
    await user.click(screen.getByRole("button", { name: "باز کردن" }));

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "بستن" })[1]).toBeDisabled();
  });

  it.each([
    ["fa", "rtl"],
    ["en", "ltr"],
  ] as const)("inherits %s direction and uses logical drawer placement", (locale, direction) => {
    applyProductLocale(document.documentElement, locale);
    const onClose = vi.fn<() => void>();
    render(
      <Drawer locale={locale} onClose={onClose} open title="Drawer">
        Content
      </Drawer>,
    );

    const drawer = screen.getByRole("dialog", { name: "Drawer" });
    expect(document.documentElement).toHaveAttribute("dir", direction);
    expect(drawer).not.toHaveAttribute("dir");
    expect(drawer).toHaveStyle({ insetInlineEnd: "0", insetInlineStart: "auto" });
  });
});
