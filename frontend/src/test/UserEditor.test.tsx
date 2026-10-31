import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { checkupinoApi } from "../modules/checkupino/query/api";
import {
  createUserEditorSchema,
  suggestUserPassword,
  userEditorDefaults,
  type AdminUser,
} from "../modules/checkupino/users/editor";
import { UserEditor } from "../modules/checkupino/users/UserEditor";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));

const record: AdminUser = {
  id: 7,
  public_id: "01-EDITOR-USER",
  first_name: "Ada",
  last_name: "Sample",
  name: "Ada Sample",
  email: "ada@example.test",
  phone: "09123456789",
  birth_date: "1990-04-15",
  NID: "0012345678",
  city: "Tehran",
  country: "Iran",
  zip_code: "1234567890",
  bio: "Preserve this profile",
  role: "patient",
  patient_status: "trial",
  account_state: "active",
  created_at: "2026-10-01T10:00:00Z",
};
const response = (data: unknown = { user: record }): TransportResponse<unknown> => ({
  data: { data, success: true },
  headers: {},
  status: 200,
});
const failure = (status: number, errors?: Readonly<Record<string, string[]>>) =>
  new TransportError(
    classifyWireFailure({
      status,
      data: { errors, message: "Request rejected" },
      headers: { "x-correlation-id": "editor-probe" },
    }),
  );
const stores: ReturnType<typeof configureStore>[] = [];

const renderEditor = async ({
  locale = "en",
  root = false,
  id = null,
}: { locale?: "en" | "fa"; root?: boolean; id?: number | null } = {}) => {
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
  const store = configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(checkupinoApi.middleware),
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
  });
  stores.push(store);
  const saved = vi.fn<(user: AdminUser) => void>();
  const close = vi.fn<() => void>();
  const view = render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <UserEditor manageAdminIdentities={root} onClose={close} onSaved={saved} userId={id} />
      </I18nextProvider>
    </Provider>,
  );
  return { ...view, close, saved, store };
};

const fillCreation = async () => {
  for (const [name, value] of Object.entries({
    first_name: "Ada",
    last_name: "Sample",
    email: "ada@example.test",
    phone: "۰۹۱۲۳۴۵۶۷۸۹",
    birth_date: "1990-04-15",
    NID: "۰۰۱۲۳۴۵۶۷۸",
    city: "Tehran",
  })) {
    fireEvent.change(document.getElementById(`user-${name}`)!, { target: { value } });
  }
  await userEvent.setup().click(screen.getByRole("button", { name: "Suggest password" }));
};
const submit = () => fireEvent.submit(document.getElementById("user-editor-form")!);

