import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import { checkupinoApi } from "../modules/checkupino/query/api";
import PatientBooking from "../pages/Booking/PatientBooking";
import PatientReservations from "../pages/Booking/PatientReservations";
import DoctorReservations from "../pages/Booking/DoctorReservations";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));

const response = (data: unknown): TransportResponse<unknown> => ({
  data: { data },
  headers: {},
  status: 200,
});
const paginator = (data: readonly unknown[]) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: data.length,
});
const slotId = "01JBOOKINGTEST00000000000000";
const storeFor = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof storeFor>[] = [];
const LocationProbe = () => <output aria-label="location">{useLocation().pathname}</output>;
const renderView = async (path = "/book", locale: "en" | "fa" = "en") => {
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
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/book" element={<PatientBooking />} />
            <Route path="/my/reservations" element={<PatientReservations />} />
            <Route path="/doctor/reservations" element={<DoctorReservations />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};
const fixtureResponse = async (request: TransportRequest) => {
  if (request.path === "/api/checkups")
    return response(
      paginator([
        { id: 1, title: "Checkup A" },
        { id: 2, title: "Checkup B" },
      ]),
    );
  if (request.path.endsWith("/doctors"))
    return response([
      {
        doctor_profile_id: 11,
        doctor_name: "Assigned doctor",
        workplaces: [{ id: 22, name: "Clinic", timezone: "Asia/Tehran" }],
      },
    ]);
  if (request.path.endsWith("/availability"))
    return response([
      {
        slot_id: slotId,
        start: "2026-10-05T10:30:00+00:00",
        end: "2026-10-05T11:00:00+00:00",
        price: 1_200_000,
        currency: "IRR",
      },
    ]);
  if (request.method === "POST")
    return response({ reservation: { public_id: "R1", status: "pending" } });
  return response(
    paginator([
      {
        id: 1,
        public_id: "R1",
        starts_at: "2026-10-05T10:30:00+00:00",
        ends_at: "2026-10-05T11:00:00+00:00",
        status: "pending",
        booked_amount: 1_200_000,
        booked_currency: "IRR",
        hold_expires_at: "2026-10-04T11:00:00Z",
        checkup: { title: "Checkup A", price: 999 },
        doctor: { name: "Assigned doctor" },
        patient: { name: "Assigned patient" },
        payment: { status: "unpaid" },
      },
    ]),
  );
};
const selectSlot = async (copy = en) => {
  fireEvent.click(
    await screen.findByRole("button", {
      name: copy["booking.chooseService"].replace("{{name}}", "Checkup A"),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: copy["booking.nextStep"] }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: copy["booking.chooseDoctor"].replace("{{name}}", "Assigned doctor"),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: copy["booking.nextStep"] }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: copy["booking.chooseLocation"].replace("{{name}}", "Clinic"),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: copy["booking.nextStep"] }));
  const slots = await screen.findAllByRole("button", { pressed: false });
  const slot = slots.find((button) => button.classList.contains("list-group-item"));
  expect(slot).toBeDefined();
  fireEvent.click(slot!);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: copy["booking.confirm"] })).not.toBeDisabled(),
  );
};
beforeEach(() => {
  execute.mockReset().mockImplementation(fixtureResponse);
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

const sandboxFixture = (fault?: "start" | "complete" | "expired") => {
  let paid = false;
  let faultSent = false;
  const attempts = new Map<string, string>();
  execute.mockImplementation(async (request) => {
    if (request.path.endsWith("/sandbox/checkout")) {
      const key = request.idempotencyKey ?? "";
      if (!attempts.has(key)) attempts.set(key, `A${attempts.size + 1}`);
      if (fault === "start" && !faultSent) {
        faultSent = true;
        throw new TransportError(classifyWireFailure({ status: 503 }));
      }
      return response({
        reservation_public_id: "R1",
        reservation_status: "pending",
        payment_status: "unpaid",
        attempt_public_id: attempts.get(key),
        attempt_status: "initiated",
        amount: 1_200_000,
        currency: "IRR",
        hold_expires_at: "2026-10-04T11:00:00Z",
        can_complete: fault !== "expired",
      });
    }
    if (request.path.endsWith("/complete")) {
      const outcome = (request.body as { outcome: string }).outcome;
      paid = outcome === "success";
      if (fault === "complete" && !faultSent) {
        faultSent = true;
        throw new TransportError(classifyWireFailure({ status: 503 }));
      }
      return response({
        reservation_public_id: "R1",
        reservation_status: paid ? "confirmed" : "pending",
        payment_status: paid ? "paid" : "unpaid",
        attempt_public_id: request.path.split("/").at(-2),
        attempt_status: paid ? "succeeded" : "failed",
        amount: 1_200_000,
        currency: "IRR",
        hold_expires_at: "2026-10-04T11:00:00Z",
        can_complete: false,
      });
    }
    if (request.path === "/api/my/reservations")
      return response(
        paginator([
          {
            id: 1,
            public_id: "R1",
            starts_at: "2026-10-05T10:30:00Z",
            ends_at: "2026-10-05T11:00:00Z",
            status: paid ? "confirmed" : "pending",
            booked_amount: 1_200_000,
            booked_currency: "IRR",
            hold_expires_at: "2026-10-04T11:00:00Z",
            can_sandbox_checkout: !paid,
            checkup: { title: "Checkup A" },
            doctor: { name: "Assigned doctor" },
            payment: { status: paid ? "paid" : "unpaid" },
          },
        ]),
      );
    return fixtureResponse(request);
  });
};
const openCheckout = async (copy = en) => {
  fireEvent.click(await screen.findByRole("button", { name: copy["booking.sandboxPay"] }));
  fireEvent.click(screen.getByRole("button", { name: copy["booking.sandboxStart"] }));
  await screen.findByLabelText(new RegExp(copy["booking.sandboxOutcome"]));
};

describe("Velzon role booking views", () => {
  it.each(["en", "fa"] as const)(
    "books through the shared transport and shows unpaid confirmation in %s",
    async (locale) => {
      const copy = locale === "fa" ? fa : en;
      await renderView("/book", locale);
      await selectSlot(copy);
      fireEvent.click(screen.getByRole("button", { name: copy["booking.confirm"] }));
      expect(await screen.findByText(copy["booking.created"])).toBeInTheDocument();
      expect(screen.getByLabelText("location")).toHaveTextContent("/my/reservations");
      const request = execute.mock.calls
        .map(([call]) => call)
        .find((call) => call.method === "POST");
      expect(request?.body).toEqual({ slot_id: slotId });
      expect(request?.idempotencyKey).toMatch(/^[a-f\d-]{36}$/);
      expect(await screen.findByText(copy["booking.paymentState.unpaid"])).toBeInTheDocument();
    },
  );

  it("retains its idempotency key after an uncertain failed booking and retries only on submission", async () => {
    let writes = 0;
    execute.mockImplementation(async (request) => {
      if (request.method === "POST" && ++writes === 1)
        throw new TransportError(classifyWireFailure({ status: 503 }));
      return fixtureResponse(request);
    });
    await renderView();
    await selectSlot();
    fireEvent.click(screen.getByRole("button", { name: en["booking.confirm"] }));
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["booking.confirm"] })).not.toBeDisabled(),
    );
    expect(writes).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: en["booking.confirm"] }));
    await screen.findByText(en["booking.created"]);
    const requests = execute.mock.calls
      .map(([call]) => call)
      .filter((call) => call.method === "POST");
    expect(requests).toHaveLength(2);
    expect(requests[1]?.idempotencyKey).toBe(requests[0]?.idempotencyKey);
  });

  it("clears the selected slot and disables submission when its checkup changes", async () => {
    await renderView();
    await selectSlot();
    fireEvent.click(screen.getAllByRole("button", { name: en["booking.checkup"] })[0]!);
    fireEvent.click(
      await screen.findByRole("button", {
        name: en["booking.chooseService"].replace("{{name}}", "Checkup B"),
      }),
    );
    expect(screen.queryByRole("button", { name: en["booking.confirm"] })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en["booking.nextStep"] })).not.toBeDisabled();
    expect(
      execute.mock.calls.map(([call]) => call).filter((call) => call.method === "POST"),
    ).toHaveLength(0);
  });

  it("loads only the doctor's assigned endpoint and displays booked money rather than current catalog price", async () => {
    await renderView("/doctor/reservations");
    expect(await screen.findByText("Assigned patient")).toBeInTheDocument();
    expect(screen.getByText("1,200,000 IRR")).toBeInTheDocument();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    expect(execute.mock.calls.map(([call]) => call.path)).toEqual(["/api/doctor/reservations"]);
    expect(screen.queryByRole("link", { name: en["booking.title"] })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en["booking.sandboxPay"] }),
    ).not.toBeInTheDocument();
  });

  it.each(["en", "fa"] as const)(
    "books and verifies sandbox payment with refreshed state in %s",
    async (locale) => {
      const copy = locale === "fa" ? fa : en;
      sandboxFixture();
      await renderView("/book", locale);
      await selectSlot(copy);
      fireEvent.click(screen.getByRole("button", { name: copy["booking.confirm"] }));
      await screen.findByText(copy["booking.created"]);
      await openCheckout(copy);
      expect(screen.getByText(copy["booking.sandboxNotice"])).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: copy["booking.sandboxConfirm"] }));
      await screen.findByText(copy["booking.sandboxResult.succeeded"]);
      await screen.findByText(copy["booking.paymentState.paid"]);
      expect(screen.getByText(copy["booking.state.confirmed"])).toBeInTheDocument();
      expect(screen.queryByText(copy["booking.created"])).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: copy["booking.sandboxPay"] }),
      ).not.toBeInTheDocument();
      const request = execute.mock.calls
        .map(([call]) => call)
        .find((call) => call.path.endsWith("/complete"));
      expect(request?.body).toEqual({ outcome: "success" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("retains checkout identity after an uncertain start and retries only manually", async () => {
    sandboxFixture("start");
    await renderView("/my/reservations");
    fireEvent.click(await screen.findByRole("button", { name: en["booking.sandboxPay"] }));
    fireEvent.click(screen.getByRole("button", { name: en["booking.sandboxStart"] }));
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["booking.sandboxStart"] })).not.toBeDisabled(),
    );
    expect(
      execute.mock.calls.filter(([request]) => request.path.endsWith("/sandbox/checkout")),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: en["booking.sandboxStart"] }));
    await screen.findByLabelText(new RegExp(en["booking.sandboxOutcome"]));
    const requests = execute.mock.calls
      .map(([call]) => call)
      .filter((call) => call.path.endsWith("/sandbox/checkout"));
    expect(requests[0]?.idempotencyKey).toBe(requests[1]?.idempotencyKey);
    expect(requests[0]?.body).toBeUndefined();
  });

  it("reuses the same attempt after an uncertain completion", async () => {
    sandboxFixture("complete");
    await renderView("/my/reservations");
    await openCheckout();
    fireEvent.click(screen.getByRole("button", { name: en["booking.sandboxConfirm"] }));
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["booking.sandboxConfirm"] })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: en["booking.sandboxConfirm"] }));
    await screen.findByText(en["booking.sandboxResult.succeeded"]);
    const requests = execute.mock.calls
      .map(([call]) => call)
      .filter((call) => call.path.endsWith("/complete"));
    expect(requests).toHaveLength(2);
    expect(requests[0]?.path).toBe(requests[1]?.path);
    expect(requests[0]?.body).toEqual(requests[1]?.body);
  });

  it("keeps failure recoverable with a new attempt rather than reusing a terminal one", async () => {
    sandboxFixture();
    await renderView("/my/reservations");
    await openCheckout();
    fireEvent.change(screen.getByLabelText(new RegExp(en["booking.sandboxOutcome"])), {
      target: { value: "failed" },
    });
    fireEvent.click(screen.getByRole("button", { name: en["booking.sandboxConfirm"] }));
    await screen.findByText(en["booking.sandboxResult.failed"]);
    await openCheckout();
    fireEvent.click(screen.getByRole("button", { name: en["booking.sandboxConfirm"] }));
    await screen.findByText(en["booking.sandboxResult.succeeded"]);
    const requests = execute.mock.calls
      .map(([call]) => call)
      .filter((call) => call.path.endsWith("/complete"));
    expect(requests.map((call) => call.path)).toEqual([
      "/api/reservations/R1/sandbox/attempts/A1/complete",
      "/api/reservations/R1/sandbox/attempts/A2/complete",
    ]);
  });

  it("blocks completion when the server says a checkout is unavailable", async () => {
    sandboxFixture("expired");
    await renderView("/my/reservations");
    await openCheckout();
    expect(screen.getByText(en["booking.sandboxUnavailable"])).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en["booking.sandboxConfirm"] })).toBeDisabled();
    expect(execute.mock.calls.some(([request]) => request.path.endsWith("/complete"))).toBe(false);
  });
});
