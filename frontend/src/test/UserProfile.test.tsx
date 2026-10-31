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
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { checkupinoApi } from "../modules/checkupino/query/api";
import UserProfile, { SupportProfile } from "../pages/Users/UserProfile";

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
    bootstrap: vi.fn<() => Promise<void>>(async () => undefined),
  },
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const id = "01m4hfgan168p6q5ftp528285f";
const profilePath = `/api/admin/users/${id}/support-profile`;
const fixture = (mode = "support") => ({
  user: {
    id: mode === "self" ? identity.id : 4,
    public_id: id,
    name: "Synthetic Patient",
    first_name: "Synthetic",
    last_name: "Patient",
    role: mode === "self" ? identity.roles[0] : "patient",
    doctor_profile_id: null,
    account_state: "active",
    created_at: null,
    email: "PRIVATE@example.test",
    NID: "PRIVATE",
  },
  mode,
  revision: "a".repeat(64),
  editable_fields: ["first_name", "last_name"],
  summary: {
    reservations: 1,
    upcoming: 0,
    completed: 1,
    medical_requests: 1,
    published_reports: 1,
    questionnaire_submissions: 1,
  },
  reservations: [
    { public_id: id, status: "completed", starts_at: null, ends_at: null, timezone: "Asia/Tehran" },
  ],
  requests: [],
  reports: [
    {
      public_id: id,
      status: "published",
      published_at: null,
      is_amendment: false,
      body: "PRIVATE BODY",
    },
  ],
  submissions: [
    {
      public_id: id,
      status: "submitted",
      created_at: null,
      answers_json: ["PRIVATE ANSWER"],
      total_score: 99,
    },
  ],
  activity: [],
});
const reply = (wire: unknown): TransportResponse<unknown> => ({
  data: { data: wire },
  headers: {},
  status: 200,
});
const rejected = (status: number) => new TransportError(classifyWireFailure({ status }));
const stores: ReturnType<typeof makeStore>[] = [];
const makeStore = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
async function page(path = `/users/${id}`, locale: "en" | "fa" = "en") {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const store = makeStore();
  stores.push(store);
  const rendered = render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/users/:userId" element={<SupportProfile />} />
            <Route path="/profile" element={<UserProfile />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return { ...rendered, translations };
}
async function edit() {
  await screen.findByRole("heading", { name: "Synthetic Patient" });
  fireEvent.click(screen.getByRole("button", { name: en["profileOverview.editName"] }));
  return screen.getByRole("form", { name: en["profileOverview.editName"] });
}
function change(form: HTMLElement) {
  fireEvent.change(within(form).getByLabelText(en["users.field.first_name"]), {
    target: { value: "Updated" },
  });
  fireEvent.change(within(form).getByLabelText(en["adminManage.reason"]), {
    target: { value: "Synthetic support correction" },
  });
}
const writes = () =>
  execute.mock.calls.map(([call]) => call).filter((call) => call.method === "PUT");
beforeEach(() => {
  identity.id = 2;
  identity.roles = ["admin"];
  execute
    .mockReset()
    .mockImplementation(async (request) =>
      reply(fixture(request.path === "/api/panel-profile" ? "self" : "support")),
    );
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("shared profile page and guarded inline editing", () => {
  it.each(["admin", "root-admin", "doctor"])(
    "does not request patient health for a %s own profile",
    async (role) => {
      identity.roles = [role];
      await page("/profile");
      await screen.findByRole("heading", { name: "Synthetic Patient" });
      expect(
        execute.mock.calls.some(([request]) => request.path === "/api/my/health-profile"),
      ).toBe(false);
    },
  );

  it("never mounts the private health reader on an administrative support profile", async () => {
    await page(`/users/${id}`);
    await screen.findByRole("heading", { name: "Synthetic Patient" });
    expect(execute.mock.calls.some(([request]) => request.path === "/api/my/health-profile")).toBe(
      false,
    );
    expect(screen.queryByText(en["health.title"])).toBeNull();
  });
  it.each(["doctors", "patients"] as const)(
    "returns to the fixed %s operational scope with its filters",
    async (directory) => {
      const { translations } = await page(
        `/users/${id}?directory=${directory}&role=admin&account_state=active&verification=verified&specialty_id=2`,
      );
      await screen.findByRole("heading", { name: "Synthetic Patient" });
      const back = screen.getByRole("link", { name: translations.t("adminManage.back") });
      const href = back.getAttribute("href")!;
      expect(href).toMatch(new RegExp(`^/${directory}\\?`));
      const parameters = new URLSearchParams(href.split("?")[1]);
      expect(parameters.get("role")).toBe(directory === "doctors" ? "doctor" : "patient");
      expect(parameters.get("account_state")).toBe("active");
      expect(parameters.get("verification")).toBe(directory === "doctors" ? "verified" : null);
      expect(writes()).toHaveLength(0);
    },
  );

  it("does not turn a pasted directory return parameter into a redirect", async () => {
    const { translations } = await page(`/users/${id}?directory=https://external.invalid`);
    await screen.findByRole("heading", { name: "Synthetic Patient" });
    expect(screen.getByRole("link", { name: translations.t("adminManage.back") })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/patients\?/),
    );
  });

  it.each(["en", "fa"] as const)(
    "shows metadata only, sanitized Back filters and no edit modal in %s",
    async (locale) => {
      const { translations } = await page(
        `/users/${id}?role=patient&q=Synthetic&unexpected=PRIVATE&sort_by=email`,
        locale,
      );
      await screen.findByRole("heading", { name: "Synthetic Patient" });
      expect(screen.queryByText(/PRIVATE/)).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        screen.getByRole("link", { name: translations.t("adminManage.back") }),
      ).toHaveAttribute("href", "/patients?page=1&per_page=20&q=Synthetic&role=patient");
      expect(document.querySelector('a[href*="/medical"]')).toBeNull();
      expect(
        screen.getByRole("link", { name: translations.t("profileOverview.allAppointments") }),
      ).toHaveAttribute("href", "/reservations?user_id=4");
    },
  );
  it.each(["patient", "doctor"])("refuses %s support access before querying", async (role) => {
    identity.roles = [role];
    await page();
    expect(screen.getByRole("alert")).toHaveTextContent(en["users.accessDenied"]);
    expect(execute).not.toHaveBeenCalled();
  });
  it.each(["patient", "doctor"])(
    "uses the current owner's API and existing medical routes for %s",
    async (role) => {
      identity.id = 4;
      identity.roles = [role];
      await page("/profile");
      await screen.findByRole("heading", { name: "Synthetic Patient" });
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/api/panel-profile", method: "GET" }),
      );
      expect(screen.getByRole("link", { name: en["medical.title"] })).toHaveAttribute(
        "href",
        `/${role === "patient" ? "my" : "doctor"}/reservations/${id}/medical`,
      );
    },
  );
  it("refuses an invalid support identifier without querying", async () => {
    await page("/users/not-a-public-id");
    expect(screen.getByRole("alert")).toHaveTextContent(en["profileOverview.unavailable"]);
    expect(execute).not.toHaveBeenCalled();
  });
  it("holds unchanged names and missing reasons, then cancels inline without a write", async () => {
    await page();
    const form = await edit();
    expect(within(form).getByRole("button", { name: en["users.save"] })).toBeDisabled();
    fireEvent.change(within(form).getByLabelText(en["users.field.first_name"]), {
      target: { value: "Updated" },
    });
    expect(within(form).getByRole("button", { name: en["users.save"] })).toBeDisabled();
    fireEvent.click(within(form).getByRole("button", { name: en["users.cancel"] }));
    expect(screen.queryByRole("form")).toBeNull();
    expect(writes()).toHaveLength(0);
  });
  it("saves only names/reason/fresh revision and refreshes the subject", async () => {
    let saved = false;
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") saved = true;
      const wire = fixture();
      return reply(
        saved
          ? {
              ...wire,
              user: { ...wire.user, name: "Updated Patient", first_name: "Updated" },
              revision: "b".repeat(64),
            }
          : wire,
      );
    });
    await page();
    const form = await edit();
    change(form);
    fireEvent.submit(form);
    await screen.findByRole("heading", { name: "Updated Patient" });
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({
      path: profilePath,
      body: {
        first_name: "Updated",
        last_name: "Patient",
        reason: "Synthetic support correction",
        expected_revision: "a".repeat(64),
      },
    });
    expect(Object.keys(writes()[0].body as object)).toHaveLength(4);
    expect(execute.mock.calls.filter(([call]) => call.method === "GET")).toHaveLength(3);
  });
  it("rejects a stale fresh-read revision without sending a PUT", async () => {
    await page();
    const form = await edit();
    change(form);
    execute.mockResolvedValue(reply({ ...fixture(), revision: "b".repeat(64) }));
    fireEvent.submit(form);
    await screen.findByText(en["adminManage.conflict"]);
    expect(writes()).toHaveLength(0);
    expect(within(form).getByRole("button", { name: en["users.save"] })).toBeDisabled();
  });
  it("blocks ambiguous delivery until cancel plus a fresh manual read", async () => {
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") throw rejected(503);
      return reply(fixture());
    });
    await page();
    const form = await edit();
    change(form);
    fireEvent.submit(form);
    await screen.findByText(en["adminManage.uncertain"]);
    fireEvent.submit(form);
    expect(writes()).toHaveLength(1);
    fireEvent.click(within(form).getByRole("button", { name: en["users.cancel"] }));
    expect(screen.getByRole("button", { name: en["profileOverview.editName"] })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en["adminReservations.refresh"] }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["profileOverview.editName"] })).toBeEnabled(),
    );
  });
  it("cancels password confirmation without retrying the business write", async () => {
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") throw rejected(423);
      return reply(fixture());
    });
    await page();
    const form = await edit();
    change(form);
    fireEvent.submit(form);
    const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Confirm your identity" })).toBeNull(),
    );
    expect(writes()).toHaveLength(1);
    expect(screen.getByLabelText(en["users.field.first_name"])).toHaveValue("Updated");
    expect(execute.mock.calls.some(([call]) => call.path === "/api/auth/confirm-password")).toBe(
      false,
    );
  });
  it("rechecks the revision after ordinary password confirmation and retries once", async () => {
    let attempts = 0;
    execute.mockImplementation(async (request) => {
      if (request.path === "/api/auth/confirm-password")
        return reply({ confirmed_at: "2026-10-13T00:00:00Z", expires_at: "2026-10-13T00:15:00Z" });
      if (request.method === "PUT" && ++attempts === 1) throw rejected(423);
      return reply(fixture());
    });
    await page();
    const form = await edit();
    change(form);
    fireEvent.submit(form);
    const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
    await userEvent
      .setup()
      .type(within(dialog).getByLabelText(/Current password/), "Synthetic confirmation passphrase");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm password" }));
    await screen.findByText(en["users.saved"]);
    expect(writes()).toHaveLength(2);
    expect(writes()[0].body).toEqual(writes()[1].body);
    expect(execute.mock.calls.filter(([call]) => call.method === "GET")).toHaveLength(4);
  });
  it("blocks duplicate submits and aborts pending fresh reads on unmount", async () => {
    const rendered = await page();
    const form = await edit();
    change(form);
    let resolve!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.submit(form);
    fireEvent.submit(form);
    const request = execute.mock.calls.at(-1)?.[0];
    expect(execute.mock.calls.filter(([call]) => call.method === "GET")).toHaveLength(2);
    rendered.unmount();
    expect(request?.signal?.aborted).toBe(true);
    await act(async () => {
      resolve(reply(fixture()));
    });
    expect(writes()).toHaveLength(0);
  });
  it("aborts a pending edit when the authenticated role changes", async () => {
    await page();
    const form = await edit();
    change(form);
    let resolve!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.submit(form);
    const request = execute.mock.calls.at(-1)?.[0];
    act(() => {
      identity.roles = ["patient"];
      for (const listener of listeners) listener();
    });
    expect(request?.signal?.aborted).toBe(true);
    await act(async () => {
      resolve(reply(fixture()));
    });
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(en["users.accessDenied"]);
  });
  it("refuses a substituted subject on the current-owner API", async () => {
    const wire = fixture("self");
    execute.mockResolvedValue(reply({ ...wire, user: { ...wire.user, id: 999 } }));
    await page("/profile");
    await screen.findByText(en["profileOverview.unavailable"]);
    expect(screen.queryByRole("heading", { name: "Synthetic Patient" })).toBeNull();
  });
});
