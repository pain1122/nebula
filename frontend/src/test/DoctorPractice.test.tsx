import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { checkupinoApi } from "../modules/checkupino/query/api";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";
import { readAppointmentCalendar } from "../modules/checkupino/dashboard/calendar";
import DoctorPractice from "../pages/Users/DoctorPractice";

const { execute, listeners } = vi.hoisted(() => ({
  execute: vi.fn<(r: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  listeners: new Set<() => void>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    subscribe: (callback: () => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot: () => ({ status: "guest", identity: null }),
  },
}));
const initial = () => ({
  owner_id: 4,
  revision: "a".repeat(64),
  verified: true,
  professional: {
    specialty_ids: [1],
    primary_specialty_id: 1,
    experience_years: 6,
    fee: 500000,
    bio: "Synthetic professional introduction",
  },
  specialty_options: [
    { id: 1, name: "Synthetic specialty" },
    { id: 2, name: "Second specialty" },
  ],
  workplaces: [
    {
      id: 3,
      name: "Synthetic clinic",
      timezone: "Asia/Tehran",
      active: true,
      services: [{ id: 5, title: "Synthetic service", active: true }],
      availability: [
        {
          day: "mon" as const,
          windows: [
            {
              checkup_id: 5,
              start: "09:00",
              end: "11:00",
              duration_minutes: 30,
              price_override: null,
              currency_override: null,
              effective_from: null,
              effective_until: null,
              breaks: [],
            },
          ],
        },
      ],
    },
  ],
});
const reply = (data: unknown): TransportResponse<unknown> => ({ status: 200, headers: {}, data });
const stores: ReturnType<typeof configureStore>[] = [];
const page = async (lang = "en") => {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: lang,
    keySeparator: false,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  const store = configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (d) => d().concat(checkupinoApi.middleware),
  });
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <DoctorPractice ownerId={4} />
      </I18nextProvider>
    </Provider>,
  );
};
beforeEach(() => {
  execute.mockReset();
  listeners.clear();
  sessionStorage.clear();
  execute.mockResolvedValue(reply({ data: initial() }));
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});
const confirm = async (copy = en) => {
  fireEvent.change(screen.getByLabelText(copy["adminManage.reason"]), {
    target: { value: "Synthetic practice reason" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: copy["doctorPractice.confirm"] }));
  fireEvent.click(screen.getByRole("button", { name: copy["users.save"] }));
};

