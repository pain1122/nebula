import { fireEvent, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import PatientArticles from "../pages/PatientArticles";
import ArticleDetail from "../pages/PatientArticles/ArticleDetail";
import {
  libraryQuerySchema,
  parsePatientArticle,
  parsePatientArticlePage,
  patientArticleHtml,
  patientImageUrl,
} from "../modules/checkupino/patientArticles/api";

const state = vi.hoisted(() => ({
  list: vi.fn<(...args: unknown[]) => unknown>(),
  detail: vi.fn<(...args: unknown[]) => unknown>(),
  roles: ["patient"],
}));
vi.mock("../modules/checkupino/recommendations/api", () => ({
  usePersonalSuggestionsQuery: () => ({
    currentData: { state: "unavailable", items: [] },
    isFetching: false,
    isError: false,
  }),
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ userProfile: { id: 8, roles: state.roles } }),
}));
vi.mock("../modules/checkupino/patientArticles/api", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/patientArticles/api")>()),
  usePatientArticlesQuery: state.list,
  usePatientArticleQuery: state.detail,
  usePatientArticleTermsQuery: () => ({
    currentData: { items: [], pagination: { last_page: 1 } },
    isFetching: false,
  }),
}));
const articleId = "01k7g3sjhb0000000000000001",
  versionId = "01k7g3sjhb0000000000000002",
  assetId = "01k7g3sjhb0000000000000003";
