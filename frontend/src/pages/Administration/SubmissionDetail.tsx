import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  adaptSubmission,
  useAdminSubmissionQuery,
  validPublicId,
} from "../../modules/checkupino/administration/api";
import { checkupinoTransport } from "../../modules/checkupino/api/transport";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import ActionDialog, { type ActionTarget } from "./ActionDialog";
import DetailBox from "./DetailBox";

export default function SubmissionDetail() {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const { submissionId = "" } = useParams();
  const [search] = useSearchParams();
  const valid = validPublicId(submissionId);
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const { currentData, isFetching, error, refetch } = useAdminSubmissionQuery(submissionId, {
    skip: !valid || !capabilities.accessAdminPanel,
    refetchOnMountOrArgChange: true,
  });
  const row = !error && !isFetching ? currentData : undefined;
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.submissionDetail")}
          pageTitle={t("adminManage.questionnaire-submissions")}
        />
        <Card>
          <CardHeader className="d-flex gap-2 flex-wrap">
            <h5 className="card-title flex-grow-1 mb-0">
              {row?.questionnaire.title ?? t("adminManage.submissionDetail")}
            </h5>
            <Link className="btn btn-light" to={`/questionnaire-submissions?${search.toString()}`}>
              {t("adminManage.back")}
            </Link>
            <button
              className="btn btn-light"
              disabled={isFetching || !valid}
              onClick={() =>
                void refetch().then((result) => {
                  if (!result.error) setUncertain(false);
                })
              }
            >
              {t("adminReservations.refresh")}
            </button>
          </CardHeader>
          <CardBody>
            {uncertain ? (
              <p role="alert" className="alert alert-warning">
                {t("adminManage.uncertain")}
              </p>
            ) : null}
            {!valid || error ? (
              <p role="alert">{t("adminManage.unavailable")}</p>
            ) : isFetching ? (
              <output>{t("adminManage.loading")}</output>
            ) : null}
          </CardBody>
        </Card>
        {row ? (
          <>
            <Row>
              <DetailBox
                id="submission-owner"
                title={t("adminManage.submitter")}
                icon="ri-user-line"
                fields={[
                  [t("adminManage.submitter"), row.submitter_name],
                  [t("adminManage.phone"), row.submitter_phone],
                  [t("adminManage.owner_type"), t(`adminManage.state.${row.owner_type}`)],
                  [
                    t("adminManage.account_id"),
                    row.user_id ? (
                      <Link key="owner" to={`/questionnaire-submissions?user_id=${row.user_id}`}>
                        {formatProductNumber(row.user_id, locale)}
                      </Link>
                    ) : (
                      t("adminReservations.missing")
                    ),
                  ],
                ]}
              />
              <DetailBox
                id="submission-receipt"
                title={t("adminManage.submissionDetail")}
                icon="ri-file-list-3-line"
                fields={[
                  [t("adminReservations.publicId"), row.public_id],
                  [
                    t("adminManage.created_at"),
                    row.submitted_at
                      ? formatProductTimestamp(row.submitted_at, locale)
                      : t("adminReservations.missing"),
                  ],
                  [
                    t("adminManage.currentDefinition"),
                    <Link key="definition" to={`/questionnaires/${row.questionnaire_id}`}>
                      {row.questionnaire.title}
                    </Link>,
                  ],
                  [
                    t("adminManage.version"),
                    formatProductNumber(row.questionnaire_version, locale),
                  ],
                ]}
              />
              <DetailBox
                id="submission-result"
                title={t("adminManage.result")}
                icon="ri-award-line"
                columns={12}
                fields={[
                  [t("adminManage.score"), formatProductNumber(row.total_score, locale)],
                  [t("adminManage.title"), row.result_title],
                ]}
              >
                {row.answers_available && row.result_body_html ? (
                  <p dir="auto" className="text-break">
                    {row.result_body_html}
                  </p>
                ) : null}
                <p className="text-muted mb-0">
                  {t(
                    row.answers_available
                      ? "adminManage.snapshotNotice"
                      : "adminManage.expiredSnapshot",
                  )}
                </p>
              </DetailBox>
              {row.answers?.map((answer, index) => (
                <DetailBox
                  key={index}
                  id={`submission-answer-${index}`}
                  title={
                    <>
                      {t("adminManage.question")} {formatProductNumber(index + 1, locale)}
                    </>
                  }
                  icon="ri-question-answer-line"
                  answer
                >
                  <p dir="auto" className="fw-medium text-break">
                    {answer.question_text}
                  </p>
                  <dl className="row mb-0">
                    <div className="col-sm-8 mb-3">
                      <dt className="text-muted small fw-normal mb-1">{t("adminManage.choice")}</dt>
                      <dd className="fw-medium mb-0 text-break">
                        <bdi>{answer.choice_text}</bdi>
                      </dd>
                    </div>
                    <div className="col-sm-4 mb-3">
                      <dt className="text-muted small fw-normal mb-1">{t("adminManage.score")}</dt>
                      <dd className="fw-medium mb-0">
                        <bdi>{formatProductNumber(answer.score ?? 0, locale)}</bdi>
                      </dd>
                    </div>
                  </dl>
                </DetailBox>
              ))}
            </Row>
            <button
              className="btn btn-danger"
              disabled={uncertain}
              onClick={() =>
                setTarget({
                  title: t("adminManage.archive"),
                  method: "DELETE",
                  path: `/api/admin/questionnaire-submissions/by-public-id/${submissionId}`,
                  body: {},
                  verify: async (signal) => {
                    const response = await checkupinoTransport.request({
                      path: `/api/admin/questionnaire-submissions/by-public-id/${submissionId}`,
                      method: "GET",
                      signal,
                    });
                    adaptSubmission(response.data, submissionId);
                  },
                })
              }
            >
              {t("adminManage.archive")}
            </button>
          </>
        ) : null}
        {target ? (
          <ActionDialog
            onUncertain={() => setUncertain(true)}
            target={target}
            onClose={() => setTarget(null)}
            onSaved={() => navigate("/questionnaire-submissions", { replace: true })}
          />
        ) : null}
      </Container>
    </div>
  );
}
