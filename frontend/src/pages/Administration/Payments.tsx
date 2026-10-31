import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  paymentAdapter,
  paymentChoices,
  useAdminPaymentsQuery,
  useAdminPaymentDetailQuery,
  validPaymentId,
  validPaymentQuery,
  type PaymentKind,
  type PaymentRow,
} from "../../modules/checkupino/payments/api";
import { formatCatalogPrice } from "../../modules/checkupino/catalog/api";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import {
  parseServerTableQuery,
  serializeServerTableQuery,
  ServerDataTable,
  type ServerTableColumnDef,
  type ServerTableQuery,
} from "../../modules/checkupino/table";
import DetailBox from "./DetailBox";
import PaymentAdjustmentEditor from "./PaymentAdjustmentEditor";

const slice = (parameters: URLSearchParams, prefix: string) =>
  prefix
    ? new URLSearchParams(
        [...parameters]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key.slice(prefix.length), value]),
      )
    : parameters;
const replaceSlice = (parameters: URLSearchParams, prefix: string, next: URLSearchParams) => {
  if (!prefix) return next;
  const result = new URLSearchParams(parameters);
  for (const key of parameters.keys()) if (key.startsWith(prefix)) result.delete(key);
  for (const [key, value] of next) result.set(prefix + key, value);
  return result;
};
const presets: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  all: {},
  unpaid: { status: "unpaid" },
  paid: { status: "paid" },
  reconciliation: { status: "reconciliation" },
  pendingRequests: { adjustment_status: "pending" },
  failedAttempts: { attempt_status: "failed" },
};

