import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { checkupinoApi } from "../modules/checkupino/query/api";
import ClinicalDashboard from "../pages/DashboardEcommerce/ClinicalDashboard";
import QuestionnaireWorkspace from "../pages/Questionnaire/QuestionnaireWorkspace";

const { execute, identity } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  identity: { id: 4, name: "Synthetic owner", roles: ["patient"] },
}));
vi.mock("../Layouts/ShellAuthContext", () => ({ useShellAuth: () => ({ userProfile: identity }) }));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const id = "01m4hfgan168p6q5ftp528285f";
const profile = () => ({
  mode: "self",
  revision: "a".repeat(64),
  editable_fields: ["first_name", "last_name"],
  user: {
    id: identity.id,
    public_id: id,
    name: identity.name,
    first_name: "Synthetic",
    last_name: "owner",
    role: identity.roles[0],
    account_state: "active",
    created_at: null,
  },
  summary: {
    reservations: 1,
    upcoming: 1,
    completed: 0,
    medical_requests: 2,
    published_reports: 2,
    questionnaire_submissions: 1,
  },
  reservations: [
    {
      public_id: id,
      status: "confirmed",
      starts_at: "2026-10-18T04:30:00Z",
      ends_at: "2026-10-18T05:00:00Z",
      timezone: "Asia/Tehran",
    },
  ],
  requests: [],
  reports: [],
  submissions: [],
  activity: [],
});
const reply = (data: unknown): TransportResponse<unknown> => ({ data, status: 200, headers: {} });
const stores: ReturnType<typeof configureStore>[] = [];
const page = async (child: ReactNode, locale = "en", path = "/") => {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const store = configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
  stores.push(store);
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>{child}</MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
};
beforeEach(() => {
  identity.id = 4;
  identity.roles = ["patient"];
  execute.mockReset();
  sessionStorage.clear();
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
});

