import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  libraryQuerySchema,
  patientImageUrl,
  usePatientArticlesQuery,
  usePatientArticleTermsQuery,
  type PatientArticle,
} from "../../modules/checkupino/patientArticles/api";
import "./PatientArticles.css";

export function PatientArticleAccess({ children }: { children: ReactNode }) {
  const { userProfile } = useShellAuth();
  const { t } = useTranslation();
  if (!userProfile?.roles.includes("patient"))
    return (
      <div className="page-content">
        <p role="alert">{t("patientArticles.denied")}</p>
      </div>
    );
  return <div key={String(userProfile.id)}>{children}</div>;
}

export function ArticleCover({
  article,
  detail = false,
}: {
  article: PatientArticle;
  detail?: boolean;
}) {
  const { t } = useTranslation();
  const [failedPath, setFailedPath] = useState<string | null>(null);
  return article.thumbnail && failedPath !== article.thumbnail.content_path ? (
    <img
      src={patientImageUrl(
        article.thumbnail.content_path,
        article.id,
        article.version_id,
        article.content_language,
      )}
      alt={article.thumbnail.alt}
      className={detail ? "img-thumbnail w-100 patient-article-cover" : "blog-img object-fit-cover"}
      loading="lazy"
      onError={() => setFailedPath(article.thumbnail?.content_path ?? null)}
    />
  ) : (
    <figure
      className="patient-article-placeholder bg-light text-muted d-flex align-items-center justify-content-center"
      aria-label={t("patientArticles.noImage")}
    >
      <i className="ri-article-line fs-1" aria-hidden="true" />
    </figure>
  );
}

export function ArticleStatus({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: boolean;
  retry: () => unknown;
}) {
  const { t } = useTranslation();
  return loading ? (
    <output className="d-block py-3">{t("patientArticles.loading")}</output>
  ) : error ? (
    <div role="alert" className="alert alert-warning">
      {t("patientArticles.unavailable")}{" "}
      <button type="button" className="btn btn-light btn-sm" onClick={() => void retry()}>
        {t("patientArticles.retry")}
      </button>
    </div>
  ) : null;
}

function TermFilter({
  kind,
  value,
  onChange,
  language,
}: {
  kind: "category" | "tag";
  value?: string;
  onChange: (value: string) => void;
  language: "en" | "fa";
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const result = usePatientArticleTermsQuery(
    { kind, q: search, page, language },
    { refetchOnMountOrArgChange: true },
  );
  const label = t(`patientArticles.${kind}`);
  return (
    <div className="col-md-4">
      <label className="form-label" htmlFor={`article-${kind}`}>
        {label}
      </label>
      <div className="input-group mb-2">
        <input
          aria-label={t("patientArticles.findTerm", { kind: label })}
          className="form-control"
          value={q}
          maxLength={120}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setSearch(q);
              setPage(1);
            }
          }}
        />
        <button
          type="button"
          className="btn btn-light"
          onClick={() => {
            setSearch(q);
            setPage(1);
          }}
        >
          {t("patientArticles.search")}
        </button>
      </div>
      <select
        id={`article-${kind}`}
        className="form-select"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={result.isFetching}
      >
        <option value="">{t("patientArticles.all")}</option>
        {value && !result.currentData?.items.some((term) => term.id === value) && (
          <option value={value}>{t("patientArticles.selectedFilter")}</option>
        )}
        {result.currentData?.items.map((term) => (
          <option key={term.id} value={term.id}>
            {term.label}
          </option>
        ))}
      </select>
      {result.isError && <small role="alert">{t("patientArticles.unavailable")}</small>}
      {result.currentData && result.currentData.pagination.last_page > 1 && (
        <div className="d-flex gap-2 mt-1">
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={page <= 1 || result.isFetching}
            onClick={() => setPage(page - 1)}
          >
            {t("patientArticles.previous")}
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={page >= result.currentData.pagination.last_page || result.isFetching}
            onClick={() => setPage(page + 1)}
          >
            {t("patientArticles.next")}
          </button>
        </div>
      )}
    </div>
  );
}

