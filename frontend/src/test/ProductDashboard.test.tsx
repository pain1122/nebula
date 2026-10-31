import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { adaptDashboard, readDashboard } from "../modules/checkupino/dashboard/api";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";
import ProductDashboard from "../pages/DashboardEcommerce/ProductDashboard";

const { execute, profile } = vi.hoisted(() => ({
  execute: vi.fn<(r: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  profile: { id: 1, roles: ["admin"] },
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../Layouts/ShellAuthContext", () => ({ useShellAuth: () => ({ userProfile: profile }) }));
vi.mock("../pages/DashboardEcommerce/AppointmentCalendar", () => ({
  default: () => <section data-dashboard-section="appointments">Appointments</section>,
}));
vi.mock("../pages/DashboardEcommerce/ClinicalDashboard", () => ({
  default: ({ doctor }: { doctor: boolean }) => <p>{doctor ? "Doctor home" : "Patient home"}</p>,
}));
vi.mock("../pages/DashboardEcommerce/DashboardEcommerceCharts", () => ({
  RevenueCharts: (props: { series: unknown; categories: unknown; countsOnly: boolean }) => (
    <output data-testid="trend-chart">{JSON.stringify(props)}</output>
  ),
  StoreVisitsCharts: (props: { values: unknown; labels: unknown }) => (
    <output data-testid="distribution-chart">{JSON.stringify(props)}</output>
  ),
}));
const dates = Array.from({ length: 30 }, (_, i) =>
  new Date(Date.UTC(2026, 8, 17 + i)).toISOString().slice(0, 10),
);
const series = () => Array.from({ length: 30 }, (_, i) => (i === 29 ? 1 : 0));
const fixture = () => ({
  success: true,
  data: {
    period: {
      from: dates[0],
      through: dates[29],
      starts_at: "2026-09-16T20:30:00Z",
      ends_at: "2026-10-16T10:30:00Z",
      timezone: "Asia/Tehran",
      days: 30,
    },
    reservations: {
      created: 1,
      upcoming: 0,
      states: { pending: 0, confirmed: 0, completed: 1, cancelled: 0, expired: 0 },
    },
    medical_requests: { created: 2, states: { open: 1, in_review: 0, completed: 1, cancelled: 0 } },
    submissions: { created: 1 },
    accounts: { patients: 4, doctors: 2, verified_doctors: 1 },
    payments: {
      paid: 1,
      inconsistent_paid: 0,
      pending_requests: 0,
      more_currencies: false,
      by_currency: [{ currency: "IRR", amount: "9007199254740993", payments: 1 }],
    },
    trends: { dates, bookings: series(), completions: series(), submissions: series() },
    rankings: {
      doctors: [
        {
          id: 2,
          public_id: "01m4hfgan168p6q5ftp528285f",
          name: "Synthetic doctor",
          archived: false,
          reservations: 1,
        },
      ],
      checkups: [
        {
          id: 5,
          public_id: "01m4hfgan168p6q5ftp528285g",
          name: "Synthetic service",
          archived: false,
          reservations: 1,
        },
      ],
    },
    latest_reservations: [
      {
        id: 8,
        public_id: "01m4hfgan168p6q5ftp528285h",
        patient: "Synthetic patient",
        doctor: "Synthetic doctor",
        checkup: "Synthetic service",
        status: "completed",
        starts_at: "2026-10-11T04:30:00Z",
        created_at: "2026-10-16T09:00:00Z",
      },
    ],
    locations: { available: false },
    updates: { available: false, reserved: true },
  },
  meta: {
    read_only: true,
    filters_supported: false,
    generated_at: "2026-10-16T10:30:00Z",
    latest_limit: 5,
    rank_limit: 5,
    currency_limit: 20,
    payment_basis: "currently_paid_canonical_payments_created_in_period",
    updates_reserved: true,
  },
});
const reply = (data: unknown) => ({ data, status: 200, headers: {} });
async function page(locale: "en" | "fa" = "en") {
  const instance = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await instance.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const view = render(
    <I18nextProvider i18n={instance}>
      <MemoryRouter>
        <ProductDashboard />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return { ...view, instance, copy: locale === "en" ? en : fa };
}
beforeEach(() => {
  profile.roles = ["admin"];
  execute.mockReset().mockResolvedValue(reply(fixture()));
});
describe("retained product dashboard", () => {
  it.each(["en", "fa"] as const)(
    "keeps all %s gadgets, exact money and full-page links without dashboard filters",
    async (locale) => {
      const { container, copy } = await page(locale);
      await screen.findByText(copy["dashboard.latest"]);
      for (const marker of [
        "reservations",
        "medical",
        "submissions",
        "payments",
        "appointments",
        "best-selling",
        "top-sellers",
        "store-visits",
        "recent-orders",
        "recent-activity",
      ])
        expect(container.querySelector(`[data-dashboard-section="${marker}"]`)).not.toBeNull();
      expect(screen.queryByTestId("preserved-map")).toBeNull();
      expect(screen.queryByTestId("trend-chart")).toBeNull();
      expect(container.querySelectorAll(".page-content input,.page-content select")).toHaveLength(
        0,
      );
      expect(screen.getAllByRole("link", { name: copy["dashboard.viewAll"] })).toHaveLength(8);
      expect(screen.getByText(copy["dashboard.updatesReserved"])).toBeVisible();
      expect(screen.queryByText(copy["dashboard.locationsUnavailable"])).toBeNull();
      expect(container.textContent).toContain(
        new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(9007199254740993n),
      );
      expect(container.textContent).not.toMatch(
        /dashboard\.|booking\.state\.|New Order|online now|185\.34|183\.35/,
      );
      expect(container.querySelector('a[href="/reservations/8"]')).not.toBeNull();
      expect(container.querySelector('a[href="/reservations?doctor_id=2"]')).not.toBeNull();
      expect(execute.mock.calls[0]?.[0]).toMatchObject({
        method: "GET",
        path: "/api/admin/dashboard",
      });
      expect(execute.mock.calls[0]?.[0]).not.toHaveProperty("query");
    },
  );
  it.each(["patient", "doctor"])("does not request admin reports for %s", async (role) => {
    profile.roles = [role];
    await page();
    expect(
      screen.getByText(role === "doctor" ? "Doctor home" : "Patient home"),
    ).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });
  it("hides the reserved feed through its retained toggle and preserves language refresh", async () => {
    const { container, instance, copy } = await page();
    await screen.findByText(copy["dashboard.latest"]);
    await userEvent.click(
      screen.getByRole("button", { name: en["product.dashboard.toggleActivity"] }),
    );
    expect(container.querySelector('[data-dashboard-section="recent-activity"]')).toHaveClass(
      "d-none",
    );
    await act(async () => {
      await instance.changeLanguage("fa");
    });
    expect(screen.getByText(fa["dashboard.latest"])).toBeInTheDocument();
    expect(execute).toHaveBeenCalledOnce();
  });
  it("clears stale reports when an explicit refresh is refused", async () => {
    const { container } = await page();
    await screen.findByText(en["dashboard.latest"]);
    execute.mockRejectedValue(new TransportError(classifyWireFailure({ status: 403, data: {} })));
    await userEvent.click(screen.getByRole("button", { name: en["adminReservations.refresh"] }));
    await waitFor(() =>
      expect(container.querySelector('[data-dashboard-section="recent-orders"]')).toBeNull(),
    );
    expect(screen.queryByText("Synthetic patient")).toBeNull();
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("aborts pending reads when the page unmounts", async () => {
    let signal: AbortSignal | undefined;
    execute.mockImplementation((r) => {
      signal = r.signal;
      return new Promise(() => {});
    });
    const view = await page();
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("escapes display labels instead of interpreting HTML", async () => {
    const body = fixture();
    body.data.latest_reservations[0]!.patient = "<img src=x onerror=alert(1)>";
    execute.mockResolvedValue(reply(body));
    const { container } = await page();
    await screen.findByText("<img src=x onerror=alert(1)>");
    expect(container.querySelector("img[src=x]")).toBeNull();
  });
  it("supports zero-state charts without fabricating records", async () => {
    const body = fixture();
    body.data.reservations.created = 0;
    body.data.reservations.states.completed = 0;
    body.data.trends.bookings.fill(0);
    body.data.latest_reservations = [];
    body.data.rankings = { doctors: [], checkups: [] };
    execute.mockResolvedValue(reply(body));
    await page();
    await screen.findByText(en["dashboard.latest"]);
    expect(screen.getAllByText(en["dashboard.empty"]).length).toBeGreaterThan(0);
  });
  it.each(["cohort", "dates", "currency", "unsafe-count", "not-read-only", "bad-limit"])(
    "rejects %s mismatches",
    (kind) => {
      const body = fixture();
      switch (kind) {
        case "cohort":
          body.data.reservations.created = 2;
          break;
        case "dates":
          body.data.trends.dates = [...dates].reverse();
          break;
        case "currency":
          body.data.payments.by_currency[0]!.currency = "12#";
          break;
        case "unsafe-count":
          body.data.accounts.patients = Number.MAX_SAFE_INTEGER + 1;
          break;
        case "not-read-only":
          body.meta.read_only = false;
          break;
        case "bad-limit":
          body.meta.latest_limit = 100;
          break;
      }
      expect(() => adaptDashboard(body)).toThrow(/Dashboard|Invalid|Too big/);
    },
  );
  it("retains mixed-currency exact values and strips unsupported private metadata", () => {
    const body = fixture();
    body.data.payments.paid = 2;
    body.data.payments.by_currency.push({ currency: "EUR", amount: "123", payments: 1 });
    Object.assign(body.data, { private_details: "PRIVATE" });
    const adapted = adaptDashboard(body);
    expect(adapted.data.payments.by_currency.map((row) => row.amount)).toEqual([
      "9007199254740993",
      "123",
    ]);
    expect(JSON.stringify(adapted)).not.toContain("PRIVATE");
  });
  it("does not contact transport with an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readDashboard(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(execute).not.toHaveBeenCalled();
  });
});
