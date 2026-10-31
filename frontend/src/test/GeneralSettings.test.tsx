import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { TransportError } from "../modules/checkupino/api/wire";
import {
  adaptGeneralSnapshot,
  generalRuntimeValue,
  generalWriteFor,
  parseGeneralDraft,
  readGeneralPair,
  type GeneralScope,
} from "../modules/checkupino/settings/general";
import GeneralSettings from "../pages/Administration/GeneralSettings";

const { execute, authority, auth } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  authority: { identity: { id: 1, roles: ["root-admin"] }, listeners: new Set<() => void>() },
  auth: {
    capabilities: { managePlatformConfiguration: true },
    userProfile: { id: 1, roles: ["root-admin"] },
  },
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../Layouts/ShellAuthContext", () => ({ useShellAuth: () => auth }));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => ({ identity: authority.identity }),
    subscribe: (fn: () => void) => {
      authority.listeners.add(fn);
      return () => authority.listeners.delete(fn);
    },
  },
}));
const wire = (scope: GeneralScope = "platform") => ({
  success: true,
  data: {
    settings: [
      {
        key: "booking.pending_hold_minutes",
        value_type: "integer",
        default: 60,
        allowed_scopes: ["platform", "site"],
        scope_type: scope,
        scope_key: scope === "platform" ? "marketplace" : "synthetic-site",
        stored: true,
        value: scope === "platform" ? 30 : 15,
        effective_value: scope === "platform" ? 30 : 15,
        effective_source: scope,
        runtime_bound: true,
        runtime_source: "new_reservation_hold",
        runtime_default: 75,
        constraints: { min: 5, max: 180 },
      },
      {
        key: "booking.default_timezone",
        value_type: "string",
        default: "Asia/Tehran",
        allowed_scopes: ["platform", "site", "user"],
        scope_type: scope,
        scope_key: scope === "platform" ? "marketplace" : "synthetic-site",
        stored: false,
        value: null,
        effective_value: "Asia/Tehran",
        effective_source: "default",
        runtime_bound: true,
        runtime_source: "missing_hospital_timezone_only",
        runtime_default: null,
        constraints: { format: "iana_timezone" },
      },
      {
        key: "payments.default_currency",
        value_type: "string",
        default: "IRR",
        allowed_scopes: ["platform", "site"],
        scope_type: scope,
        scope_key: scope === "platform" ? "marketplace" : "synthetic-site",
        stored: false,
        value: null,
        effective_value: "IRR",
        effective_source: "default",
        runtime_bound: true,
        runtime_source: "missing_new_schedule_currency_only",
        runtime_default: null,
        constraints: { format: "three_uppercase_letters" },
      },
    ],
  },
  meta: {
    read_only: true,
    managed_scopes: ["platform", "site"],
    scope_type: scope,
    revision: (scope === "platform" ? "a" : "b").repeat(64),
    write_controls_ready: true,
    runtime_binding_ready: true,
    generated_at: new Date().toISOString(),
  },
});
const reply = (data: unknown, status = 200) => ({ data, status, headers: {} });
const result = (r: TransportRequest) => {
  const b = r.body as Record<string, unknown>;
  return reply({
    success: true,
    data: {
      setting: {
        key: r.path.split("/").at(-1),
        scope_type: b.scope_type,
        scope_key: b.scope_key,
        value: b.operation === "reset" ? null : b.value,
        stored: b.operation !== "reset",
      },
    },
  });
};
const normal = async (r: TransportRequest) =>
  r.method === "GET" ? reply(wire(r.query?.scope_type as GeneralScope)) : result(r);
const writes = () => execute.mock.calls.map(([r]) => r).filter((r) => r.method === "PUT");
const holdCard = () => document.querySelector('[data-general-setting="hold"]') as HTMLElement;
const holdInput = () =>
  screen.getByLabelText(
    en["generalSettings.newValue"].replace("{{setting}}", en["generalSettings.hold"]),
  );
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
        <GeneralSettings />
      </MemoryRouter>
    </I18nextProvider>,
  );
  if (auth.capabilities.managePlatformConfiguration)
    await screen.findByLabelText(
      (locale === "en" ? en : fa)["generalSettings.newValue"].replace(
        "{{setting}}",
        (locale === "en" ? en : fa)["generalSettings.hold"],
      ),
    );
  return { ...view, instance, copy: locale === "en" ? en : fa };
}
async function open(operation = "set") {
  if (operation === "set") fireEvent.change(holdInput(), { target: { value: "45" } });
  await userEvent.click(
    within(holdCard()).getByRole("button", {
      name: en[operation === "set" ? "generalSettings.save" : "generalSettings.reset"],
    }),
  );
  const confirm = await screen.findByRole("checkbox", { name: en["generalSettings.confirm"] });
  await waitFor(() => expect(confirm).not.toBeDisabled());
  return confirm;
}
async function prepare(operation = "set") {
  await userEvent.click(await open(operation));
  fireEvent.change(screen.getByLabelText(en["adminManage.reason"]), {
    target: { value: "Synthetic reviewed policy change." },
  });
}
const submit = () =>
  userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
