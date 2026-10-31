import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import DoctorCreate, { PatientCreate } from "../pages/Users/ClinicalAccountCreate";
import { HospitalCreate } from "../pages/Administration/Hospitals";
import DoctorLocationEditor from "../pages/Users/DoctorLocationEditor";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";
import { clinicalRequest, hospitalList } from "../modules/checkupino/profiles/onboarding";

const { execute, listeners, actor } = vi.hoisted(() => ({
  execute: vi.fn<(r: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  listeners: new Set<() => void>(),
  actor: { id: 2, status: "authenticated" },
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => ({ status: actor.status, identity: { id: actor.id } }),
  },
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({
    capabilities: { manageMarketplaceUsers: true, manageAdminIdentities: false },
  }),
}));
const publicId = "01m4hfgan168p6q5ftp528285f";
const revision = "a".repeat(64);
const hospital = {
  public_id: publicId,
  name: "Synthetic clinic",
  slug: "synthetic-clinic",
  timezone: "Asia/Tehran",
  country_code: null,
  province: null,
  city: "Synthetic city",
  address: null,
  contact_phone: null,
  contact_email: null,
  website_url: null,
  profile: null,
  is_active: true,
  archived: false,
};
const practice = {
  owner_id: 4,
  revision,
  verified: true,
  professional: {
    specialty_ids: [1],
    primary_specialty_id: 1,
    experience_years: 4,
    fee: 500000,
    bio: "",
  },
  specialty_options: [{ id: 1, name: "Synthetic specialty" }],
  workplaces: [],
};
const reply = (data: unknown): TransportResponse<unknown> => ({
  status: 200,
  headers: {},
  data: { data },
});
const context = {
  revision,
  specialties: [{ id: 1, name: "Synthetic specialty" }],
  verification_on_create: true,
};
const receipt = (accountRole: "doctor" | "patient") => ({
  user: {
    id: 10,
    public_id: publicId,
    role: accountRole,
    email: null,
    phone: null,
    NID: null,
    birth_date: null,
  },
});
async function page(element: ReactNode, lang = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: lang,
    keySeparator: false,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>{element}</I18nextProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  execute.mockReset();
  listeners.clear();
  sessionStorage.clear();
  actor.id = 2;
  actor.status = "authenticated";
});
const enter = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const accountFields = (copy = en) => {
  for (const [key, value] of Object.entries({
    first_name: "Synthetic",
    last_name: "Person",
    email: "synthetic@example.test",
    phone: "09000000123",
    birth_date: "1990-01-01",
    NID: "1234567890",
    password: "cedar lantern valley compass",
    password_confirmation: "cedar lantern valley compass",
  }))
    enter(copy[("onboarding.field." + key) as keyof typeof copy], value);
  enter(copy["adminManage.reason"], "Synthetic onboarding reason");
  fireEvent.click(screen.getByRole("checkbox", { name: copy["doctorPractice.confirm"] }));
};

