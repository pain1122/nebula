import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useContent } from "../Administration/content/Shared";
import { localizedText, parsePage, validateArticle } from "../../modules/checkupino/content/api";
import {
  ruleBoard,
  ruleDetail,
  ruleRequest,
  mutationReceipt,
  parseCondition,
  type RuleBoard,
  type RuleContent,
  type RuleDetail,
} from "../../modules/checkupino/recommendations/api";
import { useClinicalWrite } from "../../modules/checkupino/profiles/useClinicalWrite";
import ConditionEditor, { emptyLeaf } from "./ConditionEditor";
import { WriteStatus } from "./Shared";

const blank = (): RuleContent => ({
  definition: {
    schema_version: 1,
    health_catalog_version: "health-2026-10-22.1",
    include: { all: [emptyLeaf()] },
    exclude: null,
  },
  translations: { en: { title: "", explanation: "" }, fa: { title: "", explanation: "" } },
  population: { en: "", fa: "" },
  limitations: { en: "", fa: "" },
  sources: [],
  targets: [],
  priority: 0,
});
export default function RuleEditor({
  board,
  detail,
  accepted,
  cancel,
  reload,
}: {
  readonly board: RuleBoard;
  readonly detail?: RuleDetail;
  readonly accepted: (id: string) => void;
  readonly cancel: () => void;
  readonly reload: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [slug, setSlug] = useState(detail?.slug ?? "");
  const [content, setContent] = useState<RuleContent>(() =>
    detail
      ? {
          definition: detail.working.definition,
          translations: detail.working.translations,
          population: detail.working.population,
          limitations: detail.working.limitations,
          sources: detail.working.sources,
          targets: detail.working.targets.map((target) => target.id),
          priority: detail.working.priority,
        }
      : blank(),
  );
  const [language, setLanguage] = useState<"en" | "fa">(
    i18n.resolvedLanguage === "fa" ? "fa" : "en",
  );
  const [error, setError] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const articles = useContent(
    "/api/admin/articles",
    { q: search, status: "published", page, per_page: 20 },
    (wire) => parsePage(wire, validateArticle),
  );
  const write = useClinicalWrite(`recommendation-${detail?.id ?? "new"}`);
  const update = <K extends keyof RuleContent>(key: K, value: RuleContent[K]) =>
    setContent((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError(false);
    try {
      const count = { value: 0 };
      parseCondition(content.definition.include, 1, count);
      if (content.definition.exclude) parseCondition(content.definition.exclude, 1, count);
      if (
        !content.targets.length ||
        content.sources.some((source) => !source.label.trim() || !source.url.startsWith("https://"))
      )
        throw new Error("Incomplete");
    } catch {
      setError(true);
      return;
    }
    const expected = detail?.contexts.save ?? board.create_revision;
    if (!expected) return;
    void write.run(
      async (signal) => {
        const fresh = detail
          ? await ruleRequest(
              "GET",
              `/api/admin/recommendation-rules/${detail.id}`,
              ruleDetail,
              signal,
            )
          : await ruleRequest("GET", "/api/admin/recommendation-rules", ruleBoard, signal);
        return {
          revision: "contexts" in fresh ? fresh.contexts.save : (fresh.create_revision ?? ""),
        };
      },
      expected,
      (signal) =>
        ruleRequest(
          detail ? "PUT" : "POST",
          `/api/admin/recommendation-rules${detail ? `/${detail.id}` : ""}`,
          mutationReceipt,
          signal,
          { expected_revision: expected, action_key: crypto.randomUUID(), slug, content },
        ),
      (receipt) => accepted(receipt.id),
    );
  };
  const localized = (key: "title" | "explanation" | "population" | "limitations") => {
    const value =
      key === "title" || key === "explanation"
        ? content.translations[language][key]
        : content[key][language];
    return (
      <div className="mb-3" key={key}>
        <label className="form-label" htmlFor={`rule-${key}`}>
          {t(`recommendationRules.${key === "title" ? "titleLabel" : key}`)}
        </label>
        <textarea
          id={`rule-${key}`}
          className="form-control"
          rows={key === "title" ? 1 : 3}
          maxLength={key === "title" ? 200 : key === "explanation" ? 1000 : 2000}
          value={value}
          onChange={(event) =>
            key === "title" || key === "explanation"
              ? update("translations", {
                  ...content.translations,
                  [language]: { ...content.translations[language], [key]: event.target.value },
                })
              : update(key, { ...content[key], [language]: event.target.value })
          }
        />
      </div>
    );
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <WriteStatus write={write} refresh={reload} />
      {error && <p role="alert">{t("recommendationRules.invalid")}</p>}
      <fieldset disabled={write.busy || write.uncertain}>
        <div className="row">
          <div className="col-xl-8">
            <section className="card">
              <div className="card-header">
                <h5>{t("recommendationRules.text")}</h5>
              </div>
              <div className="card-body">
                <div
                  className="nav nav-tabs mb-3"
                  role="tablist"
                  aria-label={t("recommendationRules.language")}
                >
                  {(["en", "fa"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      role="tab"
                      aria-selected={language === lang}
                      aria-controls="rule-language"
                      id={`rule-tab-${lang}`}
                      className={`nav-link${language === lang ? " active" : ""}`}
                      onClick={() => setLanguage(lang)}
                    >
                      {t(`patientArticles.language.${lang}`)}
                    </button>
                  ))}
                </div>
                <div
                  id="rule-language"
                  role="tabpanel"
                  aria-labelledby={`rule-tab-${language}`}
                  lang={language}
                  dir={language === "fa" ? "rtl" : "ltr"}
                >
                  {(["title", "explanation", "population", "limitations"] as const).map(localized)}
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <h5>{t("recommendationRules.include")}</h5>
              </div>
              <div className="card-body">
                <p className="text-muted">{t("recommendationRules.conditionHint")}</p>
                <ConditionEditor
                  node={content.definition.include}
                  catalog={board.catalog}
                  onChange={(include) => update("definition", { ...content.definition, include })}
                />
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <h5>{t("recommendationRules.exclude")}</h5>
              </div>
              <div className="card-body">
                <label className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={content.definition.exclude !== null}
                    onChange={(event) =>
                      update("definition", {
                        ...content.definition,
                        exclude: event.target.checked ? { any: [emptyLeaf()] } : null,
                      })
                    }
                  />
                  <span className="form-check-label">
                    {t("recommendationRules.enableExclusions")}
                  </span>
                </label>
                {content.definition.exclude && (
                  <ConditionEditor
                    node={content.definition.exclude}
                    catalog={board.catalog}
                    onChange={(exclude) => update("definition", { ...content.definition, exclude })}
                  />
                )}
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <h5>{t("recommendationRules.sources")}</h5>
              </div>
              <div className="card-body">
                {content.sources.map((source, index) => (
                  <div className="row g-2 mb-3" key={index}>
                    <div className="col-md-4">
                      <label className="form-label" htmlFor={`source-label-${index}`}>
                        {t("recommendationRules.sourceLabel")}
                      </label>
                      <input
                        id={`source-label-${index}`}
                        className="form-control"
                        maxLength={200}
                        required
                        value={source.label}
                        onChange={(event) =>
                          update(
                            "sources",
                            content.sources.map((item, offset) =>
                              offset === index ? { ...item, label: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={`source-url-${index}`}>
                        HTTPS URL
                      </label>
                      <input
                        id={`source-url-${index}`}
                        dir="ltr"
                        className="form-control"
                        type="url"
                        pattern="https://.*"
                        maxLength={2048}
                        required
                        value={source.url}
                        onChange={(event) =>
                          update(
                            "sources",
                            content.sources.map((item, offset) =>
                              offset === index ? { ...item, url: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-md-2 align-self-end">
                      <button
                        className="btn btn-soft-danger"
                        type="button"
                        onClick={() =>
                          update(
                            "sources",
                            content.sources.filter((_, offset) => offset !== index),
                          )
                        }
                      >
                        {t("recommendationRules.remove")}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={content.sources.length >= 20}
                  onClick={() => update("sources", [...content.sources, { label: "", url: "" }])}
                >
                  {t("recommendationRules.addSource")}
                </button>
              </div>
            </section>
          </div>
          <div className="col-xl-4">
            <section className="card">
              <div className="card-header">
                <h5>{t("recommendationRules.details")}</h5>
              </div>
              <div className="card-body">
                <label className="form-label" htmlFor="rule-slug">
                  {t("recommendationRules.slug")}
                </label>
                <input
                  id="rule-slug"
                  className="form-control mb-3"
                  dir="ltr"
                  pattern="[a-z0-9][a-z0-9-]{1,158}[a-z0-9]"
                  minLength={3}
                  maxLength={160}
                  required
                  readOnly={detail?.published_version != null}
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
                <label className="form-label" htmlFor="rule-priority">
                  {t("recommendationRules.priority")}
                </label>
                <input
                  id="rule-priority"
                  className="form-control mb-3"
                  type="number"
                  min={0}
                  max={1000}
                  required
                  value={content.priority}
                  onChange={(event) => update("priority", Number(event.target.value))}
                />
                <p className="small text-muted">{t("recommendationRules.draftHint")}</p>
                <div className="d-flex flex-wrap gap-2">
                  <button className="btn btn-primary" type="submit">
                    {t("recommendationRules.save")}
                  </button>
                  <button className="btn btn-light" type="button" onClick={cancel}>
                    {t("recommendationRules.cancel")}
                  </button>
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <h5>{t("recommendationRules.targets")}</h5>
              </div>
              <div className="card-body">
                <p className="small text-muted">{t("recommendationRules.targetHint")}</p>
                <label className="form-label" htmlFor="target-search">
                  {t("recommendationRules.search")}
                </label>
                <input
                  id="target-search"
                  className="form-control mb-3"
                  value={search}
                  maxLength={100}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
                {articles.error && <p role="alert">{t("recommendationRules.unavailable")}</p>}
                {content.targets.map((id) => (
                  <div className="d-flex gap-2 align-items-center mb-2" key={id}>
                    <span className="small text-break flex-grow-1">
                      <bdi>{articles.data?.data.find((item) => item.id === id)?.slug ?? id}</bdi>
                    </span>
                    <button
                      className="btn btn-sm btn-light"
                      type="button"
                      onClick={() =>
                        update(
                          "targets",
                          content.targets.filter((item) => item !== id),
                        )
                      }
                    >
                      {t("recommendationRules.remove")}
                    </button>
                  </div>
                ))}
                {articles.data?.data
                  .filter((item) => item.published && !content.targets.includes(item.id))
                  .map((article) => (
                    <button
                      className="btn btn-soft-primary w-100 text-start mb-2"
                      key={article.id}
                      type="button"
                      disabled={content.targets.length >= 20}
                      onClick={() => update("targets", [...content.targets, article.id])}
                    >
                      {localizedText(
                        {
                          en: article.published?.translations.en?.title,
                          fa: article.published?.translations.fa?.title,
                        },
                        language,
                      ) || article.slug}
                    </button>
                  ))}
                <div className="d-flex gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    disabled={page <= 1 || articles.busy}
                    onClick={() => setPage(page - 1)}
                  >
                    {t("recommendationRules.previous")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    disabled={
                      articles.busy || !articles.data || page >= articles.data.pagination.last_page
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    {t("recommendationRules.next")}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
