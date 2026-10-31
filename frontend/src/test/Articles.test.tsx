import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportRequest, TransportResponse } from "../core";
import en from "../locales/en.json";
import fa from "../locales/fa.json";
import Articles, {
  ArticleWorkspace,
  NewArticle,
  articleListQuery,
} from "../pages/Administration/content/Articles";
import Taxonomies from "../pages/Administration/content/Taxonomies";
import { adminCapabilitiesFor } from "../modules/checkupino/auth/capabilities";
import { classifyWireFailure, TransportError } from "../modules/checkupino/api/wire";
import {
  contentWrite,
  parseActionContext,
  parseArticle,
  parseDraftContext,
  parsePage,
  parseTermContext,
  readContent,
  termSchema,
  validateArticle,
} from "../modules/checkupino/content/api";
import { applyProductLocale } from "../modules/checkupino/preferences/localization";
import { emptySeo, seoCounterTone, validSeo } from "../modules/checkupino/content/seo";
import { parseScheduleContext, parseScheduleResult } from "../modules/checkupino/content/schedules";
import {
  publicationSchema,
  validPublicationInput,
} from "../modules/checkupino/content/publication";

const { execute, actor, listeners, passwordRun } = vi.hoisted(() => ({
  execute: vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(),
  actor: { id: 1, roles: ["admin"] },
  listeners: new Set<() => void>(),
  passwordRun: vi.fn<(action: () => Promise<unknown>) => Promise<unknown>>(
    async (action: () => Promise<unknown>) => action(),
  ),
}));
vi.mock("../Layouts/ShellAuthContext", () => ({
  useShellAuth: () => ({ capabilities: adminCapabilitiesFor(actor), userProfile: actor }),
}));
vi.mock("../modules/checkupino/api/transport", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/api/transport")>()),
  checkupinoTransport: { request: execute },
}));
vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => ({ status: "authenticated", identity: actor }),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  },
}));
vi.mock("../modules/checkupino/auth/recentPassword", async (original) => ({
  ...(await original<typeof import("../modules/checkupino/auth/recentPassword")>()),
  recentPasswordCoordinator: { run: passwordRun },
}));
vi.mock("../pages/Administration/content/ArticleRichTextEditor", () => ({
  default: function Editor(props: {
    id: string;
    label: string;
    value: string;
    disabled: boolean;
    contentLocale: string;
    onChange: (value: string) => void;
    onValidityChange: (value: boolean | null) => void;
  }) {
    const { onValidityChange } = props;
    useEffect(() => {
      onValidityChange(true);
      return () => onValidityChange(null);
    }, [onValidityChange]);
    return (
      <textarea
        aria-label={props.label + " " + props.contentLocale}
        id={props.id}
        disabled={props.disabled}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
}));

const id = "01j00000000000000000000001";
const oldId = "01j00000000000000000000002";
const versionId = "01j00000000000000000000003";
const termId = "01j00000000000000000000004";
const actorId = "01j00000000000000000000009";
const clock = "2026-10-23 12:00:00";
const term = () => ({
  id: termId,
  version_id: oldId,
  kind: "category",
  slug: "care-category",
  version: 1,
  labels: { en: "Care", fa: "مراقبت" },
  descriptions: {},
  is_active: true,
  parent_id: null,
  actor: { id: actorId, name: "Synthetic author" },
  recorded_at: clock,
});
const version = (number = 2) => ({
  id: number === 1 ? oldId : versionId,
  version: number,
  schema_version: 1,
  translations: {
    en: {
      title: number === 1 ? "Original content" : "Synthetic article",
      summary: "Educational summary",
      body_html: "<p>Safe body</p>",
    },
    fa: { title: "مقاله آزمایشی", summary: "خلاصه آموزشی", body_html: "<p>متن امن</p>" },
  },
  health_catalog_version: "health-2026-10-22.1",
  health_references: [],
  source_links: [],
  taxonomy: [],
  content_hash: String(number).repeat(64),
  publishable_languages: ["en", "fa"],
  actor: { id: actorId, name: "Synthetic author" },
  recorded_at: clock,
});
const article = () => ({
  id,
  slug: "synthetic-article",
  author: { id: actorId, name: "Synthetic author" },
  working_state: "draft",
  status: "published_with_draft",
  has_unpublished_changes: true,
  working: version(),
  published: version(1),
  review: null,
  created_at: clock,
  updated_at: clock,
  archived_at: null,
  email: "PRIVATE MARKER",
});
const health = {
  version: "health-2026-10-22.1",
  terms: [
    {
      id: "condition.diabetes",
      kind: "condition",
      labels: { en: "Diabetes", fa: "دیابت" },
      active: true,
    },
  ],
};
let current: ReturnType<typeof article>;
let revision = "a".repeat(64);
let blocked = false;
const envelope = (data: unknown) => ({
  success: true,
  data,
  meta: { read_only: true, revision, catalog_revision: 1 },
});
const pageWire = (data: unknown[], page = 1) => ({
  ...envelope(data),
  meta: {
    ...envelope(data).meta,
    pagination: { current_page: page, last_page: 1, per_page: 20, total: data.length },
  },
});
const draftContext = (creating: boolean) =>
  envelope({
    id: creating ? null : id,
    current: creating ? null : current,
    revision,
    catalog_revision: 1,
    can_create: creating,
    can_update: !creating,
    can_edit_slug: creating,
    composer_enabled: true,
    scheduling_available: false,
    health_catalog: health,
  });
const termContext = (creating: boolean) =>
  envelope({
    id: creating ? null : termId,
    current: creating ? null : term(),
    revision,
    catalog_revision: 1,
    can_create: creating,
    can_update: !creating,
    can_retire: !creating,
  });
const actionContext = (action: string, source?: string) =>
  envelope({
    action,
    current,
    source: source ? version(1) : null,
    revision,
    catalog_revision: 1,
    review_kind: "editorial",
    eligible: !blocked,
    blockers: blocked ? ["inactive_taxonomy_reference"] : [],
  });
const Location = () => (
  <output aria-label="test route">{useLocation().pathname + useLocation().search}</output>
);
async function mount(path = "/articles", locale: "en" | "fa" = "en") {
  const i18n = Object.assign(createInstance(), {
    reportNamespaces: { addUsedNamespaces: () => {}, getUsedNamespaces: () => [] },
  });
  await i18n.use(initReactI18next).init({
    lng: locale,
    keySeparator: false,
    resources: { en: { translation: en }, fa: { translation: fa } },
    interpolation: { escapeValue: false },
  });
  applyProductLocale(document.documentElement, locale);
  const tree = () => (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/new" element={<NewArticle />} />
          <Route path="/articles/:articleId" element={<ArticleWorkspace />} />
          <Route path="/article-taxonomies" element={<Taxonomies />} />
        </Routes>
        <Location />
      </MemoryRouter>
    </I18nextProvider>
  );
  const view = render(tree());
  return { ...view, i18n, refresh: () => view.rerender(tree()) };
}
beforeEach(() => {
  actor.id = 1;
  actor.roles = ["admin"];
  listeners.clear();
  passwordRun.mockClear();
  current = article();
  revision = "a".repeat(64);
  blocked = false;
  execute.mockReset().mockImplementation(async (request) => {
    let data: unknown;
    if (request.method !== "GET")
      data = request.path.includes("article-taxonomies") ? envelope(term()) : envelope(current);
    else if (request.path.endsWith("/write-context"))
      data = request.path.includes("article-taxonomies")
        ? termContext(request.path === "/api/admin/article-taxonomies/write-context")
        : draftContext(request.path === "/api/admin/articles/write-context");
    else if (request.path.endsWith("/action-context"))
      data = actionContext(
        String(request.query?.action),
        request.query?.source_version_id ? String(request.query.source_version_id) : undefined,
      );
    else if (request.path.endsWith("/events"))
      data = pageWire([
        {
          id: oldId,
          action: "admin.article.version_copied",
          actor: { id: actorId, name: "Synthetic author" },
          before: { version: 1, working_state: "draft", published_version: null },
          after: {
            version: 2,
            working_state: "draft",
            published_version: 1,
            source_version_id: oldId,
          },
          recorded_at: clock,
          kind: "editorial",
          reason: "PRIVATE MARKER",
        },
      ]);
    else if (request.path.endsWith("/versions"))
      data = pageWire(
        request.path.includes("article-taxonomies") ? [term()] : [version(), version(1)],
      );
    else if (request.path.includes("/versions/")) data = envelope(version(1));
    else if (request.path === "/api/admin/articles")
      data = pageWire([current], Number(request.query?.page ?? 1));
    else if (request.path === "/api/admin/article-taxonomies") data = pageWire([term()]);
    else if (request.path.startsWith("/api/admin/article-taxonomies/")) data = envelope(term());
    else data = envelope(current);
    return { data, status: request.method === "POST" ? 201 : 200, headers: {} };
  });
});
const writeCalls = () => execute.mock.calls.filter(([r]) => r.method !== "GET");
async function confirm(locale: "en" | "fa" = "en", editorial = false) {
  const copy = locale === "en" ? en : fa;
  await userEvent.type(
    screen.getByLabelText(copy["adminManage.reason"]),
    "Synthetic content operation",
  );
  await userEvent.click(
    screen.getByRole("checkbox", {
      name: copy[editorial ? "content.composer.confirmReview" : "content.confirmChange"],
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: copy["adminManage.confirm"] }));
}

describe("article and taxonomy administration", () => {
  it("retains actual Farsi publication labels rather than encoding replacement characters", () => {
    const keys = Object.keys(fa).filter(
      (key) => key.startsWith("content.composer.") || key === "adminManage.article-create",
    ) as (keyof typeof fa)[];
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      expect(fa[key]).toMatch(/\p{Script=Arabic}/u);
      expect(fa[key]).not.toMatch(/\?{2,}|\uFFFD/);
    }
  });
  it.each(["en", "fa"] as const)(
    "publishes directly from the %s editor with fresh server context",
    async (locale) => {
      const original = execute.getMockImplementation()!;
      execute.mockImplementation(async (request) => {
        if (request.method !== "GET") {
          const published = {
            ...current,
            working_state: "published",
            status: "published",
            has_unpublished_changes: false,
            published: current.working,
            review: {
              version: current.working.version,
              content_hash: current.working.content_hash,
              actor: { id: actorId, name: "Author" },
              recorded_at: clock,
              kind: "editorial",
            },
          };
          return { data: envelope(published), status: 201, headers: {} };
        }
        return original(request);
      });
      const copy = locale === "en" ? en : fa;
      const view = await mount("/articles/new", locale);
      await screen.findByLabelText(copy["content.composer.action"]);
      fireEvent.change(screen.getByLabelText(copy["content.slug"]), {
        target: { value: "synthetic-editor-publication" },
      });
      fireEvent.change(view.container.querySelector(`#article-title-${locale}`)!, {
        target: { value: "Synthetic education" },
      });
      fireEvent.change(screen.getByLabelText(copy["content.body"] + " " + locale), {
        target: { value: "<p>Safe article content.</p>" },
      });
      await userEvent.selectOptions(
        screen.getByLabelText(copy["content.composer.action"]),
        "publish",
      );
      await userEvent.click(screen.getByRole("button", { name: copy["content.composer.publish"] }));
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(writeCalls()[0][0].body).toMatchObject({ intent: "publish" });
      for (const field of ["confirmed", "editorial_confirmed", "reason"])
        expect(writeCalls()[0][0].body).not.toHaveProperty(field);
      expect(passwordRun).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByLabelText("test route")).toHaveTextContent(`/articles/${id}?edit=1`),
      );
    },
  );

  it("keeps scheduling on the editor with date/time and a truthful unavailable action", async () => {
    await mount("/articles/new");
    await screen.findByLabelText(en["content.composer.action"]);
    expect(screen.queryByLabelText(en["content.schedule.publishOn"])).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(en["content.composer.action"]), "schedule");
    expect(screen.getByLabelText(en["content.schedule.publishOn"])).toBeEnabled();
    expect(screen.getByText(en["content.composer.scheduleUnavailable"])).toHaveProperty(
      "tagName",
      "OUTPUT",
    );
    expect(screen.getByRole("button", { name: en["content.composer.schedule"] })).toBeDisabled();
    expect(writeCalls()).toHaveLength(0);
    await userEvent.selectOptions(screen.getByLabelText(en["content.composer.action"]), "draft");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each(["en", "fa"] as const)(
    "saves %s publication preferences without browser UTC conversion or scheduling",
    async (locale) => {
      const original = execute.getMockImplementation()!;
      execute.mockImplementation(async (request) =>
        request.method === "GET" && request.path === "/api/admin/articles/write-context"
          ? {
              data: envelope({
                ...parseDraftContext(draftContext(true), null),
                presentation_enabled: true,
              }),
              status: 200,
              headers: {},
            }
          : original(request),
      );
      const copy = locale === "en" ? en : fa;
      await mount("/articles/new", locale);
      await screen.findByLabelText(copy["content.composer.action"]);
      await userEvent.selectOptions(
        screen.getByLabelText(copy["content.composer.action"]),
        "schedule",
      );
      const input = await screen.findByLabelText(copy["content.schedule.publishOn"]);
      expect(input).toHaveAttribute("type", "datetime-local");
      expect(input).toHaveAttribute("dir", "ltr");
      fireEvent.change(input, { target: { value: "2026-10-24T15:30" } });
      fireEvent.change(screen.getByLabelText(copy["content.slug"]), {
        target: { value: "synthetic-scheduled-article" },
      });
      await userEvent.selectOptions(
        screen.getByLabelText(copy["content.composer.action"]),
        "draft",
      );
      await userEvent.click(screen.getByRole("button", { name: copy["content.saveDraft"] }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0][0].body).toMatchObject({
        presentation: {
          publication: { local_time: "2026-10-24T15:30", timezone: "Asia/Tehran" },
          thumbnail: null,
          inline: [],
        },
      });
      expect(JSON.stringify(writeCalls()[0][0].body)).not.toContain("publish_at");
      expect(execute.mock.calls.some(([r]) => r.path.endsWith("/schedule-actions"))).toBe(false);
    },
  );

  it("keeps legacy versions readable and checks schema3 UTC, manifest and schedule ownership", () => {
    const preference = {
      local_time: "2026-10-24T15:30",
      timezone: "Asia/Tehran",
      publish_at: "2026-10-24T12:00:00Z",
    };
    const current = {
      ...article(),
      working: {
        ...version(),
        schema_version: 3,
        presentation: { publication: preference, thumbnail: null, inline: [] },
        translations: { en: { ...version().translations.en, seo: emptySeo() } },
      },
    };
    expect(parseArticle(envelope(current), id).working.presentation?.publication).toEqual(
      preference,
    );
    expect(() =>
      parseArticle(
        envelope({ ...current, working: { ...current.working, schema_version: 2 } }),
        id,
      ),
    ).toThrow(/Invalid|rejected|ownership/i);
    expect(() =>
      parseArticle(
        envelope({ ...current, working: { ...current.working, presentation: undefined } }),
        id,
      ),
    ).toThrow(/Invalid|rejected|ownership/i);
    expect(() =>
      publicationSchema.parse({ ...preference, publish_at: "2026-10-24T15:30:00Z" }),
    ).toThrow(/Invalid|rejected|ownership/i);
    expect(validPublicationInput("2026-02-30T10:30")).toBe(false);
    expect(validPublicationInput("2028-02-29T10:30")).toBe(true);
    expect(validPublicationInput("")).toBe(true);
    const schedule = {
      id: oldId,
      article_id: id,
      version: 2,
      content_hash: version().content_hash,
      publish_at: clock,
      timezone: "Asia/Tehran",
      status: "armed",
      revision: 1,
      blocker: null,
      finished_at: null,
      actor: { id: actorId, name: "Author" },
    };
    expect(parseScheduleResult(envelope({ schedule }), id).id).toBe(oldId);
    expect(() =>
      parseScheduleResult(envelope({ schedule: { ...schedule, article_id: termId } }), id),
    ).toThrow(/Invalid|rejected|ownership/i);
    const context = {
      action: "arm",
      current,
      schedule: null,
      eligible: false,
      blockers: ["wrong_state"],
      timezone: "Asia/Tehran",
      runner_available: false,
      revision,
    };
    expect(parseScheduleContext(envelope(context), id, "arm").eligible).toBe(false);
    expect(() =>
      parseScheduleContext(envelope({ ...context, eligible: true, blockers: [] }), id, "arm"),
    ).toThrow(/Invalid|rejected|ownership/i);
  });

  it.each(["en", "fa"] as const)(
    "confirms %s schedules with a fresh context, reason and password coordinator",
    async (locale) => {
      Object.assign(current, {
        scheduling_enabled: true,
        working_state: "reviewed",
        review: {
          version: 2,
          content_hash: version().content_hash,
          actor: { id: actorId, name: "Author" },
          recorded_at: clock,
          kind: "editorial",
        },
      });
      Object.assign(current.working, {
        schema_version: 3,
        presentation: {
          publication: {
            local_time: "2026-10-24T15:30",
            timezone: "Asia/Tehran",
            publish_at: "2026-10-24T12:00:00Z",
          },
          thumbnail: null,
          inline: [],
        },
      });
      Object.assign(current.working.translations.en, { seo: emptySeo() });
      Object.assign(current.working.translations.fa, { seo: emptySeo() });
      let armed = false;
      const schedule = () => ({
        id: oldId,
        article_id: id,
        version: 2,
        content_hash: version().content_hash,
        publish_at: "2026-10-24 12:00:00",
        timezone: "Asia/Tehran",
        status: "armed",
        revision: 1,
        blocker: null,
        finished_at: null,
        actor: { id: actorId, name: "Author" },
      });
      const original = execute.getMockImplementation()!;
      execute.mockImplementation(async (request) => {
        if (request.path.endsWith("/schedule-context")) {
          const action = request.query?.action;
          const eligible = action === "cancel" ? armed : !armed;
          return {
            status: 200,
            headers: {},
            data: envelope({
              action,
              current,
              schedule: armed ? schedule() : null,
              eligible,
              blockers: eligible ? [] : ["already_armed"],
              timezone: "Asia/Tehran",
              runner_available: true,
              revision,
            }),
          };
        }
        if (request.path.endsWith("/schedule-actions")) {
          armed = true;
          return { status: 200, headers: {}, data: envelope({ schedule: schedule() }) };
        }
        return original(request);
      });
      const copy = locale === "en" ? en : fa;
      await mount("/articles/" + id, locale);
      const arm = await screen.findByRole("button", { name: copy["content.schedule.arm"] });
      await waitFor(() => expect(arm).toBeEnabled());
      await userEvent.click(arm);
      expect(await screen.findByRole("dialog")).toHaveTextContent("2026-10-24 15:30");
      expect(writeCalls()).toHaveLength(0);
      await confirm(locale);
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(passwordRun).toHaveBeenCalled();
      expect(writeCalls()[0][0]).toMatchObject({
        path: "/api/admin/articles/" + id + "/schedule-actions",
        method: "POST",
        body: {
          action: "arm",
          expected_revision: revision,
          expected_version: 2,
          expected_hash: version().content_hash,
          confirmed: true,
        },
      });
      expect(
        execute.mock.calls.filter(([r]) => r.path.endsWith("/schedule-context")).length,
      ).toBeGreaterThanOrEqual(3);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    },
  );

  it.each(["en", "fa"] as const)(
    "renders %s retained grid/list, safe metadata and composed filters",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const view = await mount("/articles", locale);
      expect(
        await screen.findByRole("link", {
          name: locale === "en" ? "Synthetic article" : "مقاله آزمایشی",
        }),
      ).toHaveAttribute("href", "/articles/" + id);
      expect(view.container.querySelector("[data-article-grid]")).toBeTruthy();
      expect(view.container.textContent).not.toMatch(/PRIVATE|content\./);
      await userEvent.click(screen.getByRole("button", { name: copy["content.list"] }));
      expect(await screen.findByRole("table")).toBeVisible();
      fireEvent.change(screen.getByLabelText(copy["content.searchArticles"]), {
        target: { value: "100% care_test" },
      });
      await waitFor(() => expect(execute.mock.calls.at(-1)?.[0].query?.q).toBe("100% care_test"));
      expect(execute.mock.calls.at(-1)?.[0].query?.language).toBe(locale);
    },
  );
  it.each(["patient", "doctor"])(
    "denies all four content pages to %s without requests",
    async (role) => {
      actor.roles = [role];
      for (const path of ["/articles", "/articles/new", "/articles/" + id, "/article-taxonomies"]) {
        const view = await mount(path);
        expect(screen.getByRole("alert")).toHaveTextContent(en["adminReservations.denied"]);
        view.unmount();
      }
      expect(execute).not.toHaveBeenCalled();
    },
  );
  it("refuses invalid public IDs and filters without making an unsafe request", async () => {
    const view = await mount("/articles/not-a-public-id");
    expect(screen.getByRole("alert")).toHaveTextContent(en["content.invalidId"]);
    expect(execute).not.toHaveBeenCalled();
    view.unmount();
    await mount("/articles?page=10001&author_id=private");
    expect(screen.getByRole("alert")).toHaveTextContent(en["content.invalidQuery"]);
    expect(execute).not.toHaveBeenCalled();
  });
  it("shows truthful unavailable state and hides old data on failed refresh", async () => {
    await mount();
    await screen.findByText("Synthetic article");
    execute.mockRejectedValue(new TransportError(classifyWireFailure({ status: 503 })));
    await userEvent.click(screen.getByRole("button", { name: en["adminReservations.refresh"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en["content.unavailable"]);
    expect(screen.queryByText("Synthetic article")).toBeNull();
  });
  it.each(["en", "fa"] as const)(
    "keeps %s draft languages separate and cancels without dispatch",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      await mount("/articles/new", locale);
      await waitFor(() => expect(screen.getByLabelText(copy["content.slug"])).toBeEnabled());
      fireEvent.change(screen.getByLabelText(copy["content.slug"]), {
        target: { value: "new-article" },
      });
      await userEvent.click(screen.getByRole("tab", { name: copy["content.language.en"] }));
      fireEvent.change(screen.getByRole("textbox", { name: copy["content.title"] }), {
        target: { value: "New English title" },
      });
      await userEvent.click(screen.getByRole("tab", { name: copy["content.language.fa"] }));
      fireEvent.change(screen.getByRole("textbox", { name: copy["content.title"] }), {
        target: { value: "عنوان جدید" },
      });
      await userEvent.click(screen.getByRole("tab", { name: copy["content.language.en"] }));
      expect(screen.getByRole("textbox", { name: copy["content.title"] })).toHaveValue(
        "New English title",
      );
      await userEvent.click(screen.getByRole("button", { name: copy["content.cancel"] }));
      expect(screen.getByLabelText("test route")).toHaveTextContent("/articles");
      expect(writeCalls()).toHaveLength(0);
    },
  );
  it("uses fresh context and sends a typed new draft without another confirmation", async () => {
    await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByLabelText(en["content.slug"]), {
      target: { value: "new-article" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en["content.saveDraft"] })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: en["content.saveDraft"] }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(passwordRun).not.toHaveBeenCalled();
    await waitFor(() => expect(writeCalls()).toHaveLength(1));
    const request = writeCalls()[0]![0];
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/api/admin/articles");
    expect(request.body).toMatchObject({
      slug: "new-article",
      expected_revision: revision,
      taxonomy: [],
      health_references: [],
    });
    for (const field of ["author_user_id", "reason", "confirmed"])
      expect(request.body).not.toHaveProperty(field);
    await waitFor(() =>
      expect(screen.getByLabelText("test route")).toHaveTextContent("/articles/" + id),
    );
  });
  it("rejects stale draft context without dispatching a mutation", async () => {
    await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByLabelText(en["content.slug"]), {
      target: { value: "new-article" },
    });
    revision = "b".repeat(64);
    await userEvent.click(screen.getByRole("button", { name: en["content.saveDraft"] }));
    expect(await screen.findByText(en["content.operation.conflict"])).toHaveProperty(
      "tagName",
      "OUTPUT",
    );
    expect(writeCalls()).toHaveLength(0);
  });
  it("locks an ambiguous save until explicit refresh and never replays the write", async () => {
    const original = execute.getMockImplementation()!;
    execute.mockImplementation((r) =>
      r.method === "GET"
        ? original(r)
        : Promise.reject(new TransportError(classifyWireFailure({ message: "Network Error" }))),
    );
    await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByLabelText(en["content.slug"]), {
      target: { value: "new-article" },
    });
    await userEvent.click(screen.getByRole("button", { name: en["content.saveDraft"] }));
    expect(await screen.findByText(en["content.operation.uncertain"])).toHaveProperty(
      "tagName",
      "OUTPUT",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en["content.saveDraft"] })).toBeDisabled();
    expect(writeCalls()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: en["content.reloadDraft"] }));
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toHaveValue(""));
    expect(writeCalls()).toHaveLength(1);
  });
  it.each(["en", "fa"] as const)(
    "renders %s detail boxes, distinct working/published previews and history",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const view = await mount("/articles/" + id, locale);
      await screen.findByRole("heading", { name: copy["content.record"] });
      expect(view.container.querySelectorAll("[data-article-boxes] section")).toHaveLength(2);
      await userEvent.click(screen.getByRole("button", { name: copy["content.publishedCopy"] }));
      expect(
        await screen.findByRole("heading", {
          name: locale === "en" ? "Original content" : "مقاله آزمایشی",
        }),
      ).toBeVisible();
      await userEvent.click(screen.getByRole("button", { name: copy["content.events"] }));
      expect(await screen.findByText(copy["content.event.version_copied"])).toBeVisible();
      expect(view.container.textContent).not.toMatch(/PRIVATE|content\./);
    },
  );
  it("previews an older version and binds recovery to current and historical hashes", async () => {
    await mount("/articles/" + id);
    await screen.findByRole("heading", { name: en["content.history"] });
    const previews = await screen.findAllByRole("button", { name: en["content.preview"] });
    await userEvent.click(previews.at(-1)!);
    await screen.findByRole("heading", { name: "Original content" });
    await userEvent.click(screen.getByRole("button", { name: en["content.action.copy_version"] }));
    await screen.findByRole("heading", { name: "Original content" });
    await confirm();
    await waitFor(() => expect(writeCalls()).toHaveLength(1));
    expect(writeCalls()[0]![0].body).toMatchObject({
      action: "copy_version",
      source_version_id: oldId,
      source_hash: "1".repeat(64),
      expected_version: 2,
      expected_hash: "2".repeat(64),
      expected_revision: revision,
      confirmed: true,
    });
  });
  it("refuses blocked publication without a second confirmation", async () => {
    current.working_state = "reviewed";
    current.review = {
      version: 2,
      content_hash: "2".repeat(64),
      actor: { id: actorId, name: "Reviewer" },
      recorded_at: clock,
      kind: "editorial",
    } as never;
    blocked = true;
    await mount("/articles/" + id);
    await screen.findByRole("heading", { name: en["content.record"] });
    await userEvent.click(screen.getByRole("button", { name: en["content.action.publish"] }));
    expect(await screen.findByText(en["content.operation.conflict"])).toHaveProperty(
      "tagName",
      "OUTPUT",
    );
    expect(writeCalls()).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("clears draft state and aborts in-flight reads on account changes", async () => {
    const view = await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByLabelText(en["content.slug"]), {
      target: { value: "private-draft" },
    });
    act(() => {
      actor.id = 2;
      for (const listener of listeners) listener();
      view.refresh();
    });
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toHaveValue(""));
    expect(writeCalls()).toHaveLength(0);
  });
  it.each(["en", "fa"] as const)(
    "manages %s article taxonomies and retained term history",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const view = await mount("/article-taxonomies", locale);
      await screen.findByText(locale === "en" ? "Care" : "مراقبت");
      await userEvent.click(screen.getByRole("button", { name: copy["content.history"] }));
      await waitFor(() =>
        expect(view.container.querySelector("[data-term-history]")).toBeVisible(),
      );
      await userEvent.click(screen.getByRole("button", { name: copy["content.term.update"] }));
      await waitFor(() =>
        expect(screen.getByLabelText(copy["content.slug"])).toHaveValue("care-category"),
      );
      expect(screen.getByLabelText(copy["content.slug"])).toBeDisabled();
      expect(screen.getByRole("button", { name: copy["adminManage.confirm"] })).toBeDisabled();
      await userEvent.click(
        within(screen.getByRole("dialog")).getByText(copy["adminManage.close"], {
          selector: "button",
        }),
      );
      expect(writeCalls()).toHaveLength(0);
      expect(view.container.textContent).not.toMatch(/PRIVATE|content\./);
    },
  );
});

