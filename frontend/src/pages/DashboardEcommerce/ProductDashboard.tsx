import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import SimpleBar from "simplebar-react";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import { formatCatalogPrice } from "../../modules/checkupino/catalog/api";
import {
  dashboardStates,
  readDashboard,
  type Dashboard,
} from "../../modules/checkupino/dashboard/api";
import {
  formatProductDate,
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import { StoreVisitsCharts } from "./DashboardEcommerceCharts";
import AppointmentCalendar from "./AppointmentCalendar";
import ClinicalDashboard from "./ClinicalDashboard";

function ReportCard({
  title,
  path,
  children,
  marker,
}: {
  readonly title: string;
  readonly path: string;
  readonly children: ReactNode;
  readonly marker: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="card-height-100" data-dashboard-section={marker}>
      <CardHeader className="align-items-center d-flex">
        <h2 className="card-title mb-0 flex-grow-1">{title}</h2>
        <Link to={path} className="btn btn-soft-info btn-sm">
          {t("dashboard.viewAll")}
        </Link>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function Reports({ snapshot }: { readonly snapshot: Dashboard }) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage),
    d = snapshot.data;
  const n = (value: number) => formatProductNumber(value, locale);
  const summaries = [
    {
      key: "reservations",
      value: d.reservations.created,
      path: "/reservations",
      icon: "ri-calendar-2-line",
      color: "primary",
    },
    {
      key: "medical",
      value: d.medical_requests.created,
      path: "/medical-requests",
      icon: "ri-health-book-line",
      color: "success",
    },
    {
      key: "submissions",
      value: d.submissions.created,
      path: "/questionnaire-submissions",
      icon: "ri-survey-line",
      color: "info",
    },
    {
      key: "payments",
      value: d.payments.paid,
      path: "/payments",
      icon: "ri-bank-card-line",
      color: "warning",
    },
  ];
  return (
    <>
      <Row>
        {summaries.map((item) => (
          <Col xl={3} md={6} key={item.key}>
            <Card className="card-animate card-height-100" data-dashboard-section={item.key}>
              <CardBody>
                <div className="d-flex align-items-center">
                  <p className="text-uppercase fw-medium text-muted text-truncate mb-0">
                    {t(`dashboard.${item.key}`)}
                  </p>
                </div>
                <div className="d-flex align-items-end justify-content-between mt-4">
                  <div>
                    <h3 className="fs-22 fw-semibold ff-secondary mb-4">{n(item.value)}</h3>
                    {item.key === "payments" ? (
                      <div data-dashboard-payments>
                        {d.payments.by_currency.slice(0, 3).map((row) => (
                          <p className="small mb-1" key={row.currency}>
                            <bdi className="text-break">
                              {formatCatalogPrice(row.amount, row.currency, locale)}
                            </bdi>
                          </p>
                        ))}
                        {d.payments.more_currencies || d.payments.by_currency.length > 3 ? (
                          <p className="text-muted small">{t("dashboard.moreCurrencies")}</p>
                        ) : null}
                        {d.payments.pending_requests > 0 ? (
                          <p className="text-muted small">
                            {t("dashboard.pendingRequests")}: {n(d.payments.pending_requests)}
                          </p>
                        ) : null}
                        {d.payments.inconsistent_paid > 0 ? (
                          <p className="text-warning small">
                            {t("dashboard.inconsistent")}: {n(d.payments.inconsistent_paid)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <Link to={item.path} className="text-decoration-underline">
                      {t("dashboard.viewAll")}
                    </Link>
                  </div>
                  <div className="avatar-sm flex-shrink-0">
                    <span className={`avatar-title rounded fs-3 bg-${item.color}-subtle`}>
                      <i className={`text-${item.color} ${item.icon}`} />
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
      <Row>
        <Col xs={12}>
          <AppointmentCalendar now={snapshot.meta.generated_at} />
        </Col>
      </Row>
      <Row>
        {(["checkups", "doctors"] as const).map((kind) => (
          <Col xl={6} key={kind}>
            <ReportCard
              title={t(`dashboard.${kind}Rank`)}
              path={`/${kind}`}
              marker={kind === "doctors" ? "top-sellers" : "best-selling"}
            >
              <div className="table-responsive table-card">
                <table className="table table-centered table-hover align-middle table-nowrap mb-0">
                  <thead className="text-muted table-light">
                    <tr>
                      <th scope="col">{t(`dashboard.${kind}Name`)}</th>
                      <th scope="col">{t("dashboard.bookings")}</th>
                      <th scope="col">{t("dashboard.state")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rankings[kind].map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link
                            className="text-reset"
                            to={
                              kind === "checkups"
                                ? `/checkups/${row.id}`
                                : `/reservations?doctor_id=${row.id}`
                            }
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td>{n(row.reservations)}</td>
                        <td>{t(row.archived ? "dashboard.archived" : "dashboard.current")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!d.rankings[kind].length ? (
                <p className="text-muted mt-3">{t("dashboard.empty")}</p>
              ) : null}
              <p className="text-muted mt-3">{t("dashboard.rankHint")}</p>
            </ReportCard>
          </Col>
        ))}
      </Row>
      <Row>
        <Col xl={4}>
          <ReportCard
            title={t("dashboard.distribution")}
            path="/reservations"
            marker="store-visits"
          >
            <StoreVisitsCharts
              dataColors='["--vz-primary", "--vz-primary-rgb, 0.85", "--vz-primary-rgb, 0.70", "--vz-primary-rgb, 0.60", "--vz-primary-rgb, 0.45"]'
              values={dashboardStates.map((state) => d.reservations.states[state])}
              labels={dashboardStates.map((state) => t(`booking.state.${state}`))}
            />
            {d.reservations.created === 0 ? (
              <p className="text-muted">{t("dashboard.empty")}</p>
            ) : null}
          </ReportCard>
        </Col>
        <Col xl={8}>
          <ReportCard title={t("dashboard.latest")} path="/reservations" marker="recent-orders">
            <div className="table-responsive table-card">
              <table className="table table-borderless table-centered align-middle table-nowrap mb-0">
                <thead className="text-muted table-light">
                  <tr>
                    {[
                      "reservation",
                      "patient",
                      "doctorsName",
                      "checkupsName",
                      "appointment",
                      "state",
                    ].map((key) => (
                      <th scope="col" key={key}>
                        {t(`dashboard.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.latest_reservations.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link
                          to={`/reservations/${row.id}`}
                          aria-label={`${t("dashboard.reservation")} ${row.id}`}
                        >
                          <bdi>{row.id}</bdi>
                        </Link>
                      </td>
                      <td>{row.patient}</td>
                      <td>{row.doctor}</td>
                      <td>{row.checkup}</td>
                      <td>
                        {row.starts_at ? (
                          <time dateTime={row.starts_at}>
                            {formatProductTimestamp(row.starts_at, locale)}
                          </time>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary">
                          {t(`booking.state.${row.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!d.latest_reservations.length ? (
              <p className="text-muted mt-3">{t("dashboard.empty")}</p>
            ) : null}
          </ReportCard>
        </Col>
      </Row>
    </>
  );
}

function Workspace() {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [snapshot, setSnapshot] = useState<Dashboard | null>(null),
    [error, setError] = useState<unknown>(null),
    [version, setVersion] = useState(0),
    [right, setRight] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void readDashboard(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSnapshot(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      });
    return () => controller.abort();
  }, [version]);
  const refresh = () => {
    setSnapshot(null);
    setError(null);
    setVersion((value) => value + 1);
  };
  return (
    <Row>
      <Col>
        <div className="h-100">
          <Row className="mb-3 pb-1">
            <Col xs={12}>
              <div className="d-flex align-items-lg-center flex-lg-row flex-column">
                <div className="flex-grow-1">
                  <h1 className="fs-16 mb-1">{t("dashboard.title")}</h1>
                  {snapshot ? (
                    <>
                      <p className="text-muted mb-1" data-dashboard-period>
                        {formatProductDate(snapshot.data.period.from, locale)} —{" "}
                        {formatProductDate(snapshot.data.period.through, locale)} ·{" "}
                        {snapshot.data.period.timezone}
                      </p>
                      <p className="text-muted mb-0">
                        {t("dashboard.updated")}:{" "}
                        <time dateTime={snapshot.meta.generated_at}>
                          {formatProductTimestamp(snapshot.meta.generated_at, locale)}
                        </time>
                      </p>
                      <p className="text-muted small mb-0">{t("dashboard.moneyHint")}</p>
                    </>
                  ) : null}
                </div>
                <div className="d-flex gap-2 mt-3 mt-lg-0">
                  <button className="btn btn-soft-success" type="button" onClick={refresh}>
                    {t("adminReservations.refresh")}
                  </button>
                  <button
                    className="btn btn-soft-info btn-icon layout-rightside-btn"
                    type="button"
                    aria-label={t("product.dashboard.toggleActivity")}
                    onClick={() => setRight((value) => !value)}
                  >
                    <i className="ri-pulse-line" />
                  </button>
                </div>
              </div>
            </Col>
          </Row>
          {error ? (
            <ErrorState error={error} locale={locale} onRetry={refresh} />
          ) : !snapshot ? (
            <LoadingState locale={locale} />
          ) : (
            <Reports snapshot={snapshot} />
          )}
        </div>
      </Col>
      <div
        className={`col-auto layout-rightside-col ${right ? "d-block" : "d-none"}`}
        id="layout-rightside-coll"
        data-dashboard-section="recent-activity"
      >
        <button
          type="button"
          className="overlay border-0"
          aria-label={t("adminManage.close")}
          onClick={() => setRight(false)}
        />
        <div className="layout-rightside">
          <Card className="h-100 rounded-0">
            <CardBody className="p-0">
              <div className="p-3">
                <h2 className="h6 text-muted mb-0 text-uppercase fw-semibold">
                  {t("product.dashboard.activity.title")}
                </h2>
              </div>
              <SimpleBar style={{ maxHeight: "410px" }} className="p-3 pt-0">
                <div className="acitivity-timeline acitivity-main">
                  <p className="text-muted">{t("dashboard.updatesReserved")}</p>
                </div>
              </SimpleBar>
            </CardBody>
          </Card>
        </div>
      </div>
    </Row>
  );
}

export default function ProductDashboard() {
  const { t } = useTranslation();
  const { userProfile } = useShellAuth();
  useEffect(() => {
    document.title = t("dashboard.title");
  }, [t]);
  const allowed = userProfile?.roles.some((role) => role === "admin" || role === "root-admin");
  if (!allowed && userProfile?.roles.includes("doctor")) return <ClinicalDashboard doctor />;
  if (!allowed && userProfile?.roles.includes("patient"))
    return <ClinicalDashboard doctor={false} />;
  return (
    <div className="page-content">
      <Container fluid>
        {allowed && userProfile ? (
          <Workspace key={`${userProfile.id}:${userProfile.roles.join(",")}`} />
        ) : (
          <div role="alert" className="alert alert-danger">
            {t("dashboard.forbidden")}
          </div>
        )}
      </Container>
    </div>
  );
}
