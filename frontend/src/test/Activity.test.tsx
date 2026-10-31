import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { activityActions, adaptActivityList } from "../modules/checkupino/activity/api";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import Activity from "../pages/Administration/Activity";

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
const id = "01m4hfgan168p6q5ftp528285f";
const fixture = () => ({
  data: [
    {
      public_id: id,
      action: "reservation.completed",
      category: "reservation",
      actor: {
        public_id: id,
        name: "Synthetic Doctor",
        role: "doctor",
        identity_available: true,
        email: "PRIVATE EMAIL",
      },
      subject_public_id: id,
      risk: "high",
      outcome: "succeeded",
      reason_recorded: true,
      created_at: "2026-10-13T10:00:00Z",
      reason: "PRIVATE REASON",
      after: { body: "PRIVATE BODY" },
    },
  ],
  meta: {
    pagination: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
    period: { from: "2026-10-13", to: "2026-10-14", timezone: "Asia/Tehran" },
    generated_at: "2026-10-14T00:00:00Z",
  },
});
const stores: ReturnType<typeof storeFor>[] = [];
const storeFor = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const Location = () => <output aria-label="test URL">{useLocation().search}</output>;
async function page(path = "/activity", locale: "en" | "fa" = "en") {
  const instance = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await instance.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  applyProductLocale(document.documentElement, locale);
  const store = storeFor();
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={instance}>
        <MemoryRouter initialEntries={[path]}>
          <Activity />
          <Location />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
}
beforeEach(() => {
  identity.roles = ["admin"];
  execute.mockReset().mockResolvedValue({ status: 200, headers: {}, data: fixture() });
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("authorized activity", () => {
  it.each(["en", "fa"] as const)(
    "renders safe current audit metadata and complete %s copy",
    async (locale) => {
      const { container } = await page("/activity", locale);
      expect(await screen.findByText("Synthetic Doctor")).toBeVisible();
      expect(container.textContent).not.toMatch(/PRIVATE|activity\.|adminManage\.activity/);
      expect(screen.getByRole("link", { name: "Synthetic Doctor" })).toHaveAttribute(
        "href",
        `/users/${id}?directory=doctors`,
      );
      expect(screen.getByRole("link", { name: id })).toHaveAttribute(
        "href",
        `/reservations?q=${id}`,
      );
      expect(document.documentElement.dir).toBe(locale === "fa" ? "rtl" : "ltr");
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ method: "GET", path: "/api/admin/activity" }),
      );
    },
  );
  it("composes URL-owned filters, exact search, time order, refresh and reset", async () => {
    await page();
    await screen.findByText("Synthetic Doctor");
    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "Category" }), "reservation");
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Risk" }), "high");
    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "Time order" }), "asc");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: id } });
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            category: "reservation",
            risk: "high",
            sort_dir: "asc",
            q: id,
            page: "1",
          }),
        }),
      ),
    );
    const before = execute.mock.calls.length;
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: en["adminReservations.refresh"] }));
    await waitFor(() => expect(execute.mock.calls.length).toBeGreaterThan(before));
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: en["adminReservations.reset"] }));
    await waitFor(() =>
      expect(screen.getByLabelText("test URL").textContent).toBe("?page=1&per_page=20"),
    );
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
  });
  it.each(["patient", "doctor"])("refuses %s before querying", async (role) => {
    identity.roles = [role];
    await page();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it("removes privileged role filters and unknown URL parameters for ordinary admins", async () => {
    await page("/activity?actor_role=root-admin&before=password&sort_by=reason");
    await screen.findByText("Synthetic Doctor");
    expect(screen.queryByRole("option", { name: en["product.role.rootAdmin"] })).toBeNull();
    expect(execute.mock.calls.at(-1)![0].query).not.toHaveProperty("actor_role");
    expect(screen.getByLabelText("test URL").textContent).not.toMatch(/before|sort_by|root-admin/);
  });
  it("root can select the current root role without exposing private payload controls", async () => {
    identity.roles = ["root-admin"];
    await page();
    await screen.findByText("Synthetic Doctor");
    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "Current actor role" }), "root-admin");
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ actor_role: "root-admin" }) }),
      ),
    );
    expect(screen.queryByRole("textbox", { name: "Reason" })).toBeNull();
  });
  it.each([
    "from=2026-10-13",
    "from=2026-10-14&to=2026-10-13",
    "from=2026-01-01&to=2026-04-01",
    "q=private@example.test",
    "page=1001",
  ])("refuses invalid read state %s before sending or presenting rows", async (query) => {
    await page("/activity?" + query);
    expect(screen.getByRole("alert")).toHaveTextContent(en["activity.invalidQuery"]);
    expect(execute).not.toHaveBeenCalled();
    expect(screen.queryByText("Synthetic Doctor")).toBeNull();
  });
  it("retains a partial subject reference while blocking reads until the reference is complete", async () => {
    await page();
    await screen.findByText("Synthetic Doctor");
    const before = execute.mock.calls.length;
    fireEvent.change(screen.getByRole("textbox", { name: "Subject reference" }), {
      target: { value: "01m4" },
    });
    expect(screen.getByRole("textbox", { name: "Subject reference" })).toHaveValue("01m4");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("Synthetic Doctor")).toBeNull();
    expect(execute.mock.calls).toHaveLength(before);
    fireEvent.change(screen.getByRole("textbox", { name: "Subject reference" }), {
      target: { value: id },
    });
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ subject_public_id: id }) }),
      ),
    );
  });
  it("strips unsolicited audit and actor payload fields and refuses contradictory identity/category/page contracts", () => {
    const safe = adaptActivityList(fixture()).items[0];
    expect(safe).not.toHaveProperty("reason");
    expect(safe.actor).not.toHaveProperty("email");
    const hidden = fixture();
    hidden.data[0].actor.identity_available = false;
    expect(() => adaptActivityList(hidden)).toThrow(/Invalid input/);
    const category = fixture();
    category.data[0].category = "medical";
    expect(() => adaptActivityList(category)).toThrow(/Invalid input/);
    const unknown = fixture();
    unknown.data[0].action = "unknown.private";
    expect(() => adaptActivityList(unknown)).toThrow(/Invalid input/);
    const duplicate = fixture();
    duplicate.data.push(duplicate.data[0]);
    expect(() => adaptActivityList(duplicate)).toThrow(/Duplicate activity/);
    const oversized = fixture();
    oversized.meta.pagination.per_page = 101;
    expect(() => adaptActivityList(oversized)).toThrow(/Activity page/);
  });
  it("covers every allowed action with both language labels", () => {
    for (const action of Object.keys(activityActions)) {
      expect(Object.keys(en)).toContain(`activity.action.${action}`);
      expect(Object.keys(fa)).toContain(`activity.action.${action}`);
    }
  });
  it("replaces rows with the acknowledged server page when paging", async () => {
    const nextId = "01m4hfgan168p6q5ftp5282860";
    execute.mockImplementation(async (request) => {
      const wire = fixture();
      if (request.query?.page === "2") {
        wire.data[0].public_id = nextId;
        wire.meta.pagination.current_page = 2;
      }
      return { status: 200, headers: {}, data: wire };
    });
    await page();
    await screen.findByText("Synthetic Doctor");
    await userEvent.setup().click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText(nextId)).toBeVisible();
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ page: "2" }) }),
      ),
    );
    expect(screen.queryByText(id, { selector: "td" })).toBeNull();
  });
});