describe("guarded taxonomy writes", () => {
  it.each(["en", "fa"] as const)(
    "saves %s labels only after fresh revision, reason and confirmation",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      await mount("/article-taxonomies", locale);
      await screen.findByText(locale === "en" ? "Care" : term().labels.fa);
      await userEvent.click(screen.getByRole("button", { name: copy["content.term.create"] }));
      await waitFor(() => expect(screen.getByLabelText(copy["content.slug"])).toBeEnabled());
      fireEvent.change(screen.getByLabelText(copy["content.slug"]), {
        target: { value: "care-topic" },
      });
      fireEvent.change(
        screen.getByLabelText(
          copy["content.labelLanguage"].replace("{{language}}", copy["content.language.en"]),
        ),
        { target: { value: "Care topic" } },
      );
      await confirm(locale);
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0]![0]).toMatchObject({
        method: "POST",
        path: "/api/admin/article-taxonomies",
        body: {
          labels: { en: "Care topic" },
          descriptions: {},
          expected_revision: revision,
          confirmed: true,
        },
      });
    },
  );
  it("retirement is a guarded action and never deletes retained versions", async () => {
    await mount("/article-taxonomies");
    await screen.findByText("Care");
    await userEvent.click(screen.getByRole("button", { name: en["content.term.retire"] }));
    await screen.findByText(en["content.retireNotice"]);
    await confirm();
    await waitFor(() => expect(writeCalls()).toHaveLength(1));
    expect(writeCalls()[0]![0]).toMatchObject({
      method: "POST",
      path: "/api/admin/article-taxonomies/" + termId + "/actions",
      body: { action: "retire", confirmed: true },
    });
  });
});