beforeEach(() => {
  auth.capabilities.managePlatformConfiguration = true;
  auth.userProfile = { id: 1, roles: ["root-admin"] };
  authority.identity = { id: 1, roles: ["root-admin"] };
  execute.mockReset().mockImplementation(normal);
});

describe("general settings controls", () => {
  it.each(["en", "fa"] as const)(
    "shows %s cards, inheritance, explicit applicability and operator fallback",
    async (locale) => {
      const { copy } = await page(locale);
      expect(holdCard().textContent).toContain(copy["generalSettings.operatorFallback"]);
      expect(holdCard().textContent).toContain("75");
      expect(holdCard().textContent).toContain(copy["generalSettings.siteWins"]);
      expect(document.body.textContent).not.toMatch(
        /generalSettings\.|secret_reference|expected_revision/,
      );
      expect(execute.mock.calls.map(([r]) => r.query?.scope_type)).toEqual([
        "platform",
        "site",
        "platform",
      ]);
      expect(writes()).toHaveLength(0);
    },
  );
  it.each(["admin", "patient", "doctor"])(
    "never fetches protected settings for %s",
    async (role) => {
      auth.userProfile.roles = [role];
      auth.capabilities.managePlatformConfiguration = false;
      await page();
      expect(screen.getByRole("alert")).toHaveTextContent(en["uploads.rootOnly"]);
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it("switches scope using server-owned keys and disables unchanged or absent-reset actions", async () => {
    await page();
    expect(
      within(holdCard()).getByRole("button", { name: en["generalSettings.save"] }),
    ).toBeDisabled();
    expect(
      within(document.querySelector('[data-general-setting="currency"]') as HTMLElement).getByRole(
        "button",
        { name: en["generalSettings.reset"] },
      ),
    ).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(en["generalSettings.scope"]), "site");
    await waitFor(() => expect(holdInput()).toHaveValue("15"));
    await prepare();
    await submit();
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).toMatchObject({
      scope_type: "site",
      scope_key: "synthetic-site",
      expected_revision: "b".repeat(64),
      value: 45,
    });
  });
  it("cancels a reviewed action without sending a write", async () => {
    await page();
    await open();
    await userEvent.click(
      within(screen.getByRole("dialog")).getByText(en["adminManage.close"], { selector: "button" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes()).toHaveLength(0);
    expect(holdInput()).toHaveValue("45");
  });
  it("requires reason and confirmation, repeats both signed reads, then sends one typed save", async () => {
    await page();
    const checkbox = await open();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    await userEvent.click(checkbox);
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(en["adminManage.reason"]), {
      target: { value: "  Synthetic review  " },
    });
    await submit();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes()).toHaveLength(1);
    expect(writes()[0]?.body).toEqual({
      operation: "set",
      scope_type: "platform",
      scope_key: "marketplace",
      value: 45,
      reason: "Synthetic review",
      confirmed: true,
      expected_revision: "a".repeat(64),
    });
    const calls = execute.mock.calls.map(([r]) => r);
    expect(
      calls.slice(
        0,
        calls.findIndex((r) => r.method === "PUT"),
      ),
    ).toHaveLength(12);
  });
  it("previews reset inheritance without touching a site override and omits value entirely", async () => {
    await page();
    await prepare("reset");
    expect(screen.getByRole("dialog")).toHaveTextContent(en["generalSettings.resetHint"]);
    const preview = document.querySelector("[data-general-setting-preview]")!;
    expect(preview.textContent).toContain("60");
    expect(preview.textContent).toContain("15");
    await submit();
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).not.toHaveProperty("value");
    expect(writes()[0]?.body).toMatchObject({ operation: "reset", confirmed: true });
  });
  it("refuses a changed preview before confirmation and requires refresh", async () => {
    await page();
    fireEvent.change(holdInput(), { target: { value: "45" } });
    execute.mockImplementation(async (r) => {
      const data = wire(r.query?.scope_type as GeneralScope);
      data.meta.revision = "c".repeat(64);
      return reply(data);
    });
    await userEvent.click(
      within(holdCard()).getByRole("button", { name: en["generalSettings.save"] }),
    );
    expect(await screen.findByText(en["generalSettings.stale"])).toBeVisible();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });
  it("refuses changes between confirmation and delivery without a PUT", async () => {
    await page();
    await prepare();
    execute.mockImplementation(async (r) => {
      const data = wire(r.query?.scope_type as GeneralScope);
      data.meta.revision = "c".repeat(64);
      return reply(data);
    });
    await submit();
    expect(await screen.findByText(en["adminManage.conflict"])).toBeVisible();
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
  it("checks again at the writer boundary after the dialog verification", async () => {
    await page();
    await prepare();
    let reads = 0;
    execute.mockImplementation(async (r) => {
      reads++;
      const data = wire(r.query?.scope_type as GeneralScope);
      if (reads > 3) data.meta.revision = "c".repeat(64);
      return reply(data);
    });
    await submit();
    expect(await screen.findByText(en["adminManage.conflict"])).toBeVisible();
    expect(writes()).toHaveLength(0);
  });
  it("prevents duplicate submits while a delivery is pending", async () => {
    await page();
    await prepare();
    let finish: (value: TransportResponse<unknown>) => void = () => {};
    execute.mockImplementation((r) =>
      r.method === "GET"
        ? normal(r)
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const form = screen.getByRole("button", { name: en["adminManage.confirm"] }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(writes()).toHaveLength(1));
    fireEvent.submit(form);
    expect(writes()).toHaveLength(1);
    await act(async () => finish(result(writes()[0]!)));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it.each(["network", "bad-ack"])(
    "locks further actions after %s until explicit refresh",
    async (failure) => {
      await page();
      await prepare();
      execute.mockImplementation(async (r) => {
        if (r.method === "GET") return normal(r);
        if (failure === "network") throw new TypeError("Synthetic network ambiguity");
        return reply({ success: true, data: { setting: {} } });
      });
      await submit();
      await waitFor(() =>
        expect(screen.getAllByText(en["adminManage.uncertain"]).length).toBeGreaterThan(0),
      );
      await userEvent.click(
        within(screen.getByRole("dialog")).getByText(en["adminManage.close"], {
          selector: "button",
        }),
      );
      expect(
        within(holdCard()).getByRole("button", { name: en["generalSettings.save"] }),
      ).toBeDisabled();
      expect(writes()).toHaveLength(1);
      execute.mockImplementation(normal);
      await userEvent.click(screen.getByRole("button", { name: en["generalSettings.refresh"] }));
      await waitFor(() => expect(holdInput()).toHaveValue("30"));
      expect(screen.queryByText(en["adminManage.uncertain"])).toBeNull();
      expect(writes()).toHaveLength(1);
    },
  );
  it("preserves reason/confirmation across password flow and rereads before retrying", async () => {
    await page();
    await prepare();
    let attempts = 0;
    execute.mockImplementation(async (r) => {
      if (r.path === "/api/auth/confirm-password")
        return reply({
          data: {
            confirmed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 300000).toISOString(),
          },
        });
      if (r.method === "GET") return normal(r);
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
      return result(r);
    });
    await submit();
    fireEvent.change(await screen.findByLabelText(/Current password/), {
      target: { value: "synthetic-only-password" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Confirm password" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes()).toHaveLength(2);
    expect(writes()[0]?.body).toEqual(writes()[1]?.body);
    const calls = execute.mock.calls.map(([r]) => r),
      first = calls.indexOf(writes()[0]!),
      second = calls.indexOf(writes()[1]!);
    expect(calls.slice(first + 1, second).filter((r) => r.method === "GET")).toHaveLength(6);
    expect(screen.queryByLabelText(/Current password/)).toBeNull();
  });
  it("aborts preview reads when scope changes or the page unmounts", async () => {
    const view = await page();
    let signal: AbortSignal | undefined;
    execute.mockImplementation((r) => {
      signal = r.signal;
      return new Promise(() => {});
    });
    await userEvent.selectOptions(screen.getByLabelText(en["generalSettings.scope"]), "site");
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(writes()).toHaveLength(0);
  });
  it("closes and aborts the action on authority changes", async () => {
    await page();
    await prepare();
    await act(async () => {
      authority.identity = { id: 2, roles: ["admin"] };
      authority.listeners.forEach((fn) => fn());
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes()).toHaveLength(0);
  });
  it("keeps unsaved values and confirmation through a language change", async () => {
    const { instance } = await page();
    await prepare();
    await act(async () => {
      await instance.changeLanguage("fa");
    });
    expect(screen.getByRole("checkbox", { name: fa["generalSettings.confirm"] })).toBeChecked();
    expect(screen.getByLabelText(fa["adminManage.reason"])).toHaveValue(
      "Synthetic reviewed policy change.",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(fa["generalSettings.holdHint"]);
    expect(writes()).toHaveLength(0);
  });
});

describe("general settings protocol", () => {
  it.each(["4", "181", "30.5", "030", "", "-1"])("rejects invalid hold input %s", (text) => {
    expect(parseGeneralDraft("booking.pending_hold_minutes", text)).toBeNull();
  });
  it("validates currency/timezone and resolves runtime reset precedence without rewriting sources", async () => {
    expect(parseGeneralDraft("payments.default_currency", "12#")).toBeNull();
    expect(parseGeneralDraft("payments.default_currency", "eur")).toBeNull();
    expect(parseGeneralDraft("booking.default_timezone", "Mars/Unknown")).toBeNull();
    const pair = await readGeneralPair(new AbortController().signal);
    expect(
      generalRuntimeValue(pair, "booking.pending_hold_minutes", {
        key: "booking.pending_hold_minutes",
        scope: "site",
        operation: "reset",
        value: null,
      }),
    ).toBe(30);
    pair.platform.settings[0]!.value = null;
    pair.platform.settings[0]!.stored = false;
    pair.site.settings[0]!.value = null;
    pair.site.settings[0]!.stored = false;
    expect(generalRuntimeValue(pair, "booking.pending_hold_minutes")).toBe(75);
  });
  it("rejects malformed metadata, duplicate keys, wrong scope/type and private-value carriers", () => {
    for (const corrupt of [
      (x: ReturnType<typeof wire>) => {
        x.data.settings[0]!.value_type = "string";
      },
      (x: ReturnType<typeof wire>) => {
        x.meta.scope_type = "site";
      },
      (x: ReturnType<typeof wire>) => {
        Object.assign(x.data.settings[0]!, { value: "PRIVATE" });
      },
      (x: ReturnType<typeof wire>) => {
        x.data.settings.reverse();
      },
      (x: ReturnType<typeof wire>) => {
        x.data.settings[0]!.runtime_bound = false;
      },
    ]) {
      const body = wire();
      corrupt(body);
      expect(() => adaptGeneralSnapshot(body, "platform")).toThrow(/General|Invalid/);
    }
  });
  it("refuses a changing platform read instead of exposing a mixed pair", async () => {
    let platforms = 0;
    execute.mockImplementation(async (r) => {
      const body = wire(r.query?.scope_type as GeneralScope);
      if (r.query?.scope_type === "platform" && ++platforms > 1)
        body.meta.revision = "c".repeat(64);
      return reply(body);
    });
    await expect(readGeneralPair(new AbortController().signal)).rejects.toBeInstanceOf(
      TransportError,
    );
  });
  it("rejects path, unknown fields, reset values and mismatched delivery snapshots before transport", async () => {
    const pair = await readGeneralPair(new AbortController().signal),
      signal = new AbortController().signal;
    const body = {
      operation: "reset",
      scope_type: "platform",
      scope_key: "marketplace",
      reason: "Synthetic review",
      confirmed: true,
      expected_revision: pair.platform.revision,
    };
    const write = generalWriteFor(pair, {
      key: "booking.pending_hold_minutes",
      scope: "platform",
      operation: "reset",
      value: null,
    });
    for (const extra of [
      { value: null },
      { patient_id: 7 },
      { scope_key: "other" },
      { expected_revision: "d".repeat(64) },
    ])
      await expect(
        write(
          "/api/admin/settings/booking.pending_hold_minutes",
          "PUT",
          { ...body, ...extra },
          signal,
        ),
      ).rejects.toBeInstanceOf(Error);
    await expect(
      write("/api/admin/settings/payments.default_currency", "PUT", body, signal),
    ).rejects.toBeInstanceOf(Error);
    expect(writes()).toHaveLength(0);
  });
  it("honors an already-aborted delivery signal", async () => {
    const pair = await readGeneralPair(new AbortController().signal),
      controller = new AbortController();
    controller.abort();
    await expect(readGeneralPair(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(writes()).toHaveLength(0);
    expect(pair.site.scope).toBe("site");
  });
});
