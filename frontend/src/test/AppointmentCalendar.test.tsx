import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import {
  adaptAppointmentCalendar,
  calendarRange,
  readAppointmentCalendar,
  tehranCalendarTime,
} from "../modules/checkupino/dashboard/calendar";
import AppointmentCalendar from "../pages/DashboardEcommerce/AppointmentCalendar";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(r: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", () => ({
  checkupinoTransport: { request: execute },
}));
const range = { from: "2026-10-01", until: "2026-11-01" };
const fixture = (from = range.from, until = range.until) => ({
  success: true,
  data: {
    from,
    until,
    timezone: "Asia/Tehran",
    limit: 200,
    has_more: false,
    appointments: [
      {
        id: 8,
        public_id: "01m4hfgan168p6q5ftp528285h",
        patient: "Synthetic patient",
        doctor: "Synthetic doctor",
        checkup: "Synthetic service",
        status: "completed",
        starts_at: "2026-10-11T04:30:00Z",
        ends_at: "2026-10-11T05:00:00Z",
      },
    ],
  },
  meta: { read_only: true, generated_at: "2026-10-16T10:30:00Z" },
});
const reply = (data: unknown) => ({ data, status: 200, headers: {} });
async function page(locale: "en" | "fa") {
  const instance = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await instance.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  return {
    ...render(
      <I18nextProvider i18n={instance}>
        <MemoryRouter>
          <AppointmentCalendar now="2026-10-16T10:30:00Z" />
        </MemoryRouter>
      </I18nextProvider>,
    ),
    instance,
  };
}
beforeEach(() => {
  execute.mockReset().mockImplementation(async (r) => {
    const from = String(r.query?.from),
      until = String(r.query?.until),
      f = fixture(from, until);
    if (from > "2026-10-11" || until <= "2026-10-11") f.data.appointments = [];
    return reply(f);
  });
});
describe("appointment calendar", () => {
  it("uses Tehran wall time independently of browser offsets, including midnight", () => {
    expect(tehranCalendarTime("2026-10-10T20:30:00Z")).toBe("2026-10-11T00:00:00");
    expect(tehranCalendarTime("2026-10-11T04:30:00Z")).toBe("2026-10-11T08:00:00");
  });
  it("rejects invalid, reversed and unbounded windows before transport", async () => {
    for (const bad of [
      { from: "2026-02-30", until: "2026-03-01" },
      { from: "2026-10-02", until: "2026-10-01" },
      { from: "2026-10-01", until: "2026-11-13" },
    ]) {
      expect(calendarRange.safeParse(bad).success).toBe(false);
      await expect(readAppointmentCalendar(bad, new AbortController().signal)).rejects.toThrow(/./);
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects response range mismatches, duplicate identities, invalid intervals and false overflow", () => {
    const mismatch = fixture();
    mismatch.data.from = "2026-09-01";
    const duplicate = fixture();
    duplicate.data.appointments.push(duplicate.data.appointments[0]!);
    const interval = fixture();
    interval.data.appointments[0]!.ends_at = interval.data.appointments[0]!.starts_at;
    const overflow = fixture();
    overflow.data.has_more = true;
    const outside = fixture();
    outside.data.appointments[0]!.starts_at = "2026-11-02T00:00:00Z";
    outside.data.appointments[0]!.ends_at = "2026-11-02T01:00:00Z";
    for (const invalid of [mismatch, duplicate, interval, overflow, outside])
      expect(() => adaptAppointmentCalendar(invalid, range)).toThrow(/Appointment calendar/);
  });
  it.each(["en", "fa"] as const)(
    "renders the real %s calendar with a timed appointment, guarded detail link and mirrored arrows",
    async (locale) => {
      const { container } = await page(locale),
        copy = locale === "fa" ? fa : en;
      await screen.findByText(/Synthetic patient/);
      expect(
        container.querySelector(locale === "fa" ? ".fc-direction-rtl" : ".fc-direction-ltr"),
      ).not.toBeNull();
      expect(container.querySelector('a[href="/panel/reservations/8"]')).not.toBeNull();
      expect(
        container.querySelector('.fc-daygrid-day[data-date="2026-10-16"] [data-calendar-today]'),
      ).toHaveTextContent(copy["dashboard.calendarToday"]);
      expect(
        container.querySelector('.fc-daygrid-day[data-date="2026-10-11"] [data-calendar-today]'),
      ).toBeNull();
      expect(container.textContent).toContain(locale === "fa" ? "۰۸:۰۰" : "8:00");
      expect(container.querySelector(".fc")?.textContent).not.toContain("۱۴۰۵");
      expect(
        screen.getByRole("button", { name: copy["dashboard.calendarPrev"] }).querySelector("i"),
      ).toHaveClass(locale === "fa" ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line");
      expect(execute.mock.calls[0]?.[0]).toMatchObject({
        method: "GET",
        path: "/api/admin/dashboard/appointments",
      });
      const compactWeekdays = container.querySelectorAll(".fc-col-header-cell span[title]");
      const expectedCompactWeekdays = locale === "fa" ? 7 : 0;
      expect(compactWeekdays).toHaveLength(expectedCompactWeekdays);
      expect(new Set(Array.from(compactWeekdays, (day) => day.textContent)).size).toBe(
        expectedCompactWeekdays,
      );
      for (const compact of compactWeekdays) {
        expect(compact).toHaveClass("d-sm-none");
        expect(compact).toHaveAttribute("aria-hidden", "true");
        expect(compact.nextElementSibling).toHaveClass("visually-hidden", "d-sm-none");
        expect(compact.nextElementSibling?.textContent).toBe(compact.getAttribute("title"));
        expect(compact.nextElementSibling?.nextElementSibling).toHaveClass("d-none", "d-sm-inline");
      }
      await userEvent.click(screen.getByRole("button", { name: copy["dashboard.calendarNext"] }));
      await screen.findByText(copy["dashboard.calendarEmpty"]);
      expect(screen.queryByText(/Synthetic patient/)).toBeNull();
      expect(execute.mock.calls.length).toBeGreaterThan(1);
    },
  );
  it("aborts superseded date reads and never renders a late old-range response", async () => {
    let resolveOld: ((r: TransportResponse<unknown>) => void) | undefined,
      oldSignal: AbortSignal | undefined;
    execute.mockImplementationOnce((r) => {
      oldSignal = r.signal;
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    });
    await page("en");
    await waitFor(() => expect(oldSignal).toBeDefined());
    await userEvent.click(screen.getByRole("button", { name: en["dashboard.calendarNext"] }));
    await screen.findByText(en["dashboard.calendarEmpty"]);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      resolveOld?.(reply(fixture("2026-09-27", "2026-11-01")));
    });
    expect(screen.queryByText(/Synthetic patient/)).toBeNull();
  });
  it("clears appointments after a refused read and aborts on unmount", async () => {
    const view = await page("en");
    await screen.findByText(/Synthetic patient/);
    execute.mockRejectedValueOnce(new Error("Refused"));
    await userEvent.click(screen.getByRole("button", { name: en["dashboard.calendarNext"] }));
    await waitFor(() => expect(screen.queryByText(/Synthetic patient/)).toBeNull());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const signal = execute.mock.calls.at(-1)?.[0].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