describe("owner-only doctor practice controls", () => {
  it.each(["en", "fa"])(
    "shows real working days and professional data with a guarded cancelable modal in %s",
    async (lang) => {
      await page(lang);
      const copy = lang === "fa" ? fa : en;
      await screen.findByText("Synthetic professional introduction");
      expect(screen.getByText(copy["doctorPractice.day.mon"])).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: copy["doctorPractice.editProfessional"] }),
      );
      expect(screen.getByRole("button", { name: copy["users.save"] })).toBeDisabled();
      expect(screen.queryByRole("textbox", { name: /HTML/ })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: copy["users.cancel"] }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it("saves only the reviewed owner revision and professional allowlist after a fresh read", async () => {
    let value = initial();
    execute.mockImplementation(async (r) => {
      if (r.method === "PUT")
        value = {
          ...value,
          revision: "b".repeat(64),
          professional: { ...value.professional, experience_years: 12 },
        };
      return reply({ data: value });
    });
    await page();
    fireEvent.click(
      await screen.findByRole("button", { name: en["doctorPractice.editProfessional"] }),
    );
    fireEvent.change(screen.getByLabelText(en["doctorPractice.experience"]), {
      target: { value: "12" },
    });
    await confirm();
    await screen.findByText(en["users.saved"]);
    const writes = execute.mock.calls.map(([r]) => r).filter((r) => r.method === "PUT");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toEqual({
      mode: "professional",
      ...initial().professional,
      experience_years: 12,
      reason: "Synthetic practice reason",
      confirmed: true,
      expected_revision: "a".repeat(64),
    });
    expect(sessionStorage.getItem("checkupino.practice.pending.v1.4")).toBeNull();
  });
  it("rejects a stale revision before dispatch and requires explicit refresh", async () => {
    let reads = 0;
    execute.mockImplementation(async () =>
      reply({ data: { ...initial(), revision: ++reads === 1 ? "a".repeat(64) : "b".repeat(64) } }),
    );
    await page();
    fireEvent.click(
      await screen.findByRole("button", { name: en["doctorPractice.editProfessional"] }),
    );
    await confirm();
    await screen.findByText(en["profileOverview.refreshRequired"]);
    expect(execute.mock.calls.some(([r]) => r.method === "PUT")).toBe(false);
    expect(
      screen.getByRole("button", { name: en["doctorPractice.editProfessional"] }),
    ).toBeDisabled();
  });
  it("cancels ordinary password confirmation without replaying a practice save", async () => {
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") throw new TransportError(classifyWireFailure({ status: 423 }));
      return reply({ data: initial() });
    });
    await page();
    fireEvent.click(
      await screen.findByRole("button", { name: en["doctorPractice.editProfessional"] }),
    );
    await confirm();
    await screen.findByLabelText(/Current password/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByLabelText(en["adminManage.reason"]);
    expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(1);
    expect(execute.mock.calls.some(([r]) => r.path === "/api/auth/confirm-password")).toBe(false);
    expect(sessionStorage.getItem("checkupino.practice.pending.v1.4")).toBeNull();
  });
  it("retains an uncertain marker after ambiguous delivery and never automatically retries", async () => {
    execute.mockImplementation(async (r) => {
      if (r.method === "PUT") throw new TransportError(classifyWireFailure({ status: 503 }));
      return reply({ data: initial() });
    });
    await page();
    fireEvent.click(
      await screen.findByRole("button", { name: en["doctorPractice.editProfessional"] }),
    );
    await confirm();
    await screen.findByText(en["profileOverview.refreshRequired"]);
    expect(sessionStorage.getItem("checkupino.practice.pending.v1.4")).toBe("1");
    expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: en["adminReservations.refresh"] }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en["doctorPractice.editProfessional"] }),
      ).toBeEnabled(),
    );
    expect(sessionStorage.getItem("checkupino.practice.pending.v1.4")).toBeNull();
  });
  it("can explicitly clear all working windows without inventing slots or updating another location", async () => {
    let value = initial();
    execute.mockImplementation(async (r) => {
      if (r.method === "PUT")
        value = {
          ...value,
          revision: "b".repeat(64),
          workplaces: [{ ...value.workplaces[0]!, availability: [] }],
        };
      return reply({ data: value });
    });
    await page();
    fireEvent.click(await screen.findByRole("button", { name: en["doctorPractice.editDays"] }));
    fireEvent.click(screen.getByRole("button", { name: en["doctorPractice.removeWindow"] }));
    await confirm();
    await screen.findByText(en["users.saved"]);
    expect(execute.mock.calls.find(([r]) => r.method === "PUT")?.[0].body).toEqual({
      mode: "weekly",
      workplace_id: 3,
      availability: [],
      reason: "Synthetic practice reason",
      confirmed: true,
      expected_revision: "a".repeat(64),
    });
  });
  it.each(["en", "fa"])(
    "edits full shifts, rest periods and services separately in %s",
    async (lang) => {
      let value = initial();
      execute.mockImplementation(async (request) => {
        if (request.method === "PUT") value = { ...value, revision: "b".repeat(64) };
        return reply({ data: value });
      });
      await page(lang);
      const copy = lang === "fa" ? fa : en;
      fireEvent.click(await screen.findByRole("button", { name: copy["doctorPractice.editDays"] }));
      const day = within(screen.getByRole("region", { name: copy["doctorPractice.day.mon"] }));
      fireEvent.change(day.getByLabelText(copy["workingHours.shiftStart"]), {
        target: { value: "08:00" },
      });
      fireEvent.change(day.getByLabelText(copy["workingHours.shiftEnd"]), {
        target: { value: "12:00" },
      });
      fireEvent.click(day.getByRole("button", { name: copy["doctorPractice.addBreak"] }));
      fireEvent.change(day.getByLabelText(copy["workingHours.breakStart"]), {
        target: { value: "10:00" },
      });
      fireEvent.change(day.getByLabelText(copy["workingHours.breakEnd"]), {
        target: { value: "10:30" },
      });
      const preview = document.querySelector("[data-working-day=mon] [data-shift-preview]")!;
      expect(preview.querySelectorAll("bdi")).toHaveLength(7);
      expect(preview.textContent).not.toContain("10:00");
      expect(day.getByLabelText(copy["doctorPractice.duration"])).toHaveValue(30);
      await confirm(copy);
      await screen.findByText(copy["users.saved"]);
      expect(execute.mock.calls.find(([r]) => r.method === "PUT")?.[0].body).toMatchObject({
        mode: "weekly",
        workplace_id: 3,
        availability: [
          {
            day: "mon",
            windows: [
              {
                checkup_id: 5,
                start: "08:00",
                end: "12:00",
                duration_minutes: 30,
                breaks: [{ start: "10:00", end: "10:30" }],
              },
            ],
          },
        ],
      });
    },
  );
  it("creates a real full-day draft only for the explicitly enabled day and refuses impossible breaks", async () => {
    await page();
    fireEvent.click(await screen.findByRole("button", { name: en["doctorPractice.editDays"] }));
    const day = within(screen.getByRole("region", { name: en["doctorPractice.day.sun"] }));
    fireEvent.click(day.getByRole("checkbox"));
    expect(day.getByLabelText(en["workingHours.shiftStart"])).toHaveValue("08:00");
    expect(day.getByLabelText(en["workingHours.shiftEnd"])).toHaveValue("16:00");
    expect(day.getByLabelText(en["workingHours.breakStart"])).toHaveValue("12:00");
    fireEvent.change(day.getByLabelText(en["workingHours.breakStart"]), {
      target: { value: "07:00" },
    });
    fireEvent.change(screen.getByLabelText(en["adminManage.reason"]), {
      target: { value: "Synthetic invalid shift" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: en["doctorPractice.confirm"] }));
    expect(screen.getByRole("button", { name: en["users.save"] })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(en["workingHours.error.invalidBreak"]);
    expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  });
  it("saves two consecutive services with their own appointment lengths and a shared crossing break", async () => {
    let value = initial();
    value.workplaces[0]!.services.push({ id: 6, title: "Second synthetic service", active: true });
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") value = { ...value, revision: "b".repeat(64) };
      return reply({ data: value });
    });
    await page();
    fireEvent.click(await screen.findByRole("button", { name: en["doctorPractice.editDays"] }));
    const day = within(screen.getByRole("region", { name: en["doctorPractice.day.mon"] }));
    fireEvent.change(day.getByLabelText(en["workingHours.shiftStart"]), {
      target: { value: "08:00" },
    });
    fireEvent.change(day.getByLabelText(en["workingHours.shiftEnd"]), {
      target: { value: "12:00" },
    });
    fireEvent.click(day.getByRole("button", { name: en["workingHours.addSession"] }));
    expect(day.getAllByLabelText(en["booking.checkup"])[1]).toHaveValue("6");
    fireEvent.change(day.getAllByLabelText(en["doctorPractice.duration"])[1]!, {
      target: { value: "20" },
    });
    fireEvent.click(day.getByRole("button", { name: en["doctorPractice.addBreak"] }));
    fireEvent.change(day.getByLabelText(en["workingHours.breakStart"]), {
      target: { value: "09:50" },
    });
    fireEvent.change(day.getByLabelText(en["workingHours.breakEnd"]), {
      target: { value: "10:20" },
    });
    await confirm();
    await screen.findByText(en["users.saved"]);
    expect(execute.mock.calls.find(([r]) => r.method === "PUT")?.[0].body).toMatchObject({
      mode: "weekly",
      workplace_id: 3,
      availability: [
        {
          day: "mon",
          windows: [
            {
              checkup_id: 5,
              start: "08:00",
              end: "10:00",
              duration_minutes: 30,
              breaks: [{ start: "09:50", end: "10:00" }],
            },
            {
              checkup_id: 6,
              start: "10:00",
              end: "12:00",
              duration_minutes: 20,
              breaks: [{ start: "10:00", end: "10:20" }],
            },
          ],
        },
      ],
    });
  });
  it("hides another account's cached practice response", async () => {
    execute.mockResolvedValue(
      reply({
        data: {
          ...initial(),
          owner_id: 8,
          professional: { ...initial().professional, bio: "PRIVATE" },
        },
      }),
    );
    await page();
    await screen.findByRole("alert");
    expect(screen.queryByText("PRIVATE")).toBeNull();
    expect(
      screen.queryByRole("button", { name: en["doctorPractice.editProfessional"] }),
    ).toBeNull();
  });
  it("aborts a fresh-read operation after session invalidation before dispatch", async () => {
    let reads = 0;
    execute.mockImplementation(async (r) => {
      if (++reads > 1)
        return await new Promise((_, reject) =>
          r.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      return reply({ data: initial() });
    });
    await page();
    fireEvent.click(
      await screen.findByRole("button", { name: en["doctorPractice.editProfessional"] }),
    );
    await confirm();
    await waitFor(() => expect(reads).toBe(2));
    for (const notify of listeners) notify();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(execute.mock.calls.some(([r]) => r.method === "PUT")).toBe(false);
  });
});

