import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import {
  adaptAdjustmentContext,
  adjustmentWriteFor,
  validAdjustmentAmount,
} from "../modules/checkupino/payments/adjustments";
import PaymentAdjustmentEditor from "../pages/Administration/PaymentAdjustmentEditor";

const { execute, authority } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  authority: { identity: { id: 1, roles: ["root-admin"] }, listeners: new Set<() => void>() },
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => ({ identity: authority.identity }),
    subscribe: (fn: () => void) => {
      authority.listeners.add(fn);
      return () => authority.listeners.delete(fn);
    },
  },
}));
const publicId = "01m4hfgan168p6q5ftp528285f";
const otherId = "01m4hfgan168p6q5ftp528285g";
const initial = { public_id: publicId, amount: "9007199254740993", currency: "IRR" };
// The server reuses the reviewed deadline; a mock must not advance it across second boundaries.
let previewExpiresAt = 0;
const wire = () => ({
  success: true,
  data: {
    payment_public_id: publicId,
    revision: "a".repeat(64),
    expires_at: previewExpiresAt,
    can_request: true,
    blocked: null as string | null,
    amount: initial.amount,
    currency: "IRR",
    remaining_amount: "9007199254740992",
    request_only: true,
    limits: { max_amount: "9223372036854775807", reason: 1000 },
    provider_ref: "PRIVATE",
  },
});
const result = (amount = "9007199254740991", type = "refund") => ({
  success: true,
  data: {
    public_id: otherId,
    payment_public_id: publicId,
    type,
    amount_exact: amount,
    currency: "IRR",
    status: "pending",
    request_only: true,
    created_at: new Date().toISOString(),
  },
});
const reply = (data: unknown, status = 200) => ({ status, headers: {}, data });
const error = (status: number) =>
  new TransportError(classifyWireFailure({ status, data: { message: "Synthetic refusal" } }));