function Library() {
  const { t, i18n } = useTranslation();
  const language: "en" | "fa" = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [parameters, setParameters] = useSearchParams();
  const parsed = libraryQuerySchema.safeParse(Object.fromEntries(parameters));
  const [search, setSearch] = useState(parameters.get("q") ?? "");
  useEffect(() => {
    document.title = t("patientArticles.title");
  }, [t]);
  const query = parsed.success ? { ...parsed.data, language } : { language };
  const result = usePatientArticlesQuery(query, {
    skip: !parsed.success,
    refetchOnMountOrArgChange: true,
  });
  const set = (name: string, value: string) => {
    const next = new URLSearchParams(parameters);
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParameters(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    set("q", search.trim());
  };
  const data = result.currentData;
  const filtered = parameters.has("q") || parameters.has("category_id") || parameters.has("tag_id");
  return (
    <div className="page-content patient-articles">
      <Container fluid>
        <BreadCrumb title={t("patientArticles.title")} pageTitle={t("navigation.content")} />
        <form onSubmit={submit} className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label" htmlFor="article-search">
              {t("patientArticles.search")}
            </label>
            <div className="input-group">
              <input
                id="article-search"
                type="search"
                className="form-control"
                value={search}
                maxLength={120}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                {t("patientArticles.search")}
              </button>
            </div>
          </div>
          <TermFilter
            kind="category"
            value={parsed.success ? parsed.data.category_id : undefined}
            language={language}
            onChange={(value) => set("category_id", value)}
          />
          <TermFilter
            kind="tag"
            value={parsed.success ? parsed.data.tag_id : undefined}
            language={language}
            onChange={(value) => set("tag_id", value)}
          />
          <div>
            <button type="button" className="btn btn-light" onClick={() => setParameters({})}>
              {t("patientArticles.reset")}
            </button>
          </div>
        </form>
        {!parsed.success ? (
          <p role="alert" className="alert alert-warning">
            {t("patientArticles.invalidQuery")}
          </p>
        ) : (
          <>
            <ArticleStatus
              loading={result.isFetching}
              error={result.isError}
              retry={result.refetch}
            />
            {!result.isFetching && !result.isError && data && (
              <>
                {data.items.length === 0 ? (
                  <p className="alert alert-info">
                    {t(filtered ? "patientArticles.noResults" : "patientArticles.empty")}
                  </p>
                ) : (
                  <div className="row">
                    {data.items.map((article) => (
                      <div key={article.id} className="col-xxl-3 col-lg-6">
                        <article
                          className="card overflow-hidden blog-grid-card"
                          lang={article.content_language}
                          dir={article.content_language === "fa" ? "rtl" : "ltr"}
                        >
                          <div className="position-relative overflow-hidden">
                            <ArticleCover article={article} />
                          </div>
                          <div className="card-body">
                            <div className="d-flex gap-1 flex-wrap mb-2">
                              {article.categories.map((term) => (
                                <span
                                  key={term.id}
                                  className="badge bg-primary-subtle text-primary"
                                >
                                  {term.label}
                                </span>
                              ))}
                            </div>
                            <h5 className="card-title">
                              <Link
                                className="text-reset"
                                to={`/my/articles/${article.id}${parameters.size ? `?${parameters}` : ""}`}
                              >
                                {article.title}
                              </Link>
                            </h5>
                            {article.tags.length > 0 && (
                              <div className="d-flex gap-1 flex-wrap mb-2">
                                {article.tags.map((term) => (
                                  <span
                                    key={term.id}
                                    className="badge bg-success-subtle text-success"
                                  >
                                    {term.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {article.summary && (
                              <p className="text-muted mb-2">{article.summary}</p>
                            )}
                            {article.fallback_used && (
                              <p className="small text-muted">
                                {t("patientArticles.fallback", {
                                  language: t(
                                    `patientArticles.language.${article.content_language}`,
                                  ),
                                })}
                              </p>
                            )}
                            <Link
                              className="link link-primary text-decoration-underline link-offset-1"
                              to={`/my/articles/${article.id}${parameters.size ? `?${parameters}` : ""}`}
                            >
                              {t("patientArticles.read")}{" "}
                              <i className="ri-arrow-right-up-line" aria-hidden="true" />
                            </Link>
                          </div>
                        </article>
                      </div>
                    ))}
                  </div>
                )}
                <div className="d-flex align-items-center flex-wrap gap-2 mb-4">
                  <span>
                    {t("patientArticles.page", {
                      page: data.pagination.current_page.toLocaleString(language),
                      pages: data.pagination.last_page.toLocaleString(language),
                      total: data.pagination.total.toLocaleString(language),
                    })}
                  </span>
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={data.pagination.current_page <= 1}
                    onClick={() => {
                      const next = new URLSearchParams(parameters);
                      next.set("page", String(data.pagination.current_page - 1));
                      setParameters(next);
                    }}
                  >
                    {t("patientArticles.previous")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={data.pagination.current_page >= data.pagination.last_page}
                    onClick={() => {
                      const next = new URLSearchParams(parameters);
                      next.set("page", String(data.pagination.current_page + 1));
                      setParameters(next);
                    }}
                  >
                    {t("patientArticles.next")}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </Container>
    </div>
  );
}

export default function PatientArticles() {
  const [parameters] = useSearchParams();
  return (
    <PatientArticleAccess>
      <Library key={parameters.toString()} />
    </PatientArticleAccess>
  );
}