const imagePath = `/api/my/articles/${articleId}/media/${assetId}?version_id=${versionId}&language=en`;
const card = {
  id: articleId,
  version_id: versionId,
  title: "Published title",
  summary: "Published summary",
  content_language: "en" as const,
  fallback_used: false,
  categories: [],
  tags: [],
  thumbnail: null,
};
const detail = {
  ...card,
  author: { display_name: "Actual author" },
  body_html: "<p>Published body.</p>",
  source_links: [],
};
const page = { current_page: 1, last_page: 1, per_page: 12, total: 1 };
async function view(path = "/my/articles", locale = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: locale,
    fallbackLng: "en",
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/my/articles" element={<PatientArticles />} />
          <Route path="/my/articles/:articleId" element={<ArticleDetail />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}
beforeEach(() => {
  state.roles = ["patient"];
  state.list.mockReset().mockReturnValue({
    currentData: { items: [card], pagination: page },
    isFetching: false,
    isError: false,
    refetch: vi.fn<() => void>(),
  });
  state.detail.mockReset().mockReturnValue({
    currentData: detail,
    isFetching: false,
    isError: false,
    refetch: vi.fn<() => void>(),
  });
});

describe("patient published-article contract", () => {
  it("refuses staff fields and image bindings to other articles, versions or origins", () => {
    expect(parsePatientArticle({ success: true, data: detail }).title).toBe("Published title");
    expect(() => parsePatientArticle({ success: true, data: { ...detail, working: {} } })).toThrow(
      /unrecognized_keys/,
    );
    expect(() =>
      parsePatientArticlePage({
        success: true,
        data: [
          {
            ...card,
            thumbnail: {
              content_path: "/api/admin/article-media/123/content",
              alt: "",
              width: 1,
              height: 1,
            },
          },
        ],
        meta: { pagination: page },
      }),
    ).toThrow("Patient image binding rejected.");
    expect(patientImageUrl(imagePath, articleId, versionId, "en")).toContain(imagePath);
    for (const path of [
      "https://external.test" + imagePath,
      imagePath + "&extra=1",
      imagePath.replace(versionId, assetId),
      imagePath.replace("language=en", "language=fa"),
    ])
      expect(() => patientImageUrl(path, articleId, versionId, "en")).toThrow(
        "Patient image binding rejected.",
      );
  });
  it("renders only allowed article-bound images and inert links/formatting", () => {
    const html = patientArticleHtml(
      `<p onclick="evil()">Text<script>evil()</script><img src="${imagePath}" onerror="evil()"><img src="/api/admin/article-media/${assetId}/content"><img src="https://external.test/x"><a href="javascript:evil()">Link</a></p>`,
      card,
    );
    expect(html).toContain("/api/my/articles/");
    expect(html).not.toMatch(/script|onclick|onerror|api\/admin|external.test|javascript:/);
  });
  it("bounds query state instead of accepting staff filters or malformed IDs", () => {
    expect(libraryQuerySchema.parse({}).per_page).toBe(12);
    for (const query of [{ status: "draft" }, { page: "0" }, { per_page: "25" }, { tag_id: "123" }])
      expect(libraryQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("retained patient blog views", () => {
  it("recommends other published articles below the author and falls back when no shared term matches", async () => {
    const other = { ...card, id: assetId, title: "Another published guide" };
    state.detail.mockReturnValue({
      currentData: { ...detail, tags: [{ id: assetId, label: "Guide" }] },
      isFetching: false,
      isError: false,
    });
    state.list.mockImplementation((...args: unknown[]) => {
      const query = args[0] as { tag_id?: string };
      return {
        currentData: { items: query.tag_id ? [card] : [card, other], pagination: page },
        isFetching: false,
        isError: false,
      };
    });
    await view(`/my/articles/${articleId}`);
    const section = screen.getByRole("region", { name: "Recommended reading" });
    expect(section).toHaveTextContent("General reading from our published library.");
    expect(screen.getByRole("link", { name: "Another published guide" })).toHaveAttribute(
      "href",
      `/my/articles/${assetId}`,
    );
    expect(section.querySelectorAll("a")).toHaveLength(1);
    expect(state.list).toHaveBeenCalledWith(
      expect.objectContaining({ tag_id: assetId, per_page: 4 }),
      expect.anything(),
    );
  });
  it("keeps image layouts while removing arbitrary classes and styles", () => {
    const html = patientArticleHtml(
      `<figure class="image image-style-side position-fixed" style="position:fixed"><img src="${imagePath}"><figcaption>Caption</figcaption></figure>`,
      card,
    );
    expect(html).toContain('class="image image-style-side"');
    expect(html).toContain("<figcaption>Caption</figcaption>");
    expect(html).not.toContain("position");
  });
  it("keeps library query state on article links and shows a neutral missing cover", async () => {
    await view("/my/articles?q=heart");
    expect(screen.getByRole("link", { name: "Published title" })).toHaveAttribute(
      "href",
      `/my/articles/${articleId}?q=heart`,
    );
    expect(screen.getByRole("figure", { name: "Image unavailable" })).toBeVisible();
    expect(screen.queryByText("Add New")).not.toBeInTheDocument();
  });
  it("uses the author sidebar beside the body and keeps recommendations inactive", async () => {
    await view(`/my/articles/${articleId}?q=heart`);
    expect(screen.getByText("Actual author").closest("aside")).toHaveClass("col-lg-3");
    expect(screen.getByText("Published body.").closest(".col-lg-9")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to articles" })).toHaveAttribute(
      "href",
      "/my/articles?q=heart",
    );
    expect(screen.queryByRole("button", { name: /publish|edit|comment/i })).not.toBeInTheDocument();
  });
  it("labels complete-translation fallback inside the selected Farsi shell", async () => {
    state.detail.mockReturnValue({
      currentData: { ...detail, fallback_used: true },
      isFetching: false,
      isError: false,
      refetch: vi.fn<() => void>(),
    });
    await view(`/my/articles/${articleId}`, "fa");
    expect(screen.getByText("موجود به زبان انگلیسی")).toBeVisible();
    expect(screen.getByText("Published body.").closest("[lang]")).toHaveAttribute("lang", "en");
  });
  it("replaces a failed cover without retrying it automatically", async () => {
    state.list.mockReturnValue({
      currentData: {
        items: [
          {
            ...card,
            thumbnail: { content_path: imagePath, alt: "Published cover", width: 1, height: 1 },
          },
        ],
        pagination: page,
      },
      isFetching: false,
      isError: false,
      refetch: vi.fn<() => void>(),
    });
    await view();
    fireEvent.error(screen.getByRole("img", { name: "Published cover" }));
    expect(screen.getByRole("figure", { name: "Image unavailable" })).toBeVisible();
    expect(screen.queryByRole("img", { name: "Published cover" })).not.toBeInTheDocument();
  });
  it("does not mount patient query consumers for other roles", async () => {
    state.roles = ["doctor"];
    await view();
    expect(screen.getByRole("alert")).toHaveTextContent("You do not have access");
    expect(state.list).not.toHaveBeenCalled();
  });
  it("does not continue showing an old article while a new request fails", async () => {
    state.detail.mockReturnValue({
      currentData: detail,
      isFetching: false,
      isError: true,
      refetch: vi.fn<() => void>(),
    });
    await view(`/my/articles/${articleId}`);
    expect(screen.queryByText("Published body.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
