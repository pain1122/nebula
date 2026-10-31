import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import { adaptAdminReservation } from "../modules/checkupino/reservations/admin";
import { adaptReplacementSlots } from "../modules/checkupino/reservations/writes";
import AdminReservationDetail from "../pages/Reservations/AdminReservationDetail";

const { execute, identity, listeners } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  identity: { id: 2, roles: ["admin"] },
  listeners: new Set<() => void>(),
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ capabilities: adminCapabilitiesFor(identity), userProfile: identity }),
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => ({ identity: { ...identity, roles: [...identity.roles] } }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const publicId = "01m44ah0fxjqz5mbpbabe1qj44";
const slot = {
  slot_id: "01m4hfgan168p6q5ftp528285f",
  starts_at: "2026-10-18T05:30:00+00:00",
  ends_at: "2026-10-18T06:00:00+00:00",
  duration_minutes: 30,
};
const fixture = () => ({
  id: 8,
  public_id: publicId,
  starts_at: "2026-10-18T04:30:00+00:00",
  ends_at: "2026-10-18T05:00:00+00:00",
  status: "confirmed",
  booked_amount: 7000000,
  booked_currency: "IRR",
  doctor_workplace_id: 3,
  hospital_name: "Synthetic workplace",
  timezone: "Asia/Tehran",
  hold_expires_at: null,
  completed_at: null,
  created_at: null,
  patient: { id: 4, public_id: publicId, name: "Synthetic patient", email: null },
  doctor: {
    id: 2,
    public_id: publicId,
    user_id: 5,
    name: "Synthetic doctor",
    specialty: "Synthetic specialty",
  },
  checkup: { id: 5, public_id: publicId, title: "Synthetic checkup" },
  payment: {
    id: 9,
    public_id: publicId,
    amount: 7000000,
    currency: "IRR",
    status: "paid",
    provider: "synthetic",
  },
  actions: {
    revision: "a".repeat(64),
    generated_at: "2026-10-13T12:00:00+00:00",
    can_reschedule: true,
    allowed_statuses: ["cancelled"],
  },
});
let live = fixture();
let offered = [slot];
const reply = (data: unknown): TransportResponse<unknown> => ({
  data: { data },
  status: 200,
  headers: {},
});
const rejected = (status?: number) => new TransportError(classifyWireFailure({ status }));
const slotPage = (page = 1) => ({
  reservation_id: 8,
  actions: live.actions,
  timezone: live.timezone,
  booked_amount: live.booked_amount,
  booked_currency: live.booked_currency,
  items: offered,
  pagination: { current_page: page, per_page: 20, last_page: 2, total: 21 },
});
const perform = async (request: TransportRequest): Promise<TransportResponse<unknown>> => {
  if (request.path === "/api/auth/confirm-password")
    return reply({ confirmed_at: "2026-10-13T12:00:00Z", expires_at: "2026-10-13T12:15:00Z" });
  if (request.path.endsWith("/reschedule-slots"))
    return reply(slotPage(Number(request.query?.page ?? 1)));
  if (request.method === "PUT") {
    const body = request.body as Readonly<Record<string, unknown>>;
    live = {
      ...live,
      ...(request.path.endsWith("/schedule")
        ? { starts_at: slot.starts_at, ends_at: slot.ends_at }
        : { status: String(body.status) }),
      actions: {
        ...live.actions,
        revision: "b".repeat(64),
        ...(request.path.endsWith("/status")
          ? { can_reschedule: false, allowed_statuses: [] }
          : {}),
      },
    };
  }
  return reply(live);
};
const writes = () => execute.mock.calls.filter(([request]) => request.method === "PUT");
const makeStore = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof makeStore>[] = [];
async function page(locale: "en" | "fa" = "en") {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  applyProductLocale(document.documentElement, locale);
  const store = makeStore();
  stores.push(store);
  const view = render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter initialEntries={["/reservations/8?doctor_id=2"]}>
          <Routes>
            <Route path="/reservations/:reservationId" element={<AdminReservationDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  await screen.findByText("Synthetic patient");
  return view;
}
const click = async (name: string) =>
  userEvent
    .setup()
    .click(
      screen
        .getAllByRole("button", { name })
        .find((button) => button.textContent?.trim() === name)!,
    );
async function chooseReschedule() {
  await click("Reschedule appointment");
  await screen.findByRole("option", { name: /2026/ });
  fireEvent.change(screen.getByLabelText("Replacement appointment"), {
    target: { value: slot.slot_id },
  });
}
function confirm() {
  fireEvent.change(screen.getByLabelText("Reason for this administrative action"), {
    target: { value: "Synthetic supported change." },
  });
  fireEvent.click(screen.getByLabelText("I confirm the selected change and its reason."));
}
beforeEach(() => {
  identity.id = 2;
  identity.roles = ["admin"];
  live = fixture();
  offered = [slot];
  execute.mockReset().mockImplementation(perform);
});
afterEach(() =>
  stores.splice(0).forEach((store) => store.dispatch(checkupinoApi.util.resetApiState())),
);

describe("reservation action controls", () => {
  it("keeps completed controls disabled and excludes root-only override for ordinary admins", async () => {
    live.status = "completed";
    live.actions.can_reschedule = false;
    live.actions.allowed_statuses = [];
    await page();
    expect(screen.getByRole("button", { name: "Reschedule appointment" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Override appointment status" }),
    ).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
  it("selects a real issued slot and requires reason plus explicit confirmation", async () => {
    await page();
    await chooseReschedule();
    expect(screen.getByRole("button", { name: "Confirm action" })).toBeDisabled();
    expect(screen.getByText(/booked amount remains 7,000,000 IRR/)).toBeVisible();
    expect(
      execute.mock.calls.find(([request]) => request.path.endsWith("/reschedule-slots"))?.[0].query,
    ).toEqual({ from: "2026-10-13", to: "2026-10-26", page: 1, per_page: 20 });
    confirm();
    expect(screen.getByRole("button", { name: "Confirm action" })).toBeEnabled();
    expect(writes()).toHaveLength(0);
  });
  it("fresh-checks detail and availability, allowlists one save and refreshes acknowledged success", async () => {
    await page();
    await chooseReschedule();
    confirm();
    await click("Confirm action");
    expect(await screen.findByText("Appointment change saved and audited.")).toBeVisible();
    expect(writes()).toHaveLength(1);
    expect(writes()[0][0].body).toEqual({
      slot_id: slot.slot_id,
      reason: "Synthetic supported change.",
      expected_revision: "a".repeat(64),
    });
    expect(
      execute.mock.calls.filter(([request]) => request.path.endsWith("/reschedule-slots")),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });
  it("shows only the server-permitted root state and sends its reason/revision", async () => {
    identity.id = 1;
    identity.roles = ["root-admin"];
    await page();
    await click("Override appointment status");
    const select = screen.getByLabelText("Appointment status");
    expect(within(select).queryByRole("option", { name: "Completed" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Paid" })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "cancelled" } });
    confirm();
    await click("Confirm action");
    await screen.findByText("Appointment change saved and audited.");
    expect(writes()[0][0].body).toEqual({
      status: "cancelled",
      reason: "Synthetic supported change.",
      expected_revision: "a".repeat(64),
    });
  });
  it("blocks stale preflight before delivery and requires explicit refresh", async () => {
    await page();
    await chooseReschedule();
    confirm();
    live.actions.revision = "b".repeat(64);
    await click("Confirm action");
    expect(await screen.findByRole("alert")).toHaveTextContent(/changed|refresh/i);
    expect(writes()).toHaveLength(0);
    await click("Close");
    expect(screen.getByRole("button", { name: "Reschedule appointment" })).toBeDisabled();
    await click("Refresh");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reschedule appointment" })).toBeEnabled(),
    );
  });
  it("refuses a slot that disappeared between selection and fresh delivery checks", async () => {
    await page();
    await chooseReschedule();
    confirm();
    offered = [];
    await click("Confirm action");
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(writes()).toHaveLength(0);
  });
  it("rechecks after normal password confirmation and makes only the bounded ordinary retry", async () => {
    let first = true;
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT" && first) {
        first = false;
        throw rejected(423);
      }
      return perform(request);
    });
    await page();
    await chooseReschedule();
    confirm();
    await click("Confirm action");
    const field = await screen.findByLabelText(/Current password/);
    fireEvent.change(field, { target: { value: "synthetic" } });
    await click("Confirm password");
    await screen.findByText("Appointment change saved and audited.");
    expect(writes()).toHaveLength(2);
    expect(
      execute.mock.calls.filter(([request]) => request.path.endsWith("/reschedule-slots")),
    ).toHaveLength(3);
  });
  it("never retries a stale selection after password confirmation", async () => {
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") throw rejected(423);
      return perform(request);
    });
    await page();
    await chooseReschedule();
    confirm();
    await click("Confirm action");
    const field = await screen.findByLabelText(/Current password/);
    live.actions.revision = "b".repeat(64);
    fireEvent.change(field, { target: { value: "synthetic" } });
    await click("Confirm password");
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(writes()).toHaveLength(1);
  });
  it("password cancellation preserves the reason and delivers no retry", async () => {
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") throw rejected(423);
      return perform(request);
    });
    await page();
    await chooseReschedule();
    confirm();
    await click("Confirm action");
    await screen.findByLabelText(/Current password/);
    await click("Cancel");
    expect(await screen.findByLabelText("Reason for this administrative action")).toHaveValue(
      "Synthetic supported change.",
    );
    expect(writes()).toHaveLength(1);
    expect(
      execute.mock.calls.filter(([request]) => request.path === "/api/auth/confirm-password"),
    ).toHaveLength(0);
  });
  it.each([undefined, 500, 409])(
    "locks a delivered %s failure without automatic replay",
    async (status) => {
      execute.mockImplementation(async (request) => {
        if (request.method === "PUT") throw rejected(status);
        return perform(request);
      });
      await page();
      await chooseReschedule();
      confirm();
      await click("Confirm action");
      await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: "Confirm action" })).toBeDisabled();
      await click("Close");
      expect(screen.getByRole("button", { name: "Reschedule appointment" })).toBeDisabled();
      expect(writes()).toHaveLength(1);
    },
  );
  it("cancels preflight and ignores a late read without delivering", async () => {
    let resolve: ((value: TransportResponse<unknown>) => void) | undefined;
    let signal: AbortSignal | undefined;
    await page();
    await chooseReschedule();
    confirm();
    execute.mockImplementation(async (request) => {
      if (request.path === "/api/admin/reservations/8") {
        signal = request.signal;
        return new Promise((done) => {
          resolve = done;
        });
      }
      return perform(request);
    });
    await click("Confirm action");
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    await click("Stop waiting and close");
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve?.(reply(live));
    });
    expect(writes()).toHaveLength(0);
  });
  it("cancels an in-flight save as uncertain and ignores its late acknowledgement", async () => {
    let resolve: ((value: TransportResponse<unknown>) => void) | undefined;
    let signal: AbortSignal | undefined;
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") {
        signal = request.signal;
        return new Promise((done) => {
          resolve = done;
        });
      }
      return perform(request);
    });
    await page();
    await chooseReschedule();
    confirm();
    await click("Confirm action");
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    await click("Stop waiting and close");
    expect(signal?.aborted).toBe(true);
    live = {
      ...live,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      actions: { ...live.actions, revision: "b".repeat(64) },
    };
    await act(async () => {
      resolve?.(reply(live));
    });
    expect(screen.queryByText("Appointment change saved and audited.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reschedule appointment" })).toBeDisabled();
    expect(writes()).toHaveLength(1);
  });
  it("aborts on role/identity change before a late preflight result", async () => {
    let resolve: ((value: TransportResponse<unknown>) => void) | undefined;
    let signal: AbortSignal | undefined;
    await page();
    await chooseReschedule();
    confirm();
    execute.mockImplementation(async (request) => {
      if (request.path === "/api/admin/reservations/8") {
        signal = request.signal;
        return new Promise((done) => {
          resolve = done;
        });
      }
      return perform(request);
    });
    await click("Confirm action");
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    act(() => {
      identity.id = 4;
      identity.roles = ["patient"];
      listeners.forEach((listener) => listener());
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve?.(reply(live));
    });
    expect(writes()).toHaveLength(0);
  });
  it("aborts pending reads when the page unmounts", async () => {
    const view = await page();
    let signal: AbortSignal | undefined;
    execute.mockImplementation(async (request) => {
      signal = request.signal;
      return new Promise(() => {});
    });
    await click("Reschedule appointment");
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(writes()).toHaveLength(0);
  });
  it("clears selection on pagination and refuses an oversized date window before querying", async () => {
    await page();
    await chooseReschedule();
    await click("Next appointments");
    await waitFor(() => expect(execute.mock.lastCall?.[0].query?.page).toBe(2));
    expect(screen.getByLabelText("Replacement appointment")).toHaveValue("");
    const count = execute.mock.calls.length;
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-12-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("31 days");
    expect(execute.mock.calls).toHaveLength(count);
    expect(writes()).toHaveLength(0);
  });
  it("renders Farsi action controls with language-owned direction and cancels without saving", async () => {
    await page("fa");
    await click("تغییر زمان نوبت");
    expect(await screen.findByLabelText("نوبت جایگزین")).toBeVisible();
    expect(document.documentElement.dir).toBe("rtl");
    await click("بستن");
    expect(writes()).toHaveLength(0);
  });
  it("rejects wrong subject, duplicate slots, unsafe actions and time/duration contradictions", () => {
    const row = adaptAdminReservation({ data: live }, 8);
    const query = { from: "2026-10-13", to: "2026-10-26", page: 1 };
    const wire = { data: slotPage() };
    expect(adaptReplacementSlots(wire, row, query).items).toHaveLength(1);
    for (const data of [
      { ...slotPage(), reservation_id: 9 },
      { ...slotPage(), items: [slot, slot] },
      { ...slotPage(), items: [{ ...slot, duration_minutes: 1 }] },
    ])
      expect(() => adaptReplacementSlots({ data }, row, query)).toThrow(/eligibility changed/);
    expect(() => adaptAdminReservation({ data: { ...live, status: "completed" } }, 8)).toThrow(
      "Terminal reservation action contract rejected.",
    );
    expect(() =>
      adaptAdminReservation(
        { data: { ...live, actions: { ...live.actions, allowed_statuses: ["paid"] } } },
        8,
      ),
    ).toThrow(/Invalid/);
    expect(
      adaptReplacementSlots({ data: { ...slotPage(), secret: "PRIVATE" } }, row, query),
    ).not.toHaveProperty("secret");
  });
});
