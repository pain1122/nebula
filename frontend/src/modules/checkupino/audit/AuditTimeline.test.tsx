import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyProductLocale } from "../preferences/localization";
import { AuditTimeline, type SafeAuditEvent } from "./AuditTimeline";

const events: readonly SafeAuditEvent[] = Object.freeze([
  Object.freeze({
    actionLabel: "پرونده بایگانی شد",
    actorLabel: "مدیر سامانه",
    occurredAt: "2026-08-26T10:00:00Z",
    outcome: "succeeded" as const,
    publicId: "01EVENT2",
    reason: "درخواست کاربر",
  }),
  Object.freeze({
    actionLabel: "تلاش ناموفق",
    actorLabel: null,
    occurredAt: "2026-08-26T09:00:00Z",
    outcome: "failed" as const,
    publicId: "01EVENT1",
    reason: null,
  }),
]);

beforeEach(() => applyProductLocale(document.documentElement, "fa"));

describe("safe audit timeline", () => {
  it("renders supplied immutable order without fetching, sorting, or mutation", () => {
    const { container } = render(<AuditTimeline events={events} />);
    const items = screen.getAllByRole("listitem");

    expect(within(items[0]).getByText("پرونده بایگانی شد")).toBeVisible();
    expect(within(items[1]).getByText("تلاش ناموفق")).toBeVisible();
    expect(events).toHaveLength(2);
    expect(container.querySelector("[data-audit-timeline='presentation-only']")).toBeVisible();
  });

  it.each([
    ["fa", "rtl", "تاریخچه رویدادها"],
    ["en", "ltr", "Event history"],
  ] as const)(
    "inherits %s direction and uses logical timeline geometry",
    (locale, direction, title) => {
      applyProductLocale(document.documentElement, locale);
      const { container } = render(<AuditTimeline events={events} locale={locale} />);

      expect(document.documentElement).toHaveAttribute("dir", direction);
      expect(container.querySelector("[data-audit-timeline]")).not.toHaveAttribute("dir");
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      const timelineItemStyle = container.querySelector("li")?.getAttribute("style") ?? "";
      expect(timelineItemStyle).toContain("border-inline-start: 1px solid var(--bs-border-color)");
      expect(timelineItemStyle).toContain("padding-inline-start: 1.5rem");
    },
  );

  it("escapes caller labels and never renders extra raw audit fields", () => {
    const eventWithRawExtras = {
      ...events[0],
      actionLabel: "<script>steal()</script>",
      actorLabel: '<img src=x onerror="steal()">',
      after: "private after snapshot",
      before: "private before snapshot",
      ip: "192.0.2.10",
      route: "POST /internal/path",
      userAgent: "private browser fingerprint",
    };
    const { container } = render(<AuditTimeline events={[eventWithRawExtras]} />);

    expect(screen.getByText("<script>steal()</script>")).toBeVisible();
    expect(screen.getByText('<img src=x onerror="steal()">')).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container).not.toHaveTextContent("private after snapshot");
    expect(container).not.toHaveTextContent("192.0.2.10");
    expect(container).not.toHaveTextContent("/internal/path");
  });

  it("uses safe fallbacks for a missing actor and malformed timestamp", () => {
    render(
      <AuditTimeline
        events={[
          {
            ...events[1],
            occurredAt: "invalid",
          },
        ]}
      />,
    );

    expect(screen.getByText("سامانه")).toBeVisible();
    expect(screen.getByText("زمان نامشخص")).toBeVisible();
  });

  it("uses shared empty and safe retry error states", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    const { rerender } = render(<AuditTimeline events={[]} />);
    expect(screen.getByText("رویدادی برای نمایش وجود ندارد.")).toBeVisible();

    rerender(
      <AuditTimeline error={new Error("network unavailable")} events={[]} onRetry={onRetry} />,
    );
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
