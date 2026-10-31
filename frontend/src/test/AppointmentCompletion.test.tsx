import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import type { PanelReservation } from "../modules/checkupino/booking/api";
import { checkupinoApi } from "../modules/checkupino/query/api";
import ReservationList from "../pages/Booking/ReservationList";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const fixture: PanelReservation = {
  id: 8,
  public_id: "R8",
  starts_at: "2026-10-11T04:30:00Z",
  ends_at: "2026-10-11T05:00:00Z",
  status: "confirmed",
  booked_amount: 7_000_000,
  booked_currency: "IRR",
  hold_expires_at: null,
  can_complete: true,
  checkup: { title: "Synthetic checkup" },
  payment: { status: "paid" },
  patient: { name: "Synthetic patient" },
  doctor: { name: "Assigned doctor" },
};
const response = (data: unknown): TransportResponse<unknown> => ({
  data: { data },
  status: 200,
  headers: {},
});
const storeFor = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof storeFor>[] = [];
let current: PanelReservation, reads: number;
const ordinary = async (request: TransportRequest) => {
  if (request.method === "POST") {
    current = { ...current, status: "completed", can_complete: false };
    return response(current);
  }
  if (request.path === "/api/doctor/reservations/8") {
    reads++;
    return response(current);
  }
  return response({ data: [current], current_page: 1, last_page: 1, per_page: 20, total: 1 });
};
const renderView = async (locale: "en" | "fa" = "en", doctor = true) => {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const store = storeFor();
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter>
          <ReservationList doctor={doctor} />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};
const deliveries = () =>
  execute.mock.calls.map(([request]) => request).filter((request) => request.method === "POST");
const open = async (copy = en) => {
  fireEvent.click(await screen.findByRole("button", { name: copy["booking.completeAppointment"] }));
  const dialog = await screen.findByRole("dialog");
  const confirm = within(dialog).getByRole("button", { name: copy["booking.confirmCompletion"] });
  await waitFor(() => expect(confirm).not.toBeDisabled());
  return confirm;
};
beforeEach(() => {
  current = { ...fixture };
  reads = 0;
  execute.mockReset().mockImplementation(ordinary);
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("ordinary appointment completion", () => {
  it.each(["en", "fa"] as const)(
    "confirms a fresh server-owned completion and refreshes the list in %s",
    async (locale) => {
      const copy = locale === "fa" ? fa : en;
      await renderView(locale);
      fireEvent.click(await open(copy));
      await screen.findByText(copy["booking.appointmentCompleted"]);
      expect(reads).toBe(2);
      expect(deliveries()).toHaveLength(1);
      expect(deliveries()[0]).toMatchObject({
        method: "POST",
        path: "/api/doctor/reservations/8/complete",
      });
      expect(deliveries()[0].body).toBeUndefined();
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: copy["booking.completeAppointment"] }),
        ).not.toBeInTheDocument(),
      );
    },
  );
  it.each([false, undefined])("refuses early/unavailable or rollback metadata %s", async (flag) => {
    current = { ...fixture, can_complete: flag };
    await renderView();
    expect(
      await screen.findByRole("button", { name: en["booking.completeAppointment"] }),
    ).toBeDisabled();
    expect(deliveries()).toHaveLength(0);
  });
  it("does not expose the doctor control to patients", async () => {
    await renderView("en", false);
    await screen.findByText("Synthetic checkup");
    expect(
      screen.queryByRole("button", { name: en["booking.completeAppointment"] }),
    ).not.toBeInTheDocument();
  });
  it.each([
    { can_complete: false },
    { booked_amount: 1 },
    { public_id: "OTHER" },
    { starts_at: "2026-10-12T04:30:00Z" },
  ])("refuses changed authoritative facts before writing %j", async (change) => {
    await renderView();
    const confirm = await open();
    current = { ...fixture, ...change };
    fireEvent.click(confirm);
    await screen.findByText(en["booking.completionChanged"]);
    expect(deliveries()).toHaveLength(0);
  });
  it("blocks duplicate delivery while the fresh read is pending", async () => {
    await renderView();
    const confirm = await open();
    let release!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementation((request) =>
      request.path === "/api/doctor/reservations/8"
        ? new Promise((resolve) => {
            release = resolve;
          })
        : ordinary(request),
    );
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(release).toBeTypeOf("function"));
    release(response(fixture));
    await screen.findByText(en["booking.appointmentCompleted"]);
    expect(deliveries()).toHaveLength(1);
  });
  it.each(["malformed", "unavailable"])(
    "blocks uncertain %s receipts without automatic replay",
    async (fault) => {
      execute.mockImplementation(async (request) => {
        if (request.method !== "POST") return ordinary(request);
        if (fault === "malformed") return response({ ...fixture, status: "confirmed" });
        throw new TransportError(classifyWireFailure({ status: 503 }));
      });
      await renderView();
      fireEvent.click(await open());
      await screen.findByText(en["booking.completionUncertain"]);
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: en["booking.confirmCompletion"],
        }),
      ).toBeDisabled();
      expect(deliveries()).toHaveLength(1);
    },
  );
  it("aborts a pending preflight on unmount without sending completion", async () => {
    const view = await renderView();
    const confirm = await open();
    let signal: AbortSignal | undefined;
    let release!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementation((request) =>
      request.path === "/api/doctor/reservations/8"
        ? new Promise((resolve) => {
            signal = request.signal;
            release = resolve;
          })
        : ordinary(request),
    );
    fireEvent.click(confirm);
    await waitFor(() => expect(release).toBeTypeOf("function"));
    view.unmount();
    expect(signal?.aborted).toBe(true);
    release(response(fixture));
    await Promise.resolve();
    expect(deliveries()).toHaveLength(0);
  });
});
