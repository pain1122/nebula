import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  adaptMedicalDetail,
  adminMedicalDownloadUrl,
  useAdminMedicalQuery,
  validPublicId,
} from "../../modules/checkupino/administration/api";
import { checkupinoTransport } from "../../modules/checkupino/api/transport";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import ActionDialog, { type ActionTarget } from "./ActionDialog";

export default function MedicalDetail() {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const { requestId = "" } = useParams();
  const [search] = useSearchParams();
  const valid = validPublicId(requestId);
  const { currentData, isFetching, error, refetch } = useAdminMedicalQuery(requestId, {
    skip: !valid || !capabilities.accessAdminPanel,
    refetchOnMountOrArgChange: true,
  });
  const data = !error && !isFetching ? currentData : undefined;
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  const row = data?.medical_request;
  const retained =
    !uncertain && !!row && (!row.retention_until || Date.parse(row.retention_until) > clock);
  const action = (
    kind: "review" | "draft" | "publish",
    reportId?: string,
    predecessor?: string,
    text = "",
  ) => {
    if (!data || !row || !retained) return;
    setBody(text);
    setEditing(kind === "draft");
    setNotice(false);
    setTarget({
      title: t(`adminManage.${kind}`),
      method: "POST",
      path: `/api/admin/medical-requests/${requestId}/${kind === "review" ? "review" : kind === "publish" ? `reports/${reportId}/publish` : "reports"}`,
      body:
        kind === "draft"
          ? {
              ...(reportId ? { draft_id: reportId, expected_body: text } : {}),
              ...(predecessor ? { supersedes_report_id: predecessor } : {}),
            }
          : {},
      verify: async (signal) => {
        const response = await checkupinoTransport.request({
          path: `/api/admin/medical-requests/${requestId}`,
          method: "GET",
          signal,
        });
        const fresh = adaptMedicalDetail(response.data, requestId);
        if (
          fresh.medical_request.status !== row.status ||
          JSON.stringify(fresh.reports) !== JSON.stringify(data.reports) ||
          ((kind === "review" || kind === "publish") && fresh.medical_request.eligible_count === 0)
        )
          throw new Error("Clinical eligibility changed.");
      },
    });
  };
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.medicalDetail")}
          pageTitle={t("adminManage.medical-requests")}
        />
        <Card>
          <CardHeader className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="card-title flex-grow-1 mb-0">
              {row?.title ?? t("adminManage.medicalDetail")}
            </h5>
            <Link to={`/medical-requests?${search.toString()}`} className="btn btn-light">
              {t("adminManage.back")}
            </Link>
            <button
              className="btn btn-light"
              disabled={!valid || isFetching}
              onClick={() =>
                void refetch().then((result) => {
                  if (!result.error) setUncertain(false);
                })
              }
            >
              {t("adminReservations.refresh")}
            </button>
          </CardHeader>
          {!valid || error ? (
            <CardBody>
              <p role="alert" className="alert alert-warning">
                {t("adminManage.unavailable")}
              </p>
            </CardBody>
          ) : isFetching ? (
            <CardBody>
              <output>{t("adminManage.loading")}</output>
            </CardBody>
          ) : null}
        </Card>
        {notice ? (
          <output className="alert alert-success d-block">{t("adminManage.saved")}</output>
        ) : null}
        {uncertain ? (
          <p className="alert alert-warning" role="alert">
            {t("adminManage.uncertain")}
          </p>
        ) : null}
        {row && data ? (
          <>
            <Row>
              <Col lg={6}>
                <Card>
                  <CardHeader>
                    <h5 className="card-title mb-0">{t("adminManage.context")}</h5>
                  </CardHeader>
                  <CardBody>
                    <p>
                      <Link to={`/reservations/${row.reservation.id}`}>
                        {t("adminManage.reservation_id")}{" "}
                        {formatProductNumber(row.reservation.id, locale)}
                      </Link>
                    </p>
                    <p>
                      <Link to={`/medical-requests?user_id=${row.patient.id}`}>
                        {row.patient.name}
                      </Link>
                    </p>
                    <p>
                      <Link to={`/medical-requests?doctor_id=${row.doctor.id}`}>
                        {row.doctor.name}
                      </Link>
                    </p>
                    <p>
                      {t("adminManage.requestedBy")}: {row.requested_by.name}
                    </p>
                    <p>
                      {t("adminManage.status")}: {t(`adminManage.state.${row.status}`)}
                    </p>
                    <p>
                      {t("adminManage.created_at")}:{" "}
                      {row.created_at
                        ? formatProductTimestamp(row.created_at, locale)
                        : t("adminReservations.missing")}
                    </p>
                  </CardBody>
                </Card>
              </Col>
              <Col lg={6}>
                <Card>
                  <CardHeader>
                    <h5 className="card-title mb-0">{t("adminManage.instructions")}</h5>
                  </CardHeader>
                  <CardBody>
                    <p className="text-break">
                      {row.instructions ?? t("adminReservations.missing")}
                    </p>
                    <p>
                      {t("adminManage.retention")}:{" "}
                      {row.retention_until
                        ? formatProductTimestamp(row.retention_until, locale)
                        : t("adminReservations.missing")}
                    </p>
                    <p>
                      {t("adminManage.progressHint")}:{" "}
                      {[row.received_count, row.awaiting_checks_count, row.eligible_count]
                        .map((n) => formatProductNumber(n, locale))
                        .join(" / ")}
                    </p>
                    {retained && row.status === "open" && row.eligible_count > 0 ? (
                      <button className="btn btn-primary" onClick={() => action("review")}>
                        {t("medical.startReview")}
                      </button>
                    ) : null}
                    {retained &&
                    row.status === "in_review" &&
                    !data.reports.some((r) => !r.supersedes_report_public_id) ? (
                      <button className="btn btn-primary" onClick={() => action("draft")}>
                        {t("medical.newDraft")}
                      </button>
                    ) : null}
                    <p className="text-muted mt-2">{t("adminManage.authorship")}</p>
                  </CardBody>
                </Card>
              </Col>
            </Row>
            <Card>
              <CardHeader>
                <h5 className="card-title mb-0">{t("adminManage.files")}</h5>
              </CardHeader>
              <CardBody>
                <div className="table-responsive">
                  <table className="table align-middle table-nowrap">
                    <thead>
                      <tr>
                        <th>{t("adminManage.title")}</th>
                        <th>{t("adminManage.bytes")}</th>
                        <th>{t("adminManage.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.files.map((file) => (
                        <tr key={file.public_id}>
                          <td>{file.label ?? file.public_id}</td>
                          <td>{formatProductNumber(file.size_bytes, locale)}</td>
                          <td>
                            <a
                              className="btn btn-sm btn-light"
                              href={adminMedicalDownloadUrl(requestId, file.public_id)}
                            >
                              {t("medical.download")}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.files.length ? <p>{t("adminManage.noEligibleFiles")}</p> : null}
              </CardBody>
            </Card>
            <Row>
              {data.reports.map((report) => (
                <Col lg={6} key={report.public_id}>
                  <Card>
                    <CardHeader>
                      <h5 className="card-title mb-0">{t(`adminManage.state.${report.status}`)}</h5>
                    </CardHeader>
                    <CardBody>
                      <p>
                        {report.author_name} ·{" "}
                        {report.published_at || report.created_at
                          ? formatProductTimestamp(
                              (report.published_at ?? report.created_at)!,
                              locale,
                            )
                          : t("adminReservations.missing")}
                      </p>
                      {report.supersedes_report_public_id ? (
                        <p className="text-muted text-break">
                          {t("adminManage.supersedes")}: {report.supersedes_report_public_id}
                        </p>
                      ) : null}
                      <p className="text-break">{report.body}</p>
                      <div className="d-flex flex-wrap gap-2">
                        {retained && report.can_manage ? (
                          <>
                            <button
                              className="btn btn-light"
                              onClick={() =>
                                action("draft", report.public_id, undefined, report.body)
                              }
                            >
                              {t("medical.editDraft")}
                            </button>
                            <button
                              className="btn btn-primary"
                              disabled={!row.eligible_count}
                              onClick={() => action("publish", report.public_id)}
                            >
                              {t("medical.confirmPublication")}
                            </button>
                          </>
                        ) : null}
                        {retained &&
                        row.status === "completed" &&
                        report.status === "published" &&
                        !data.reports.some(
                          (r) => r.supersedes_report_public_id === report.public_id,
                        ) ? (
                          <button
                            className="btn btn-light"
                            onClick={() => action("draft", undefined, report.public_id)}
                          >
                            {t("medical.amendReport")}
                          </button>
                        ) : null}
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        ) : null}
        {target ? (
          <ActionDialog
            onUncertain={() => setUncertain(true)}
            target={{
              ...target,
              body: { ...target.body, ...(editing ? { body: body.trim() } : {}) },
            }}
            valid={!editing || !!body.trim()}
            onClose={() => setTarget(null)}
            onSaved={() => {
              setTarget(null);
              setNotice(true);
              void refetch();
            }}
          >
            {editing ? (
              <>
                <label className="form-label" htmlFor="admin-report-body">
                  {t("adminManage.body")}
                </label>
                <textarea
                  id="admin-report-body"
                  className="form-control mb-3"
                  rows={8}
                  maxLength={20000}
                  required
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </>
            ) : null}
          </ActionDialog>
        ) : null}
      </Container>
    </div>
  );
}
