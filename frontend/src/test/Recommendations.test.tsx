import { fireEvent, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import {
  parseCondition,
  personalSuggestions,
  rulePreviewHtml,
  ruleRequest,
  mutationReceipt,
  type RuleBoard,
  type RuleDetail,
} from "../modules/checkupino/recommendations/api";
import ConditionEditor from "../pages/Recommendations/ConditionEditor";
import RuleEditor from "../pages/Recommendations/RuleEditor";
import RuleReview from "../pages/Recommendations/RuleReview";
import { RuleAccess } from "../pages/Recommendations/Shared";
import PersonalSuggestions from "../pages/PatientArticles/PersonalSuggestions";

const state = vi.hoisted(() => ({
  roles: ["admin"],
  personal: { state: "unavailable", items: [] } as unknown,
  fetching: false,
  error: false,
  request: vi.fn<(...args: unknown[]) => void>(),
  hook: vi.fn<(...args: unknown[]) => void>(),
  run: vi.fn<(...args: unknown[]) => void>(),
  busy: false,
  uncertain: false,
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ userProfile: { id: "synthetic", roles: state.roles } }),
}));
vi.mock("../modules/checkupino/profiles/onboarding", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/profiles/onboarding")>()),
  clinicalRequest: state.request,
}));
vi.mock("../modules/checkupino/profiles/useClinicalWrite", () => ({
  useClinicalRead: () => ({ data: null, error: false }),
  useClinicalWrite: () => ({
    busy: state.busy,
    uncertain: state.uncertain,
    failure: null,
    refresh: vi.fn<(...args: unknown[]) => void>(),
    run: state.run,
    password: {
      request: null,
      submit: vi.fn<(...args: unknown[]) => void>(),
      cancel: vi.fn<(...args: unknown[]) => void>(),
    },
  }),
}));
vi.mock("../pages/Administration/content/Shared", () => ({
  useContent: () => ({
    data: { data: [], pagination: { last_page: 1 } },
    busy: false,
    error: false,
  }),
}));
vi.mock("../modules/checkupino/recommendations/api", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/recommendations/api")>()),
  usePersonalSuggestionsQuery: (...args: unknown[]) => {
    state.hook(...args);
    return { currentData: state.personal, isFetching: state.fetching, isError: state.error };
  },
}));
const article = "01k7g3sjhb0000000000000001",
  version = "01k7g3sjhb0000000000000002",
  asset = "01k7g3sjhb0000000000000003",
  rule = "01k7g3sjhb0000000000000004";
