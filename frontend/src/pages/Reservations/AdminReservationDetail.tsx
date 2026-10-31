import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import {
  adminReservationAdapter,
  parseAdminReservationQuery,
  useAdminReservationPanelDetailQuery,
} from "../../modules/checkupino/reservations/admin";
import { serializeServerTableQuery } from "../../modules/checkupino/table";
import { checkupinoApi } from "../../modules/checkupino/query/api";
import AdminReservationActions from "./AdminReservationActions";

interface DetailBox {
  readonly key: string;
  readonly icon: string;
  readonly columns: 4 | 6 | 12;
  readonly fields: readonly (readonly [string, ReactNode])[];
}

const ReservationDetailSession = () => {
  const { capabilities } = useShellAuth();
  const { reservationId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters] = useSearchParams();
  const dispatch = useDispatch();
  const [blocked, setBlocked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const uncertain = useCallback(() => setBlocked(true), []);
  const identifier =
    /^\d+$/.test(reservationId) &&
    Number.isSafeInteger(Number(reservationId)) &&
    Number(reservationId) > 0
      ? Number(reservationId)
      : null;
  const { currentData, error, isFetching, refetch } = useAdminReservationPanelDetailQuery(
    identifier ?? 0,
    {
      skip: identifier === null || !capabilities.accessAdminPanel,
      refetchOnMountOrArgChange: true,
    },
  );
  const refresh = async () => {
    const result = await refetch();
    if (!result.error && result.data?.id === identifier) setBlocked(false);
  };
  const onSaved = () => {
    setSaved(true);
    setDialogOpen(false);
    dispatch(checkupinoApi.util.invalidateTags(["AdminReservations"]));
  };
  useEffect(() => {
    document.title = t("adminReservations.detailTitle");
  }, [t]);
  if (!capabilities.accessAdminPanel)
    return (
      <p className="alert alert-danger" role="alert">
        {t("adminReservations.denied")}
      </p>
    );
  const row = !error && !isFetching && identifier !== null ? currentData : undefined;
  const missing = t("adminReservations.missing");
  const date = (value: string | null) => (value ? formatProductTimestamp(value, locale) : missing);
  const back =
    "/reservations?" +
    serializeServerTableQuery(parseAdminReservationQuery(parameters), adminReservationAdapter);

  const boxes: readonly DetailBox[] = row
    ? [
        {
          key: "appointment",
          icon: "ri-calendar-check-line",
          columns: 6,
          fields: [
            ["reference", formatProductNumber(row.id, locale)],
            ["publicId", row.public_id],
            ["status", t(`adminReservations.state.${row.status}`)],
            ["checkup", row.checkup?.title || missing],
            ["startsAt", date(row.starts_at)],
            ["endsAt", date(row.ends_at)],
            ["timezone", row.timezone],
          ],
        },
        {
          key: "payment",
          icon: "ri-bank-card-line",
          columns: 6,
          fields: [
            [
              "bookedAmount",
              `${formatProductNumber(row.booked_amount, locale)} ${row.booked_currency}`,
            ],
            [
              "paymentStatus",
              row.payment ? t(`adminReservations.payment.${row.payment.status}`) : missing,
            ],
            ["paymentReference", row.payment?.public_id || missing],
            [
              "paymentAmount",
              row.payment
                ? `${formatProductNumber(row.payment.amount, locale)} ${row.payment.currency}`
                : missing,
            ],
            ["provider", row.payment?.provider || missing],
          ],
        },
        {
          key: "patient",
          icon: "ri-user-line",
          columns: 4,
          fields: [
            [
              "patient",
              row.patient ? (
                <Link key="patient" to={`/reservations?user_id=${row.patient.id}`}>
                  {row.patient.name || missing}
                </Link>
              ) : (
                missing
              ),
            ],
            ["patientEmail", row.patient?.email || missing],
          ],
        },
        {
          key: "doctor",
          icon: "ri-stethoscope-line",
          columns: 4,
          fields: [
            [
              "doctor",
              row.doctor ? (
                <Link key="doctor" to={`/reservations?doctor_id=${row.doctor.id}`}>
                  {row.doctor.name || missing}
                </Link>
              ) : (
                missing
              ),
            ],
            ["specialty", row.doctor?.specialty || missing],
          ],
        },
        {
          key: "workplace",
          icon: "ri-hospital-line",
          columns: 4,
          fields: [
            ["workplace", row.hospital_name || missing],
            ["workplaceId", formatProductNumber(row.doctor_workplace_id, locale)],
          ],
        },
        {
          key: "timeline",
          icon: "ri-time-line",
          columns: 12,
          fields: [
            ["createdAt", date(row.created_at)],
            ["holdExpiresAt", date(row.hold_expires_at)],
            ["completedAt", date(row.completed_at)],
          ],
        },
      ]
    : [];
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminReservations.detailTitle")}
          pageTitle={t("adminReservations.title")}
        />
        <Row>
          <Col lg={12}>
            <Card>
              <CardHeader>
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <h5 className="card-title mb-0 flex-grow-1">
                    {t("adminReservations.detailTitle")}
                  </h5>
                  <Link className="btn btn-light" to={back}>
                    {t("adminReservations.back")}
                  </Link>
                  <button
                    className="btn btn-light"
                    type="button"
                    disabled={isFetching || identifier === null || dialogOpen}
                    onClick={() => void refresh()}
                  >
                    {t("adminReservations.refresh")}
                  </button>
                </div>
              </CardHeader>
              {saved ? (
                <output className="alert alert-success m-3">{t("reservationActions.saved")}</output>
              ) : null}
              {row ? (
                <CardBody>
                  <AdminReservationActions
                    row={row}
                    blocked={blocked}
                    onUncertain={uncertain}
                    onSaved={onSaved}
                    onDialogChange={setDialogOpen}
                  />
                </CardBody>
              ) : null}
              {identifier === null || isFetching || error ? (
                <CardBody>
                  {identifier === null ? (
                    <p className="alert alert-warning" role="alert">
                      {t("adminReservations.invalidId")}
                    </p>
                  ) : null}
                  {isFetching ? <LoadingState locale={locale} /> : null}
                  {error ? (
                    <ErrorState error={error} locale={locale} onRetry={() => void refetch()} />
                  ) : null}
                </CardBody>
              ) : null}
            </Card>
          </Col>
        </Row>
        <Row>
          {boxes.map((box) => (
            <Col key={box.key} lg={box.columns} md={box.columns === 12 ? 12 : 6} className="d-flex">
              <Card tag="section" className="flex-fill" aria-labelledby={`reservation-${box.key}`}>
                <CardHeader>
                  <h5
                    id={`reservation-${box.key}`}
                    className="card-title mb-0 d-flex align-items-center gap-2"
                  >
                    <span aria-hidden="true" className={box.icon} />
                    {t(`adminReservations.box.${box.key}`)}
                  </h5>
                </CardHeader>
                <CardBody>
                  <dl className="row mb-0">
                    {box.fields.map(([key, value]) => (
                      <div
                        key={key}
                        className={
                          box.columns === 12
                            ? "col-md-4 mb-3"
                            : box.columns === 6
                              ? "col-sm-6 mb-3"
                              : "col-12 mb-3"
                        }
                      >
                        <dt className="text-muted small fw-normal mb-1">
                          {t(`adminReservations.${key}`)}
                        </dt>
                        <dd className="fw-medium mb-0 text-break">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </div>
  );
};
export default function AdminReservationDetail() {
  const { userProfile } = useShellAuth();
  const { reservationId } = useParams();
  return (
    <ReservationDetailSession
      key={`${reservationId}:${userProfile?.id ?? "none"}:${userProfile?.roles.join("|") ?? "none"}`}
    />
  );
}