describe("Velzon article authoring layout", () => {
  it.each(["en", "fa"] as const)(
    "hides retired %s source/topic controls while preserving existing references on save",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const legacySource = { url: "https://example.com/reference", label: "Existing reference" };
      Object.assign(current.working, {
        source_links: [legacySource],
        taxonomy: [{ ...term(), kind: "topic" }],
      });
      const view = await mount("/articles/" + id, locale);
      await userEvent.click(await screen.findByRole("button", { name: copy["content.editDraft"] }));
      await screen.findByRole("textbox", { name: copy["content.title"] });
      expect(screen.queryByRole("heading", { name: copy["content.sources"] })).toBeNull();
      expect(screen.queryByRole("heading", { name: copy["content.tabs.topic"] })).toBeNull();
      expect(
        view.container.querySelector('[id^="article-source-"],#content-picker-topic-search'),
      ).toBeNull();
      expect(screen.getByRole("heading", { name: copy["content.tabs.category"] })).toBeVisible();
      expect(screen.getByRole("heading", { name: copy["content.tabs.tag"] })).toBeVisible();
      fireEvent.change(screen.getByRole("textbox", { name: copy["content.title"] }), {
        target: { value: "Updated article" },
      });
      await userEvent.click(screen.getByRole("button", { name: copy["content.saveDraft"] }));
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0]![0].body).toMatchObject({
        source_links: [legacySource],
        taxonomy: [{ id: termId, kind: "topic" }],
      });
      view.unmount();
      await mount("/article-taxonomies", locale);
      expect(screen.queryByRole("button", { name: copy["content.tabs.topic"] })).toBeNull();
    },
  );
  it.each(["en", "fa"] as const)(
    "edits %s versioned SEO in an accordion without a summary field",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const view = await mount("/articles/new", locale);
      await waitFor(() => expect(screen.getByLabelText(copy["content.slug"])).toBeEnabled());
      expect(view.container.querySelector('[id^="article-summary-"]')).toBeNull();
      fireEvent.change(screen.getByLabelText(copy["content.slug"]), {
        target: { value: "seo-article" },
      });
      const toggle = screen.getByRole("button", { name: copy["content.seo.heading"] });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      const seo = within(view.container.querySelector("[data-article-seo]") as HTMLElement);
      const title = seo.getByRole("textbox", { name: copy["content.seo.title"] });
      expect(title).toHaveAttribute("placeholder", copy["content.seo.example.title"]);
      fireEvent.change(title, { target: { value: "x".repeat(50) } });
      expect(
        view.container.querySelector(
          `[data-article-seo-language=${locale}] [data-seo-counter=title]`,
        ),
      ).toHaveClass("text-success");
      fireEvent.change(title, { target: { value: "x".repeat(61) } });
      expect(
        view.container.querySelector(
          `[data-article-seo-language=${locale}] [data-seo-counter=title]`,
        ),
      ).toHaveClass("text-danger");
      expect(screen.getByRole("button", { name: copy["content.saveDraft"] })).toBeEnabled();
      fireEvent.change(seo.getByRole("textbox", { name: copy["content.seo.schema_json"] }), {
        target: { value: "<script>alert(1)</script>" },
      });
      expect(screen.getByRole("button", { name: copy["content.saveDraft"] })).toBeDisabled();
      expect(view.container.querySelector("[data-article-seo] script")).toBeNull();
      fireEvent.change(seo.getByRole("textbox", { name: copy["content.seo.schema_json"] }), {
        target: { value: copy["content.seo.example.schema_json"] },
      });
      fireEvent.change(seo.getByRole("textbox", { name: copy["content.seo.canonical_url"] }), {
        target: { value: "https://example.com/article" },
      });
      await userEvent.click(screen.getByRole("button", { name: copy["content.saveDraft"] }));
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0]![0].body).toMatchObject({
        translations: {
          [locale]: {
            summary: "",
            seo: {
              title: "x".repeat(61),
              canonical_url: "https://example.com/article",
              schema_json: copy["content.seo.example.schema_json"],
            },
          },
        },
      });
    },
  );
  it("uses advisory Unicode counter boundaries and refuses unsafe JSON-LD/canonical metadata", () => {
    for (const [kind, min, max] of [
      ["title", 50, 60],
      ["description", 120, 160],
    ] as const) {
      expect(seoCounterTone("😀".repeat(min - 1), kind)).toBe("text-body");
      expect(seoCounterTone("😀".repeat(min), kind)).toBe("text-success");
      expect(seoCounterTone("x".repeat(max), kind)).toBe("text-success");
      expect(seoCounterTone("x".repeat(max + 1), kind)).toBe("text-danger");
    }
    for (const canonical_url of [
      "/relative",
      "javascript:alert(1)",
      "https://user:pass@example.com",
      "https://example.com/#fragment",
    ])
      expect(validSeo({ ...emptySeo(), canonical_url })).toBe(false);
    for (const schema_json of [
      "[]",
      "42",
      '{"@context":"https://evil.test","@type":"Thing"}',
      '{"@context":"https://schema.org","@type":"Thing","__proto__":{}}',
    ])
      expect(validSeo({ ...emptySeo(), schema_json })).toBe(false);
    expect(validSeo({ ...emptySeo(), title: "x".repeat(61), description: "x".repeat(161) })).toBe(
      true,
    );
  });
  it.each(["en", "fa"] as const)(
    "uses the %s Add Product columns and native accessible language tabs",
    async (locale) => {
      const copy = locale === "en" ? en : fa;
      const view = await mount("/articles/new", locale);
      await waitFor(() => expect(screen.getByLabelText(copy["content.slug"])).toBeEnabled());
      expect(view.container.querySelector("[data-article-content-column].col-lg-8")).toBeTruthy();
      expect(view.container.querySelector("[data-article-sidebar].col-lg-4")).toBeTruthy();
      const english = screen.getByRole("tab", { name: copy["content.language.en"] });
      const persian = screen.getByRole("tab", { name: copy["content.language.fa"] });
      await userEvent.click(english);
      await userEvent.keyboard("{ArrowRight}");
      expect(persian).toHaveFocus();
      expect(persian).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "article-content-pane-fa");
      await userEvent.keyboard("{Home}");
      expect(english).toHaveFocus();
      expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "article-content-pane-en");
      const ids = Array.from(view.container.querySelectorAll("[id]")).map((element) => element.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );
  it("previews unsaved content and closes without sending a save or changing the draft", async () => {
    await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: en["content.title"] }), {
      target: { value: "Unsaved article title" },
    });
    fireEvent.change(screen.getByLabelText(en["content.body"] + " en"), {
      target: { value: "<p>Unsaved preview body</p>" },
    });
    await userEvent.click(screen.getByRole("button", { name: en["content.previewDraft"] }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Unsaved article title" })).toBeVisible();
    expect(within(dialog).getByText("Unsaved preview body")).toBeVisible();
    await userEvent.click(within(dialog).getByText(en["content.close"], { selector: "button" }));
    expect(screen.getByRole("textbox", { name: en["content.title"] })).toHaveValue(
      "Unsaved article title",
    );
    expect(writeCalls()).toHaveLength(0);
  });
  it("selects one shared bilingual taxonomy identity without duplicate language entries", async () => {
    const view = await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByLabelText(en["content.slug"]), {
      target: { value: "bilingual-article" },
    });
    const card = screen
      .getByRole("heading", { name: en["content.tabs.category"] })
      .closest(".card")!;
    await userEvent.click((card as HTMLElement).querySelector("#content-picker-category-search")!);
    await userEvent.click(await screen.findByRole("option", { name: new RegExp("Care") }));
    await userEvent.keyboard("{Escape}");
    await act(async () => {
      await view.i18n.changeLanguage("fa");
    });
    await userEvent.click(screen.getByRole("button", { name: fa["content.saveDraft"] }));
    await waitFor(() => expect(writeCalls()).toHaveLength(1));
    expect(writeCalls()[0]![0].body).toMatchObject({
      taxonomy: [{ id: termId, kind: "category" }],
    });
    expect(writeCalls()[0]![0].body).not.toHaveProperty("taxonomy_fa");
  });
  it("shows a truthful authoring gate instead of a disabled form when the real service is unavailable", async () => {
    execute.mockRejectedValue(new TransportError(classifyWireFailure({ status: 503 })));
    await mount("/articles/new");
    expect(await screen.findByText(en["content.authoringUnavailable"])).toHaveProperty(
      "tagName",
      "OUTPUT",
    );
    expect(screen.queryByLabelText(en["content.slug"])).toBeNull();
    expect(screen.queryByRole("button", { name: en["content.saveDraft"] })).toBeNull();
    expect(screen.getByRole("button", { name: en["content.cancel"] })).toBeEnabled();
    expect(writeCalls()).toHaveLength(0);
  });
});