const hash = "a".repeat(64);
const catalog: RuleBoard["catalog"] = {
  version: "health-2026-10-22.1",
  terms: [
    {
      id: "condition.diabetes",
      kind: "condition",
      active: true,
      labels: { en: "Diabetes", fa: "دیابت" },
    },
  ],
};
const board: RuleBoard = {
  catalog,
  items: [],
  reviewers: [],
  grants: [],
  designation_candidates: [],
  create_revision: hash,
  grant_revision: null,
  pagination: { current_page: 1, last_page: 1, total: 0 },
};
const content = {
  definition: {
    schema_version: 1 as const,
    health_catalog_version: catalog.version,
    include: { field: "smoking", operator: "eq", value: "yes", max_age_days: 30 },
    exclude: null,
  },
  translations: {
    en: { title: "Synthetic title", explanation: "Synthetic explanation" },
    fa: { title: "عنوان ساختگی", explanation: "توضیح ساختگی" },
  },
  population: { en: "Synthetic population", fa: "جمعیت ساختگی" },
  limitations: { en: "Synthetic limits", fa: "محدودیت ساختگی" },
  sources: [],
  priority: 0,
  targets: [
    { kind: "article" as const, id: article, version_id: version, version: 1, content_hash: hash },
  ],
};
const detail: RuleDetail = {
  id: rule,
  slug: "synthetic-rule",
  state: "draft",
  working_version: 1,
  author: { id: article, name: "Synthetic author" },
  staff: true,
  assigned: false,
  publication_eligible: false,
  can_publish: false,
  can_review: false,
  assigned_reviewer: null,
  reviews: [],
  target_previews: [],
  versions: [],
  published_version: null,
  contexts: { save: hash },
  working: {
    ...content,
    id: version,
    version: 1,
    content_hash: hash,
    recorded_at: "2026-11-05T08:30:00Z",
  },
};
async function view(children: React.ReactNode, lang = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: lang,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>,
  );
}
beforeEach(() => {
  state.roles = ["admin"];
  state.personal = { state: "unavailable", items: [] };
  state.fetching = false;
  state.error = false;
  state.busy = false;
  state.uncertain = false;
  state.request.mockReset();
  state.run.mockReset();
  state.hook.mockClear();
});
describe("Reviewed recommendation contracts", () => {
  it.each(["en", "fa"])(
    "requires explicit independent-review inputs before a doctor submits in %s",
    async (lang) => {
      state.roles = ["doctor"];
      const copy = lang === "fa" ? fa : en;
      await view(
        <RuleReview
          board={board}
          detail={{
            ...detail,
            staff: false,
            state: "in_review",
            can_review: true,
            contexts: { approve: hash, reject: hash, withdraw: hash },
          }}
          refresh={vi.fn<() => void>()}
        />,
        lang,
      );
      const approve = screen.getByRole("button", { name: copy["recommendationRules.approve"] });
      fireEvent.click(approve);
      expect(state.run).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(copy["recommendationRules.assessment"]), {
        target: { value: "Synthetic independent assessment" },
      });
      fireEvent.change(screen.getByLabelText(copy["recommendationRules.validUntil"]), {
        target: { value: "2026-12-01T12:00" },
      });
      fireEvent.click(screen.getByRole("checkbox", { name: copy["recommendationRules.attested"] }));
      fireEvent.click(approve);
      expect(state.run).toHaveBeenCalledOnce();
      const save = state.run.mock.calls[0][2] as (signal: AbortSignal) => Promise<unknown>;
      await save(new AbortController().signal);
      expect(state.request.mock.calls[0][0]).toBe("POST");
      expect(state.request.mock.calls[0][1]).toBe(
        `/api/doctor/recommendation-rules/${rule}/actions`,
      );
      expect(state.request.mock.calls[0][4]).toMatchObject({
        action: "approve",
        expected_revision: hash,
        assessment: "Synthetic independent assessment",
        attested: true,
        valid_until_local: "2026-12-01T12:00",
      });
      expect(
        screen.queryByRole("button", { name: copy["recommendationRules.publish"] }),
      ).not.toBeInTheDocument();
    },
  );
  it("keeps clinical approval out of an ordinary admin's controls", async () => {
    await view(<RuleReview board={board} detail={detail} refresh={vi.fn<() => void>()} />);
    expect(screen.queryByRole("button", { name: "Approve exact version" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish reviewed version" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request independent review" })).toBeDisabled();
  });
  it("bounds expression depth, shared node budget and explicit freshness", () => {
    const leaf = {
      field: "bmi",
      operator: "gte",
      value: "22.86",
      unit: "kg/m2",
      max_age_days: 7,
      max_measurement_gap_days: 1,
    };
    expect(parseCondition(leaf)).toEqual(leaf);
    expect(() => parseCondition({ ...leaf, max_age_days: null })).toThrow(Error);
    expect(() => parseCondition({ ...leaf, max_measurement_gap_days: undefined })).toThrow(Error);
    expect(() => parseCondition({ all: [{ all: [{ all: [{ all: [leaf] }] }] }] })).toThrow(Error);
    expect(() => parseCondition({ all: [leaf] }, 1, { value: 64 })).toThrow(Error);
    expect(() => parseCondition({ ...leaf, patient_id: article })).toThrow(Error);
  });
  it("rejects wrong units, reversed bounds, scientific numbers and cross-kind terms", () => {
    const leaf = {
      field: "weight_kg",
      operator: "between",
      value: ["60", "70"],
      unit: "kg",
      max_age_days: 7,
    };
    expect(() => parseCondition({ ...leaf, unit: "lb" })).toThrow(Error);
    expect(() => parseCondition({ ...leaf, value: ["70", "60"] })).toThrow(Error);
    expect(() => parseCondition({ ...leaf, value: ["6e1", "70"] })).toThrow(Error);
    expect(() =>
      parseCondition({
        field: "conditions",
        operator: "contains",
        value: "allergy.drug",
        max_age_days: 7,
      }),
    ).toThrow(Error);
  });
  it("blocks requests outside the bounded rule API before transport", async () => {
    await expect(
      ruleRequest("POST", "/api/admin/articles", mutationReceipt, new AbortController().signal, {}),
    ).rejects.toThrow(Error);
    await expect(
      ruleRequest(
        "PUT",
        `/api/doctor/recommendation-rules/${rule}`,
        mutationReceipt,
        new AbortController().signal,
        {},
      ),
    ).rejects.toThrow(Error);
    expect(state.request).not.toHaveBeenCalled();
  });
  it("rewrites only referenced images into exact scoped reviewer URLs and removes active HTML", () => {
    const preview: RuleDetail["target_previews"][number] = {
      id: article,
      version_id: version,
      version: 1,
      languages: ["en"],
      thumbnail: null,
      images: [{ id: asset, language: "en" }],
      sources: [],
      translations: {
        en: {
          title: "Synthetic",
          summary: "",
          body_html: `<script>alert(1)</script><p onclick="alert(1)">Text</p><figure class="image"><img src="/api/admin/article-media/${asset}/content" onerror="alert(1)"></figure><img src="https://example.com/tracker">`,
        },
      },
    };
    const html = rulePreviewHtml(preview, "en", rule, 2, true);
    expect(html).toContain(
      `/api/doctor/recommendation-rules/${rule}/media/${asset}?article_id=${article}&amp;rule_version=2&amp;language=en`,
    );
    expect(html).not.toMatch(/<script|onclick|onerror|example\.com|\/api\/admin\/article-media/);
  });
  it("rejects private staff fields and staff image URLs in patient results", () => {
    expect(() =>
      personalSuggestions.parse({ state: "matched", patient_id: article, items: [] }),
    ).toThrow(Error);
    expect(() =>
      personalSuggestions.parse({
        state: "matched",
        items: [
          {
            article: {},
            explanation: "Text",
            explanation_language: "en",
            rule_version_id: version,
            health: "private",
          },
        ],
      }),
    ).toThrow(Error);
  });
  it.each(["patient", "guest"])("denies %s the staff/reviewer subtree", async (role) => {
    state.roles = role === "guest" ? [] : [role];
    await view(
      <RuleAccess>
        <p>Protected child</p>
      </RuleAccess>,
    );
    expect(screen.queryByText("Protected child")).not.toBeInTheDocument();
  });
  it("edits only controlled terms without arbitrary medical free text", async () => {
    const onChange = vi.fn<(...args: unknown[]) => void>();
    await view(
      <ConditionEditor
        node={{
          field: "conditions",
          operator: "contains",
          value: "condition.diabetes",
          max_age_days: 30,
        }}
        catalog={catalog}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("option", { name: "Diabetes" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Comparison"), { target: { value: "reported_none" } });
    expect(onChange).toHaveBeenCalledWith({
      field: "conditions",
      operator: "reported_none",
      max_age_days: 30,
    });
  });
  it.each(["en", "fa"])(
    "keeps Save/Cancel adjacent, switches complete localized text and submits a guarded draft in %s",
    async (lang) => {
      const accepted = vi.fn<(...args: unknown[]) => void>(),
        cancel = vi.fn<(...args: unknown[]) => void>();
      await view(
        <RuleEditor
          board={board}
          detail={detail}
          accepted={accepted}
          cancel={cancel}
          reload={vi.fn<(...args: unknown[]) => void>()}
        />,
        lang,
      );
      const copy = lang === "fa" ? fa : en;
      const save = screen.getByRole("button", { name: copy["recommendationRules.save"] });
      const close = screen.getByRole("button", { name: copy["recommendationRules.cancel"] });
      expect(save.parentElement).toBe(close.parentElement);
      expect(save.closest("fieldset")).toBe(close.closest("fieldset"));
      expect(screen.queryByText(/password|رمز عبور/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: copy["patientArticles.language.en"] }));
      expect(screen.getByLabelText(copy["recommendationRules.titleLabel"])).toHaveValue(
        "Synthetic title",
      );
      fireEvent.submit(save.closest("form")!);
      expect(state.run).toHaveBeenCalledOnce();
      const invocation = state.run.mock.calls[0];
      expect(invocation[1]).toBe(hash);
      for (const offset of [0, 2, 3]) expect(invocation[offset]).toBeTypeOf("function");
      fireEvent.click(close);
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
  it("locks draft actions after uncertain delivery", async () => {
    state.uncertain = true;
    await view(
      <RuleEditor
        board={board}
        detail={detail}
        accepted={vi.fn<(...args: unknown[]) => void>()}
        cancel={vi.fn<(...args: unknown[]) => void>()}
        reload={vi.fn<(...args: unknown[]) => void>()}
      />,
    );
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload current state" })).toBeEnabled();
  });
  it("keeps unavailable suggestions quiet and binds refresh to the article and selected language", async () => {
    await view(<PersonalSuggestions articleId={article} language="fa" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(state.hook).toHaveBeenCalledWith(
      { articleId: article, language: "fa" },
      expect.objectContaining({
        refetchOnFocus: true,
        pollingInterval: 60000,
        skipPollingIfUnfocused: true,
      }),
    );
  });
  it("shows private reviewed explanations without putting criteria or reasons in URLs", async () => {
    state.personal = {
      state: "matched",
      items: [
        {
          article: { id: article, title: "Suggested article", content_language: "en" },
          explanation: "Private reviewed explanation",
          explanation_language: "en",
          rule_version_id: version,
        },
      ],
    };
    await view(<PersonalSuggestions articleId={rule} language="en" />);
    expect(screen.getByRole("link", { name: "Suggested article" })).toHaveAttribute(
      "href",
      `/my/articles/${article}`,
    );
    expect(screen.getByText("Private reviewed explanation")).toBeInTheDocument();
  });
});