describe("role-owned clinical dashboard and published questionnaire catalog", () => {
  const savedId = "01m4hfgan168p6q5ftp528285f";
  const saved = {
    public_id: savedId,
    questionnaire_title: "Saved version title",
    questionnaire_version: 7,
    submitted_at: "2026-10-11T10:00:00Z",
    total_score: 2,
    result_title: "Saved result",
  };
  it.each(["en", "fa"])(
    "opens the owner's saved snapshot and returns to history in %s",
    async (locale) => {
      execute.mockImplementation(async (request) =>
        request.path.endsWith(savedId)
          ? reply({
              data: {
                ...saved,
                owner_id: 4,
                answers_available: true,
                answers: [{ question_text: "Original question?", choice_text: "Original choice" }],
                result_body_html:
                  '<p>Saved advice</p><script>unsafe()</script><img src="https://untrusted.invalid/x">',
              },
            })
          : reply({
              data: { owner_id: 4, items: [saved] },
              meta: { pagination: { current_page: 1, last_page: 1, total: 1 } },
            }),
      );
      await page(<QuestionnaireWorkspace />, locale, "/my/questionnaire?view=submissions");
      const copy = locale === "fa" ? fa : en;
      fireEvent.click(
        await screen.findByRole("link", { name: copy["questionnaire.viewSubmission"] }),
      );
      await screen.findByText("Original question?");
      expect(screen.getByText("Original choice")).toBeInTheDocument();
      expect(screen.getByText("Saved advice")).toBeInTheDocument();
      expect(screen.getByText("Saved advice")).toHaveAttribute("dir", "auto");
      expect(document.querySelector("img,script")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: copy["questionnaire.backToHistory"] }));
      await screen.findByRole("link", { name: copy["questionnaire.viewSubmission"] });
      expect(
        execute.mock.calls.every(
          ([request]) =>
            request.method === "GET" &&
            request.path.startsWith("/api/my/questionnaire-submissions"),
        ),
      ).toBe(true);
    },
  );
  it("hides retained cache from a different identity and refuses malformed IDs without a fetch", async () => {
    execute.mockResolvedValue(
      reply({
        data: {
          ...saved,
          owner_id: 8,
          answers_available: true,
          answers: [{ question_text: "PRIVATE", choice_text: "SECRET" }],
          result_body_html: "PRIVATE",
        },
      }),
    );
    const first = await page(
      <QuestionnaireWorkspace />,
      "en",
      `/my/questionnaire?view=submissions&submission=${savedId}`,
    );
    await screen.findByRole("alert");
    expect(screen.queryByText("PRIVATE")).toBeNull();
    first.unmount();
    execute.mockClear();
    await page(
      <QuestionnaireWorkspace />,
      "en",
      "/my/questionnaire?view=submissions&submission=42",
    );
    await screen.findByRole("alert");
    expect(execute).not.toHaveBeenCalled();
  });
  it("shows retention expiry without stale answers and preserves server paging", async () => {
    execute.mockImplementation(async (request) =>
      request.path.endsWith(savedId)
        ? reply({
            data: {
              ...saved,
              owner_id: 4,
              answers_available: false,
              answers: [],
              result_body_html: null,
            },
          })
        : reply({
            data: { owner_id: 4, items: [saved] },
            meta: { pagination: { current_page: 2, last_page: 3, total: 25 } },
          }),
    );
    await page(<QuestionnaireWorkspace />, "en", "/my/questionnaire?view=submissions&page=2");
    fireEvent.click(await screen.findByRole("link", { name: en["questionnaire.viewSubmission"] }));
    await screen.findByText(en["questionnaire.expiredAnswers"]);
    fireEvent.click(screen.getByRole("button", { name: en["questionnaire.backToHistory"] }));
    fireEvent.click(await screen.findByRole("button", { name: en["booking.next"] }));
    await waitFor(() =>
      expect(execute.mock.calls.some(([request]) => request.query?.page === 3)).toBe(true),
    );
  });
  it.each([
    [false, "en"],
    [false, "fa"],
    [true, "en"],
    [true, "fa"],
  ] as const)("shows only owner links for doctor=%s in %s", async (doctor, locale) => {
    identity.roles = [doctor ? "doctor" : "patient"];
    execute.mockImplementation(async (request) =>
      request.path === "/api/panel-profile"
        ? reply({ data: profile() })
        : reply({
            success: true,
            data: {
              owner_id: 4,
              scope: "doctor_confirmed",
              from: String(request.query?.from),
              until: String(request.query?.until),
              timezone: "Asia/Tehran",
              limit: 200,
              has_more: false,
              appointments: [],
            },
            meta: { read_only: true, generated_at: "2026-10-18T00:00:00Z" },
          }),
    );
    await page(<ClinicalDashboard doctor={doctor} />, locale);
    const copy = locale === "fa" ? fa : en;
    const fileLink = await screen.findByRole("link", { name: copy["clinicalHome.openFiles"] });
    expect(fileLink).toHaveAttribute(
      "href",
      (doctor ? "/doctor" : "/my") + "/reservations/" + id + "/medical",
    );
    expect(screen.queryByRole("link", { name: copy["questionnaire.catalog"] }) !== null).toBe(
      !doctor,
    );
    expect(
      execute.mock.calls.every(
        ([request]) =>
          [
            "/api/panel-profile",
            ...(doctor ? ["/api/doctor/dashboard/appointments"] : []),
          ].includes(request.path) && request.method === "GET",
      ),
    ).toBe(true);
    expect(document.querySelector('a[href="/patients"]')).toBeNull();
  });
  it("refuses a different user's summary rather than displaying cached data", async () => {
    execute.mockResolvedValue(
      reply({ data: { ...profile(), user: { ...profile().user, id: 8 } } }),
    );
    await page(<ClinicalDashboard doctor={false} />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: en["clinicalHome.openFiles"] })).toBeNull();
  });
  it.each(["en", "fa"])(
    "lists published cards with inert placeholders and opens the selected slug in %s",
    async (locale) => {
      execute.mockImplementation(async (request) => {
        if (request.path === "/api/questionnaires")
          return reply({
            data: [
              {
                id: 7,
                slug: "second-screen",
                title: "Synthetic second screen",
                questions_count: 1,
                cover_image_url: "https://untrusted.invalid/image.png",
              },
            ],
            meta: { current_page: 1, last_page: 1, total: 1 },
          });
        return reply({
          id: 7,
          slug: "second-screen",
          version: 1,
          title: "Synthetic second screen",
          content_html: "<p>Test</p>",
          questions: [
            {
              id: 8,
              text: "Synthetic question",
              choices: [{ id: 9, text: "Choice", sort_order: 0 }],
              sort_order: 0,
            },
          ],
        });
      });
      await page(<QuestionnaireWorkspace />, locale);
      const copy = locale === "fa" ? fa : en;
      fireEvent.click(await screen.findByRole("button", { name: copy["questionnaire.start"] }));
      await screen.findByLabelText(copy["questionnaire.name"]);
      expect(document.querySelector("img")).toBeNull();
      expect(
        execute.mock.calls.some(
          ([request]) => request.path === "/api/questionnaires/second-screen",
        ),
      ).toBe(true);
      expect(
        execute.mock.calls.some(([request]) => request.path.includes("demo-heart-health-screen")),
      ).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: copy["questionnaire.backToList"] }));
      await waitFor(() => expect(screen.queryByLabelText(copy["questionnaire.name"])).toBeNull());
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
});
