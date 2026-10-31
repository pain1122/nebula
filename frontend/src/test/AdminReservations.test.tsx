import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import {
  adaptAdminReservation,
  adaptAdminReservationList,
  adminReservationRequest,
  parseAdminReservationQuery,
} from "../modules/checkupino/reservations/admin";
import AdminReservations from "../pages/Reservations/AdminReservations";
import AdminReservationDetail from "../pages/Reservations/AdminReservationDetail";

const { identity, execute } = vi.hoisted(() => ({
  identity: { roles: ["admin"] },
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ capabilities: adminCapabilitiesFor(identity) }),
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const publicId = "01m44ah0fxjqz5mbpbabe1qj44";
const row = {
  id: 8,
  public_id: publicId,
  starts_at: "2026-10-11T04:30:00+00:00",
  ends_at: "2026-10-11T05:00:00+00:00",
  status: "completed",
  booked_amount: 7000000,
  booked_currency: "IRR",
  doctor_workplace_id: 3,
  hospital_name: "Synthetic workplace",
  timezone: "Asia/Tehran",
  hold_expires_at: null,
  completed_at: "2026-10-11T10:14:21+00:00",
  created_at: "2026-10-04T10:00:00+00:00",
  patient: { id: 4, public_id: publicId, name: "Demo Patient", email: "patient@example.test" },
  doctor: {
    id: 2,
    public_id: publicId,
    user_id: 5,
    name: "Demo Doctor",
    specialty: "Synthetic specialty",
  },
  checkup: { id: 5, public_id: publicId, title: "Synthetic checkup", price: 9900000 },
  payment: {
    id: 9,
    public_id: publicId,
    amount: 7000000,
    currency: "IRR",
    status: "paid",
    provider: "synthetic",
  },
};
const wire = (data: unknown, total = 21) => ({
  data,
  meta: { pagination: { current_page: 1, last_page: 2, per_page: 20, total } },
});
const response = (data: unknown): TransportResponse<unknown> => ({
  data,
  headers: {},
  status: 200,
});
const stores: ReturnType<typeof makeStore>[] = [];
const makeStore = () =>
  configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(checkupinoApi.middleware),
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
  });
