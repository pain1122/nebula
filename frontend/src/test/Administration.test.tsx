import { configureStore } from "@reduxjs/toolkit";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import {
  adaptAdminCollection,
  adaptMedicalDetail,
  adaptSubmission,
  collectionAdapter,
} from "../modules/checkupino/administration/api";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { checkupinoApi } from "../modules/checkupino/query/api";
import { parseServerTableQuery, serverTableBackendParameters } from "../modules/checkupino/table";
import MedicalRequests, { Questionnaires } from "../pages/Administration/Collections";
import MedicalDetail from "../pages/Administration/MedicalDetail";
import QuestionnaireDetail from "../pages/Administration/QuestionnaireDetail";
import ActionDialog from "../pages/Administration/ActionDialog";
import SubmissionDetail from "../pages/Administration/SubmissionDetail";

const { identity, execute } = vi.hoisted(() => ({
  identity: { roles: ["admin"], editorValid: true },
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ capabilities: adminCapabilitiesFor(identity) }),
}));
vi.mock("../modules/checkupino/api/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../pages/Administration/QuestionnaireRichTextEditor", async () => {
  const { useEffect } = await import("react");
  return {
    default: function MockRichTextEditor({
      label,
      value,
      onChange,
      onValidityChange,
      disabled,
    }: {
      label: string;
      value: string | null;
      onChange: (value: string) => void;
      onValidityChange: (valid: boolean) => void;
      disabled: boolean;
    }) {
      useEffect(() => {
        onValidityChange(identity.editorValid);
      }, [onValidityChange]);
      return (
        <textarea
          aria-label={label}
          value={value ?? ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    },
  };
});
const publicId = "01m44ah0fxjqz5mbpbabe1qj44";
const stamp = "2026-10-11T04:30:00+00:00";
const requestRow = {
  public_id: publicId,
  reservation: { id: 8, public_id: publicId },
  patient: { id: 4, name: "Synthetic patient" },
  doctor: { id: 2, name: "Synthetic doctor" },
  requested_by: { id: 5, name: "Synthetic doctor" },
  title: "Synthetic medical request",
  instructions: null,
  request_type: "document_upload",
  status: "open",
  received_count: 1,
  awaiting_checks_count: 1,
  eligible_count: 0,
  published_count: 0,
  due_at: null,
  reviewed_at: null,
  closed_at: null,
  created_at: stamp,
  retention_until: "2099-10-11T04:30:00+00:00",
};
const definition = {
  id: 3,
  public_id: publicId,
  title: "Synthetic definition",
  slug: "synthetic-definition",
  status: "published",
  version: 1,
  content_html: "<script>never execute</script>",
  cover_image_url: null,
  created_at: stamp,
  updated_at: stamp,
  published_at: stamp,
  questions: [
    {
      text: "Saved question",
      sort_order: 0,
      choices: [{ text: "Saved choice", score: 2, sort_order: 0 }],
    },
  ],
  recommendations: [],
};
const wire = (data: unknown) => ({
  data,
  meta: { pagination: { current_page: 1, last_page: 1, per_page: 20, total: 1 } },
});
const response = (data: unknown): TransportResponse<unknown> => ({
  data,
  headers: {},
  status: 200,
});
const stores: ReturnType<typeof makeStore>[] = [];
const makeStore = () =>
  configureStore({
    middleware: (getDefault) => getDefault().concat(checkupinoApi.middleware),
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
  });
async function page(
  path = "/medical-requests",
  locale: "en" | "fa" = "en",
  child?: React.ReactNode,
) {
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
  return render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter initialEntries={[path]}>
          {child ?? (
            <Routes>
              <Route path="/medical-requests" element={<MedicalRequests />} />
              <Route path="/medical-requests/:requestId" element={<MedicalDetail />} />
              <Route path="/questionnaires" element={<Questionnaires />} />
              <Route path="/questionnaires/:questionnaireId" element={<QuestionnaireDetail />} />
              <Route
                path="/questionnaire-submissions/:submissionId"
                element={<SubmissionDetail />}
              />
            </Routes>
          )}
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
}
beforeEach(() => {
  identity.roles = ["admin"];
  identity.editorValid = true;
  execute
    .mockReset()
    .mockImplementation(async (request) =>
      response(
        request.path === "/api/admin/medical-requests"
          ? wire([requestRow])
          : request.path.startsWith("/api/admin/medical-requests/")
            ? { data: { medical_request: requestRow, files: [], reports: [] } }
            : request.path === "/api/admin/questionnaires"
              ? wire([definition])
              : { data: definition },
      ),
    );
});
afterEach(() => {
  act(() =>
    stores.splice(0).forEach((store) => store.dispatch(checkupinoApi.util.resetApiState())),
  );
});

describe("administration contracts", () => {
  it("rejects duplicate/malformed pages, medical scope and dishonest counts", () => {
    expect(() => adaptAdminCollection(wire([requestRow, requestRow]), "medical-requests")).toThrow(
      "Duplicate",
    );
    expect(() =>
      adaptAdminCollection(wire([{ ...requestRow, awaiting_checks_count: 2 }]), "medical-requests"),
    ).toThrow("summary");
    expect(() =>
      adaptMedicalDetail(
        { data: { medical_request: requestRow, files: [], reports: [] } },
        "01m44ah0fxjqz5mbpbabe1qj45",
      ),
    ).toThrow("binding");
    expect(() =>
      adaptMedicalDetail(
        {
          data: {
            medical_request: requestRow,
            files: [
              {
                public_id: publicId,
                label: null,
                mime_type: "application/pdf",
                size_bytes: 1,
                available: false,
                created_at: stamp,
              },
            ],
            reports: [],
          },
        },
        publicId,
      ),
    ).toThrow(/Invalid/);
  });
  it("allowlists URL filters and preserves exact doctor/patient IDs", () => {
    const adapter = collectionAdapter("medical-requests");
    const query = parseServerTableQuery(
      new URLSearchParams(
        "doctor_id=2&user_id=4&stage=awaiting_checks&status=unknown&from=2026-02-30&token=never&per_page=999",
      ),
      adapter,
    );
    expect(serverTableBackendParameters(query, adapter)).toMatchObject({
      doctor_id: "2",
      user_id: "4",
      stage: "awaiting_checks",
      per_page: "100",
    });
    expect(query.filters).not.toHaveProperty("from");
    expect(query.filters).not.toHaveProperty("status");
    expect(query.filters).not.toHaveProperty("token");
  });
  it("pairs every admin locale key and refuses placeholder Farsi", () => {
    for (const key of Object.keys(en).filter((key) => key.startsWith("adminManage."))) {
      expect(fa).toHaveProperty(key);
      expect(fa[key as keyof typeof fa]).toMatch(/[\u0600-\u06ff]/);
    }
  });
  it("rejects submission identity swaps and strips token internals", () => {
    const row = {
      public_id: publicId,
      questionnaire_id: 3,
      questionnaire_version: 1,
      questionnaire: { public_id: publicId, title: "Saved title", slug: "saved" },
      user_id: 4,
      owner_type: "account",
      submitter_name: "Saved name",
      submitter_phone: null,
      total_score: 2,
      result_title: "Saved result",
      submitted_at: stamp,
      retention_until: null,
      answers: [],
      answers_available: true,
      guest_token_hash: "never",
    };
    expect(adaptSubmission({ data: row }, publicId)).not.toHaveProperty("guest_token_hash");
    expect(() => adaptSubmission({ data: row }, "01m44ah0fxjqz5mbpbabe1qj45")).toThrow("binding");
    expect(() =>
      adaptAdminCollection(wire([{ ...row, owner_type: "guest" }]), "questionnaire-submissions"),
    ).toThrow("owner");
  });
});
describe("administration controls", () => {
  it("keeps another recommendation editor and its draft when an earlier recommendation is removed", async () => {
    execute.mockResolvedValue(
      response({
        data: {
          ...definition,
          recommendations: [
            {
              title: "First",
              body_html: "<p>First advice</p>",
              min_score: 0,
              max_score: 2,
              priority: 0,
              conditions: null,
            },
            {
              title: "Second",
              body_html: "<p>Second advice</p>",
              min_score: 3,
              max_score: 5,
              priority: 1,
              conditions: null,
            },
          ],
        },
      }),
    );
    await page("/questionnaires/3");
    const first = await screen.findByDisplayValue("<p>First advice</p>");
    const second = screen.getByDisplayValue("<p>Second advice</p>");
    const group = first.closest("fieldset");
    expect(group).not.toBeNull();
    await userEvent.click(
      within(group as HTMLElement).getByRole("button", { name: en["adminManage.remove"] }),
    );
    expect(screen.getByDisplayValue("<p>Second advice</p>")).toBe(second);
    expect(screen.queryByDisplayValue("<p>First advice</p>")).toBeNull();
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
  });
  it("keeps the save action closed when a rich-text field cannot validate", async () => {
    identity.editorValid = false;
    await page("/questionnaires/3");
    await screen.findByDisplayValue("Saved question");
    expect(screen.getByRole("button", { name: en["adminManage.save"] })).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
  });
  it("sends formatted content through the ordinary fresh-version/reason controls without rewriting saved answers", async () => {
    await page("/questionnaires/3");
    await screen.findByDisplayValue("Saved question");
    const content = screen.getByRole("textbox", { name: en["adminManage.content_html"] });
    await userEvent.clear(content);
    await userEvent.type(content, "<p><strong>Formatted introduction</strong></p>");
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.save"] }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    await userEvent.type(
      screen.getByLabelText(en["adminManage.reason"]),
      "Synthetic content review",
    );
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() =>
      expect(execute.mock.calls.filter(([request]) => request.method === "PUT")).toHaveLength(1),
    );
    const write = execute.mock.calls.find(([request]) => request.method === "PUT")?.[0];
    expect(write?.body).toMatchObject({
      content_html: "<p><strong>Formatted introduction</strong></p>",
      expected_version: 1,
      reason: "Synthetic content review",
    });
    expect(
      execute.mock.calls.some(([request]) => request.path.includes("questionnaire-submissions")),
    ).toBe(false);
  });
  it.each(["en", "fa"] as const)(
    "keeps saved answers/owner/version in grouped cards independently of the current definition (%s)",
    async (locale) => {
      execute.mockResolvedValue(
        response({
          data: {
            public_id: publicId,
            questionnaire_id: 3,
            questionnaire_version: 1,
            questionnaire: { public_id: publicId, title: "Saved title", slug: "saved" },
            user_id: 4,
            owner_type: "account",
            submitter_name: "Saved owner",
            submitter_phone: null,
            total_score: 2,
            result_title: "Saved result",
            result_body_html: "<script>snapshot only</script>",
            submitted_at: stamp,
            retention_until: null,
            answers_available: true,
            answers: [
              { question_text: "Original question", choice_text: "Original answer", score: 2 },
            ],
          },
        }),
      );
      const { container } = await page("/questionnaire-submissions/" + publicId, locale);
      expect(await screen.findByText("Original question")).toBeVisible();
      const answer = container.querySelector('[data-questionnaire-answer="true"]');
      expect(answer).toHaveTextContent("Original answer");
      expect(screen.getByText("Saved owner")).toBeVisible();
      expect(screen.getByText("<script>snapshot only</script>")).toBeVisible();
      expect(container.querySelector("script")).toBeNull();
      expect(screen.getByRole("link", { name: "Saved title" })).toHaveAttribute(
        "href",
        "/questionnaires/3",
      );
      expect(container.querySelectorAll("section.card")).toHaveLength(4);
      expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
    },
  );
  it("keeps unavailable saved answers out of the detail grid", async () => {
    execute.mockResolvedValue(
      response({
        data: {
          public_id: publicId,
          questionnaire_id: 3,
          questionnaire_version: 1,
          questionnaire: { public_id: publicId, title: "Saved title", slug: "saved" },
          user_id: 4,
          owner_type: "account",
          submitter_name: "Saved owner",
          submitter_phone: null,
          total_score: 2,
          result_title: "Saved result",
          submitted_at: stamp,
          retention_until: stamp,
          answers_available: false,
          answers: [],
          result_body_html: null,
        },
      }),
    );
    const { container } = await page("/questionnaire-submissions/" + publicId);
    expect(await screen.findByText(en["adminManage.expiredSnapshot"])).toBeVisible();
    expect(container.querySelector("[data-questionnaire-answer]")).toBeNull();
    expect(container.querySelectorAll("section.card")).toHaveLength(3);
  });
  it.each(["patient", "doctor"])("does not fetch administrative data for %s", async (role) => {
    identity.roles = [role];
    await page();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it("uses server filters and refuses review/download for quarantine", async () => {
    await page("/medical-requests?doctor_id=2&user_id=4&stage=awaiting_checks");
    expect(await screen.findByText("Synthetic medical request")).toBeVisible();
    expect(execute.mock.calls[0][0].query).toMatchObject({
      doctor_id: "2",
      user_id: "4",
      stage: "awaiting_checks",
    });
    await userEvent.click(screen.getByRole("link", { name: "Synthetic medical request" }));
    expect(await screen.findByText(en["adminManage.noEligibleFiles"])).toBeVisible();
    expect(
      screen.queryByRole("button", { name: en["medical.startReview"] }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en["medical.download"] })).not.toBeInTheDocument();
  });
  it("opens a reasoned archive confirmation without sending a write", async () => {
    await page("/questionnaires/3", "fa");
    expect(await screen.findByDisplayValue("Saved question")).toBeVisible();
    expect(screen.getByDisplayValue("Saved question")).toHaveAttribute("dir", "auto");
    expect(screen.getByDisplayValue("synthetic-definition")).toHaveAttribute("dir", "ltr");
    expect(screen.getByDisplayValue("<script>never execute</script>")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: fa["adminManage.archive"] }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: fa["adminManage.confirm"] })).toBeDisabled();
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
  });
  it("blocks a stale questionnaire before its write", async () => {
    await page("/questionnaires/3");
    await screen.findByDisplayValue("Saved question");
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.archive"] }));
    await userEvent.type(screen.getByLabelText(en["adminManage.reason"]), "Synthetic reason");
    execute.mockImplementation(async () => response({ data: { ...definition, version: 2 } }));
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en["adminManage.rejected"]);
    expect(execute.mock.calls.every(([request]) => request.method === "GET")).toBe(true);
  });
  it("blocks duplicates and retries after ambiguous dispatch", async () => {
    const saved = vi.fn<() => void>();
    execute.mockRejectedValue(new TransportError(classifyWireFailure({ status: 503 })));
    await page(
      "/",
      "en",
      <ActionDialog
        target={{
          title: "Synthetic action",
          path: "/api/admin/questionnaires",
          method: "POST",
          body: {},
          verify: async () => {},
        }}
        onClose={() => {}}
        onSaved={saved}
      />,
    );
    await userEvent.type(screen.getByLabelText(en["adminManage.reason"]), "Synthetic reason");
    await userEvent.click(screen.getByRole("button", { name: en["adminManage.confirm"] }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(en["adminManage.uncertain"]),
    );
    expect(screen.getByRole("button", { name: en["adminManage.confirm"] })).toBeDisabled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });
});
