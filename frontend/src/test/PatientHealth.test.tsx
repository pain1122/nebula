import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import PatientHealth from "../pages/Users/PatientHealth";
import {
  healthChanges,
  healthProfile,
  type HealthProfile,
} from "../modules/checkupino/profiles/health";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";

const { execute, actor, listeners } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  actor: { id: 4, status: "authenticated" },
  listeners: new Set<() => void>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => ({ status: actor.status, identity: { id: actor.id } }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));
vi.mock("../modules/checkupino/auth/recentPassword", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/auth/recentPassword")>()),
  recentPasswordCoordinator: { run: async (operation: () => Promise<void>) => operation() },
}));
const id = "01m4hfgan168p6q5ftp528285f";
const initial = (): HealthProfile => ({
  owner_id: id,
  revision: "a".repeat(64),
  schema_version: 1,
  version: 0,
  recorded_at: null,
  facts: {},
  provenance: {},
  measurements: {},
  age: null,
  bmi: null,
  history: { weight: [], height: [] },
  history_truncated: { weight: false, height: false },
  catalog: {
    version: "health-2026-10-22.1",
    terms: [
      {
        id: "condition.diabetes",
        kind: "condition",
        active: true,
        labels: { en: "Diabetes", fa: "دیابت" },
      },
      { id: "allergy.latex", kind: "allergy", active: true, labels: { en: "Latex", fa: "لاتکس" } },
    ],
  },
});
const reply = (data: unknown): TransportResponse<unknown> => ({
  status: 200,
  headers: {},
  data: { data },
});
async function page(locale = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <PatientHealth ownerId={id} />
    </I18nextProvider>,
  );
}
beforeEach(() => {
  execute.mockReset();
  actor.id = 4;
  actor.status = "authenticated";
  sessionStorage.clear();
  localStorage.clear();
});