describe("editorial transitions", () => {
  it("publishes a reviewed workspace directly with exact current bindings and no password prompt", async () => {
    current.working_state = "reviewed";
    current.review = {
      version: 2,
      content_hash: "2".repeat(64),
      actor: { id: actorId, name: "Reviewer" },
      recorded_at: clock,
      kind: "editorial",
    } as never;
    const original = execute.getMockImplementation()!;
    execute.mockImplementation(async (request) => {
      if (request.method === "POST") {
        current = {
          ...current,
          working_state: "published",
          status: "published",
          has_unpublished_changes: false,
          published: current.working,
        };
        return { status: 200, headers: {}, data: envelope(current) };
      }
      return original(request);
    });
    await mount("/articles/" + id);
    await screen.findByRole("heading", { name: en["content.record"] });
    const publish = screen.getByRole("button", { name: en["content.action.publish"] });
    fireEvent.click(publish);
    fireEvent.click(publish);
    await waitFor(() => expect(writeCalls()).toHaveLength(1));
    expect(writeCalls()[0][0].body).toEqual({
      action: "publish",
      expected_revision: revision,
      expected_version: 2,
      expected_hash: "2".repeat(64),
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(passwordRun).not.toHaveBeenCalled();
  });
  it("aborts a direct draft action when authority changes during the fresh read", async () => {
    await mount("/articles/new");
    await waitFor(() => expect(screen.getByLabelText(en["content.slug"])).toBeEnabled());
    fireEvent.change(screen.getByLabelText(en["content.slug"]), {
      target: { value: "synthetic-draft" },
    });
    let finish: ((value: TransportResponse<unknown>) => void) | undefined;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: en["content.saveDraft"] }));
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    act(() => {
      actor.roles = ["patient"];
      for (const listener of listeners) listener();
    });
    await act(async () => {
      finish?.({ status: 200, headers: {}, data: draftContext(true) });
    });
    expect(writeCalls()).toHaveLength(0);
    expect(passwordRun).not.toHaveBeenCalled();
  });
  it.each(["submit", "review", "archive"] as const)(
    "sends %s only with current version/hash and fresh confirmation",
    async (action) => {
      if (action === "review") current.working_state = "in_review";
      await mount("/articles/" + id);
      await screen.findByRole("heading", { name: en["content.record"] });
      await userEvent.click(screen.getByRole("button", { name: en[`content.action.${action}`] }));
      await waitFor(() => expect(screen.getByLabelText(en["adminManage.reason"])).toBeEnabled());
      expect(writeCalls()).toHaveLength(0);
      await confirm();
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0]![0]).toMatchObject({
        method: "POST",
        path: "/api/admin/articles/" + id + "/actions",
        body: {
          action,
          expected_revision: revision,
          expected_hash: "2".repeat(64),
          expected_version: 2,
          confirmed: true,
        },
      });
    },
  );
  it("cancels a pending password step on authority changes before any content dispatch", async () => {
    let resume: (() => void) | undefined;
    passwordRun.mockImplementationOnce(
      (operation) =>
        new Promise((resolve) => {
          resume = () => {
            void operation().then(resolve);
          };
        }),
    );
    const view = await mount("/articles/" + id);
    await screen.findByRole("heading", { name: en["content.record"] });
    await userEvent.click(screen.getByRole("button", { name: en["content.action.submit"] }));
    await confirm();
    await waitFor(() => expect(resume).toBeTypeOf("function"));
    act(() => {
      actor.id = 3;
      for (const listener of listeners) listener();
      view.refresh();
    });
    resume?.();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writeCalls()).toHaveLength(0);
  });
  it("renders hostile stored rich text inertly and never creates remote media or unsafe links", async () => {
    current.working.translations.en.body_html =
      '<p onclick="alert(1)">Safe preview</p><script>alert(1)</script><img src="https://example.test/private"><a href="javascript:alert(1)">Unsafe link</a>';
    const view = await mount("/articles/" + id);
    await screen.findByText("Safe preview");
    expect(
      view.container.querySelector(
        '[data-article-preview] script, [data-article-preview] img, [data-article-preview] [onclick], [data-article-preview] a[href^="javascript:"]',
      ),
    ).toBeNull();
    expect(writeCalls()).toHaveLength(0);
  });
});

