import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { Provider } from "react-redux";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import { TransportError, classifyWireFailure } from "../modules/checkupino/api/wire";
import { checkupinoApi } from "../modules/checkupino/query/api";
import { questionnaireApi } from "../modules/checkupino/questionnaire/api";
import {
  completeAnswers,
  demoTranslationKey,
  questionnaireText,
} from "../modules/checkupino/questionnaire/definition";
import type { QuestionnaireDefinition } from "../modules/checkupino/questionnaire/definition";
import PatientQuestionnaire from "../pages/Questionnaire/PatientQuestionnaire";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
const definition: QuestionnaireDefinition = {
  id: 1,
  slug: "demo-heart-health-screen",
  version: 1,
  title: "Demo Heart Health Screen",
  content_html: "<p>This demo is informational and does not replace medical advice.</p>",
  questions: [
    {
      id: 1,
      text: "Do you experience chest discomfort during activity?",
      sort_order: 1,
      choices: [
        { id: 1, text: "Never", sort_order: 1 },
        { id: 2, text: "Sometimes", sort_order: 2 },
      ],
    },
    {
      id: 2,
      text: "Do you have a family history of early heart disease?",
      sort_order: 2,
      choices: [
        { id: 3, text: "No", sort_order: 1 },
        { id: 4, text: "Yes", sort_order: 2 },
      ],
    },
  ],
};
const receipt = {
  submission_id: "01M4KZKE1XC59AH523YZ1VZ6RN",
  total_score: 2,
  recommendation: {
    title: "Continue routine prevention",
    body_html: "<p>Maintain routine preventive care.</p>",
  },
};
const response = (data: unknown): TransportResponse<unknown> => ({
  data,
  status: 200,
  headers: {},
});
const storeFor = () =>
  configureStore({
    reducer: { [checkupinoApi.reducerPath]: checkupinoApi.reducer },
    middleware: (defaults) => defaults().concat(checkupinoApi.middleware),
  });
const stores: ReturnType<typeof storeFor>[] = [];
const renderView = async (locale: "en" | "fa" = "en") => {
  const translations = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await translations.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, fa: { translation: fa } },
  });
  const store = storeFor();
  stores.push(store);
  const view = render(
    <Provider store={store}>
      <I18nextProvider i18n={translations}>
        <MemoryRouter>
          <PatientQuestionnaire />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  await screen.findByLabelText(locale === "en" ? "Name" : "نام");
  return view;
};
const fill = () => {
  fireEvent.change(document.querySelector("#questionnaire-name")!, {
    target: { value: "Synthetic patient" },
  });
  fireEvent.change(document.querySelector("#questionnaire-phone")!, {
    target: { value: "09120000000" },
  });
  fireEvent.click(document.querySelector("#questionnaire-choice-2")!);
  fireEvent.click(document.querySelector("#questionnaire-choice-3")!);
};
const submit = () => fireEvent.submit(document.querySelector(".page-content form")!);
const writes = () =>
  execute.mock.calls.map(([request]) => request).filter((request) => request.method === "POST");

beforeEach(() => {
  sessionStorage.clear();
  execute.mockReset();
  execute.mockImplementation(async (request) =>
    response(request.method === "GET" ? definition : receipt),
  );
});
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(checkupinoApi.util.resetApiState());
  vi.restoreAllMocks();
});

