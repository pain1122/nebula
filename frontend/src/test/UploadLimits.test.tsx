import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { checkupinoApi } from "../modules/checkupino/query/api";
import {
  adaptUploadSetting,
  createUploadPolicyGateway,
  parseSizeInput,
  uploadPolicyDraft,
  uploadPolicyValue,
  type UploadSetting,
  type UploadSettingKey,
} from "../modules/checkupino/uploads/policy";
import { UploadPolicyCard } from "../modules/checkupino/uploads/UploadPolicyCard";
import UploadLimits from "../pages/Uploads/UploadLimits";

const { execute, profile } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  profile: { id: 1, roles: ["root-admin"] },
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ capabilities: adminCapabilitiesFor(profile), userProfile: profile }),
}));
vi.mock("../Components/Common/BreadCrumb", () => ({ default: () => null }));

const policy = (
  key: UploadSettingKey = "uploads.medical",
  revision = "a".repeat(64),
): UploadSetting => ({
  key,
  scope_type: "platform",
  scope_key: "marketplace",
  revision,
  policy_state: "active",
  policy: {
    allowed_mime_types: ["application/pdf", "image/png"],
    max_bytes_by_mime: { "application/pdf": 10485760, "image/png": 10485760 },
  },
  type_limit_overrides: {},
  default_max_bytes: 10485760,
  configured_default_max_bytes: 10485760,
  capacity_max_bytes: 10485760,
  scanner_max_bytes: key === "uploads.medical" ? 10485760 : null,
});
const response = (data: unknown = {}) => ({ data, headers: {}, status: 200 });
const failure = (status: number, errors?: Record<string, string[]>) =>
  new TransportError(
    classifyWireFailure({
      status,
      data: { errors, message: "Request rejected" },
      headers: { "x-correlation-id": "synthetic-upload-policy" },
    }),
  );
const stores: ReturnType<typeof configureStore>[] = [];

const renderControls = async (setting = policy(), locale: "en" | "fa" = "en", page = false) => {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    keySeparator: false,
    lng: locale,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const store = configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(checkupinoApi.middleware),
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
  });
  stores.push(store);
  const reload = vi.fn<() => Promise<UploadSetting>>().mockResolvedValue(setting);
  const wrap = (next = setting) => (
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        {page ? <UploadLimits /> : <UploadPolicyCard setting={next} reload={reload} />}
      </I18nextProvider>
    </Provider>
  );
  const view = render(wrap());
  return { ...view, reload, store, update: (next: UploadSetting) => view.rerender(wrap(next)) };
};
const reason = (value = "Synthetic policy review") =>
  fireEvent.change(document.getElementById("uploads-medical-reason")!, { target: { value } });
const submit = () => fireEvent.submit(document.getElementById("uploads-medical-form")!);