describe("content response and transport boundaries", () => {
  it("omits empty optional filters that Laravel would normalize to rejected null values", async () => {
    await readContent(
      "/api/admin/article-taxonomies",
      { q: "", kind: "category", parent_id: undefined, page: 1 },
      new AbortController().signal,
    );
    expect(execute.mock.calls.at(-1)?.[0].query).toEqual({ kind: "category", page: 1 });
    await readContent(
      "/api/admin/articles",
      { q: "  ", author_id: undefined, page: 1 },
      new AbortController().signal,
    );
    expect(execute.mock.calls.at(-1)?.[0].query).toEqual({ page: 1 });
    await readContent(
      "/api/admin/articles",
      { q: "100% care_test", page: 1 },
      new AbortController().signal,
    );
    expect(execute.mock.calls.at(-1)?.[0].query?.q).toBe("100% care_test");
  });
  it("accepts several immutable revisions of one taxonomy without confusing their identities", () => {
    const rows = [term(), { ...term(), version_id: versionId, version: 2 }];
    expect(
      parsePage(
        pageWire(rows),
        (v) => termSchema.parse(v),
        (v) => v.version_id,
      ).data,
    ).toHaveLength(2);
    expect(() =>
      parsePage(
        pageWire([term(), term()]),
        (v) => termSchema.parse(v),
        (v) => v.version_id,
      ),
    ).toThrow(/rejected|identity|state|Invalid|Duplicate/i);
  });
  it("rejects invalid dates, state claims and unpublished published pointers", () => {
    expect(() => validateArticle({ ...article(), status: "reviewed" })).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => validateArticle({ ...article(), updated_at: "not a timestamp" })).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => validateArticle({ ...article(), working_state: "published" })).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
  });
  it("requires exact write methods for the target, including actions", async () => {
    const signal = new AbortController().signal;
    for (const [path, method] of [
      ["/api/admin/articles/" + id, "POST"],
      ["/api/admin/articles", "PUT"],
      ["/api/admin/articles/" + id + "/actions", "PUT"],
    ] as const)
      await expect(contentWrite(path, method, {}, signal)).rejects.toThrow(
        /rejected|identity|state|Invalid|Duplicate/i,
      );
    expect(execute).not.toHaveBeenCalled();
  });
  it("strips private response fields and rejects contradictory pointers and mismatched contexts", () => {
    expect(parseArticle(envelope(article()), id)).not.toHaveProperty("email");
    expect(() => parseArticle(envelope(article()), termId)).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => validateArticle({ ...article(), has_unpublished_changes: false })).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => parseDraftContext(draftContext(false), termId)).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => parseTermContext(termContext(false), id)).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => parseActionContext(actionContext("copy_version", oldId), id, "archive")).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(() => parsePage(pageWire([article(), article()]), validateArticle)).toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
  });
  it.each([
    "https://evil.test",
    "/api/admin/users",
    "/api/admin/articles/../users",
    "/api/admin/articles",
    "/api/admin/articles/" + id + "/actions",
  ])("rejects out-of-scope or destructive writes: %s", async (path) => {
    await expect(contentWrite(path, "DELETE", {}, new AbortController().signal)).rejects.toThrow(
      /rejected|identity|state|Invalid|Duplicate/i,
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it("keeps invalid URL filters from reaching the API", () => {
    for (const query of [
      "page=0",
      "per_page=51",
      "author_id=1",
      "status=completed",
      "sort=private",
      "q=" + "x".repeat(121),
    ])
      expect(articleListQuery(new URLSearchParams(query)).valid).toBe(false);
  });
});
