import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { classifyWireFailure } from "../api/wire";
import { applyProductLocale } from "../preferences/localization";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "./Feedback";

const visibleFailureCases = [
  [403, "account_inactive", "account-inactive"],
  [419, undefined, "csrf"],
  [403, undefined, "forbidden"],
  [418, undefined, "http"],
  [undefined, undefined, "network"],
  [404, undefined, "not-found"],
  [423, undefined, "recent-password"],
  [500, undefined, "server"],
  [429, undefined, "throttled"],
  [401, undefined, "unauthenticated"],
  [422, undefined, "validation"],
] as const;

describe("feedback primitives", () => {
  it.each([
    ["fa", "rtl", "در حال بارگذاری…"],
    ["en", "ltr", "Loading…"],
  ] as const)("inherits the %s document direction", (locale, direction, label) => {
    applyProductLocale(document.documentElement, locale);

    render(<LoadingState locale={locale} />);

    expect(document.documentElement).toHaveAttribute("dir", direction);
    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.getByRole("status")).not.toHaveAttribute("dir");
  });

  it("renders Farsi-first empty feedback with an optional caller-owned action", () => {
    render(<EmptyState action={<button type="button">افزودن مورد</button>} />);

    expect(screen.getByRole("heading", { name: "نتیجه‌ای پیدا نشد" })).toBeVisible();
    expect(screen.getByRole("button", { name: "افزودن مورد" })).toBeEnabled();
  });

  it.each(["fa", "en"] as const)(
    "renders every visible transport class under the %s direction contract",
    (locale) => {
      applyProductLocale(document.documentElement, locale);

      for (const [status, code, kind] of visibleFailureCases) {
        const { unmount } = render(
          <ErrorState error={classifyWireFailure({ data: { code }, status })} locale={locale} />,
        );

        expect(screen.getByRole("alert")).toHaveAttribute("data-feedback-kind", kind);
        expect(screen.getByRole("alert")).not.toHaveAttribute("dir");
        unmount();
      }
    },
  );

  it("shows structured error details and invokes only an explicit retry action", () => {
    const retry = vi.fn<() => void>();
    const error = classifyWireFailure({
      data: {
        code: "validation_failed",
        errors: { email: "نشانی ایمیل معتبر نیست.", global: "دوباره تلاش کنید." },
        message: "اطلاعات ارسال‌شده رد شد.",
      },
      headers: { "retry-after": "30", "x-correlation-id": "request-123" },
      status: 422,
    });

    render(<ErrorState error={error} onRetry={retry} />);

    expect(screen.getByRole("alert")).toHaveAttribute("data-feedback-kind", "validation");
    expect(screen.getByText("اطلاعات ارسال‌شده رد شد.")).toBeVisible();
    expect(screen.getByText("request-123")).toBeVisible();
    expect(screen.getByText("نشانی ایمیل معتبر نیست.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("does not infer retry or render cancelled requests", () => {
    const { rerender } = render(<ErrorState error={classifyWireFailure({ status: 500 })} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<ErrorState error={classifyWireFailure({ cancelled: true })} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a visible status label in addition to color and decoration", () => {
    render(<StatusBadge label="فعال" tone="success" />);

    expect(screen.getByRole("status")).toHaveTextContent("فعال");
    expect(screen.getByText("●")).toHaveAttribute("aria-hidden", "true");
  });
});