const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="test URL">{location.pathname + location.search}</output>;
};
const renderPage = async (path = "/reservations", locale: "en" | "fa" = "en") => {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    interpolation: { escapeValue: false },
    keySeparator: false,
    lng: locale,
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  applyProductLocale(document.documentElement, locale);
  const store = makeStore();
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/reservations" element={<AdminReservations />} />
            <Route path="/reservations/:reservationId" element={<AdminReservationDetail />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};
beforeEach(() => {
  identity.roles = ["admin"];
  execute
    .mockReset()
    .mockImplementation(async (request) =>
      response(request.path === "/api/admin/reservations" ? wire([row]) : { data: row }),
    );
});
afterEach(() => {
  stores.splice(0).forEach((store) => store.dispatch(checkupinoApi.util.resetApiState()));
});

describe("admin reservation read contract", () => {
  it("rejects malformed identity/time/money/page and drops undeclared sensitive fields", () => {
    expect(
      adaptAdminReservation({ data: { ...row, password: "never", report_body: "never" } }, 8),
    ).not.toHaveProperty("password");
    expect(adaptAdminReservation({ data: row }, 8).checkup).not.toHaveProperty("price");
    expect(() => adaptAdminReservation({ data: row }, 9)).toThrow(
      "Reservation detail identity or time contract rejected.",
    );
    for (const bad of [
      { ...row, booked_amount: undefined },
      { ...row, booked_amount: Number.MAX_SAFE_INTEGER + 1 },
      { ...row, ends_at: row.starts_at },
      { ...row, public_id: "wrong" },
      { ...row, status: "invented" },
    ])
      expect(() => adaptAdminReservationList(wire([bad]))).toThrow(/Reservation|Invalid|Too big/);
    expect(() => adaptAdminReservationList(wire([row, row]))).toThrow(
      "Reservation list identity or time contract rejected.",
    );
    expect(() =>
      adaptAdminReservationList({
        data: [row],
        meta: { pagination: { current_page: 1, last_page: 1, per_page: 101, total: 1 } },
      }),
    ).toThrow("Reservation page bound rejected.");
  });
  it("bounds and allowlists URL state while keeping exact doctor-profile/patient identities", () => {
    const query = parseAdminReservationQuery(
      new URLSearchParams(
        "doctor_id=2&user_id=4&workplace_id=3&checkup_id=5&period=upcoming&page=999999&per_page=1000&sort_by=patient_name&sort_dir=asc&token=private&from=2026-02-30&status=unknown",
      ),
    );
    expect(query).toMatchObject({
      page: 100000,
      perPage: 100,
      filters: { doctor_id: 2, user_id: 4, workplace_id: 3, checkup_id: 5, period: "upcoming" },
    });
    expect(query.filters).not.toHaveProperty("from");
    expect(adminReservationRequest(query)).toMatchObject({
      doctorId: 2,
      userId: 4,
      workplaceId: 3,
      period: "upcoming",
      sortBy: "patient_name",
      sortDirection: "asc",
    });
  });
});
describe("admin reservations panel", () => {
  it.each(["admin", "root-admin"])(
    "shows booked snapshots and server pagination for %s",
    async (role) => {
      identity.roles = [role];
      await renderPage();
      expect(await screen.findByText("7,000,000 IRR")).toBeVisible();
      expect(screen.queryByText(/9,900,000/)).not.toBeInTheDocument();
      expect(screen.getByText("21 reservations found")).toBeVisible();
      expect(screen.getByRole("link", { name: "Demo Doctor" })).toHaveAttribute(
        "href",
        "/reservations?doctor_id=2",
      );
      expect(screen.getByRole("link", { name: "Demo Patient" })).toHaveAttribute(
        "href",
        "/reservations?user_id=4",
      );
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
  it.each(["patient", "doctor"])("never requests admin data for %s", async (role) => {
    identity.roles = [role];
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("You do not have access");
    expect(execute).not.toHaveBeenCalled();
  });
  it("composes advanced identity/date/status filters and resets pages", async () => {
    await renderPage(
      "/reservations?page=2&doctor_id=2&user_id=4&workplace_id=3&checkup_id=5&from=2026-10-11&to=2026-10-12&payment_status=paid",
    );
    await screen.findByText("Demo Patient");
    expect(execute.mock.calls[0][0].query).toMatchObject({
      page: 2,
      doctor_id: 2,
      user_id: 4,
      workplace_id: 3,
      checkup_id: 5,
      from: "2026-10-11",
      to: "2026-10-12",
      payment_status: "paid",
    });
    fireEvent.change(screen.getByLabelText("Appointment status"), {
      target: { value: "completed" },
    });
    await waitFor(() =>
      expect(execute.mock.lastCall?.[0].query).toMatchObject({
        page: 1,
        status: "completed",
        doctor_id: 2,
        user_id: 4,
      }),
    );
  });
  it("uses server quick periods and preserves identity filters while clearing conflicting dates/states", async () => {
    await renderPage("/reservations?doctor_id=2&status=completed&from=2026-10-10");
    await screen.findByText("Demo Patient");
    await userEvent.setup().click(screen.getByRole("button", { name: "Upcoming" }));
    await waitFor(() =>
      expect(execute.mock.lastCall?.[0].query).toMatchObject({
        doctor_id: 2,
        period: "upcoming",
        page: 1,
      }),
    );
    expect(execute.mock.lastCall?.[0].query?.from).toBeUndefined();
    expect(execute.mock.lastCall?.[0].query?.status).toBeUndefined();
    expect(screen.getByRole("button", { name: "Upcoming" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(execute.mock.lastCall?.[0].query?.doctor_id).toBeUndefined());
  });
  it("connects debounced search/sort/pagination and strips unknown URL parameters", async () => {
    await renderPage("/reservations?unapproved=private");
    await screen.findByText("Demo Patient");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Demo" } });
    await waitFor(() => expect(execute.mock.lastCall?.[0].query?.q).toBe("Demo"));
    await screen.findByText("Demo Patient");
    expect(screen.getByLabelText("test URL")).not.toHaveTextContent("unapproved");
    await userEvent.setup().click(screen.getByRole("button", { name: /Starts \(Tehran\)/ }));
    await waitFor(() => expect(execute.mock.lastCall?.[0].query?.sort_by).toBe("starts_at"));
    await screen.findByText("Demo Patient");
    await userEvent.setup().click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(execute.mock.lastCall?.[0].query?.page).toBe(2));
  });
  it.each(["from=2026-10-12&to=2026-10-11", "q=" + "x".repeat(201)])(
    "refuses invalid query %s without fetching",
    async (query) => {
      await renderPage("/reservations?" + query);
      expect(screen.getByRole("alert")).toBeVisible();
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it("clears prior rows during refresh and error rather than presenting stale data", async () => {
    await renderPage();
    await screen.findByText("Demo Patient");
    let resolve: (response: TransportResponse<unknown>) => void = () => {};
    execute.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Demo Patient")).not.toBeInTheDocument());
    await act(async () => resolve(response(wire([]))));
    await waitFor(() => expect(screen.queryByText("Demo Patient")).not.toBeInTheDocument());
    execute.mockRejectedValue(new Error("private diagnostic must not show"));
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText(/private diagnostic/)).not.toBeInTheDocument();
  });
  it("opens numeric detail and returns to retained filtered list", async () => {
    await renderPage("/reservations?doctor_id=2&payment_status=paid");
    await screen.findByText("Demo Patient");
    await userEvent.setup().click(screen.getByRole("link", { name: "View" }));
    expect((await screen.findAllByText(publicId))[0]).toBeVisible();
    expect(execute.mock.lastCall?.[0].path).toBe("/api/admin/reservations/8");
    expect(
      screen.getByRole("link", { name: "Back to reservations" }).getAttribute("href"),
    ).toContain("doctor_id=2");
    expect(
      screen.getByRole("link", { name: "Back to reservations" }).getAttribute("href"),
    ).toContain("payment_status=paid");
  });
  it("refuses malformed detail IDs and mismatched response identity", async () => {
    const view = await renderPage("/reservations/not-an-id");
    expect(screen.getByRole("alert")).toHaveTextContent("invalid");
    expect(execute).not.toHaveBeenCalled();
    view.unmount();
    await renderPage("/reservations/9");
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("Demo Patient")).not.toBeInTheDocument();
  });
  it("uses Persian copy and language-owned RTL for list and detail", async () => {
    await renderPage("/reservations", "fa");
    expect(await screen.findByText("Demo Patient")).toBeVisible();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("button", { name: "تازه‌سازی" })).toBeVisible();
    await userEvent.setup().click(screen.getByRole("link", { name: "نمایش" }));
    expect((await screen.findAllByText(publicId))[0]).toBeVisible();
    expect(screen.getByRole("link", { name: "بازگشت به رزروها" })).toBeVisible();
  });
});
