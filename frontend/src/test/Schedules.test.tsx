import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import {
  adaptScheduleDetail,
  adaptSchedulePage,
  validScheduleQuery,
} from "../modules/checkupino/schedules/api";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import Schedules, { WorkplaceSchedule } from "../pages/Administration/Schedules";

const { execute, identity } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  identity: { roles: ["admin"] },
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ capabilities: adminCapabilitiesFor(identity) }),
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const publicId = "01m4hfgan168p6q5ftp528285f";
const workplace = () => ({
  id: 3,
  public_id: publicId,
  display_name: "Synthetic workplace",
  is_active: true,
  state: "active",
  archived_at: null,
  created_at: "2026-10-15T08:00:00Z",
  updated_at: "2026-10-15T08:00:00Z",
  doctor: {
    id: 2,
    public_id: publicId,
    user_public_id: publicId,
    name: "Synthetic doctor",
    verified: true,
    account_active: true,
    archived: false,
    email: "PRIVATE EMAIL",
  },
  hospital: {
    id: 1,
    public_id: publicId,
    name: "Synthetic hospital",
    timezone: "Asia/Tehran",
    is_active: true,
    archived: false,
    address: "PRIVATE ADDRESS",
  },
  counts: { services: 1, rules: 1, active_rules: 1, slots: 1 },
  booking_notes: "PRIVATE NOTES",
});
const offering = () => ({
  id: 5,
  public_id: publicId,
  title: "Synthetic service",
  is_active: true,
  archived: false,
  offering_active: true,
  price_override: null,
  currency_override: null,
  base_price: "9007199254740993",
  base_currency: "IRR",
});
const rule = () => ({
  id: 7,
  public_id: publicId,
  checkup: offering(),
  weekday: 0,
  starts_at: "08:00:00",
  ends_at: "12:00:00",
  duration_minutes: 30,
  is_active: true,
  effective_from: "2026-10-01",
  effective_until: null,
  price_override: "7654321",
  currency_override: null,
  breaks: [{ starts_at: "10:00:00", ends_at: "10:15:00" }],
});
const slot = () => ({
  public_id: publicId,
  starts_at: "2026-10-18T08:00:00+03:30",
  ends_at: "2026-10-18T08:30:00+03:30",
  duration_minutes: 30,
  price: "9007199254740993",
  currency: "IRR",
  is_active: true,
  checkup: offering(),
  rule: { id: 7, public_id: publicId, is_active: true },
  binding_consistent: true,
  is_future: true,
  blocking_reservation: false,
  has_reservation_history: true,
  patient_email: "PRIVATE PATIENT",
});
const pageWire = (kind: "workplaces" | "rules" | "slots") => ({
  success: true,
  data: [kind === "workplaces" ? workplace() : kind === "rules" ? rule() : slot()],
  meta: {
    read_only: true,
    generated_at: "2026-10-15T08:00:00Z",
    pagination: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
    ...(kind === "rules"
      ? { timezone: "Asia/Tehran" }
      : kind === "slots"
        ? { period: { from: "2026-10-15", to: "2026-10-21", timezone: "Asia/Tehran" } }
        : {}),
  },
});
const detailWire = () => ({
  success: true,
  data: { ...workplace(), services: [offering()] },
  meta: { read_only: true, generated_at: "2026-10-15T08:00:00Z" },
});
const makeStore = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof makeStore>[] = [];
const Location = () => <output aria-label="test URL">{useLocation().search}</output>;
async function page(path = "/schedules", locale: "en" | "fa" = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  applyProductLocale(document.documentElement, locale);
  const store = makeStore();
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/schedules/workplaces/:workplaceId" element={<WorkplaceSchedule />} />
          </Routes>
          <Location />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
}
beforeEach(() => {
  identity.roles = ["admin"];
  execute.mockReset().mockImplementation(async (request) => ({
    status: 200,
    headers: {},
    data: request.path.endsWith("/rules")
      ? pageWire("rules")
      : request.path.endsWith("/slots")
        ? pageWire("slots")
        : request.path.endsWith("/3")
          ? detailWire()
          : pageWire("workplaces"),
  }));
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("schedule read panels", () => {
  it.each(["en", "fa"] as const)(
    "renders %s safe workplace lists with stable detail links",
    async (locale) => {
      const { container } = await page("/schedules?doctor_id=2&state=active", locale);
      expect(await screen.findByRole("link", { name: "Synthetic workplace" })).toHaveAttribute(
        "href",
        "/schedules/workplaces/3?page=1&per_page=20&doctor_id=2&state=active",
      );
      expect(container.textContent).not.toMatch(/PRIVATE|schedule\.|adminManage\./);
      expect(document.documentElement.dir).toBe(locale === "fa" ? "rtl" : "ltr");
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it.each(["en", "fa"] as const)(
    "renders %s independent rule and slot facts in the retained grid",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const { container } = await page("/schedules/workplaces/3?doctor_id=2", locale);
      expect(await screen.findByRole("heading", { name: "Synthetic workplace" })).toBeVisible();
      await waitFor(() =>
        expect(container.querySelectorAll("[data-schedule-generated]")).toHaveLength(2),
      );
      expect(container.querySelectorAll("[data-schedule-boxes] section")).toHaveLength(3);
      expect(screen.getByRole("region", { name: copy["schedule.rules"] })).toHaveTextContent(
        "10:00 – 10:15",
      );
      const slots = screen.getByRole("region", { name: copy["schedule.slots"] });
      expect(slots).toHaveTextContent(copy["schedule.blocking_reservation"]);
      expect(slots).toHaveTextContent(copy["schedule.has_reservation_history"]);
      expect(container.querySelector('a[href="/reservations?workplace_id=3"]')).toBeVisible();
      expect(screen.getByRole("link", { name: copy["adminManage.back"] })).toHaveAttribute(
        "href",
        "/schedules?page=1&per_page=20&doctor_id=2",
      );
      expect(container.textContent).not.toMatch(/PRIVATE|schedule\.|adminManage\./);
      expect(screen.queryByRole("searchbox")).toBeNull();
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it("keeps rule and slot filters independent and preserves the list Back state", async () => {
    await page("/schedules/workplaces/3?doctor_id=2&state=inactive");
    await screen.findByRole("region", { name: en["schedule.slots"] });
    const rules = screen.getByRole("region", { name: en["schedule.rules"] }),
      slots = screen.getByRole("region", { name: en["schedule.slots"] });
    await userEvent.selectOptions(within(rules).getByLabelText(en["schedule.filter.weekday"]), "0");
    await userEvent.selectOptions(
      within(slots).getByLabelText(en["schedule.filter.history"]),
      "with",
    );
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/admin/schedules/workplaces/3/slots",
          query: expect.objectContaining({ history: "with" }),
        }),
      ),
    );
    expect(screen.getByLabelText("test URL")).toHaveTextContent("rules_weekday=0");
    expect(screen.getByRole("link", { name: en["adminManage.back"] })).toHaveAttribute(
      "href",
      "/schedules?page=1&per_page=20&doctor_id=2&state=inactive",
    );
  });
  it("suspends only slot reads while a paired date filter is incomplete", async () => {
    const { container } = await page("/schedules/workplaces/3");
    await waitFor(() =>
      expect(container.querySelectorAll("[data-schedule-generated]")).toHaveLength(2),
    );
    const before = execute.mock.calls.filter(([r]) => r.path.endsWith("/slots")).length;
    fireEvent.change(screen.getByLabelText(en["schedule.filter.from"]), {
      target: { value: "2026-10-18" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(en["schedule.invalidQuery"]);
    expect(
      screen.getByRole("region", { name: en["schedule.slots"] }).querySelector("tbody"),
    ).toBeNull();
    expect(execute.mock.calls.filter(([r]) => r.path.endsWith("/slots"))).toHaveLength(before);
    expect(
      screen.getByRole("region", { name: en["schedule.rules"] }).querySelector("tbody"),
    ).not.toBeNull();
  });
  it("refresh denial clears previous detail and both nested tables", async () => {
    await page("/schedules/workplaces/3");
    await screen.findByRole("heading", { name: "Synthetic workplace" });
    execute.mockResolvedValue({ status: 403, headers: {}, data: { message: "PRIVATE DENIAL" } });
    const detail = document.querySelector("[data-schedule-detail]");
    expect(detail).not.toBeNull();
    await userEvent.click(
      within(detail as HTMLElement).getByRole("button", { name: en["adminReservations.refresh"] }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.unavailable"]);
    expect(screen.queryByText("Synthetic doctor")).toBeNull();
    expect(screen.queryByRole("region", { name: en["schedule.slots"] })).toBeNull();
    expect(screen.queryByText("PRIVATE DENIAL")).toBeNull();
  });
  it.each(["patient", "doctor"])("does not fetch schedule data for %s", async (role) => {
    identity.roles = [role];
    await page();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it.each(["doctor_id=0", "page=1001", "state=unknown", "q=" + "a".repeat(101)])(
    "refuses invalid workplace query %s",
    async (query) => {
      await page("/schedules?" + query);
      expect(screen.getByRole("alert")).toHaveTextContent(en["schedule.invalidQuery"]);
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it("binds detail identity and strips nested identity/contact data", () => {
    const detail = adaptScheduleDetail(detailWire(), "3");
    expect(detail.doctor).not.toHaveProperty("email");
    expect(detail.hospital).not.toHaveProperty("address");
    expect(detail).not.toHaveProperty("booking_notes");
    expect(() => adaptScheduleDetail(detailWire(), "4")).toThrow(/binding/);
    const slots = adaptSchedulePage(pageWire("slots"), "slots");
    expect(slots.items[0]).not.toHaveProperty("patient_email");
  });
  it("rejects dishonest page/period/time/money/state shapes and duplicate rows", () => {
    expect(() =>
      adaptSchedulePage({ ...pageWire("slots"), data: [slot(), slot()] }, "slots"),
    ).toThrow(/Duplicate/);
    expect(() =>
      adaptSchedulePage({ ...pageWire("slots"), data: [{ ...slot(), price: 123 }] }, "slots"),
    ).toThrow(/Invalid input/i);
    expect(() =>
      adaptSchedulePage(
        { ...pageWire("slots"), data: [{ ...slot(), duration_minutes: 60 }] },
        "slots",
      ),
    ).toThrow(/Invalid input/i);
    expect(() =>
      adaptSchedulePage(
        { ...pageWire("workplaces"), data: [{ ...workplace(), state: "archived" }] },
        "workplaces",
      ),
    ).toThrow(/Invalid input/i);
    expect(() =>
      adaptSchedulePage(
        {
          ...pageWire("slots"),
          meta: {
            ...pageWire("slots").meta,
            period: { from: "2026-10-01", to: "2026-11-01", timezone: "Asia/Tehran" },
          },
        },
        "slots",
      ),
    ).toThrow(/period/);
    const query = {
      page: 1,
      perPage: 20,
      search: "",
      sort: null,
      filters: { from: "2026-02-30", to: "2026-03-01" },
    };
    expect(validScheduleQuery(query, "slots")).toBe(false);
  });
});