beforeEach(() => {
  execute.mockReset().mockResolvedValue(response());
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("real user editor", () => {
  it.each(["en", "fa"] as const)("renders complete %s labels and role limits", async (locale) => {
    await renderEditor({ locale });
    const dialog = screen.getByRole("dialog");
    expect(document.documentElement.dir).toBe(locale === "en" ? "ltr" : "rtl");
    expect(dialog).not.toHaveAttribute("dir");
    expect(dialog.textContent).not.toMatch(/users\./);
    expect(screen.getByLabelText(locale === "en" ? /Birth date/ : /تاریخ تولد/)).toHaveAttribute(
      "type",
      "date",
    );
    expect(
      screen.queryByRole("option", { name: locale === "en" ? "Administrator" : "مدیر" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /root/i })).not.toBeInTheDocument();
  });

  it("validates required identity fields, password length and confirmation before writing", async () => {
    await renderEditor();
    submit();
    expect(await screen.findAllByText("This field is required.")).not.toHaveLength(0);
    expect(execute).not.toHaveBeenCalled();
    await fillCreation();
    fireEvent.change(document.getElementById("user-password_confirmation")!, {
      target: { value: "different" },
    });
    submit();
    expect(await screen.findByText("The passwords must match.")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });

  it("creates through the real gateway, normalizes digits and keeps credentials out of Redux", async () => {
    const { saved, store } = await renderEditor();
    await fillCreation();
    const suggested = (document.getElementById("user-password") as HTMLInputElement).value;
    submit();
    await waitFor(() => expect(saved).toHaveBeenCalledWith(record));
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/admin/users",
        body: expect.objectContaining({
          password: suggested,
          password_confirmation: suggested,
          phone: "09123456789",
          NID: "0012345678",
          city: "Tehran",
          country: null,
        }),
      }),
    );
    expect(JSON.stringify(store.getState())).not.toContain(suggested);
    expect(document.getElementById("user-password")).toHaveValue("");
  });

  it("fetches full details before edit and preserves optional fields without sending passwords", async () => {
    const { saved } = await renderEditor({ id: 7 });
    expect(await screen.findByLabelText("Biography")).toHaveValue(record.bio);
    expect(screen.queryByLabelText(/New password/)).not.toBeInTheDocument();
    fireEvent.change(document.getElementById("user-last_name")!, { target: { value: "Updated" } });
    submit();
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ method: "GET", path: "/api/admin/users/7" }),
    );
    const write = execute.mock.calls.find(([request]) => request.method === "PUT")![0];
    expect(write.body).toMatchObject({
      last_name: "Updated",
      bio: record.bio,
      country: "Iran",
      zip_code: record.zip_code,
      patient_status: "trial",
    });
    expect(write.body).not.toHaveProperty("password");
    expect(write.body).not.toHaveProperty("password_confirmation");
  });

  it("shows detail failure and retries without enabling an incomplete edit", async () => {
    execute.mockRejectedValueOnce(failure(503));
    await renderEditor({ id: 7 });
    expect(await screen.findByRole("alert")).toHaveTextContent("editor-probe");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Biography")).toHaveValue(record.bio);
  });

  it("maps server validation, keeps the form open, and does not retry a rejected write", async () => {
    execute.mockRejectedValueOnce(
      failure(422, { email: ["Email is already used"], other: ["Additional error"] }),
    );
    const { saved } = await renderEditor();
    await fillCreation();
    submit();
    await waitFor(() =>
      expect(document.getElementById("user-email")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(document.getElementById("user-email")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Additional error");
    expect(screen.getByRole("alert")).toHaveTextContent("editor-probe");
    expect(saved).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("uses one visible overlay and retries the same write once after password confirmation", async () => {
    execute
      .mockRejectedValueOnce(failure(423))
      .mockResolvedValueOnce(response({ confirmed_at: "now", expires_at: "later" }))
      .mockResolvedValueOnce(response());
    const { saved } = await renderEditor();
    await fillCreation();
    submit();
    const confirmation = await screen.findByRole("dialog", { name: "Confirm your identity" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.change(within(confirmation).getByLabelText(/Current password/), {
      target: { value: "current secret password" },
    });
    await userEvent
      .setup()
      .click(within(confirmation).getByRole("button", { name: "Confirm password" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(execute.mock.calls.map(([request]) => request.path)).toEqual([
      "/api/admin/users",
      "/api/auth/confirm-password",
      "/api/admin/users",
    ]);
    expect(execute.mock.calls[0][0].body).toEqual(execute.mock.calls[2][0].body);
  });

  it("cancels step-up without retrying and restores the draft", async () => {
    execute.mockRejectedValueOnce(failure(423));
    const { saved } = await renderEditor();
    await fillCreation();
    submit();
    const confirmation = await screen.findByRole("dialog", { name: "Confirm your identity" });
    await userEvent.setup().click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("dialog", { name: "Create user" })).toBeVisible();
    expect(document.getElementById("user-first_name")).toHaveValue("Ada");
    expect(screen.getByRole("button", { name: "Create user" })).toBeEnabled();
    expect(saved).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("separates wrong current-password errors from the new account password", async () => {
    execute
      .mockRejectedValueOnce(failure(423))
      .mockRejectedValueOnce(failure(422, { password: ["Wrong current password"] }));
    await renderEditor();
    await fillCreation();
    submit();
    const confirmation = await screen.findByRole("dialog", { name: "Confirm your identity" });
    fireEvent.change(within(confirmation).getByLabelText(/Current password/), {
      target: { value: "wrong current password" },
    });
    await userEvent
      .setup()
      .click(within(confirmation).getByRole("button", { name: "Confirm password" }));
    expect(await screen.findByText(/Your current password could not be confirmed/)).toBeVisible();
    expect(document.getElementById("user-password")).not.toHaveAttribute("aria-invalid", "true");
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("requires an audit reason for creating, promoting and demoting admin accounts", async () => {
    await renderEditor({ root: true });
    await fillCreation();
    await userEvent.setup().selectOptions(screen.getByLabelText(/^Role/), "admin");
    submit();
    expect(await screen.findByText("Enter a reason for this admin-account change.")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("user-reason")!, {
      target: { value: "Demo setup approval" },
    });
    submit();
    await waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(execute.mock.calls[0][0].body).toMatchObject({
      role: "admin",
      patient_status: null,
      reason: "Demo setup approval",
    });
    const schema = createUserEditorSchema((key) => key, false, true, "admin");
    expect(
      schema.safeParse({ ...userEditorDefaults({ ...record, role: "admin" }), role: "patient" })
        .success,
    ).toBe(false);
  });

  it("locks duplicate submission and dismissal during an unresolved write", async () => {
    let resolve!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { close } = await renderEditor();
    await fillCreation();
    submit();
    await waitFor(() => expect(execute).toHaveBeenCalledOnce());
    submit();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
    await act(async () => {
      resolve(response());
    });
  });

  it("aborts an outstanding step-up when the consumer unmounts", async () => {
    execute.mockRejectedValueOnce(failure(423));
    const view = await renderEditor();
    await fillCreation();
    submit();
    await screen.findByRole("dialog", { name: "Confirm your identity" });
    view.unmount();
    expect(execute.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("generates bounded multi-word suggestions with cryptographic randomness", () => {
    const random = vi.spyOn(crypto, "getRandomValues");
    const suggested = suggestUserPassword();
    expect(random).toHaveBeenCalledOnce();
    expect(suggested).toMatch(/^(?:[a-z]+-){4}[a-f0-9]{16}$/);
    expect(suggested.length).toBeGreaterThanOrEqual(15);
    expect(suggested.length).toBeLessThanOrEqual(64);
    random.mockRestore();
  });
  it("rejects admin role selection for normal admins even through programmatic input", () => {
    const schema = createUserEditorSchema((key) => key, false, false);
    expect(
      schema.safeParse({
        ...userEditorDefaults(record),
        role: "admin",
        reason: "Unauthorized promotion",
      }).success,
    ).toBe(false);
  });
});
