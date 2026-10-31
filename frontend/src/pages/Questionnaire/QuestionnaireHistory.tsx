import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardBody, Col, Row } from "reactstrap";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  useMyQuestionnaireSubmissionQuery,
  useMyQuestionnaireSubmissionsQuery,
} from "../../modules/checkupino/questionnaire/api";
import { questionnaireText } from "../../modules/checkupino/questionnaire/definition";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

export default function QuestionnaireHistory() {
  const { t, i18n } = useTranslation();
  const { userProfile } = useShellAuth();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [search, setSearch] = useSearchParams();
  const id = search.get("submission");
  const validId = !!id && /^[0-9a-hjkmnp-tv-z]{26}$/i.test(id);
  const rawPage = Number(search.get("page") ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const allowed = userProfile?.roles.includes("patient") ?? false;
  const list = useMyQuestionnaireSubmissionsQuery(page, {
    skip: !allowed || !!id,
    refetchOnMountOrArgChange: true,
  });
  const detail = useMyQuestionnaireSubmissionQuery(id ?? "", {
    skip: !allowed || !validId,
    refetchOnMountOrArgChange: true,
  });
  const query = id ? detail : list;
  const item = detail.currentData?.data;
  const rows = list.currentData?.data;
  const pagination = list.currentData?.meta.pagination;
  const dataOwner = id ? item?.owner_id : rows?.owner_id;
  const unavailable =
    !allowed || (!!id && !validId) || (dataOwner !== undefined && dataOwner !== userProfile?.id);
  const submitted = (value: string | null) =>
    value ? formatProductTimestamp(value, locale) : t("adminManage.unavailable");
  return (
    <section aria-label={t("questionnaire.history")}>
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <h2 className="h4 mb-0">{t("questionnaire.history")}</h2>
        <div className="d-flex gap-2">
          {id && (
            <button
              className="btn btn-light"
              onClick={() => setSearch({ view: "submissions", page: String(page) })}
            >
              {t("questionnaire.backToHistory")}
            </button>
          )}
          {!unavailable && (
            <button
              className="btn btn-soft-primary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t("adminReservations.refresh")}
            </button>
          )}
        </div>
      </div>
      {unavailable ? (
        <p role="alert">{t("adminManage.unavailable")}</p>
      ) : query.isFetching ? (
        <LoadingState locale={locale} />
      ) : query.error ? (
        <ErrorState error={query.error} locale={locale} onRetry={() => void query.refetch()} />
      ) : id && item ? (
        <>
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Card className="h-100">
                <CardBody>
                  <span className="badge bg-success-subtle text-success mb-3">
                    {t("questionnaire.submitted")}
                  </span>
                  <h3 className="h5" dir="auto">
                    {item.questionnaire_title}
                  </h3>
                  <p>
                    {t("questionnaire.savedVersion", {
                      version: formatProductNumber(item.questionnaire_version, locale),
                    })}
                  </p>
                  <time dateTime={item.submitted_at ?? undefined}>
                    {submitted(item.submitted_at)}
                  </time>
                </CardBody>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="h-100 bg-info-subtle">
                <CardBody>
                  <h3 className="h5">{t("questionnaire.savedResult")}</h3>
                  <p className="fs-3">
                    {t("questionnaire.score")}: {formatProductNumber(item.total_score, locale)}
                  </p>
                  <h4 className="h6" dir="auto">
                    {item.result_title}
                  </h4>
                  {item.answers_available && (
                    <p className="mb-0 text-break" dir="auto" style={{ whiteSpace: "pre-wrap" }}>
                      {questionnaireText(item.result_body_html)}
                    </p>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
          <p className="text-muted">{t("questionnaire.snapshotNote")}</p>
          {!item.answers_available ? (
            <output className="d-block">{t("questionnaire.expiredAnswers")}</output>
          ) : (
            <Row className="g-3">
              {item.answers.map((answer, index) => (
                <Col md={6} key={index}>
                  <Card className="h-100">
                    <CardBody>
                      <span className="badge bg-primary-subtle text-primary mb-2">
                        {formatProductNumber(index + 1, locale)}
                      </span>
                      <h3 className="h6 text-break" dir="auto">
                        {answer.question_text}
                      </h3>
                      <p className="mb-0 text-break" dir="auto">
                        {answer.choice_text}
                      </p>
                    </CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      ) : !id && rows ? (
        <>
          <Row className="g-3">
            {rows.items.map((entry) => (
              <Col sm={6} xl={4} key={entry.public_id}>
                <Card className="card-animate h-100">
                  <CardBody>
                    <i className="ri-file-list-3-line fs-1 text-primary" aria-hidden="true" />
                    <h3 className="h5 mt-3" dir="auto">
                      {entry.questionnaire_title}
                    </h3>
                    <p className="text-muted">{submitted(entry.submitted_at)}</p>
                    <p dir="auto">{entry.result_title ?? t("questionnaire.submitted")}</p>
                    <Link
                      className="btn btn-soft-primary"
                      to={`?view=submissions&page=${page}&submission=${entry.public_id}`}
                    >
                      {t("questionnaire.viewSubmission")}
                    </Link>
                  </CardBody>
                </Card>
              </Col>
            ))}
          </Row>
          {!rows.items.length && (
            <Card>
              <CardBody>{t("questionnaire.historyEmpty")}</CardBody>
            </Card>
          )}
          {pagination && pagination.last_page > 1 && (
            <nav className="d-flex gap-2 mt-4" aria-label={t("questionnaire.history")}>
              <button
                className="btn btn-light"
                disabled={page <= 1}
                onClick={() => setSearch({ view: "submissions", page: String(page - 1) })}
              >
                {t("booking.previous")}
              </button>
              <span className="align-self-center">
                {formatProductNumber(page, locale)} /{" "}
                {formatProductNumber(pagination.last_page, locale)}
              </span>
              <button
                className="btn btn-light"
                disabled={page >= pagination.last_page}
                onClick={() => setSearch({ view: "submissions", page: String(page + 1) })}
              >
                {t("booking.next")}
              </button>
            </nav>
          )}
        </>
      ) : null}
    </section>
  );
}
