import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import {
  adaptSlotPreview,
  slotControlWrite,
  type SlotSelection,
} from "../modules/checkupino/schedules/controls";
import type { ScheduleDetail, ScheduleRow } from "../modules/checkupino/schedules/api";
import SlotControlEditor from "../pages/Administration/SlotControlEditor";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const publicId = "01m4hfgan168p6q5ftp528285f";
const selection: SlotSelection = {
  workplace_id: 3,
  checkup_id: 5,
  scope: "slot",
  date: "2026-10-18",
  slot_public_id: publicId,
};
const wire = (selected: SlotSelection = selection) => ({
  success: true,
  data: {
    selection: selected,
    period: {
      from: selected.scope === "week" ? "2026-10-12" : selected.date,
      to: selected.date,
      timezone: "Asia/Tehran",
    },
    items: [
      {
        public_id: publicId,
        starts_at: "2026-10-18T08:00:00+03:30",
        ends_at: "2026-10-18T08:30:00+03:30",
        price: "1000",
        currency: "IRR",
        is_active: true,
        eligible: true,
        exclusions: [] as string[],
        patient: "PRIVATE",
      },
    ],
    eligible_count: 1,
    limits: { slots: 250, max_price: "9007199254740991", reason: 1000 },
    revision: "a".repeat(64),
    preview_expires_at: Math.floor(Date.now() / 1000) + 300,
  },
});
const services: ScheduleDetail["services"] = [
  {
    id: 5,
    public_id: publicId,
    title: "Synthetic service",
    is_active: true,
    archived: false,
    offering_active: true,
    price_override: null,
    currency_override: null,
    base_price: "1000",
    base_currency: "IRR",
  },
];
const initial: Extract<ScheduleRow, { kind: "slots" }> = {
  kind: "slots",
  public_id: publicId,
  starts_at: "2026-10-18T08:00:00+03:30",
  ends_at: "2026-10-18T08:30:00+03:30",
  price: "1000",
  currency: "IRR",
  duration_minutes: 30,
  is_active: true,
  is_future: true,
  blocking_reservation: false,
  has_reservation_history: false,
  binding_consistent: true,
  checkup: services[0]!,
  rule: { id: 7, public_id: publicId, is_active: true },
};
async function editor(locale: "en" | "fa" = "en", single = true) {
  const instance = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await instance.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const callbacks = {
    onSaved: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
    onUncertain: vi.fn<() => void>(),
  };
  const view = render(
    <I18nextProvider i18n={instance}>
      <SlotControlEditor
        workplaceId="3"
        services={services}
        date="2026-10-18"
        initial={single ? initial : undefined}
        {...callbacks}
      />
    </I18nextProvider>,
  );
  return { ...view, ...callbacks, copy: locale === "en" ? en : fa };
}
beforeEach(() => {
  execute.mockReset().mockImplementation(async (request) => ({
    status: 200,
    headers: {},
    data:
      request.method === "PUT"
        ? { success: true, data: { workplace_id: 3, changed_slot_public_ids: [publicId] } }
        : wire({
            workplace_id: 3,
            checkup_id: Number(request.query?.checkup_id ?? 5),
            scope: (request.query?.scope ?? "slot") as SlotSelection["scope"],
            date: String(request.query?.date ?? "2026-10-18"),
            slot_public_id: request.query?.scope === "slot" ? publicId : null,
          }),
  }));
});
const prepare = async () => {
  await userEvent.click(screen.getByRole("button", { name: en["schedule.control.preview"] }));
  await screen.findByLabelText(en["schedule.control.newPrice"]);
  fireEvent.change(screen.getByLabelText(en["schedule.control.newPrice"]), {
    target: { value: "7654321" },
  });
  fireEvent.change(screen.getByLabelText(en["adminManage.reason"]), {
    target: { value: "Synthetic price correction." },
  });
  await userEvent.click(screen.getByRole("checkbox", { name: en["schedule.control.confirm"] }));
};
describe("guarded slot controls", () => {
  it.each(["en", "fa"] as const)(
    "shows %s individual scope, exact preview and cancels without writes",
    async (locale) => {
      const { copy, onClose } = await editor(locale);
      expect(screen.getByLabelText(copy["schedule.control.scope"])).toHaveValue("slot");
      expect(screen.getByLabelText(copy["schedule.service"])).toBeDisabled();
      expect(screen.getByRole("button", { name: copy["adminManage.confirm"] })).toBeDisabled();
      await userEvent.click(screen.getByRole("button", { name: copy["schedule.control.preview"] }));
      await screen.findByLabelText(copy["schedule.control.newPrice"]);
      expect(
        screen.getByRole("dialog").querySelector('time[datetime="2026-10-18T08:00:00+03:30"]'),
      ).toBeVisible();
      expect(
        screen.getByRole("dialog").querySelector('time[datetime="2026-10-18T08:30:00+03:30"]'),
      ).toBeVisible();
      expect(screen.getByRole("dialog").textContent).not.toMatch(/PRIVATE|schedule\.control\./);
      await userEvent.click(
        within(screen.getByRole("dialog")).getByText(copy["adminManage.close"], {
          selector: "button",
        }),
      );
      expect(onClose).toHaveBeenCalledOnce();
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
  it("rechecks the same signed expiry and sends one explicit individual-price mock write", async () => {
    const { onSaved } = await editor();
    await prepare();
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const writes = execute.mock.calls.map(([r]) => r).filter((r) => r.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      method: "PUT",
      path: "/api/admin/schedules/workplaces/3/slot-control",
      body: {
        checkup_id: 5,
        scope: "slot",
        slot_public_id: publicId,
        date: "2026-10-18",
        price: "7654321",
        expected_revision: "a".repeat(64),
        reason: "Synthetic price correction.",
        confirmed: true,
      },
    });
    expect(writes[0]?.body).not.toHaveProperty("is_active");
    expect(execute.mock.calls[1]?.[0].query).toHaveProperty("preview_expires_at");
  });
  it("requires a new preview after switching from day to week and drops slot identity", async () => {
    await editor("en", false);
    await prepare();
    await userEvent.selectOptions(screen.getByLabelText(en["schedule.control.scope"]), "week");
    expect(screen.queryByLabelText(en["schedule.control.newPrice"])).toBeNull();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: en["schedule.control.preview"] }));
    await screen.findByLabelText(en["schedule.control.newPrice"]);
    expect(execute.mock.lastCall?.[0].query).toMatchObject({ scope: "week", checkup_id: 5 });
    expect(execute.mock.lastCall?.[0].query).not.toHaveProperty("slot_public_id");
  });
  it("clears confirmation when changing values and refuses negative, decimal or unsafe prices", async () => {
    await editor();
    await prepare();
    for (const value of ["-1", "1.2", "9007199254740992", "1000"]) {
      fireEvent.change(screen.getByLabelText(en["schedule.control.newPrice"]), {
        target: { value },
      });
      const confirmation = screen.getByRole("checkbox", { name: en["schedule.control.confirm"] });
      expect(confirmation).not.toBeChecked();
      await userEvent.click(confirmation);
      expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    }
  });
  it("shows protected exclusions and never permits an all-excluded save", async () => {
    execute.mockResolvedValue({
      status: 200,
      headers: {},
      data: {
        ...wire(),
        data: {
          ...wire().data,
          eligible_count: 0,
          items: [
            { ...wire().data.items[0], eligible: false, exclusions: ["reservation_history"] },
          ],
        },
      },
    });
    await editor();
    await prepare();
    expect(screen.getByText(en["schedule.control.exclusion.reservation_history"])).toBeVisible();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
  });
  it("refuses changed revision before dispatch", async () => {
    await editor();
    await prepare();
    execute.mockResolvedValue({
      status: 200,
      headers: {},
      data: { ...wire(), data: { ...wire().data, revision: "b".repeat(64) } },
    });
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.conflict"]);
    expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  });
  it("freezes ambiguous mock delivery and never retries it automatically", async () => {
    const { onUncertain } = await editor();
    await prepare();
    execute.mockImplementation(async (r) => {
      if (r.method === "PUT") throw new TransportError(classifyWireFailure({ status: 503 }));
      return { status: 200, headers: {}, data: wire() };
    });
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.uncertain"]);
    expect(onUncertain).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(en["schedule.control.newPrice"])).toBeDisabled();
    expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(1);
  });
  it("aborts a pending preview on unmount", async () => {
    execute.mockImplementation(() => new Promise(() => {}));
    const view = await editor();
    await userEvent.click(screen.getByRole("button", { name: en["schedule.control.preview"] }));
    const signal = execute.mock.lastCall?.[0].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("validates identity, unique exact targets, exclusion consistency and strips private fields", () => {
    expect(adaptSlotPreview(wire(), selection).items[0]).not.toHaveProperty("patient");
    expect(() => adaptSlotPreview(wire(), { ...selection, workplace_id: 4 })).toThrow(
      /identity or targets/,
    );
    expect(() =>
      adaptSlotPreview(
        {
          ...wire(),
          data: { ...wire().data, items: [wire().data.items[0], wire().data.items[0]] },
        },
        selection,
      ),
    ).toThrow(/identity or targets/);
    expect(() =>
      adaptSlotPreview(
        {
          ...wire(),
          data: { ...wire().data, items: [{ ...wire().data.items[0], exclusions: ["past"] }] },
        },
        selection,
      ),
    ).toThrow(/identity or targets/);
  });
  it("refuses writes outside the approved endpoint and PUT method", async () => {
    const signal = new AbortController().signal;
    await expect(slotControlWrite("/api/admin/checkups", "PUT", {}, signal)).rejects.toThrow(
      /scope rejected/,
    );
    await expect(
      slotControlWrite("/api/admin/schedules/workplaces/3/slot-control", "POST", {}, signal),
    ).rejects.toThrow(/scope rejected/);
    expect(execute).not.toHaveBeenCalled();
  });
});
