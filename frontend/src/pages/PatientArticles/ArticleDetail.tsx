import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Container } from "reactstrap";
import { useTranslation } from "react-i18next";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import {
  patientArticleHtml,
  patientImageUrl,
  usePatientArticleQuery,
  usePatientArticlesQuery,
  type PatientArticleDetail,
} from "../../modules/checkupino/patientArticles/api";
import { ArticleCover, ArticleStatus, PatientArticleAccess } from "./index";

function RecommendedReading({
  article,
  language,
}: {
  readonly article: PatientArticleDetail;
  readonly language: "en" | "fa";
}) {
  const { t } = useTranslation();
  const tag = article.tags[0]?.id,
    category = article.categories[0]?.id;
  const related = usePatientArticlesQuery(
    {
      language,
      page: 1,
      per_page: 4,
      ...(tag ? { tag_id: tag } : category ? { category_id: category } : {}),
    },
    { refetchOnMountOrArgChange: true },
  );
  const matches = related.currentData?.items.filter((item) => item.id !== article.id) ?? [];
  const needsFallback = Boolean(
    (tag || category) &&
    related.currentData &&
    !related.isFetching &&
    !related.isError &&
    matches.length === 0,
  );
  const general = usePatientArticlesQuery(
    { language, page: 1, per_page: 4 },
    {
      skip: !needsFallback,
      refetchOnMountOrArgChange: true,
    },
  );
  const result = needsFallback ? general : related;
  const items = (
    needsFallback
      ? (general.currentData?.items.filter((item) => item.id !== article.id) ?? [])
      : matches
  ).slice(0, 3);
  return (
    <section className="mt-4" aria-label={t("patientArticles.recommended")}>
      <h6>{t("patientArticles.recommended")}</h6>
      <p className="small text-muted">{t("patientArticles.recommendedHint")}</p>
      <ArticleStatus loading={result.isFetching} error={result.isError} retry={result.refetch} />
      {!result.isFetching &&
        !result.isError &&
        (items.length ? (
          <ul className="list-unstyled">
            {items.map((item) => (
              <li
                key={item.id}
                className="mb-3 patient-article-recommendation"
                lang={item.content_language}
                dir={item.content_language === "fa" ? "rtl" : "ltr"}
              >
                <Link className="d-flex align-items-start gap-2" to={`/my/articles/${item.id}`}>
                  {item.thumbnail && (
                    <img
                      loading="lazy"
                      alt=""
                      src={patientImageUrl(
                        item.thumbnail.content_path,
                        item.id,
                        item.version_id,
                        item.content_language,
                      )}
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  )}
                  <span>{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small text-muted">{t("patientArticles.noRecommendations")}</p>
        ))}
    </section>
  );
}

function Detail() {
  const { articleId = "" } = useParams();
  const [parameters] = useSearchParams();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const valid = /^[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(articleId);
  const result = usePatientArticleQuery(
    { id: articleId, language },
    { skip: !valid, refetchOnMountOrArgChange: true },
  );
  const article = result.currentData;
  useEffect(() => {
    document.title = article?.title ?? t("patientArticles.title");
  }, [article?.title, t]);
  const back = `/my/articles${parameters.size ? `?${parameters}` : ""}`;
  const filter = (kind: "category" | "tag", id: string) => {
    const query = new URLSearchParams();
    query.set(`${kind}_id`, id);
    return `/my/articles?${query}`;
  };
  return (
    <div className="page-content patient-articles">
      <Container fluid>
        <BreadCrumb title={t("patientArticles.article")} pageTitle={t("patientArticles.title")} />
        <Link to={back} className="btn btn-light mb-3">
          {t("patientArticles.back")}
        </Link>
        {!valid ? (
          <p role="alert">{t("patientArticles.unavailable")}</p>
        ) : (
          <ArticleStatus
            loading={result.isFetching}
            error={result.isError}
            retry={result.refetch}
          />
        )}
        {valid && !result.isFetching && !result.isError && article && (
          <div className="row justify-content-center">
            <div className="col-xxl-10">
              <article className="card">
                <div className="card-body">
                  <header
                    className="text-center mb-4"
                    lang={article.content_language}
                    dir={article.content_language === "fa" ? "rtl" : "ltr"}
                  >
                    <p className="text-success text-uppercase mb-2">
                      {article.categories.map((term) => term.label).join(" · ")}
                    </p>
                    <h4 className="mb-2">{article.title}</h4>
                    {article.summary && <p className="text-muted mb-4">{article.summary}</p>}
                    <div className="d-flex align-items-center justify-content-center flex-wrap gap-2">
                      {article.tags.map((term) => (
                        <Link
                          to={filter("tag", term.id)}
                          key={term.id}
                          className="badge bg-primary-subtle text-primary"
                        >
                          {term.label}
                        </Link>
                      ))}
                    </div>
                    {article.fallback_used && (
                      <p className="small text-muted mt-2">
                        {t("patientArticles.fallback", {
                          language: t(`patientArticles.language.${article.content_language}`),
                        })}
                      </p>
                    )}
                  </header>
                  <ArticleCover article={article} detail />
                  <div className="row mt-4">
                    <aside className="col-lg-3">
                      <h6 className="pb-1">{t("patientArticles.author")}</h6>
                      <div className="d-flex gap-2 mb-3">
                        <div
                          className="avatar-sm rounded bg-primary-subtle text-primary d-flex align-items-center justify-content-center flex-shrink-0"
                          aria-hidden="true"
                        >
                          {Array.from(article.author.display_name.trim())[0] ?? ""}
                        </div>
                        <div className="flex-grow-1">
                          <h5 className="mb-1">
                            <bdi>{article.author.display_name}</bdi>
                          </h5>
                        </div>
                      </div>
                      <RecommendedReading
                        key={`${article.version_id}-${language}`}
                        article={article}
                        language={language}
                      />
                      {article.categories.length > 0 && (
                        <section className="mt-4">
                          <h6>{t("patientArticles.category")}</h6>
                          <ul className="list-unstyled">
                            {article.categories.map((term) => (
                              <li key={term.id}>
                                <Link to={filter("category", term.id)}>{term.label}</Link>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                      {article.tags.length > 0 && (
                        <section className="mt-4">
                          <h6>{t("patientArticles.tag")}</h6>
                          <div className="d-flex gap-1 flex-wrap">
                            {article.tags.map((term) => (
                              <Link
                                to={filter("tag", term.id)}
                                key={term.id}
                                className="badge bg-success-subtle text-success"
                              >
                                {term.label}
                              </Link>
                            ))}
                          </div>
                        </section>
                      )}
                      {article.source_links.length > 0 && (
                        <section className="mt-4">
                          <h6>{t("patientArticles.sources")}</h6>
                          <ul className="list-unstyled">
                            {article.source_links.map((source) => (
                              <li key={source.url} className="mb-2">
                                <a href={source.url} rel="noopener noreferrer" target="_blank">
                                  {source.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </aside>
                    <div className="col-lg-9">
                      <div
                        className="patient-article-body"
                        lang={article.content_language}
                        dir={article.content_language === "fa" ? "rtl" : "ltr"}
                        onErrorCapture={(event) => {
                          if (event.target instanceof HTMLImageElement)
                            event.target.replaceWith(
                              document.createTextNode(t("patientArticles.noImage")),
                            );
                        }}
                        dangerouslySetInnerHTML={{
                          __html: patientArticleHtml(article.body_html, article),
                        }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

export default function ArticleDetail() {
  return (
    <PatientArticleAccess>
      <Detail />
    </PatientArticleAccess>
  );
}