function PaymentCollection({
  kind,
  paymentId,
}: {
  readonly kind: PaymentKind;
  readonly paymentId?: string;
}) {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters, setParameters] = useSearchParams();
  const prefix = kind === "payments" ? "" : kind + "_";
  const adapter = useMemo(() => paymentAdapter(kind), [kind]);
  const query = useMemo(
    () => parseServerTableQuery(slice(parameters, prefix), adapter),
    [parameters, prefix, adapter],
  );
  const canonical = serializeServerTableQuery(query, adapter).toString();
  const valid =
    validPaymentQuery(query, kind) && (kind === "payments" || validPaymentId(paymentId ?? ""));
  useEffect(() => {
    if (!prefix && parameters.toString() !== canonical) setParameters(canonical, { replace: true });
  }, [prefix, parameters, canonical, setParameters]);
  const update = (next: ServerTableQuery) =>
    setParameters((previous) =>
      replaceSlice(previous, prefix, serializeServerTableQuery(next, adapter)),
    );
  const { currentData, error, isFetching, refetch } = useAdminPaymentsQuery(
    { kind, paymentId, query },
    { skip: !capabilities.accessAdminPanel || !valid, refetchOnMountOrArgChange: true },
  );
  const visible = valid && !error && !isFetching ? currentData : undefined;
  const missing = t("adminReservations.missing");
  const columns = useMemo<readonly ServerTableColumnDef<PaymentRow>[]>(() => {
    const flag = (value: boolean) => t(value ? "activity.yes" : "activity.no");
    const reference: ServerTableColumnDef<PaymentRow> = {
      id: "reference",
      header: t("payment.reference"),
      cell: ({ row }) =>
        row.original.kind === "payments" ? (
          <Link to={`/payments/${row.original.public_id}?${canonical}`}>
            <bdi>{row.original.public_id}</bdi>
          </Link>
        ) : (
          <bdi>{row.original.public_id}</bdi>
        ),
      enableSorting: false,
    };
    const money: ServerTableColumnDef<PaymentRow> = {
      id: "amount",
      header: t("payment.amount"),
      cell: ({ row }) =>
        row.original.kind !== "events" ? (
          <bdi>{formatCatalogPrice(row.original.amount, row.original.currency, locale)}</bdi>
        ) : (
          missing
        ),
      enableSorting: kind === "payments",
    };
    const status: ServerTableColumnDef<PaymentRow> = {
      id: "status",
      header: t("payment.status"),
      cell: ({ row }) =>
        row.original.kind !== "events" ? t(`payment.state.${row.original.status}`) : missing,
      enableSorting: kind === "payments",
    };
    const provider: ServerTableColumnDef<PaymentRow> = {
      id: "provider",
      header: t("payment.provider"),
      cell: ({ row }) =>
        "provider" in row.original ? <bdi>{row.original.provider ?? missing}</bdi> : missing,
      enableSorting: false,
    };
    if (kind === "payments")
      return [
        reference,
        money,
        status,
        {
          id: "patient",
          header: t("payment.patient"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "payments" ? row.original.reservation.patient.name : missing,
        },
        {
          id: "doctor",
          header: t("payment.doctor"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "payments" ? row.original.reservation.doctor.name : missing,
        },
        {
          id: "reservation",
          header: t("payment.reservationStatus"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "payments"
              ? t(`payment.state.${row.original.reservation.status}`)
              : missing,
        },
        {
          id: "canonical",
          header: t("payment.canonicalConsistent"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "payments" ? flag(row.original.canonical_consistent) : missing,
        },
        {
          id: "created_at",
          header: t("payment.created"),
          cell: ({ row }) =>
            row.original.kind === "payments" && row.original.created_at
              ? formatProductTimestamp(row.original.created_at, locale)
              : missing,
        },
      ];
    if (kind === "attempts")
      return [
        reference,
        money,
        status,
        provider,
        ...(["is_canonical", "binding_consistent", "has_failure"] as const).map(
          (key): ServerTableColumnDef<PaymentRow> => ({
            id: key,
            header: t(`payment.${key}`),
            enableSorting: false,
            cell: ({ row }) =>
              row.original.kind === "attempts" ? flag(row.original[key]) : missing,
          }),
        ),
        {
          id: "completed",
          header: t("payment.completed"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "attempts" && row.original.completed_at
              ? formatProductTimestamp(row.original.completed_at, locale)
              : missing,
        },
      ];
    if (kind === "adjustments")
      return [
        reference,
        money,
        status,
        {
          id: "type",
          header: t("payment.type"),
          cell: ({ row }) =>
            row.original.kind === "adjustments" ? t(`payment.type.${row.original.type}`) : missing,
        },
        ...(["reason_recorded", "currency_matches_payment"] as const).map(
          (key): ServerTableColumnDef<PaymentRow> => ({
            id: key,
            header: t(`payment.${key}`),
            cell: ({ row }) =>
              row.original.kind === "adjustments" ? flag(row.original[key]) : missing,
          }),
        ),
        {
          id: "created",
          header: t("payment.created"),
          cell: ({ row }) =>
            row.original.kind === "adjustments" && row.original.created_at
              ? formatProductTimestamp(row.original.created_at, locale)
              : missing,
        },
      ];
    return [
      reference,
      provider,
      {
        id: "attempt",
        header: t("payment.attemptReference"),
        cell: ({ row }) =>
          row.original.kind === "events" ? <bdi>{row.original.attempt_public_id}</bdi> : missing,
      },
      {
        id: "type",
        header: t("payment.eventType"),
        cell: ({ row }) =>
          row.original.kind === "events" && row.original.event_type
            ? t(`payment.event.${row.original.event_type}`)
            : missing,
      },
      {
        id: "verified",
        header: t("payment.signature_verified"),
        cell: ({ row }) =>
          row.original.kind === "events" ? flag(row.original.signature_verified) : missing,
      },
      {
        id: "received",
        header: t("payment.received"),
        cell: ({ row }) =>
          row.original.kind === "events" && row.original.received_at
            ? formatProductTimestamp(row.original.received_at, locale)
            : missing,
      },
      {
        id: "processed",
        header: t("payment.processed"),
        cell: ({ row }) =>
          row.original.kind === "events" && row.original.processed_at
            ? formatProductTimestamp(row.original.processed_at, locale)
            : missing,
      },
    ];
  }, [kind, t, locale, canonical, missing]);
  if (!capabilities.accessAdminPanel) return null;
  return (
    <Card tag="section" aria-labelledby={`payment-${kind}-heading`} data-payment-kind={kind}>
      <CardHeader>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <h5 id={`payment-${kind}-heading`} className="card-title flex-grow-1 mb-0">
            {t(`payment.${kind}`)}
          </h5>
          <button
            type="button"
            className="btn btn-light"
            disabled={!valid || isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            {t("adminReservations.refresh")}
          </button>
          <button
            type="button"
            className="btn btn-light"
            onClick={() => update({ page: 1, perPage: 20, search: "", sort: null, filters: {} })}
          >
            {t("adminReservations.reset")}
          </button>
        </div>
        {kind === "payments" ? (
          <div className="d-flex flex-wrap gap-2 mt-3">
            {Object.entries(presets).map(([name, filters]) => (
              <button
                type="button"
                key={name}
                className="btn btn-outline-primary btn-sm"
                aria-pressed={["status", "attempt_status", "adjustment_status"].every(
                  (key) => query.filters[key] === filters[key],
                )}
                onClick={() => {
                  const next = { ...query.filters };
                  for (const key of ["status", "attempt_status", "adjustment_status"])
                    delete next[key];
                  update({ ...query, page: 1, filters: { ...next, ...filters } });
                }}
              >
                {t(`payment.quick.${name}`)}
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardBody>
        {!valid ? (
          <p role="alert" className="alert alert-warning">
            {t("payment.invalidQuery")}
          </p>
        ) : null}
        {visible ? (
          <p className="text-muted" data-payment-generated>
            {t("catalog.generated", {
              total: formatProductNumber(visible.page.total, locale),
              at: formatProductTimestamp(visible.generatedAt, locale),
            })}
          </p>
        ) : null}
        {visible?.period ? (
          <p className="text-muted" data-payment-period>
            {t("payment.createdPeriod")}:{" "}
            <bdi>
              {visible.period.from} – {visible.period.to} ({visible.period.timezone})
            </bdi>
          </p>
        ) : null}
        <p className="text-muted">
          {t(
            kind === "adjustments"
              ? "payment.requestsNotice"
              : kind === "events"
                ? "payment.eventsNotice"
                : "payment.moneyNotice",
          )}
        </p>
        <ServerDataTable
          adapter={adapter}
          columns={columns}
          searchable={kind === "payments"}
          query={query}
          onQueryChange={update}
          result={visible}
          locale={locale}
          loading={valid && isFetching}
          error={valid ? error : undefined}
          onRetry={() => {
            if (valid) void refetch();
          }}
          debounceMilliseconds={250}
          filterControls={({ filters, setFilter }) => (
            <>
              {Object.keys(adapter.filters ?? {}).map((key) => {
                const choices = paymentChoices(kind, key),
                  value = String(filters[key] ?? "");
                return (
                  <div key={key} className="col-sm-6 col-xl-3">
                    <label className="form-label" htmlFor={`payment-${kind}-${key}`}>
                      {t(`payment.filter.${key}`)}
                    </label>
                    {choices ? (
                      <select
                        className="form-select"
                        id={`payment-${kind}-${key}`}
                        value={value}
                        onChange={(event) => setFilter(key, event.target.value || undefined)}
                      >
                        <option value="">{t("adminReservations.all")}</option>
                        {choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {key === "type"
                              ? t(`payment.type.${choice}`)
                              : key === "signature_verified" || key === "processed"
                                ? t(
                                    choice === "1" || choice === "yes"
                                      ? "activity.yes"
                                      : "activity.no",
                                  )
                                : t(`payment.state.${choice}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="form-control"
                        id={`payment-${kind}-${key}`}
                        dir="ltr"
                        type={
                          key === "from" || key === "to"
                            ? "date"
                            : key.endsWith("_id")
                              ? "number"
                              : "text"
                        }
                        min={key.endsWith("_id") ? 1 : undefined}
                        step={key.endsWith("_id") ? 1 : undefined}
                        maxLength={key === "currency" ? 3 : key === "provider" ? 60 : undefined}
                        value={value}
                        onChange={(event) =>
                          setFilter(
                            key,
                            (key === "currency"
                              ? event.target.value.toUpperCase()
                              : event.target.value) || undefined,
                          )
                        }
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}
        />
      </CardBody>
    </Card>
  );
}

export default function Payments() {
  const { capabilities } = useShellAuth(),
    { t } = useTranslation();
  useEffect(() => {
    document.title = t("adminManage.payments");
  }, [t]);
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.payments")}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <PaymentCollection kind="payments" />
      </Container>
    </div>
  );
}

export function PaymentDetail() {
  const { paymentId = "" } = useParams();
  return <PaymentDetailContent key={paymentId} />;
}

function PaymentDetailContent() {
  const { capabilities } = useShellAuth(),
    { paymentId = "" } = useParams(),
    { t, i18n } = useTranslation();
  const [parameters] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const locale = normalizeProductLocale(i18n.resolvedLanguage),
    valid = validPaymentId(paymentId);
  const { currentData, error, isFetching, refetch } = useAdminPaymentDetailQuery(
    { paymentId },
    { skip: !valid || !capabilities.accessAdminPanel, refetchOnMountOrArgChange: true },
  );
  const row = valid && !error && !isFetching ? currentData : undefined;
  const missing = t("adminReservations.missing"),
    flag = (value: boolean) => t(value ? "activity.yes" : "activity.no");
  const date = (value: string | null) => (value ? formatProductTimestamp(value, locale) : missing);
  const back =
    "/payments?" +
    serializeServerTableQuery(
      parseServerTableQuery(parameters, paymentAdapter("payments")),
      paymentAdapter("payments"),
    );
  useEffect(() => {
    document.title = t("adminManage.payment-detail");
  }, [t]);
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={t("adminManage.payment-detail")} pageTitle={t("adminManage.payments")} />
        <Card data-payment-detail>
          <CardHeader className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="card-title flex-grow-1 mb-0">
              {t("adminManage.payment-detail")}
              {row ? (
                <>
                  : <bdi>{row.public_id}</bdi>
                </>
              ) : null}
            </h5>
            <Link className="btn btn-light" to={back}>
              {t("adminManage.back")}
            </Link>
            {capabilities.requestPaymentAdjustment ? (
              <button
                type="button"
                className="btn btn-warning"
                data-payment-adjustment-open
                disabled={!row || row.status !== "paid" || !row.canonical_consistent || uncertain}
                onClick={() => setEditing(true)}
              >
                {t("payment.control.open")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-light"
              disabled={!valid || isFetching}
              onClick={() => {
                void refetch().then((result) => {
                  if (result.data && !result.error) setUncertain(false);
                });
              }}
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
              <p role="alert" className="alert alert-warning">
                {t(!valid ? "payment.invalidIdentity" : "adminManage.unavailable")}
              </p>
            ) : isFetching ? (
              <output>{t("adminManage.loading")}</output>
            ) : null}
            <p className="mb-0 text-muted">{t("payment.moneyNotice")}</p>
          </CardBody>
        </Card>
        {row ? (
          <>
            {editing && capabilities.requestPaymentAdjustment ? (
              <PaymentAdjustmentEditor
                key={row.public_id}
                initial={row}
                onClose={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  void refetch();
                }}
                onUncertain={() => setUncertain(true)}
              />
            ) : null}
            <Row data-payment-boxes>
              <DetailBox
                id="payment-summary-box"
                title={t("payment.summary")}
                icon="ri-bank-card-line"
                fields={[
                  [t("payment.reference"), row.public_id],
                  [t("payment.status"), t(`payment.state.${row.status}`)],
                  [t("payment.amount"), formatCatalogPrice(row.amount, row.currency, locale)],
                  [t("payment.provider"), row.provider ?? missing],
                  [t("payment.paidAt"), date(row.paid_at)],
                  [t("payment.refundedAt"), date(row.refunded_at)],
                  [t("payment.created"), date(row.created_at)],
                  [t("payment.updated"), date(row.updated_at)],
                ]}
              />
              <DetailBox
                id="payment-reservation-box"
                title={t("payment.reservation")}
                icon="ri-calendar-line"
                fields={[
                  [
                    t("payment.reference"),
                    <Link key="reservation" to={`/reservations/${row.reservation.id}`}>
                      {row.reservation.public_id}
                    </Link>,
                  ],
                  [t("payment.reservationStatus"), t(`payment.state.${row.reservation.status}`)],
                  [
                    t("payment.bookedAmount"),
                    formatCatalogPrice(
                      row.reservation.booked_amount,
                      row.reservation.booked_currency,
                      locale,
                    ),
                  ],
                  [t("payment.appointmentStart"), date(row.reservation.starts_at)],
                  [t("payment.appointmentEnd"), date(row.reservation.ends_at)],
                  [t("schedule.timezone"), row.reservation.timezone ?? missing],
                  [t("schedule.service"), row.reservation.checkup_title ?? missing],
                  [t("schedule.hospital"), row.reservation.hospital_name ?? missing],
                ]}
              />
              <DetailBox
                id="payment-people-box"
                title={t("payment.people")}
                icon="ri-team-line"
                fields={[
                  [
                    t("payment.patient"),
                    <Link
                      key="patient"
                      to={`/users/${row.reservation.patient.public_id}?directory=patients`}
                    >
                      {row.reservation.patient.name}
                    </Link>,
                  ],
                  [
                    t("payment.doctor"),
                    <Link
                      key="doctor"
                      to={`/users/${row.reservation.doctor.user_public_id}?directory=doctors`}
                    >
                      {row.reservation.doctor.name}
                    </Link>,
                  ],
                  [t("payment.doctorArchived"), flag(row.reservation.doctor.archived)],
                ]}
              />
              <DetailBox
                id="payment-review-box"
                title={t("payment.review")}
                icon="ri-shield-check-line"
                fields={[
                  [t("payment.canonicalConsistent"), flag(row.canonical_consistent)],
                  [t("payment.attempts"), formatProductNumber(row.counts.attempts, locale)],
                  [t("payment.adjustments"), formatProductNumber(row.counts.adjustments, locale)],
                  [
                    t("payment.reconciliationAttempts"),
                    formatProductNumber(row.counts.reconciliation_attempts, locale),
                  ],
                  [
                    t("payment.pendingRequests"),
                    formatProductNumber(row.counts.pending_adjustments, locale),
                  ],
                ]}
              >
                <p className="mb-0 text-muted">{t("payment.requestsNotice")}</p>
                {!row.canonical_consistent ? (
                  <p className="alert alert-warning mt-3 mb-0">{t("payment.inconsistent")}</p>
                ) : null}
              </DetailBox>
              {row.canonical_attempt ? (
                <DetailBox
                  id="payment-canonical-box"
                  title={t("payment.canonicalAttempt")}
                  icon="ri-checkbox-circle-line"
                  columns={12}
                  fields={[
                    [t("payment.attemptReference"), row.canonical_attempt.public_id],
                    [t("payment.status"), t(`payment.state.${row.canonical_attempt.status}`)],
                    [
                      t("payment.amount"),
                      formatCatalogPrice(
                        row.canonical_attempt.amount,
                        row.canonical_attempt.currency,
                        locale,
                      ),
                    ],
                    [t("payment.provider"), row.canonical_attempt.provider ?? missing],
                    [t("payment.completed"), date(row.canonical_attempt.completed_at)],
                  ]}
                />
              ) : null}
            </Row>
            {(["attempts", "adjustments", "events"] as const).map((kind) => (
              <PaymentCollection key={kind} kind={kind} paymentId={paymentId} />
            ))}
          </>
        ) : null}
      </Container>
    </div>
  );
}