beforeEach(() => {
  profile.roles = ["root-admin"];
  profile.id = 1;
  execute.mockReset().mockResolvedValue(response());
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("exact configurable size inputs", () => {
  it.each([
    ["۵۰", "MiB", 52428800],
    ["١٫٥", "MiB", 1572864],
    ["104857601", "bytes", 104857601],
    ["0.00000095367431640625", "MiB", 1],
    ["9007199254740991", "bytes", Number.MAX_SAFE_INTEGER],
  ] as const)("converts %s %s without rounding", (amount, unit, expected) => {
    expect(parseSizeInput({ amount, unit }, Number.MAX_SAFE_INTEGER)).toBe(expected);
  });
  it.each(["0", "-1", "1e8", "", "NaN", "1,000", "0.1", "9007199254740992"])(
    "rejects invalid or fractional byte input %s",
    (amount) => {
      expect(() => parseSizeInput({ amount, unit: "bytes" }, Number.MAX_SAFE_INTEGER)).toThrow(
        /invalidSize|wholeBytes|aboveCapacity/,
      );
    },
  );
  it("rejects one byte above capacity and supports future MIME/large policies from the backend", () => {
    expect(() => parseSizeInput({ amount: "33", unit: "bytes" }, 32)).toThrow("aboveCapacity");
    const setting = {
      ...policy(),
      capacity_max_bytes: 1073741824,
      scanner_max_bytes: 1073741824,
      policy: {
        allowed_mime_types: ["video/mp4", "application/zip"],
        max_bytes_by_mime: { "video/mp4": 209715200, "application/zip": 536870912 },
      },
      default_max_bytes: 209715200,
      type_limit_overrides: { "application/zip": 536870912 },
    };
    expect(adaptUploadSetting({ data: { setting } }, "uploads.medical")).toEqual(setting);
    expect(uploadPolicyValue(setting, uploadPolicyDraft(setting))).toEqual({
      max_bytes: 209715200,
      type_limits: { "application/zip": 536870912 },
    });
    expect(() => adaptUploadSetting({ data: { setting } }, "uploads.public_media")).toThrow(
      "Invalid upload policy response.",
    );
    expect(() =>
      adaptUploadSetting(
        { data: { setting: { ...setting, revision: "missing" } } },
        "uploads.medical",
      ),
    ).toThrow(/revision/);
  });
  it("sends only approved scoped values, audit reason and revision", async () => {
    const gateway = createUploadPolicyGateway({
      request: async (request) => {
        await execute(request);
        return { data: undefined as never, headers: {}, status: 200 };
      },
    });
    await gateway.save(policy(), { max_bytes: 1, type_limits: {} }, " Synthetic ");
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        path: "/api/admin/settings/uploads.medical",
        body: {
          scope_type: "platform",
          scope_key: "marketplace",
          value: { max_bytes: 1, type_limits: {} },
          reason: "Synthetic",
          expected_revision: "a".repeat(64),
        },
      }),
    );
  });
});

