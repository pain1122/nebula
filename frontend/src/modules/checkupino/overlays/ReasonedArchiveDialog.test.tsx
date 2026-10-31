import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { classifyWireFailure } from "../api/wire";
import { ReasonedArchiveDialog } from "./ReasonedArchiveDialog";

describe("reasoned archive dialog", () => {
  it("uses archive semantics and submits the exact reason payload", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn<(payload: { readonly reason: string }) => Promise<void>>(
      async () => undefined,
    );
    const onClose = vi.fn<() => void>();
    render(<ReasonedArchiveDialog onArchive={onArchive} onClose={onClose} open />);

    await user.click(screen.getByRole("button", { name: "بایگانی کردن" }));
    expect(screen.getByText("دلیل بایگانی را وارد کنید.")).toBeVisible();
    expect(onArchive).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: /دلیل بایگانی/ }), "  درخواست مدیر  ");
    await user.click(screen.getByRole("button", { name: "بایگانی کردن" }));

    expect(onArchive).toHaveBeenCalledWith({ reason: "درخواست مدیر" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText(/حذف/)).not.toBeInTheDocument();
  });

  it("stays open, prevents duplicates, and closes only after success", async () => {
    const user = userEvent.setup();
    let resolveArchive: (() => void) | undefined;
    const onArchive = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          resolveArchive = resolve;
        }),
    );
    const onClose = vi.fn<() => void>();
    render(<ReasonedArchiveDialog onArchive={onArchive} onClose={onClose} open />);

    await user.type(screen.getByRole("textbox", { name: /دلیل بایگانی/ }), "reason");
    await user.click(screen.getByRole("button", { name: "بایگانی کردن" }));

    const pending = screen.getByRole("button", { name: "در حال بایگانی…" });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    resolveArchive?.();
    expect(await screen.findByRole("button", { name: "بایگانی کردن" })).toBeEnabled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("retains a structured server failure for a caller-controlled retry", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn<() => Promise<void>>(async () =>
      Promise.reject(
        classifyWireFailure({
          data: { message: "Archive rejected by the server." },
          headers: { "x-correlation-id": "archive-request" },
          status: 500,
        }),
      ),
    );
    render(<ReasonedArchiveDialog onArchive={onArchive} onClose={() => undefined} open />);

    await user.type(screen.getByRole("textbox", { name: /دلیل بایگانی/ }), "reason");
    await user.click(screen.getByRole("button", { name: "بایگانی کردن" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Archive rejected by the server.");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /دلیل بایگانی/ })).toHaveValue("reason");
  });
});