describe("approved clinical onboarding", () => {
  it("passes search and paging through the transport query contract rather than the plain path", async () => {
    execute.mockResolvedValue(reply({ hospitals: [hospital], page: 2, last_page: 2, total: 21 }));
    await clinicalRequest(
      "GET",
      "/api/admin/hospitals?q=Synthetic%20city&page=2",
      hospitalList,
      new AbortController().signal,
    );
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      path: "/api/admin/hospitals",
      query: { q: "Synthetic city", page: "2" },
    });
  });
  it.each(["en", "fa"])(
    "creates a fixed-role patient with input-only credentials in %s",
    async (lang) => {
      execute.mockImplementation(async (r) =>
        reply(r.method === "GET" ? context : receipt("patient")),
      );
      await page(<PatientCreate />, lang);
      const copy = lang === "fa" ? fa : en;
      await waitFor(() =>
        expect(screen.getByLabelText(copy["onboarding.field.first_name"])).toBeEnabled(),
      );
      accountFields(copy);
      fireEvent.click(screen.getByRole("button", { name: copy["users.create"] }));
      await screen.findByText(copy["users.saved"]);
      const body = execute.mock.calls.find(([r]) => r.method === "POST")?.[0].body;
      expect(body).toMatchObject({ role: "patient", expected_revision: revision, confirmed: true });
      expect(body).not.toHaveProperty("verified");
      expect(body).not.toHaveProperty("accountRole");
      expect(screen.queryByDisplayValue("cedar lantern valley compass")).toBeNull();
      expect(sessionStorage.length).toBe(0);
    },
  );
  it("requires an explicit verification choice and active specialty for a new doctor", async () => {
    execute.mockImplementation(async (r) =>
      reply(r.method === "GET" ? context : receipt("doctor")),
    );
    await page(<DoctorCreate />);
    await screen.findByRole("option", { name: "Synthetic specialty" });
    expect(screen.getByRole("checkbox", { name: en["onboarding.verifyDoctor"] })).not.toBeChecked();
    accountFields();
    enter(en["doctorPractice.primary"], "1");
    enter(en["onboarding.field.fee"], "650000");
    fireEvent.click(screen.getByRole("checkbox", { name: en["onboarding.verifyDoctor"] }));
    fireEvent.click(screen.getByRole("button", { name: en["users.create"] }));
    await screen.findByText(en["users.saved"]);
    expect(execute.mock.calls.find(([r]) => r.method === "POST")?.[0].body).toMatchObject({
      role: "doctor",
      specialty_id: 1,
      fee: 650000,
      verified: true,
    });
  });
  it("does not dispatch a stale account form and requires explicit fresh context", async () => {
    let reads = 0;
    execute.mockImplementation(async () =>
      reply({ ...context, revision: ++reads === 1 ? revision : "b".repeat(64) }),
    );
    await page(<PatientCreate />);
    await waitFor(() =>
      expect(screen.getByLabelText(en["onboarding.field.first_name"])).toBeEnabled(),
    );
    accountFields();
    fireEvent.click(screen.getByRole("button", { name: en["users.create"] }));
    await screen.findByText(en["onboarding.uncertain"]);
    expect(execute.mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  });
  it("keeps uncertain delivery marked without automatically repeating a credential write", async () => {
    execute.mockImplementation(async (r) => {
      if (r.method === "POST") throw new TransportError(classifyWireFailure({ status: 503 }));
      return reply(context);
    });
    await page(<PatientCreate />);
    await waitFor(() =>
      expect(screen.getByLabelText(en["onboarding.field.first_name"])).toBeEnabled(),
    );
    accountFields();
    fireEvent.click(screen.getByRole("button", { name: en["users.create"] }));
    await screen.findByText(en["onboarding.uncertain"]);
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1);
    expect(sessionStorage.getItem("checkupino.clinical.pending.v1.2.account-patient")).toBe("1");
    expect(
      sessionStorage.getItem("checkupino.clinical.pending.v1.2.account-patient"),
    ).not.toContain("cedar");
  });
  it("cancels password confirmation without replay or loss of the unsaved form", async () => {
    execute.mockImplementation(async (r) => {
      if (r.method === "POST") throw new TransportError(classifyWireFailure({ status: 423 }));
      return reply(context);
    });
    await page(<PatientCreate />);
    await waitFor(() =>
      expect(screen.getByLabelText(en["onboarding.field.first_name"])).toBeEnabled(),
    );
    accountFields();
    fireEvent.click(screen.getByRole("button", { name: en["users.create"] }));
    await screen.findByLabelText(/Current password/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(execute.mock.calls.filter(([r]) => r.method === "POST")).toHaveLength(1);
    expect(screen.getByLabelText(en["onboarding.field.first_name"])).toHaveValue("Synthetic");
    await waitFor(() => expect(sessionStorage.length).toBe(0));
  });
  it.each(["en", "fa"])(
    "creates an organizational hospital with no price field in %s",
    async (lang) => {
      execute.mockImplementation(async (r) =>
        reply(r.method === "GET" ? { revision } : { hospital }),
      );
      await page(<HospitalCreate />, lang);
      const copy = lang === "fa" ? fa : en;
      await screen.findByLabelText(copy["onboarding.field.name"]);
      enter(copy["onboarding.field.name"], "Synthetic clinic");
      enter(copy["onboarding.field.slug"], "synthetic-clinic");
      enter(copy["adminManage.reason"], "Synthetic organization creation");
      fireEvent.click(screen.getByRole("checkbox", { name: copy["doctorPractice.confirm"] }));
      fireEvent.click(screen.getByRole("button", { name: copy["users.save"] }));
      await screen.findByText(copy["users.saved"]);
      expect(execute.mock.calls.find(([r]) => r.method === "POST")?.[0].body).toMatchObject({
        name: "Synthetic clinic",
        timezone: "Asia/Tehran",
        confirmed: true,
      });
      expect(execute.mock.calls.find(([r]) => r.method === "POST")?.[0].body).not.toHaveProperty(
        "price",
      );
    },
  );
  it("adds only the current doctor's selected location and explicitly priced services", async () => {
    actor.id = 4;
    execute.mockImplementation(async (r) => {
      if (r.path.startsWith("/api/doctor/location-options"))
        return reply({
          owner_id: 4,
          revision,
          default_price: 500000,
          hospitals: [
            {
              public_id: publicId,
              name: "Synthetic clinic",
              city: null,
              address: null,
              timezone: "Asia/Tehran",
              revision,
            },
          ],
          page: 1,
          last_page: 1,
          services: [{ id: 7, title: "Synthetic service", currency: "IRR" }],
        });
      return reply(r.method === "POST" ? { ...practice, revision: "b".repeat(64) } : practice);
    });
    const saved = vi.fn<() => void>();
    await page(
      <DoctorLocationEditor
        practice={practice}
        workplaceId={0}
        onClose={() => {}}
        onSaved={saved}
        onRefresh={() => {}}
      />,
    );
    await screen.findByRole("option", { name: "Synthetic clinic" });
    enter(en["booking.workplace"], publicId);
    fireEvent.click(screen.getByRole("checkbox", { name: "Synthetic service" }));
    enter(en["onboarding.servicePrice"], "650000");
    enter(en["adminManage.reason"], "Synthetic own location");
    fireEvent.click(screen.getByRole("checkbox", { name: en["doctorPractice.confirm"] }));
    fireEvent.click(screen.getByRole("button", { name: en["users.save"] }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    const request = execute.mock.calls.find(([r]) => r.method === "POST")?.[0];
    expect(request?.path).toBe("/api/doctor/locations");
    expect(request?.body).toEqual({
      hospital_public_id: publicId,
      hospital_revision: revision,
      expected_revision: revision,
      services: [{ id: 7, price: 650000, currency: "IRR" }],
      reason: "Synthetic own location",
      confirmed: true,
    });
  });
  it("aborts a pending context read on account invalidation before credential dispatch", async () => {
    let reads = 0;
    execute.mockImplementation(async (r) => {
      if (++reads === 1) return reply(context);
      return new Promise((_, reject) =>
        r.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        ),
      );
    });
    await page(<PatientCreate />);
    await waitFor(() =>
      expect(screen.getByLabelText(en["onboarding.field.first_name"])).toBeEnabled(),
    );
    accountFields();
    fireEvent.click(screen.getByRole("button", { name: en["users.create"] }));
    await waitFor(() => expect(reads).toBe(2));
    actor.status = "guest";
    for (const listener of listeners) listener();
    expect(execute.mock.calls.some(([r]) => r.method === "POST")).toBe(false);
    expect(execute.mock.calls[1]?.[0].signal?.aborted).toBe(true);
  });
});