describe("Approved fixed questionnaire", () => {
  it.each(["en", "fa"] as const)(
    "renders retained form and server-owned result in %s",
    async (locale) => {
      await renderView(locale);
      fill();
      submit();
      await screen.findByText(locale === "en" ? "Questionnaire submitted" : "پرسشنامه ارسال شد");
      expect(writes()).toHaveLength(1);
      expect(writes()[0].body).toEqual({
        submitter_name: "Synthetic patient",
        submitter_phone: "09120000000",
        answers: [
          { question_id: 1, choice_id: 2 },
          { question_id: 2, choice_id: 3 },
        ],
      });
      expect(execute.mock.calls.filter(([r]) => r.method === "GET")).toHaveLength(2);
      expect(
        screen.getByText(
          locale === "en" ? "Continue routine prevention" : "پیشگیری معمول را ادامه دهید",
        ),
      ).toBeInTheDocument();
      expect(sessionStorage.getItem("checkupino.questionnaire.demo.pending")).toBeNull();
      expect(document.querySelector(".row .col-xl-8 .card")).toBeInTheDocument();
    },
  );
  it("refuses missing answers before the fresh read or write", async () => {
    await renderView();
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent(en["questionnaire.invalid"]);
    expect(writes()).toHaveLength(0);
  });
  it("requires deliberate new answers when the fresh definition changes", async () => {
    await renderView();
    fill();
    execute.mockImplementation(async (request) =>
      response(request.method === "GET" ? { ...definition, version: 2 } : receipt),
    );
    submit();
    await screen.findByText(en["questionnaire.changed"]);
    expect(writes()).toHaveLength(0);
    expect(document.querySelector("#questionnaire-choice-2")).not.toBeChecked();
    fill();
    submit();
    await screen.findByText(en["questionnaire.submitted"]);
    expect(writes()).toHaveLength(1);
  });
  it("blocks duplicate submit events while fresh access is pending", async () => {
    await renderView();
    fill();
    let release!: (value: TransportResponse<unknown>) => void;
    execute.mockImplementation((request) =>
      request.method === "GET"
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.resolve(response(receipt)),
    );
    submit();
    submit();
    await waitFor(() => expect(release).toBeDefined());
    release(response(definition));
    await screen.findByText(en["questionnaire.submitted"]);
    expect(writes()).toHaveLength(1);
  });
  it("retains ambiguous delivery across page remount without replay", async () => {
    const view = await renderView();
    fill();
    execute.mockImplementation(async (request) => {
      if (request.method === "GET") return response(definition);
      throw new TransportError(classifyWireFailure({ message: "Disconnected" }));
    });
    submit();
    await screen.findByText(en["questionnaire.uncertain"]);
    expect(writes()).toHaveLength(1);
    view.unmount();
    await renderView();
    expect(screen.getByText(en["questionnaire.uncertain"])).toBeInTheDocument();
    submit();
    expect(writes()).toHaveLength(1);
  });
  it("allows editing after a definitive validation rejection", async () => {
    await renderView();
    fill();
    execute.mockImplementation(async (request) => {
      if (request.method === "GET") return response(definition);
      throw new TransportError(
        classifyWireFailure({ status: 422, data: { errors: { answers: ["Invalid"] } } }),
      );
    });
    submit();
    await waitFor(() => expect(writes()).toHaveLength(1));
    await waitFor(() =>
      expect(document.querySelector(".page-content fieldset")).not.toBeDisabled(),
    );
    expect(sessionStorage.getItem("checkupino.questionnaire.demo.pending")).toBeNull();
  });
  it("aborts an in-flight submission on unmount and preserves the ambiguous marker", async () => {
    const view = await renderView();
    fill();
    let signal: AbortSignal | undefined;
    execute.mockImplementation((request) => {
      if (request.method === "GET") return Promise.resolve(response(definition));
      signal = request.signal;
      return new Promise(() => {});
    });
    submit();
    await waitFor(() => expect(signal).toBeDefined());
    expect(screen.getByText(en["questionnaire.sending"])).toBeInTheDocument();
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(sessionStorage.getItem("checkupino.questionnaire.demo.pending")).toBe("pending");
  });
  it("does not send when durable duplicate protection is unavailable", async () => {
    await renderView();
    fill();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    submit();
    await waitFor(() =>
      expect(execute.mock.calls.filter(([r]) => r.method === "GET")).toHaveLength(2),
    );
    expect(writes()).toHaveLength(0);
  });
  it("whitelists the exact ordinary submission contract in the adapter", async () => {
    const store = storeFor();
    stores.push(store);
    await store
      .dispatch(
        questionnaireApi.endpoints.submitDemoQuestionnaire.initiate(
          Object.assign(
            {
              submitter_name: "Synthetic",
              submitter_phone: "000",
              answers: [Object.assign({ question_id: 1, choice_id: 2 }, { score: 999 })],
            },
            { user_id: 7, questionnaire_version: 999, total_score: 999 },
          ),
        ),
      )
      .unwrap();
    expect(writes()[0].body).toEqual({
      submitter_name: "Synthetic",
      submitter_phone: "000",
      answers: [{ question_id: 1, choice_id: 2 }],
    });
  });
  it("renders rich text inertly and uses aliases only for exact approved source/version", () => {
    expect(
      questionnaireText(
        '<p>Hello &amp; safe</p><script>secret()</script><img src="https://invalid.test/x" onerror="bad()">',
      ),
    ).toBe("Hello & safe");
    expect(demoTranslationKey(definition, "Never")).toBe("questionnaire.demo.never");
    expect(demoTranslationKey({ ...definition, version: 2 }, "Never")).toBeUndefined();
    expect(demoTranslationKey(definition, "Changed source")).toBeUndefined();
    expect(completeAnswers(definition, { 1: 3, 2: 4 })).toBe(false);
  });
  it("treats malformed success receipts as ambiguous", async () => {
    await renderView();
    fill();
    execute.mockImplementation(async (r) =>
      response(r.method === "GET" ? definition : { ...receipt, submission_id: "" }),
    );
    submit();
    await screen.findByText(en["questionnaire.uncertain"]);
    expect(writes()).toHaveLength(1);
  });
});
