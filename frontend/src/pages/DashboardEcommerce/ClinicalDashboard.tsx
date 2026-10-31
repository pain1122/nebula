import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, Col, Container, Row } from "reactstrap";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { usePanelProfileQuery } from "../../modules/checkupino/profiles/api";
import AppointmentCalendar from "./AppointmentCalendar";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

export default function ClinicalDashboard({ doctor }: { readonly doctor: boolean }) {
  const [now] = useState(() => new Date().toISOString());
  const { userProfile } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const query = usePanelProfileQuery(null, { refetchOnMountOrArgChange: true });
  const profile =
    !query.error &&
    !query.isFetching &&
    query.currentData?.user.id === userProfile?.id &&
    query.currentData?.mode === "self"
      ? query.currentData
      : undefined;
  const reservations = doctor ? "/doctor/reservations" : "/my/reservations";
  const metrics = profile
    ? ([
        ["upcoming", profile.summary.upcoming, "ri-calendar-check-line", "primary"],
        ["medical_requests", profile.summary.medical_requests, "ri-folder-shield-2-line", "info"],
        ["published_reports", profile.summary.published_reports, "ri-file-text-line", "success"],
        [
          doctor ? "completed" : "questionnaire_submissions",
          doctor ? profile.summary.completed : profile.summary.questionnaire_submissions,
          doctor ? "ri-checkbox-circle-line" : "ri-survey-line",
          "warning",
        ],
      ] as const)
    : [];
  return (
    <div className="page-content">
      <Container fluid>
        <Card className="bg-primary-subtle overflow-hidden">
          <CardBody className="p-4 d-flex gap-3 align-items-center flex-wrap">
            <span className="avatar-lg flex-shrink-0">
              <span className="avatar-title bg-primary text-white rounded-circle fs-1">
                <i className={doctor ? "ri-stethoscope-line" : "ri-heart-pulse-line"} />
              </span>
            </span>
            <div className="flex-grow-1">
              <p className="text-primary fw-semibold mb-1">
                {t(doctor ? "clinicalHome.doctor" : "clinicalHome.patient")}
              </p>
              <h1 className="h3 mb-2">
                {t("clinicalHome.welcome", { name: userProfile?.name ?? "" })}
              </h1>
              <p className="text-muted mb-0">
                {t(doctor ? "clinicalHome.doctorIntro" : "clinicalHome.patientIntro")}
              </p>
            </div>
            <Link className="btn btn-primary" to={doctor ? reservations : "/book"}>
              {t(doctor ? "booking.doctorReservations" : "booking.title")}
            </Link>
            <button
              className="btn btn-light"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              {t("adminReservations.refresh")}
            </button>
          </CardBody>
        </Card>
        {query.isFetching ? (
          <LoadingState locale={locale} />
        ) : query.error ? (
          <ErrorState error={query.error} locale={locale} onRetry={() => void query.refetch()} />
        ) : !profile ? (
          <p role="alert">{t("profileOverview.unavailable")}</p>
        ) : (
          <>
            <Row>
              {metrics.map(([key, amount, icon, color]) => (
                <Col md={6} xl={3} key={key}>
                  <Card className="card-animate">
                    <CardBody className="d-flex align-items-center gap-3">
                      <span className="avatar-sm">
                        <span
                          className={"avatar-title rounded bg-" + color + "-subtle text-" + color}
                        >
                          <i className={icon + " fs-2"} />
                        </span>
                      </span>
                      <div>
                        <p className="text-muted mb-1">{t("profileOverview.count." + key)}</p>
                        <h2 className="mb-0">{formatProductNumber(amount, locale)}</h2>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
            {doctor && <AppointmentCalendar now={now} doctorOwnerId={profile.user.id} />}
            <Row>
              <Col xl={8}>
                <Card>
                  <CardBody>
                    <div className="d-flex justify-content-between gap-2 mb-3">
                      <h2 className="h5 mb-0">{t("clinicalHome.appointments")}</h2>
                      <Link to={reservations}>{t("dashboard.viewAll")}</Link>
                    </div>
                    {profile.reservations.length ? (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle">
                          <thead>
                            <tr>
                              <th>{t("dashboard.appointment")}</th>
                              <th>{t("booking.status")}</th>
                              <th>{t("medical.title")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profile.reservations.map((row) => (
                              <tr key={row.public_id}>
                                <td>
                                  {row.starts_at
                                    ? formatProductTimestamp(row.starts_at, locale)
                                    : "—"}
                                  <small className="d-block text-muted">
                                    <bdi>{row.timezone}</bdi>
                                  </small>
                                </td>
                                <td>
                                  <span className="badge bg-primary-subtle text-primary">
                                    {t("booking.state." + row.status)}
                                  </span>
                                </td>
                                <td>
                                  <Link
                                    className="btn btn-soft-success btn-sm"
                                    to={
                                      (doctor ? "/doctor" : "/my") +
                                      "/reservations/" +
                                      row.public_id +
                                      "/medical"
                                    }
                                  >
                                    {t("clinicalHome.openFiles")}
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted">{t("profileOverview.empty")}</p>
                    )}
                    <p className="text-muted small mb-0">{t("profileOverview.previewBound")}</p>
                  </CardBody>
                </Card>
              </Col>
              <Col xl={4}>
                <Card>
                  <CardBody>
                    <h2 className="h5 mb-3">{t("clinicalHome.quickAccess")}</h2>
                    <div className="d-grid gap-2">
                      <Link className="btn btn-soft-primary text-start" to={reservations}>
                        <i className="ri-calendar-line me-2" />
                        {t(doctor ? "booking.doctorReservations" : "booking.myReservations")}
                      </Link>
                      {!doctor && (
                        <Link className="btn btn-soft-info text-start" to="/my/questionnaire">
                          <i className="ri-survey-line me-2" />
                          {t("questionnaire.catalog")}
                        </Link>
                      )}
                      <Link className="btn btn-light text-start" to="/profile">
                        <i className="ri-user-line me-2" />
                        {t("profileOverview.title")}
                      </Link>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <h2 className="h5 mb-3">{t("profileOverview.activity")}</h2>
                    <div className="acitivity-timeline">
                      {profile.activity.length ? (
                        profile.activity.slice(0, 5).map((row) => (
                          <div className="acitivity-item py-2 border-bottom" key={row.public_id}>
                            <p className="mb-1">{t("profileOverview.action." + row.action)}</p>
                            <small className="text-muted">
                              {row.created_at
                                ? formatProductTimestamp(row.created_at, locale)
                                : "—"}
                            </small>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted mb-0">{t("profileOverview.empty")}</p>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </div>
  );
}
