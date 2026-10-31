import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import UserDirectory from "../pages/Users/UserDirectory";
import type { DirectoryScope } from "../modules/checkupino/users/directory";

const { identity, execute } = vi.hoisted(() => ({
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

const response = (empty = false): TransportResponse<unknown> => ({
  data: {
    data: {
      users: empty
        ? []
        : [
            {
              account_state: "active",
              created_at: "2026-09-11T10:00:00Z",
              email: "ada@example.test",
              first_name: "Ada",
              id: 7,
              last_name: "Sample",
              name: "Ada Sample",
              patient_status: "trial",
              phone: null,
              public_id: "01-DIRECTORY-USER",
              role: "admin",
            },
          ],
    },
    meta: {
      pagination: {
        current_page: 1,
        last_page: empty ? 1 : 2,
        per_page: 20,
        total: empty ? 0 : 21,
      },
    },
  },
  headers: {},
  status: 200,
});

const storeFor = () =>
  configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(checkupinoApi.middleware),
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
  });
const stores: ReturnType<typeof storeFor>[] = [];

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="test URL">{location.search}</output>
      <button onClick={() => navigate(-1)} type="button">
        Test back
      </button>
    </>
  );
};

const renderDirectory = async (
  locale: "en" | "fa" = "en",
  path = "/users",
  scope?: DirectoryScope,
) => {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    interpolation: { escapeValue: false },
    keySeparator: false,
    lng: locale,
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  applyProductLocale(document.documentElement, locale);
  const store = storeFor();
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter initialEntries={[path]}>
          <UserDirectory scope={scope} />
          <LocationProbe />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};

beforeEach(() => {
  identity.roles = ["root-admin"];
  execute.mockReset().mockResolvedValue(response());
});

afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("API-backed user directory", () => {
  it.each(["doctor", "patient"] as const)(
    "locks the %s scope even for privileged pasted URLs and hides creation",
    async (scope) => {
      identity.roles = ["root-admin"];
      await renderDirectory(
        "en",
        `/${scope}s?role=admin&verification=verified&specialty_id=2&workplace_id=3`,
        scope,
      );
      await screen.findByText("Ada Sample");
      expect(screen.queryByRole("combobox", { name: "Role" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Add staff member" })).toBeNull();
      const request = execute.mock.calls.at(-1)![0];
      expect(request.query?.role).toBe(scope);
      expect(request.query).toMatchObject({
        verification: scope === "patient" ? undefined : "verified",
        specialty_id: scope === "patient" ? undefined : 2,
        workplace_id: scope === "patient" ? undefined : 3,
      });
      expect(screen.getByLabelText("test URL").textContent).toContain(`role=${scope}`);
    },
  );

  it("composes doctor metadata filters and links the correct doctor profile into existing records", async () => {
    identity.roles = ["admin"];
    const wire = response();
    execute.mockResolvedValue({
      ...wire,
      data: {
        data: {
          users: [
            {
              id: 5,
              public_id: "01-DOCTOR",
              name: "Synthetic Doctor",
              role: "doctor",
              account_state: "active",
              created_at: null,
              doctor_profile: {
                id: 2,
                verified: true,
                specialty: "Cardiology",
                active_workplaces_count: 3,
              },
            },
          ],
        },
        meta: { pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 } },
      },
    });
    await renderDirectory("en", "/doctors", "doctor");
    expect(await screen.findByText("Cardiology")).toBeVisible();
    expect(screen.getByText("Verified", { selector: "td" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Reservations" })).toHaveAttribute(
      "href",
      "/reservations?doctor_id=2",
    );
    expect(screen.getByRole("link", { name: "Medical requests" })).toHaveAttribute(
      "href",
      "/medical-requests?doctor_id=2",
    );
    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox", { name: "Doctor verification" }), "verified");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Specialty ID" }), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: en["operations.workplaceId"] }), {
      target: { value: "6" },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Suspended" }));
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            role: "doctor",
            verification: "verified",
            specialty_id: 4,
            workplace_id: 6,
            account_state: "suspended",
            page: 1,
          }),
        }),
      ),
    );
  });

  it("keeps missing doctor profiles distinct and offers no guessed reservation or medical links", async () => {
    const wire = response();
    execute.mockResolvedValue({
      ...wire,
      data: {
        data: {
          users: [
            {
              id: 5,
              public_id: "01-DOCTOR",
              name: "Synthetic Doctor",
              role: "doctor",
              doctor_profile: null,
              account_state: "active",
              created_at: null,
            },
          ],
        },
        meta: { pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 } },
      },
    });
    await renderDirectory("en", "/doctors", "doctor");
    await screen.findByText("Synthetic Doctor");
    expect(screen.getByText("No doctor profile", { selector: "td" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Reservations" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Medical requests" })).toBeNull();
  });

  it.each(["en", "fa"] as const)(
    "offers metadata-only patient drill-downs with complete %s copy",
    async (locale) => {
      identity.roles = ["admin"];
      const { container } = await renderDirectory(locale, "/patients", "patient");
      await screen.findByText("Ada Sample");
      const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
      expect(links).toContain("/reservations?user_id=7");
      expect(links).toContain("/medical-requests?user_id=7");
      expect(links).toContain("/questionnaire-submissions?user_id=7");
      expect(container.textContent).not.toMatch(/operations\.|adminManage\.patients/);
      expect(container.textContent).not.toContain("ada@example.test");
      expect(document.documentElement.dir).toBe(locale === "fa" ? "rtl" : "ltr");
    },
  );

  it("removes unsupported doctor filter IDs before requesting or serializing them", async () => {
    await renderDirectory(
      "en",
      "/doctors?verification=unknown&specialty_id=-1&workplace_id=9007199254740992",
      "doctor",
    );
    await screen.findByText("Ada Sample");
    const request = execute.mock.calls.at(-1)![0];
    expect(request.query?.verification).toBeUndefined();
    expect(request.query?.specialty_id).toBeUndefined();
    expect(request.query?.workplace_id).toBeUndefined();
  });

  it("resets operational filters without losing the locked scope and explicitly refreshes", async () => {
    await renderDirectory(
      "en",
      "/patients?account_state=suspended&range=month&q=Ada&page=2",
      "patient",
    );
    await screen.findByText("Ada Sample");
    await userEvent.setup().click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            role: "patient",
            page: 1,
            q: undefined,
            range: undefined,
            account_state: undefined,
          }),
        }),
      ),
    );
    const before = execute.mock.calls.length;
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: en["adminReservations.refresh"] }));
    await waitFor(() => expect(execute.mock.calls.length).toBeGreaterThan(before));
  });

  it("connects creation to the directory and refreshes rows only after a confirmed write", async () => {
    execute.mockImplementation(async (request) =>
      request.method === "POST"
        ? {
            data: { data: { user: { id: 7, public_id: "01-DIRECTORY-USER" } } },
            status: 200,
            headers: {},
          }
        : response(),
    );
    await renderDirectory();
    await screen.findByText("Ada Sample");
    await userEvent.setup().click(screen.getByRole("button", { name: "Add staff member" }));
    const roleField = document.getElementById("user-role") as HTMLSelectElement;
    expect([...roleField.options].map((option) => option.value).filter(Boolean)).toEqual(["admin"]);
    expect(roleField.value).toBe("admin");
    for (const [name, value] of Object.entries({
      first_name: "Demo",
      last_name: "Created",
      email: "created@example.test",
      phone: "09123456789",
      birth_date: "1990-04-15",
      NID: "0012345678",
      reason: "Synthetic staff creation",
    })) {
      fireEvent.change(document.getElementById(`user-${name}`)!, { target: { value } });
    }
    await userEvent.setup().click(screen.getByRole("button", { name: "Suggest password" }));
    fireEvent.submit(document.getElementById("user-editor-form")!);
    expect(await screen.findByText("User saved successfully.")).toBeVisible();
    expect(
      execute.mock.calls.find(([request]) => request.method === "POST")?.[0].body,
    ).toMatchObject({ role: "admin", reason: "Synthetic staff creation" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(execute.mock.calls.filter(([request]) => request.method === "GET")).toHaveLength(2),
    );
  });

  it.each(["en", "fa"] as const)(
    "renders server data and complete %s copy with language-owned direction",
    async (locale) => {
      const { container } = await renderDirectory(locale);
      expect(await screen.findByText("Ada Sample")).toBeVisible();
      expect(screen.queryByText("ada@example.test")).toBeNull();
      expect(screen.getByRole("link", { name: /Ada Sample/ })).toHaveAttribute(
        "href",
        expect.stringContaining("/users/01-DIRECTORY-USER?"),
      );
      expect(screen.queryByRole("combobox", { name: locale === "en" ? "Role" : "نقش" })).toBeNull();
      expect(screen.queryByText(en["users.patientStatus"])).toBeNull();
      expect(
        screen.getByText(locale === "en" ? "Active" : "فعال", { selector: "td output" }),
      ).toBeVisible();
      expect(document.documentElement.dir).toBe(locale === "en" ? "ltr" : "rtl");
      expect(container.querySelector("[data-server-table]")).not.toHaveAttribute("dir");
      expect(container.textContent).not.toMatch(/users\.|product\.navigation|routes\.admin/);
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ method: "GET", path: "/api/admin/staff" }),
      );
    },
  );

  it("persists server search, filters, sorting, pagination and browser history in the URL", async () => {
    const user = userEvent.setup();
    await renderDirectory();
    await screen.findByText("Ada Sample");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "Ada" },
    });
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ q: "Ada", page: 1 }) }),
      ),
    );
    expect(screen.queryByRole("combobox", { name: "Role" })).toBeNull();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Registration period" }),
      "month",
    );
    await user.click(await screen.findByRole("button", { name: "Sort ascending: Name" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            page: 2,
            q: "Ada",
            range: "month",
            role: "admin",
            sort_by: "name",
            sort_dir: "asc",
          }),
        }),
      ),
    );
    expect(screen.getByLabelText("test URL")).toHaveTextContent("page=2");
    await user.click(screen.getByRole("button", { name: "Test back" }));
    await waitFor(() => expect(screen.getByLabelText("test URL")).toHaveTextContent("page=1"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Rows per page" }), "50");
    await waitFor(() =>
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ page: 1, per_page: 50 }) }),
      ),
    );
  });

  it("pins staff role despite pasted clinical URL filters", async () => {
    await renderDirectory(
      "en",
      "/users?role=patient&per_page=500&sort_by=password&unexpected=secret",
    );
    await screen.findByText("Ada Sample");
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: "/api/admin/staff",
        query: expect.objectContaining({ per_page: 100, role: "admin", sort_by: undefined }),
      }),
    );
    expect(screen.queryByRole("combobox", { name: "Role" })).toBeNull();
    expect(screen.getByLabelText("test URL")).not.toHaveTextContent(/patient|password|secret/);
  });
  it("denies an ordinary admin the staff workspace without fetching", async () => {
    identity.roles = ["admin"];
    await renderDirectory();
    expect(screen.getByRole("alert")).toHaveTextContent("You do not have access");
    expect(execute).not.toHaveBeenCalled();
  });
  it.each(["doctor", "patient"])("does not fetch or render staff rows for %s", async (role) => {
    identity.roles = [role];
    await renderDirectory();
    expect(screen.getByRole("alert")).toHaveTextContent("You do not have access");
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a clinical row returned by the staff endpoint", async () => {
    const wire = response();
    execute.mockResolvedValue({
      ...wire,
      data: {
        data: { users: [{ id: 4, role: "patient", name: "Forbidden clinical identity" }] },
        meta: { pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 } },
      },
    });
    await renderDirectory();
    await screen.findByRole("alert");
    expect(screen.queryByText("Forbidden clinical identity")).toBeNull();
  });

  it("shows loading and server-empty states without fixture fallback", async () => {
    let resolve!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await renderDirectory();
    expect(screen.getByText("Loading…")).toBeVisible();
    expect(screen.queryByText("Ada Sample")).not.toBeInTheDocument();
    await act(async () => {
      resolve(response(true));
    });
    expect(await screen.findByText("Nothing found")).toBeVisible();
    expect(screen.getByText("Total users: 0")).toBeVisible();
  });

  it("keeps structured API errors visible and retries the failed request", async () => {
    execute.mockRejectedValueOnce(
      new TransportError(
        classifyWireFailure({
          status: 503,
          message: "Service unavailable",
          headers: { "x-correlation-id": "directory-probe" },
        }),
      ),
    );
    await renderDirectory();
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
    expect(screen.getByRole("alert")).toHaveTextContent("directory-probe");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ada Sample")).toBeVisible();
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