describe("doctor calendar transport", () => {
  it("requires doctor ownership and confirmed status in the server response", async () => {
    const range = { from: "2026-10-01", until: "2026-11-01" };
    const data = {
      success: true,
      data: {
        ...range,
        owner_id: 4,
        scope: "doctor_confirmed",
        timezone: "Asia/Tehran",
        limit: 200,
        has_more: false,
        appointments: [],
      },
      meta: { read_only: true, generated_at: "2026-10-18T00:00:00Z" },
    };
    execute.mockResolvedValue(reply(data));
    await expect(
      readAppointmentCalendar(range, new AbortController().signal, 4),
    ).resolves.toHaveProperty("data.owner_id", 4);
    expect(execute.mock.calls[0]?.[0].path).toBe("/api/doctor/dashboard/appointments");
    execute.mockResolvedValue(reply({ ...data, data: { ...data.data, owner_id: 8 } }));
    await expect(readAppointmentCalendar(range, new AbortController().signal, 4)).rejects.toThrow(
      /ownership/,
    );
    execute.mockResolvedValue(
      reply({
        ...data,
        data: {
          ...data.data,
          appointments: [
            {
              id: 1,
              public_id: "01m4hfgan168p6q5ftp528285f",
              patient: "Synthetic",
              doctor: "Synthetic",
              checkup: "Synthetic",
              status: "completed",
              starts_at: "2026-10-19T09:00:00Z",
              ends_at: "2026-10-19T09:30:00Z",
            },
          ],
        },
      }),
    );
    await expect(readAppointmentCalendar(range, new AbortController().signal, 4)).rejects.toThrow(
      /finalized/,
    );
  });
});
