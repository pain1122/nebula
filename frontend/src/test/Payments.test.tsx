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
  adaptPaymentDetail,
  adaptPaymentPage,
  validPaymentQuery,
  type PaymentKind,
} from "../modules/checkupino/payments/api";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import Payments, { PaymentDetail } from "../pages/Administration/Payments";

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
const attempt = () => ({
  public_id: publicId,
  provider: "sandbox",
  status: "succeeded",
  amount: "9007199254740993",
  currency: "IRR",
  binding_consistent: true,
  is_canonical: true,
  has_failure: false,
  initiated_at: "2026-10-05T10:00:00Z",
  expires_at: null,
  completed_at: "2026-10-05T10:05:00Z",
  provider_ref: "PRIVATE REFERENCE",
  metadata: { raw: "PRIVATE METADATA" },
});
const adjustment = () => ({
  public_id: publicId,
  type: "refund",
  status: "pending",
  amount: "123",
  currency: "IRR",
  currency_matches_payment: true,
  reason_recorded: true,
  created_at: "2026-10-15T10:00:00Z",
  updated_at: null,
  reason: "PRIVATE REASON",
});
const event = () => ({
  public_id: publicId,
  attempt_public_id: publicId,
  provider: "sandbox",
  event_type: "payment.succeeded",
  signature_verified: true,
  received_at: "2026-10-05T10:05:00Z",
  processed_at: "2026-10-05T10:05:01Z",
  sanitized_payload: "PRIVATE CALLBACK",
});
const payment = () => ({
  public_id: publicId,
  amount: "9007199254740993",
  currency: "IRR",
  status: "paid",
  provider: "sandbox",
  paid_at: "2026-10-05T10:05:00Z",
  refunded_at: null,
  created_at: "2026-10-05T10:00:00Z",
  updated_at: null,
  canonical_consistent: true,
  canonical_attempt: attempt(),
  counts: { attempts: 1, adjustments: 1, reconciliation_attempts: 0, pending_adjustments: 1 },
  reservation: {
    id: 8,
    public_id: publicId,
    status: "completed",
    starts_at: "2026-10-11T04:30:00Z",
    ends_at: "2026-10-11T05:00:00Z",
    timezone: "Asia/Tehran",
    booked_amount: "7000000",
    booked_currency: "IRR",
    workplace_id: 3,
    checkup_id: 5,
    checkup_title: "Synthetic service",
    hospital_name: "Synthetic hospital",
    patient: { id: 4, public_id: publicId, name: "Synthetic patient", email: "PRIVATE EMAIL" },
    doctor: {
      id: 2,
      public_id: publicId,
      user_public_id: publicId,
      name: "Synthetic doctor",
      archived: false,
      phone: "PRIVATE PHONE",
    },
  },
});
const metadata = () => ({
  read_only: true,
  adjustments_execute_provider: false,
  generated_at: "2026-10-16T00:00:00Z",
});
const pageWire = (kind: PaymentKind = "payments") => ({
  success: true,
  data: [
    kind === "payments"
      ? payment()
      : kind === "attempts"
        ? attempt()
        : kind === "adjustments"
          ? adjustment()
          : event(),
  ],
  meta: {
    ...metadata(),
    pagination: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
    period: null,
    payment_public_id: publicId,
    pending_is_request_only: true,
  },
});
const detailWire = () => ({ success: true, data: payment(), meta: metadata() });
const makeStore = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof makeStore>[] = [];
const Location = () => <output aria-label="test URL">{useLocation().search}</output>;
async function page(path = "/payments", locale: "en" | "fa" = "en") {
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
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/:paymentId" element={<PaymentDetail />} />
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
    data: request.path.endsWith("/attempts")
      ? pageWire("attempts")
      : request.path.endsWith("/adjustments")
        ? pageWire("adjustments")
        : request.path.endsWith("/events")
          ? pageWire("events")
          : request.path.endsWith("/" + publicId)
            ? detailWire()
            : pageWire(),
  }));
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});
describe("payment read panels", () => {
  it.each(["en", "fa"] as const)(
    "shows %s safe exact payment money and scoped details links",
    async (locale) => {
      const { container } = await page("/payments?patient_id=4&status=paid", locale);
      expect(await screen.findByRole("link", { name: publicId })).toHaveAttribute(
        "href",
        `/payments/${publicId}?page=1&per_page=20&patient_id=4&status=paid`,
      );
      expect(container.textContent).toContain(
        new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(9007199254740993n),
      );
      expect(container.textContent).not.toMatch(/PRIVATE|payment\.|adminManage\./);
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it.each(["en", "fa"] as const)(
    "shows %s separate financial/reservation facts, five cards and three histories",
    async (locale) => {
      const { container } = await page(`/payments/${publicId}?patient_id=4`, locale);
      const copy = locale === "en" ? en : fa;
      await waitFor(() =>
        expect(container.querySelectorAll("[data-payment-generated]")).toHaveLength(3),
      );
      expect(container.querySelectorAll("[data-payment-boxes] section")).toHaveLength(5);
      expect(screen.getByRole("link", { name: copy["adminManage.back"] })).toHaveAttribute(
        "href",
        "/payments?page=1&per_page=20&patient_id=4",
      );
      expect(container.querySelector('a[href="/reservations/8"]')).toBeVisible();
      expect(screen.getByRole("link", { name: "Synthetic patient" })).toHaveAttribute(
        "href",
        `/users/${publicId}?directory=patients`,
      );
      expect(screen.getByRole("link", { name: "Synthetic doctor" })).toHaveAttribute(
        "href",
        `/users/${publicId}?directory=doctors`,
      );
      expect(container.textContent).toContain(copy["payment.state.paid"]);
      expect(container.textContent).toContain(copy["payment.state.completed"]);
      expect(container.textContent).toContain(copy["payment.requestsNotice"]);
      expect(container.textContent).not.toMatch(/PRIVATE|payment\.|adminManage\./);
    },
  );
  it("keeps adjustment controls hidden for an ordinary admin", async () => {
    await page(`/payments/${publicId}`);
    await screen.findByText(en["payment.summary"]);
    expect(screen.queryByRole("button", { name: en["payment.control.open"] })).toBeNull();
    expect(execute.mock.calls.some(([r]) => r.path.endsWith("/adjustment-context"))).toBe(false);
  });
  it.each(["en", "fa"] as const)(
    "opens and cancels the %s root request preview without writes",
    async (locale) => {
      identity.roles = ["root-admin"];
      const reader = execute.getMockImplementation()!;
      const expiresAt = Math.floor(Date.now() / 1000) + 300;
      execute.mockImplementation(async (r) =>
        r.path.endsWith("/adjustment-context")
          ? {
              status: 200,
              headers: {},
              data: {
                success: true,
                data: {
                  payment_public_id: publicId,
                  revision: "a".repeat(64),
                  expires_at: expiresAt,
                  can_request: true,
                  blocked: null,
                  amount: payment().amount,
                  currency: "IRR",
                  remaining_amount: "9007199254740870",
                  request_only: true,
                  limits: { max_amount: "9223372036854775807", reason: 1000 },
                },
              },
            }
          : reader(r),
      );
      const copy = locale === "en" ? en : fa;
      await page(`/payments/${publicId}`, locale);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: copy["payment.control.open"] })).toBeEnabled(),
      );
      await userEvent.click(screen.getByRole("button", { name: copy["payment.control.open"] }));
      await screen.findByText(copy["payment.control.remaining"]);
      await userEvent.click(
        within(screen.getByRole("dialog")).getByText(copy["adminManage.close"], {
          selector: "button",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it("requires a successful manual detail refresh before reopening an uncertain root request", async () => {
    identity.roles = ["root-admin"];
    const reader = execute.getMockImplementation()!;
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    execute.mockImplementation(async (r) => {
      if (r.method === "POST") throw new Error("Synthetic uncertain response");
      return r.path.endsWith("/adjustment-context")
        ? {
            status: 200,
            headers: {},
            data: {
              success: true,
              data: {
                payment_public_id: publicId,
                revision: "a".repeat(64),
                expires_at: expiresAt,
                can_request: true,
                blocked: null,
                amount: payment().amount,
                currency: "IRR",
                remaining_amount: "9007199254740870",
                request_only: true,
                limits: { max_amount: "9223372036854775807", reason: 1000 },
              },
            },
          }
        : reader(r);
    });
    await page(`/payments/${publicId}`);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["payment.control.open"] })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: en["payment.control.open"] }));
    await screen.findByText(en["payment.control.remaining"]);
    fireEvent.change(screen.getByLabelText(en["payment.control.amount"]), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(en["adminManage.reason"]), {
      target: { value: "Synthetic ambiguous request." },
    });
    await userEvent.click(screen.getByRole("checkbox", { name: en["payment.control.confirm"] }));
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() => expect(screen.getAllByText(en["adminManage.uncertain"])).toHaveLength(2));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByText(en["adminManage.close"], { selector: "button" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: en["payment.control.open"] })).toBeDisabled();
    await userEvent.click(
      screen.getAllByRole("button", { name: en["adminReservations.refresh"] })[0]!,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["payment.control.open"] })).toBeEnabled(),
    );
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1);
  });
  it("maps quick filters to server queries while retaining patient and currency scope", async () => {
    await page("/payments?patient_id=4&currency=IRR&status=paid");
    await screen.findByRole("link", { name: publicId });
    await userEvent.click(screen.getByRole("button", { name: en["payment.quick.failedAttempts"] }));
    await waitFor(() =>
      expect(execute.mock.lastCall?.[0].query).toMatchObject({
        patient_id: "4",
        currency: "IRR",
        attempt_status: "failed",
      }),
    );
    expect(execute.mock.lastCall?.[0].query).not.toHaveProperty("status");
  });
  it("keeps history filters, reset and paging independent from list Back state", async () => {
    const { container } = await page(
      `/payments/${publicId}?patient_id=4&attempts_status=failed&events_processed=no`,
    );
    await waitFor(() =>
      expect(container.querySelectorAll("[data-payment-generated]")).toHaveLength(3),
    );
    const adjustments = container.querySelector('[data-payment-kind="adjustments"]') as HTMLElement;
    await userEvent.selectOptions(
      within(adjustments).getByLabelText(en["payment.filter.status"]),
      "pending",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("test URL")).toHaveTextContent("adjustments_status=pending"),
    );
    expect(screen.getByLabelText("test URL")).toHaveTextContent("attempts_status=failed");
    expect(screen.getByLabelText("test URL")).toHaveTextContent("events_processed=no");
    await userEvent.click(
      within(adjustments).getByRole("button", { name: en["adminReservations.reset"] }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("test URL").textContent).not.toContain("adjustments_status"),
    );
    expect(screen.getByRole("link", { name: en["adminManage.back"] })).toHaveAttribute(
      "href",
      "/payments?page=1&per_page=20&patient_id=4",
    );
  });
  it("suspends incomplete dates and partial currency while retaining visible filter input", async () => {
    await page();
    await screen.findByRole("link", { name: publicId });
    fireEvent.change(screen.getByLabelText(en["payment.filter.from"]), {
      target: { value: "2026-10-15" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(en["payment.invalidQuery"]);
    expect(screen.queryByRole("link", { name: publicId })).toBeNull();
    expect(execute.mock.calls.map(([r]) => r.query).some((q) => q?.from && !q.to)).toBe(false);
    fireEvent.change(screen.getByLabelText(en["payment.filter.currency"]), {
      target: { value: "I" },
    });
    expect(screen.getByLabelText(en["payment.filter.currency"])).toHaveValue("I");
  });
  it("clears cards and nested histories on refreshed detail refusal", async () => {
    const { container } = await page(`/payments/${publicId}`);
    await waitFor(() =>
      expect(container.querySelectorAll("[data-payment-generated]")).toHaveLength(3),
    );
    execute.mockResolvedValue({ status: 403, headers: {}, data: { message: "PRIVATE REASON" } });
    await userEvent.click(
      within(container.querySelector("[data-payment-detail]") as HTMLElement).getByRole("button", {
        name: en["adminReservations.refresh"],
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.unavailable"]);
    expect(container.querySelector("[data-payment-boxes]")).toBeNull();
    expect(container.querySelector("[data-payment-kind]")).toBeNull();
    expect(container.textContent).not.toContain("PRIVATE");
  });
  it.each(["patient", "doctor"])("refuses %s without dispatching payment reads", async (role) => {
    identity.roles = [role];
    await page(`/payments/${publicId}`);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it("refuses malformed public identifiers without dispatch", async () => {
    await page("/payments/123");
    expect(screen.getByRole("alert")).toHaveTextContent(en["payment.invalidIdentity"]);
    expect(execute).not.toHaveBeenCalled();
  });
  it("binds detail/history identities and strips all nested private data", () => {
    const row = adaptPaymentDetail(detailWire(), publicId);
    expect(row.reservation.patient).not.toHaveProperty("email");
    expect(row.canonical_attempt).not.toHaveProperty("metadata");
    expect(() => adaptPaymentDetail(detailWire(), "01m4hfgan168p6q5ftp528285g")).toThrow(
      /identity/,
    );
    expect(() =>
      adaptPaymentPage(pageWire("events"), "events", "01m4hfgan168p6q5ftp528285g"),
    ).toThrow(/binding/);
  });
  it("rejects duplicate rows, unsafe money/state/canonical metadata and oversized page payloads", () => {
    expect(() =>
      adaptPaymentPage({ ...pageWire(), data: [payment(), payment()] }, "payments"),
    ).toThrow(/Duplicate/);
    for (const override of [
      { amount: 123 },
      { amount: "1.5" },
      { amount: "18446744073709551616" },
      { currency: "irr" },
      { canonical_attempt: null },
    ]) {
      expect(() =>
        adaptPaymentDetail({ ...detailWire(), data: { ...payment(), ...override } }, publicId),
      ).toThrow(/Invalid/);
    }
    expect(() =>
      adaptPaymentPage(
        {
          ...pageWire(),
          meta: {
            ...pageWire().meta,
            pagination: { current_page: 1, last_page: 1, per_page: 101, total: 1 },
          },
        },
        "payments",
      ),
    ).toThrow(/bounds/);
    expect(() =>
      adaptPaymentPage(
        {
          ...pageWire("adjustments"),
          meta: { ...pageWire("adjustments").meta, pending_is_request_only: false },
        },
        "adjustments",
        publicId,
      ),
    ).toThrow(/Invalid/);
  });
  it("rejects malformed composed filters and creation periods", () => {
    const base = { page: 1, perPage: 20, search: "", sort: null, filters: {} };
    const cases: readonly Readonly<Record<string, string>>[] = [
      { from: "2026-10-15" },
      { from: "2026-01-01", to: "2026-04-01" },
      { currency: "I" },
      { patient_id: "0" },
      { provider: "not a code" },
      { status: "unknown" },
    ];
    for (const filters of cases)
      expect(validPaymentQuery({ ...base, filters }, "payments")).toBe(false);
    expect(
      validPaymentQuery(
        { ...base, filters: { provider: "sandbox", attempt_status: "succeeded", currency: "IRR" } },
        "payments",
      ),
    ).toBe(true);
  });
});
