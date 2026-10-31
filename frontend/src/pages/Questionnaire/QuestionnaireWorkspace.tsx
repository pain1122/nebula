import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { usePublishedQuestionnairesQuery } from "../../modules/checkupino/questionnaire/api";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  normalizeProductLocale,
  formatProductNumber,
} from "../../modules/checkupino/preferences/localization";
import PatientQuestionnaire from "./PatientQuestionnaire";
import QuestionnaireHistory from "./QuestionnaireHistory";

export default function QuestionnaireWorkspace() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const [page, setPage] = useState(1);
  const history = search.get("view") === "submissions" || search.has("submission");
  const query = usePublishedQuestionnairesQuery(page, {
    skip: history,
    refetchOnMountOrArgChange: true,
  });
  const slug = search.get("slug");
  const validSlug =
    !history && slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 255 ? slug : null;
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  // No remote cover URL is fetched: the thumbnail publication workflow is a separate gate.
  return (
    <>
      <div className="page-content">
        <Container fluid>
          <Card className="bg-info-subtle">
            <CardBody className="p-4 d-flex align-items-center gap-3 flex-wrap">
              <span className="avatar-lg">
                <span className="avatar-title rounded-circle bg-info fs-1">
                  <i className="ri-survey-line" />
                </span>
              </span>
              <div>
                <h1 className="h3">{t("questionnaire.catalog")}</h1>
                <p className="text-muted mb-0">{t("questionnaire.catalogIntro")}</p>
              </div>
              {!history && (
                <button
                  className="btn btn-light ms-auto"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {t("adminReservations.refresh")}
                </button>
              )}
            </CardBody>
          </Card>
          <nav className="nav nav-pills gap-2 mb-4" aria-label={t("questionnaire.catalog")}>
            <Link
              className={"nav-link " + (!history ? "active" : "")}
              aria-current={!history ? "page" : undefined}
              to="?"
            >
              {t("questionnaire.available")}
            </Link>
            <Link
              className={"nav-link " + (history ? "active" : "")}
              aria-current={history ? "page" : undefined}
              to="?view=submissions"
            >
              {t("questionnaire.history")}
            </Link>
          </nav>
          {history && <QuestionnaireHistory />}
          {!history &&
            !validSlug &&
            (query.isFetching ? (
              <LoadingState locale={locale} />
            ) : query.error ? (
              <ErrorState
                error={query.error}
                locale={locale}
                onRetry={() => void query.refetch()}
              />
            ) : (
              <>
                <Row className="g-3">
                  {query.currentData?.data.map((item) => (
                    <Col sm={6} xl={4} key={item.slug}>
                      <Card
                        className={
                          "card-animate h-100 border " +
                          (validSlug === item.slug ? "border-primary" : "")
                        }
                      >
                        <div
                          className="bg-primary-subtle rounded-top p-5 text-center"
                          aria-hidden="true"
                        >
                          <i className="ri-survey-line display-3 text-primary" />
                        </div>
                        <CardBody className="d-flex flex-column">
                          <span className="badge bg-success-subtle text-success align-self-start mb-3">
                            {t("questionnaire.published")}
                          </span>
                          <h2 className="h5">{item.title}</h2>
                          <p className="text-muted">
                            {t("questionnaire.questionCount", {
                              count: item.questions_count,
                              amount: formatProductNumber(item.questions_count, locale),
                            })}
                          </p>
                          <button
                            className="btn btn-soft-primary mt-auto"
                            onClick={() => setSearch({ slug: item.slug })}
                          >
                            {t("questionnaire.start")}
                          </button>
                        </CardBody>
                      </Card>
                    </Col>
                  ))}
                </Row>
                {!query.currentData?.data.length && (
                  <p className="text-muted">{t("questionnaire.empty")}</p>
                )}
                {query.currentData && query.currentData.meta.last_page > 1 && (
                  <div className="d-flex gap-2 mt-4">
                    <button
                      className="btn btn-light"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      {t("booking.previous")}
                    </button>
                    <button
                      className="btn btn-light"
                      disabled={page >= query.currentData.meta.last_page}
                      onClick={() => setPage(page + 1)}
                    >
                      {t("booking.next")}
                    </button>
                  </div>
                )}
              </>
            ))}
          {!history && slug && !validSlug && <p role="alert">{t("adminManage.unavailable")}</p>}
          {validSlug && (
            <div className="d-flex align-items-center justify-content-between mt-4">
              <h2 className="h4">{t("questionnaire.yourResponses")}</h2>
              <button className="btn btn-light" onClick={() => setSearch({})}>
                {t("questionnaire.backToList")}
              </button>
            </div>
          )}
        </Container>
      </div>
      {validSlug && <PatientQuestionnaire key={validSlug} slug={validSlug} embedded />}
    </>
  );
}