describe("retained upload policy controls", () => {
  it("requires reason and checks capacity and byte boundaries before writing", async () => {
    await renderControls();
    submit();
    expect(screen.getByText(en["uploads.reasonRequired"])).toBeVisible();
    reason();
    fireEvent.change(document.getElementById("uploads-medical-default")!, {
      target: { value: "11" },
    });
    submit();
    expect(screen.getByText(en["uploads.aboveCapacity"])).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("uploads-medical-default")!, {
      target: { value: "0.1" },
    });
    submit();
    expect(screen.getByText(en["uploads.wholeBytes"])).toBeVisible();
  });
  it("saves Persian numbers with one-byte type control and refreshes the saved policy", async () => {
    const view = await renderControls(policy(), "fa");
    reason();
    fireEvent.change(document.getElementById("uploads-medical-default")!, {
      target: { value: "۱" },
    });
    fireEvent.change(document.getElementById("uploads-medical-type-0-unit")!, {
      target: { value: "bytes" },
    });
    fireEvent.change(document.getElementById("uploads-medical-type-0")!, {
      target: { value: "۳۲" },
    });
    submit();
    await waitFor(() => expect(view.reload).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].body).toMatchObject({
      value: { max_bytes: 1048576, type_limits: { "application/pdf": 32 } },
    });
    expect(await screen.findByText(fa["uploads.saved"])).toBeVisible();
    expect(screen.getByRole("heading", { name: fa["uploads.medical"] })).toBeVisible();
  });
  it("preserves draft on policy shifts and requires explicit reload before writing", async () => {
    const view = await renderControls();
    reason();
    fireEvent.change(document.getElementById("uploads-medical-default")!, {
      target: { value: "2" },
    });
    const next = {
      ...policy("uploads.medical", "b".repeat(64)),
      default_max_bytes: 1048576,
      policy: { allowed_mime_types: ["video/webm"], max_bytes_by_mime: { "video/webm": 1048576 } },
    };
    view.reload.mockResolvedValue(next);
    view.update(next);
    expect(screen.getByText(en["uploads.changed"])).toBeVisible();
    expect(document.getElementById("uploads-medical-default")).toHaveValue("2");
    expect(screen.getByRole("button", { name: en["uploads.save"] })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en["uploads.reload"] }));
    await screen.findByLabelText("video/webm");
    expect(document.getElementById("uploads-medical-default")).toHaveValue("1");
    expect(document.getElementById("uploads-medical-reason")).toHaveValue("");
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects stale saves without automatic replay and keeps invalid saved policy warnings explicit", async () => {
    execute.mockRejectedValue(failure(422, { expected_revision: ["Policy changed"] }));
    await renderControls({ ...policy(), policy_state: "review_required" });
    expect(screen.getByText(en["uploads.reviewRequired"])).toBeVisible();
    reason();
    submit();
    await screen.findByText(en["uploads.changed"]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: en["uploads.save"] })).toBeDisabled();
  });
  it("requires a reason for reset and submits an empty override", async () => {
    await renderControls();
    fireEvent.click(screen.getByRole("button", { name: en["uploads.reset"] }));
    expect(execute).not.toHaveBeenCalled();
    reason();
    fireEvent.change(document.getElementById("uploads-medical-default")!, {
      target: { value: "invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: en["uploads.reset"] }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0][0].body).toMatchObject({
      value: [],
      reason: "Synthetic policy review",
    });
  });
  it("uses existing password confirmation and preserves the reviewed revision on retry", async () => {
    execute
      .mockRejectedValueOnce(failure(423))
      .mockResolvedValue(response({ data: { confirmed_at: "now", expires_at: "later" } }));
    const view = await renderControls();
    reason();
    submit();
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Current password", { exact: false }), {
      target: { value: "synthetic-password" },
    });
    fireEvent.submit(document.getElementById("recent-password-form")!);
    await waitFor(() => expect(view.reload).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls.map(([request]) => request.path)).toEqual([
      "/api/admin/settings/uploads.medical",
      "/api/auth/confirm-password",
      "/api/admin/settings/uploads.medical",
    ]);
    expect(execute.mock.calls[0][0].body).toEqual(execute.mock.calls[2][0].body);
    expect(JSON.stringify(view.store.getState())).not.toContain("synthetic-password");
  });
  it("does not replay cancelled password confirmation", async () => {
    execute.mockRejectedValueOnce(failure(423));
    await renderControls();
    reason();
    submit();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["uploads.save"] })).toBeEnabled(),
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("reports a committed save even if refresh fails and retries only the read", async () => {
    const view = await renderControls();
    view.reload.mockRejectedValueOnce(failure(503));
    reason();
    submit();
    await screen.findByText(en["uploads.saved"]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["uploads.reload"] })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: en["uploads.save"] })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en["uploads.reload"] }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["uploads.save"] })).toBeEnabled(),
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("aborts pending writes when the form unmounts", async () => {
    let resolve!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = await renderControls();
    reason();
    submit();
    const signal = execute.mock.calls[0][0].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve(response());
    });
    expect(view.reload).not.toHaveBeenCalled();
  });
  it.each(["admin", "patient", "doctor"])("starts no upload-setting read for %s", async (role) => {
    profile.roles = [role];
    await renderControls(policy(), "en", true);
    expect(screen.getByText(en["uploads.rootOnly"])).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it("root page reads each section and discards drafts on an identity change", async () => {
    execute.mockImplementation(async (request) =>
      response({
        data: {
          setting: policy(
            request.path.endsWith("public_media") ? "uploads.public_media" : "uploads.medical",
          ),
        },
      }),
    );
    const view = await renderControls(policy(), "en", true);
    await screen.findByRole("heading", { name: en["uploads.medical"] });
    await screen.findByRole("heading", { name: en["uploads.public"] });
    expect(execute.mock.calls.map(([request]) => request.method)).toEqual(["GET", "GET"]);
    reason();
    profile.id = 2;
    view.update(policy());
    await waitFor(() => expect(document.getElementById("uploads-medical-reason")).toHaveValue(""));
  });
});
