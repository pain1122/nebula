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
  adaptCatalogDetail,
  adaptCatalogList,
  formatCatalogPrice,
  type CatalogKind,
} from "../modules/checkupino/catalog/api";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import { CatalogList } from "../pages/Administration/Catalog";
import { CatalogDetail } from "../pages/Administration/CatalogDetail";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";

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
const common = () => ({
  id: 5,
  public_id: publicId,
  slug: "synthetic-catalog",
  is_active: true,
  state: "active",
  archived_at: null,
  created_at: "2026-10-13T10:00:00Z",
  updated_at: "2026-10-13T10:00:00Z",
  archive_reason: "PRIVATE REASON",
});
const category = () => ({
  ...common(),
  name: "Synthetic category",
  counts: { checkups: 3, active_checkups: 2, archived_checkups: 1 },
});
const checkup = () => ({
  ...common(),
  title: "Synthetic checkup",
  price: "9007199254740993",
  currency: "IRR",
  default_duration_minutes: 30,
  category: {
    id: 5,
    public_id: publicId,
    name: "Synthetic category",
    slug: "synthetic-category",
    state: "active",
    email: "PRIVATE EMAIL",
  },
  counts: { reservations: 2, workplace_assignments: 1 },
});
const specialty = () => ({
  ...common(),
  name: "Synthetic specialty",
  level: 0,
  parent: null,
  counts: { children: 1, primary_doctors: 2, secondary_associations: 1 },
});
const response = (kind: CatalogKind, detail = false) => ({
  success: true,
  data: detail
    ? {
        ...(kind === "checkups" ? checkup() : kind === "specialties" ? specialty() : category()),
        description: '<img src=x onerror="alert(1)"> plain text',
      }
    : [kind === "checkups" ? checkup() : kind === "specialties" ? specialty() : category()],
  meta: {
    pagination: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
    generated_at: "2026-10-13T11:00:00Z",
  },
});
const context = (kind: CatalogKind = "checkup-categories", id: number | null = null) => ({
  data: {
    kind,
    id,
    revision: "a".repeat(64),
    can_create: id === null,
    can_update: id !== null,
    can_archive: id !== null,
    limits: {
      name: 190,
      slug: 190,
      description: 2000,
      reason: 1000,
      min_duration: 5,
      max_duration: 720,
      max_price: "9007199254740991",
    },
    generated_at: "2026-10-15T00:00:00Z",
  },
});
const stores: ReturnType<typeof storeFor>[] = [];
const storeFor = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const Location = () => <output aria-label="test URL">{useLocation().search}</output>;
async function page(path = "/checkups", locale: "en" | "fa" = "en") {
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
          <Routes>
            <Route path="/specialties" element={<CatalogList kind="specialties" />} />
            <Route
              path="/specialties/:specialtyId"
              element={<CatalogDetail kind="specialties" />}
            />
            <Route path="/checkups" element={<CatalogList kind="checkups" />} />
            <Route path="/checkups/:checkupId" element={<CatalogDetail kind="checkups" />} />
            <Route path="/checkup-categories" element={<CatalogList kind="checkup-categories" />} />
            <Route
              path="/checkup-categories/:categoryId"
              element={<CatalogDetail kind="checkup-categories" />}
            />
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
    data: request.path.includes("/catalog/")
      ? context(
          request.path.includes("/checkups/") ? "checkups" : "checkup-categories",
          request.path.endsWith("/5") ? 5 : null,
        )
      : request.method !== "GET"
        ? { data: { id: 6 } }
        : response(
            request.path.includes("specialties")
              ? "specialties"
              : request.path.includes("checkup-categories")
                ? "checkup-categories"
                : "checkups",
            request.path.endsWith("/5"),
          ),
  }));
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("catalog panels", () => {
  it.each(["en", "fa"] as const)(
    "shows %s specialty hierarchy and refuses referenced archive",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const { container } = await page("/specialties/5", locale);
      expect(await screen.findByRole("heading", { name: "Synthetic specialty" })).toBeVisible();
      expect(screen.getByRole("button", { name: copy["catalog.archive"] })).toBeDisabled();
      expect(container.querySelector('a[href="/specialties?parent_id=5&state=all"]')).toBeVisible();
      expect(container.querySelector('a[href="/doctors?specialty_id=5"]')).toBeVisible();
      expect(container.textContent).not.toMatch(/PRIVATE|catalog\.|adminManage\./);
    },
  );
  it("requires an explicit category archive choice and cancels without a write", async () => {
    await page("/checkup-categories/5");
    await screen.findByRole("heading", { name: "Synthetic category" });
    await userEvent.click(screen.getByRole("button", { name: en["catalog.archive"] }));
    await waitFor(() => expect(screen.getByLabelText(en["catalog.childAction"])).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText(en["catalog.childAction"]), "reassign");
    await userEvent.type(
      screen.getByLabelText(en["adminManage.reason"]),
      "Synthetic reassignment.",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: en["catalog.confirmChange"] }));
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    await userEvent.click(
      within(screen.getByRole("dialog")).getByText(en["adminManage.close"], { selector: "button" }),
    );
    expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  });
  const openCreate = async (locale: "en" | "fa" = "en") => {
    await page("/checkup-categories", locale);
    await screen.findByRole("link", { name: "Synthetic category" });
    const copy = locale === "en" ? en : fa;
    await userEvent.click(screen.getByRole("button", { name: copy["catalog.create"] }));
    await waitFor(() => expect(screen.getByLabelText(copy["catalog.name"])).toBeEnabled());
    return copy;
  };
  const fillCreate = async () => {
    await userEvent.type(screen.getByLabelText(en["catalog.name"]), "Synthetic new category");
    await userEvent.type(screen.getByLabelText(en["catalog.slug"]), "synthetic-new-category");
    await userEvent.type(screen.getByLabelText(en["adminManage.reason"]), "Synthetic reason");
    await userEvent.click(screen.getByRole("checkbox", { name: en["catalog.confirmChange"] }));
  };
  it.each(["en", "fa"] as const)(
    "opens %s guarded creation and cancels without a write",
    async (locale) => {
      const copy = await openCreate(locale);
      expect(screen.getByRole("button", { name: copy["adminManage.confirm"] })).toBeDisabled();
      await userEvent.click(
        within(screen.getByRole("dialog")).getByText(copy["adminManage.close"], {
          selector: "button",
        }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
  it("rechecks a fresh actor-bound revision before one confirmed mock save", async () => {
    await openCreate();
    await fillCreate();
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const writes = execute.mock.calls.map(([r]) => r).filter((r) => r.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      method: "POST",
      path: "/api/admin/checkup-categories",
      body: {
        name: "Synthetic new category",
        slug: "synthetic-new-category",
        reason: "Synthetic reason",
        confirmed: true,
        expected_revision: "a".repeat(64),
      },
    });
    expect(execute.mock.calls.filter(([r]) => r.path.includes("/catalog/"))).toHaveLength(2);
  });
  it("refuses a changed revision before mock dispatch", async () => {
    await openCreate();
    await fillCreate();
    execute.mockImplementation(async () => ({
      status: 200,
      headers: {},
      data: { data: { ...context().data, revision: "b".repeat(64) } },
    }));
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.conflict"]);
    expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  });
  it("freezes edits and forbids replay after ambiguous mock delivery", async () => {
    await openCreate();
    await fillCreate();
    execute.mockImplementation(async (r) => {
      if (r.method !== "GET") throw new TransportError(classifyWireFailure({ status: 503 }));
      return { status: 200, headers: {}, data: context() };
    });
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent(en["adminManage.uncertain"]),
    );
    expect(screen.getByLabelText(en["catalog.name"])).toBeDisabled();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    expect(execute.mock.calls.filter(([r]) => r.method !== "GET")).toHaveLength(1);
  });
  it.each(["en", "fa"] as const)(
    "renders %s safe list, exact prices and both detail links",
    async (locale) => {
      const { container } = await page("/checkups", locale);
      expect(await screen.findByRole("link", { name: "Synthetic checkup" })).toHaveAttribute(
        "href",
        "/checkups/5?page=1&per_page=20",
      );
      expect(screen.getByRole("link", { name: "Synthetic category" })).toHaveAttribute(
        "href",
        "/checkup-categories/5",
      );
      expect(screen.getByText(formatCatalogPrice("9007199254740993", "IRR", locale))).toBeVisible();
      expect(container.textContent).not.toMatch(/PRIVATE|catalog\.|adminManage\./);
      expect(document.documentElement.dir).toBe(locale === "fa" ? "rtl" : "ltr");
      expect(
        screen.getByRole("button", {
          name:
            en["catalog.create"] === "Create" && locale === "en" ? "Create" : fa["catalog.create"],
        }),
      ).toBeEnabled();
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
  it.each(["en", "fa"] as const)(
    "renders %s category detail boxes and historical child drill-downs",
    async (locale) => {
      const { container } = await page("/checkup-categories/5", locale);
      expect(await screen.findByRole("heading", { name: "Synthetic category" })).toBeVisible();
      expect(container.querySelectorAll("[data-catalog-boxes] section")).toHaveLength(3);
      expect(
        container.querySelector('a[href="/checkups?state=archived&category_id=5"]'),
      ).toBeVisible();
      expect(container.querySelector("img[src=x]")).toBeNull();
      expect(container.textContent).not.toMatch(/PRIVATE|catalog\.|adminManage\./);
    },
  );
  it("renders checkup facts in boxes, keeps Back filters and escapes descriptions", async () => {
    const { container } = await page("/checkups/5?state=archived&q=old");
    expect(await screen.findByRole("heading", { name: "Synthetic checkup" })).toBeVisible();
    expect(container.querySelectorAll("[data-catalog-boxes] section")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Back to list" })).toHaveAttribute(
      "href",
      "/checkups?page=1&per_page=20&q=old&state=archived",
    );
    expect(container.querySelector('a[href="/reservations?checkup_id=5"]')).toBeVisible();
    expect(screen.getByText('<img src=x onerror="alert(1)"> plain text')).toBeVisible();
    expect(container.querySelector("img[src=x]")).toBeNull();
  });
  it("composes literal search/state/category/money filters and resets them", async () => {
    await page(
      "/checkups?q=100%25&state=active&category_id=5&currency=IRR&min_price=1&max_price=10",
    );
    await screen.findByRole("link", { name: "Synthetic checkup" });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/admin/checkups",
        query: expect.objectContaining({
          q: "100%",
          state: "active",
          category_id: "5",
          currency: "IRR",
          min_price: "1",
          max_price: "10",
        }),
      }),
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() =>
      expect(screen.getByLabelText("test URL")).toHaveTextContent("?page=1&per_page=20"),
    );
    expect(screen.getByLabelText("Currency")).toHaveValue("");
  });
  it.each([
    "page=1001",
    "category_id=5&uncategorized=1",
    "currency=I",
    "min_price=10&max_price=1",
    "min_price=1.1",
    "q=" + "x".repeat(101),
  ])("blocks malformed query %s and never presents stale rows", async (query) => {
    await page("/checkups?" + query);
    expect(screen.getByRole("alert")).toHaveTextContent(en["catalog.invalidQuery"]);
    expect(screen.queryByRole("link", { name: "Synthetic checkup" })).toBeNull();
    expect(
      execute.mock.calls.filter(([request]) => request.path === "/api/admin/checkups"),
    ).toHaveLength(0);
  });
  it("retains partial currency input while suspending reads and clearing rows", async () => {
    await page();
    await screen.findByRole("link", { name: "Synthetic checkup" });
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "I" } });
    expect(screen.getByLabelText("Currency")).toHaveValue("I");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Synthetic checkup" })).toBeNull();
  });
  it("shows a generic denial after refresh and clears previous facts", async () => {
    await page("/checkups/5");
    await screen.findByRole("heading", { name: "Synthetic checkup" });
    execute.mockResolvedValue({ status: 403, headers: {}, data: { message: "PRIVATE REASON" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.unavailable"]);
    expect(screen.queryByText("Synthetic checkup")).toBeNull();
    expect(screen.queryByText("PRIVATE REASON")).toBeNull();
  });
  it("refuses invalid detail identifiers and unauthorized page reads", async () => {
    identity.roles = ["patient"];
    await page("/checkups/5");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects wrong detail identities and strips nested private fields", () => {
    const row = adaptCatalogDetail(response("checkups", true), "checkups", "5");
    expect(row).not.toHaveProperty("archive_reason");
    expect(row.kind === "checkups" && row.category).not.toHaveProperty("email");
    expect(() => adaptCatalogDetail(response("checkups", true), "checkups", "6")).toThrow(
      /identity rejected/,
    );
  });
  it("rejects duplicate/oversized rows and contradictory state/count payloads", () => {
    const duplicate = response("checkups");
    duplicate.data = [checkup(), checkup()];
    expect(() => adaptCatalogList(duplicate, "checkups")).toThrow(/Duplicate catalog/);
    const oversized = response("checkups");
    oversized.meta.pagination.per_page = 101;
    expect(() => adaptCatalogList(oversized, "checkups")).toThrow(/page bounds/);
    expect(() =>
      adaptCatalogList(
        { ...response("checkups"), data: [{ ...checkup(), state: "archived" }] },
        "checkups",
      ),
    ).toThrow(/Contradictory/);
    expect(() =>
      adaptCatalogList(
        {
          ...response("checkup-categories"),
          data: [
            { ...category(), counts: { checkups: 1, active_checkups: 2, archived_checkups: 0 } },
          ],
        },
        "checkup-categories",
      ),
    ).toThrow(/Contradictory/);
  });
});