describe("patient health foundation", () => {
  it.each(["en", "fa"])(
    "renders an honest empty summary and cancels unsaved edits in %s",
    async (locale) => {
      execute.mockResolvedValue(reply(initial()));
      await page(locale);
      const labels = locale === "fa" ? fa : en;
      fireEvent.click(await screen.findByRole("button", { name: labels["health.edit"] }));
      expect(screen.getByLabelText(labels["health.gender"])).toHaveValue("");
      fireEvent.change(screen.getByLabelText(labels["health.gender"]), {
        target: { value: "female" },
      });
      fireEvent.click(screen.getByRole("button", { name: labels["users.cancel"] }));
      expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: labels["health.edit"] }));
      expect(screen.getByLabelText(labels["health.gender"])).toHaveValue("");
    },
  );

  it("submits stable taxonomy IDs after a fresh read, without labels or unrelated facts", async () => {
    execute.mockResolvedValue(reply(initial()));
    await page();
    fireEvent.click(await screen.findByRole("button", { name: en["health.edit"] }));
    fireEvent.change(screen.getAllByLabelText(en["health.reportedStatus"])[0], {
      target: { value: "yes" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Diabetes" }));
    fireEvent.change(screen.getByLabelText(en["health.searchTerms"]), {
      target: { value: "no match" },
    });
    expect(screen.getByRole("checkbox", { name: "Diabetes" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: en["health.confirm"] }));
    fireEvent.click(screen.getByRole("button", { name: en["users.save"] }));
    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(1),
    );
    const put = execute.mock.calls.find(([r]) => r.method === "PUT")?.[0];
    expect(put?.body).toEqual({
      expected_revision: "a".repeat(64),
      catalog_version: "health-2026-10-22.1",
      confirmed: true,
      changes: { conditions: { status: "yes", codes: ["condition.diabetes"] } },
      measurements: {},
    });
    expect(execute.mock.calls.slice(0, 3).map(([r]) => r.method)).toEqual(["GET", "GET", "PUT"]);
    expect(
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    ).not.toContain("condition.diabetes");
  });

  it("locks an ambiguous delivery and never automatically repeats the save", async () => {
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") throw new TransportError(classifyWireFailure({ status: 503 }));
      return reply(initial());
    });
    await page();
    fireEvent.click(await screen.findByRole("button", { name: en["health.edit"] }));
    fireEvent.change(screen.getByLabelText(en["health.gender"]), { target: { value: "male" } });
    fireEvent.click(screen.getByRole("checkbox", { name: en["health.confirm"] }));
    fireEvent.click(screen.getByRole("button", { name: en["users.save"] }));
    await screen.findByText(en["health.uncertain"]);
    expect(screen.getByRole("button", { name: en["users.save"] })).toBeDisabled();
    expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(1);
    expect(sessionStorage.getItem("checkupino.clinical.pending.v1.4.patient-health")).toBe("1");
  });

  it("refuses an edit after a changed fresh revision", async () => {
    let gets = 0;
    execute.mockImplementation(async () =>
      reply({ ...initial(), revision: (++gets === 1 ? "a" : "b").repeat(64) }),
    );
    await page();
    fireEvent.click(await screen.findByRole("button", { name: en["health.edit"] }));
    fireEvent.change(screen.getByLabelText(en["health.gender"]), { target: { value: "female" } });
    fireEvent.click(screen.getByRole("checkbox", { name: en["health.confirm"] }));
    fireEvent.click(screen.getByRole("button", { name: en["users.save"] }));
    await screen.findByText(en["health.uncertain"]);
    expect(execute.mock.calls.filter(([r]) => r.method === "PUT")).toHaveLength(0);
  });

  it("aborts a dispatched operation when the authenticated account changes", async () => {
    let pending: AbortSignal | undefined;
    execute.mockImplementation(async (request) => {
      if (request.method === "PUT") {
        pending = request.signal;
        return new Promise(() => {});
      }
      return reply(initial());
    });
    const view = await page();
    fireEvent.click(await screen.findByRole("button", { name: en["health.edit"] }));
    fireEvent.change(screen.getByLabelText(en["health.gender"]), { target: { value: "male" } });
    fireEvent.click(screen.getByRole("checkbox", { name: en["health.confirm"] }));
    fireEvent.click(screen.getByRole("button", { name: en["users.save"] }));
    await waitFor(() => expect(pending).toBeDefined());
    act(() => {
      actor.id = 5;
      listeners.forEach((listener) => listener());
    });
    expect(pending?.aborted).toBe(true);
    view.unmount();
  });

  it("does not display a foreign owner's health response", async () => {
    execute.mockResolvedValue(
      reply({ ...initial(), owner_id: "other-owner", facts: { gender: "female" } }),
    );
    await page();
    await screen.findByText(en["health.unavailable"]);
    expect(screen.queryByText(en["health.female"])).toBeNull();
    expect(screen.queryByRole("button", { name: en["health.edit"] })).toBeNull();
  });

  it("does not reassert unchanged measurements and normalizes Persian quantities", () => {
    const base = initial();
    base.measurements.weight = {
      id,
      metric: "weight",
      unit: "kg",
      value: "63.50",
      measured_on: "2026-10-01",
      recorded_at: "2026-10-22T00:00:00Z",
      source: "self_report",
    };
    expect(
      healthChanges(
        base,
        { smoking: "no" },
        { weight: { value: "۶۳.۵", measured_on: "2026-10-01" }, height: null },
      ),
    ).toEqual({ changes: { smoking: "no" }, measurements: {} });
    expect(
      healthChanges(base, {}, { weight: null, height: { value: "۱۷۲", measured_on: "2026-10-01" } })
        .measurements,
    ).toEqual({ weight: null, height: { value: "172", measured_on: "2026-10-01" } });
  });

  it("rejects unsupported schema and private extra fields rather than silently adapting them", () => {
    expect(healthProfile.safeParse({ ...initial(), schema_version: 2 }).success).toBe(false);
    expect(healthProfile.safeParse({ ...initial(), password: "private" }).success).toBe(false);
  });
});