async function editor(locale: "en" | "fa" = "en") {
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
      <PaymentAdjustmentEditor initial={initial} {...callbacks} />
    </I18nextProvider>,
  );
  await screen.findByLabelText((locale === "en" ? en : fa)["payment.control.amount"]);
  await waitFor(() =>
    expect(
      view.container.ownerDocument.querySelector("[data-payment-adjustment-preview]"),
    ).not.toBeNull(),
  );
  return { ...view, ...callbacks, copy: locale === "en" ? en : fa };
}
const prepare = async () => {
  fireEvent.change(screen.getByLabelText(en["payment.control.amount"]), {
    target: { value: "9007199254740991" },
  });
  fireEvent.change(screen.getByLabelText(en["adminManage.reason"]), {
    target: { value: "Synthetic request for isolated acceptance." },
  });
  await userEvent.click(screen.getByRole("checkbox", { name: en["payment.control.confirm"] }));
};
beforeEach(() => {
  previewExpiresAt = Math.floor(Date.now() / 1000) + 300;
  authority.identity = { id: 1, roles: ["root-admin"] };
  execute
    .mockReset()
    .mockImplementation(async (request) =>
      reply(request.method === "POST" ? result() : wire(), request.method === "POST" ? 201 : 200),
    );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("root payment adjustment requests", () => {
  it("prevents duplicate submission while one request is pending", async () => {
    const { onSaved } = await editor();
    await prepare();
    let finish: (value: TransportResponse<unknown>) => void = () => {};
    execute.mockImplementation(async (r) =>
      r.method === "GET"
        ? reply(wire())
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const form = screen.getByRole("button", { name: en["adminManage.confirm"] }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1),
    );
    fireEvent.submit(form);
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1);
    await act(async () => finish(reply(result(), 201)));
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it.each(["en", "fa"] as const)(
    "shows %s exact currency/remaining/expiry and cancels without a write",
    async (locale) => {
      const { copy, onClose } = await editor(locale);
      const dialog = screen.getByRole("dialog");
      expect(dialog.textContent).toContain(copy["payment.requestsNotice"]);
      expect(dialog.textContent).toContain(
        new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(9007199254740992n),
      );
      expect(dialog.querySelector("time[datetime]")).toBeVisible();
      expect(dialog.textContent).not.toMatch(/PRIVATE|payment\.control\./);
      expect(screen.getByRole("button", { name: copy["adminManage.confirm"] })).toBeDisabled();
      await userEvent.click(
        within(dialog).getByText(copy["adminManage.close"], { selector: "button" }),
      );
      expect(onClose).toHaveBeenCalledOnce();
      expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
    },
  );
  it("rechecks the same revision/expiry then sends one exact pending-request mock write", async () => {
    const { onSaved } = await editor();
    await prepare();
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const calls = execute.mock.calls.map(([r]) => r);
    expect(calls.map((r) => r.method)).toEqual(["GET", "GET", "POST"]);
    expect(calls[1]?.query).toEqual({
      expires_at: (calls[2]!.body as Record<string, unknown>).expires_at,
    });
    expect(calls[2]).toMatchObject({
      path: `/api/admin/payments/${publicId}/adjustments`,
      body: {
        type: "refund",
        amount: "9007199254740991",
        expected_revision: "a".repeat(64),
        confirmed: true,
        reason: "Synthetic request for isolated acceptance.",
      },
    });
    expect(calls[2]?.body).not.toHaveProperty("currency");
  });
  it("requires a fresh confirmation after changing amount/type and makes void the whole remaining amount", async () => {
    await editor();
    await prepare();
    fireEvent.change(screen.getByLabelText(en["payment.control.amount"]), {
      target: { value: "1" },
    });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText(en["payment.control.type"]), "void");
    expect(screen.getByLabelText(en["payment.control.amount"])).toHaveValue("9007199254740992");
    expect(screen.getByLabelText(en["payment.control.amount"])).toHaveAttribute("readonly");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText(en["payment.control.type"]), "refund");
    expect(screen.getByLabelText(en["payment.control.amount"])).toHaveValue("");
  });
  it("refuses zero, negative, decimal, exponent, leading zeros and excessive amounts", async () => {
    const context = adaptAdjustmentContext(wire(), initial);
    for (const amount of [
      "0",
      "-1",
      "1.5",
      "1e3",
      "01",
      "9007199254740993",
      "9223372036854775808",
      "9".repeat(100),
    ])
      expect(validAdjustmentAmount(amount, context, "refund")).toBe(false);
    expect(validAdjustmentAmount("9007199254740992", context, "void")).toBe(true);
    expect(validAdjustmentAmount("1", context, "void")).toBe(false);
  });
  it("invalidates changed revisions before dispatch and disables another attempt", async () => {
    await editor();
    await prepare();
    execute.mockResolvedValue(
      reply({ ...wire(), data: { ...wire().data, revision: "b".repeat(64) } }),
    );
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    expect(await screen.findByText(en["adminManage.conflict"])).toBeVisible();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  });
  it("blocks an expired preview and clears confirmation", async () => {
    const expiry = Math.floor(Date.now() / 1000) + 2;
    execute.mockResolvedValue(reply({ ...wire(), data: { ...wire().data, expires_at: expiry } }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await editor();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText(en["payment.control.expired"])).toBeVisible();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
  });
  it("shows a blocked history and never enables submission", async () => {
    execute.mockResolvedValue(
      reply({
        ...wire(),
        data: { ...wire().data, can_request: false, blocked: "adjustment_history_inconsistent" },
      }),
    );
    await editor();
    expect(
      screen.getByText(en["payment.control.blocked.adjustment_history_inconsistent"]),
    ).toBeVisible();
    expect(screen.getByLabelText(en["payment.control.amount"])).toBeDisabled();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
  });
  it("revalidates again after recent-password confirmation without retaining the password", async () => {
    const { onSaved } = await editor();
    await prepare();
    let attempts = 0;
    execute.mockImplementation(async (request) => {
      if (request.path === "/api/auth/confirm-password")
        return reply({
          data: {
            confirmed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 300000).toISOString(),
          },
        });
      if (request.method === "GET") return reply(wire());
      if (attempts++ === 0)
        throw new TransportError({
          kind: "recent-password",
          status: 423,
          code: null,
          message: null,
          errors: {},
          meta: null,
          correlationId: null,
          retryAfter: null,
        });
      return reply(result(), 201);
    });
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    fireEvent.change(await screen.findByLabelText(/Current password/), {
      target: { value: "synthetic-only-password" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Confirm password" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(execute.mock.calls.map(([r]) => r.method)).toEqual([
      "GET",
      "GET",
      "POST",
      "POST",
      "GET",
      "POST",
    ]);
    expect(screen.queryByLabelText(/Current password/)).toBeNull();
    const writes = execute.mock.calls
      .map(([r]) => r)
      .filter((r) => r.path.endsWith("/adjustments"));
    expect(writes[0]?.body).toEqual(writes[1]?.body);
  });
  it("cancels the password prompt without retrying the request", async () => {
    const { onSaved } = await editor();
    await prepare();
    execute.mockImplementation(async (r) => {
      if (r.method === "GET") return reply(wire());
      throw new TransportError({
        kind: "recent-password",
        status: 423,
        code: null,
        message: null,
        errors: {},
        meta: null,
        correlationId: null,
        retryAfter: null,
      });
    });
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await screen.findByLabelText(/Current password/);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSaved).not.toHaveBeenCalled();
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1);
    expect(screen.queryByLabelText(/Current password/)).toBeNull();
  });
  it("freezes after an ambiguous request and does not automatically retry", async () => {
    const { onSaved, onUncertain } = await editor();
    await prepare();
    execute.mockImplementation(async (r) => {
      if (r.method === "GET") return reply(wire());
      throw error(500);
    });
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    expect(await screen.findByText(en["adminManage.uncertain"])).toBeVisible();
    expect(onUncertain).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText(en["payment.control.amount"])).toBeDisabled();
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1);
  });
  it("aborts verification on session role change and closes the dialog", async () => {
    const { onClose, onSaved } = await editor();
    await prepare();
    execute.mockImplementation(() => new Promise(() => {}));
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    const signal = execute.mock.lastCall?.[0].signal;
    await act(async () => {
      authority.identity = { id: 1, roles: ["admin"] };
      for (const notify of authority.listeners) notify();
    });
    expect(signal?.aborted).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("aborts a pending initial preview on unmount", async () => {
    const { unmount } = await editor();
    const signal = execute.mock.calls[0]?.[0].signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("binds previews to payment/money/currency, checks eligibility and strips private fields", () => {
    expect(adaptAdjustmentContext(wire(), initial)).not.toHaveProperty("provider_ref");
    for (const change of [
      { payment_public_id: otherId },
      { amount: "1" },
      { currency: "USD" },
      { remaining_amount: "9007199254740994" },
      { can_request: true, blocked: "nothing_remaining" },
      { request_only: false },
    ])
      expect(() =>
        adaptAdjustmentContext({ ...wire(), data: { ...wire().data, ...change } }, initial),
      ).toThrow(/binding rejected|Invalid/);
  });
  it("refuses another endpoint/method, client financial fields and invalid or misbound receipts", async () => {
    const context = adaptAdjustmentContext(wire(), initial),
      write = adjustmentWriteFor(context),
      signal = new AbortController().signal;
    const body = {
      type: "refund",
      amount: "1",
      reason: "Synthetic",
      confirmed: true,
      expected_revision: context.revision,
      expires_at: context.expires_at,
    };
    await expect(
      write("/api/admin/payments/other/adjustments", "POST", body, signal),
    ).rejects.toThrow(/Request failed/);
    await expect(
      write(`/api/admin/payments/${publicId}/adjustments`, "PUT", body, signal),
    ).rejects.toThrow(/Request failed/);
    await expect(
      write(
        `/api/admin/payments/${publicId}/adjustments`,
        "POST",
        { ...body, currency: "USD" },
        signal,
      ),
    ).rejects.toThrow(/Unrecognized/);
    expect(execute).not.toHaveBeenCalled();
    for (const change of [
      { payment_public_id: otherId },
      { amount_exact: "2" },
      { currency: "USD" },
      { type: "void" },
      { status: "succeeded" },
      { request_only: false },
    ]) {
      execute.mockResolvedValue(
        reply({ ...result("1"), data: { ...result("1").data, ...change } }, 201),
      );
      await expect(
        write(`/api/admin/payments/${publicId}/adjustments`, "POST", body, signal),
      ).rejects.toThrow(/rejected|Invalid/);
    }
  });
});
