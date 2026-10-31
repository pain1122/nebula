import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Container, Table } from "reactstrap";

import BreadCrumb from "../../Components/Common/BreadCrumb";
import {
  usePatientReservationsQuery,
  useDoctorReservationsQuery,
  type PanelReservation,
  type SandboxCheckout as Checkout,
} from "../../modules/checkupino/booking/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import SandboxCheckout from "./SandboxCheckout";
import { AppointmentCompletion } from "./AppointmentCompletion";

const ReservationList = ({ doctor = false }: { readonly doctor?: boolean }) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [page, setPage] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PanelReservation | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null);
  const [completion, setCompletion] = useState<PanelReservation | null>(null);
  const [completionBlocked, setCompletionBlocked] = useState<readonly number[]>([]);
  const [completed, setCompleted] = useState(false);
  const patientQuery = usePatientReservationsQuery(page, {
    skip: doctor,
    refetchOnMountOrArgChange: true,
  });
  const doctorQuery = useDoctorReservationsQuery(page, {
    skip: !doctor,
    refetchOnMountOrArgChange: true,
  });
  const query = doctor ? doctorQuery : patientQuery;
  const title = t(doctor ? "booking.doctorReservations" : "booking.myReservations");
  const created = (location.state as { bookingCreated?: boolean } | null)?.bookingCreated;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={title}
          pageTitle={t(doctor ? "booking.doctorPanel" : "booking.patientPanel")}
        />
        {!doctor && created && !checkoutResult && (
          <output className="alert alert-success d-block">{t("booking.created")}</output>
        )}
        {!doctor && checkoutResult && (
          <output className="alert alert-info d-block">
            {t(`booking.sandboxResult.${checkoutResult}`, {
              defaultValue: t("booking.sandboxUnavailable"),
            })}
          </output>
        )}
        <Card>
          <CardHeader>
            <div className="d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">{title}</h5>
              {!doctor && (
                <Link className="btn btn-success" to="/book">
                  {t("booking.title")}
                </Link>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {doctor && completed && (
              <output className="alert alert-success d-block">
                {t("booking.appointmentCompleted")}
              </output>
            )}
            {query.isFetching && <LoadingState locale={locale} />}
            {query.error && (
              <ErrorState
                locale={locale}
                error={query.error}
                onRetry={() => void query.refetch()}
              />
            )}
            {!query.isFetching && query.currentData?.items.length === 0 && (
              <EmptyState locale={locale} />
            )}
            {query.currentData && query.currentData.items.length > 0 && (
              <div className="table-responsive">
                <Table className="align-middle table-nowrap mb-0">
                  <thead>
                    <tr>
                      {[
                        "checkup",
                        doctor ? "patient" : "doctor",
                        "slot",
                        "status",
                        "price",
                        "payment",
                        "holdExpires",
                      ].map((key) => (
                        <th key={key}>{t(`booking.${key}`)}</th>
                      ))}
                      <th>{t("booking.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.currentData.items.map((item) => (
                      <tr key={item.public_id}>
                        <td>{item.checkup?.title ?? "—"}</td>
                        <td>{(doctor ? item.patient?.name : item.doctor?.name) ?? "—"}</td>
                        <td>{formatProductTimestamp(item.starts_at, locale)}</td>
                        <td>
                          <StatusBadge
                            label={t(`booking.state.${item.status}`, {
                              defaultValue: t("booking.unknown"),
                            })}
                            tone={
                              item.status === "confirmed" || item.status === "completed"
                                ? "success"
                                : "neutral"
                            }
                          />
                        </td>
                        <td>
                          {formatProductNumber(item.booked_amount, locale)} {item.booked_currency}
                        </td>
                        <td>
                          {t(`booking.paymentState.${item.payment?.status}`, {
                            defaultValue: t("booking.unknown"),
                          })}
                        </td>
                        <td>
                          {item.status === "pending" && item.hold_expires_at
                            ? formatProductTimestamp(item.hold_expires_at, locale)
                            : "—"}
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Link
                              className="btn btn-soft-success btn-sm"
                              to={`/${doctor ? "doctor" : "my"}/reservations/${encodeURIComponent(item.public_id)}/medical`}
                            >
                              {t("medical.title")}
                            </Link>
                            {!doctor && item.can_sandbox_checkout && (
                              <Button
                                color="primary"
                                size="sm"
                                onClick={() => {
                                  setCheckoutResult(null);
                                  setSelected(item);
                                }}
                              >
                                {t("booking.sandboxPay")}
                              </Button>
                            )}
                            {doctor && item.status === "confirmed" && (
                              <Button
                                color="primary"
                                size="sm"
                                disabled={
                                  item.can_complete !== true || completionBlocked.includes(item.id)
                                }
                                title={
                                  item.can_complete === true
                                    ? t("booking.completeAppointment")
                                    : t("booking.completionUnavailable")
                                }
                                onClick={() => setCompletion(item)}
                              >
                                {t("booking.completeAppointment")}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            {query.currentData && query.currentData.page.lastPage > 1 && (
              <div className="d-flex gap-2 mt-3">
                <Button
                  color="light"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  {t("booking.previous")}
                </Button>
                <Button
                  color="light"
                  disabled={page >= query.currentData.page.lastPage || query.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  {t("booking.next")}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
        {!doctor && selected && (
          <SandboxCheckout
            key={selected.public_id}
            reservation={selected}
            onClose={() => setSelected(null)}
            onFinished={(result: Checkout) => {
              setCheckoutResult(result.attempt_status);
              setSelected(null);
              void navigate(location.pathname + location.search, { replace: true, state: null });
            }}
          />
        )}
        {doctor && completion && (
          <AppointmentCompletion
            key={completion.id}
            reservation={completion}
            blocked={completionBlocked.includes(completion.id)}
            onClose={() => setCompletion(null)}
            onUncertain={() =>
              setCompletionBlocked((previous) =>
                previous.includes(completion.id) ? previous : [...previous, completion.id],
              )
            }
            onCompleted={() => {
              setCompletion(null);
              setCompleted(true);
            }}
          />
        )}
      </Container>
    </div>
  );
};

export default ReservationList;
