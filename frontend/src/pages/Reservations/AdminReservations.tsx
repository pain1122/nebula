import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";

import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { StatusBadge } from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import {
  adminReservationAdapter,
  adminReservationQueryIssue,
  adminReservationRequest,
  parseAdminReservationQuery,
  paymentStates,
  reservationStates,
  useAdminReservationPanelListQuery,
  type AdminReservation,
} from "../../modules/checkupino/reservations/admin";
import {
  serializeServerTableQuery,
  ServerDataTable,
  type ServerFilterValue,
  type ServerTableColumnDef,
  type ServerTableQuery,
} from "../../modules/checkupino/table";

const quickFilters: readonly { key: string; filters: Record<string, ServerFilterValue> }[] = [
  { key: "today", filters: { period: "today" } },
  { key: "upcoming", filters: { period: "upcoming" } },
  { key: "awaitingPayment", filters: { payment_status: "unpaid" } },
  { key: "paid", filters: { payment_status: "paid" } },
  { key: "completed", filters: { status: "completed" } },
  { key: "cancelled", filters: { status: "cancelled" } },
  { key: "reconciliation", filters: { payment_status: "reconciliation" } },
];
const temporalFilters = ["period", "status", "payment_status", "from", "to"];

const AdminReservations = () => {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters, setParameters] = useSearchParams();
  const query = useMemo(() => parseAdminReservationQuery(parameters), [parameters]);
  const canonical = serializeServerTableQuery(query, adminReservationAdapter).toString();
  const search = parameters.toString();
  const issue = adminReservationQueryIssue(query);
  const update = (next: ServerTableQuery) =>
    setParameters(serializeServerTableQuery(next, adminReservationAdapter));
  useEffect(() => {
    if (search !== canonical) setParameters(canonical, { replace: true });
  }, [search, canonical, setParameters]);
  useEffect(() => {
    document.title = t("adminReservations.title");
  }, [t]);
  const { currentData, error, isFetching, refetch } = useAdminReservationPanelListQuery(
    adminReservationRequest(query),
    {
      skip: !capabilities.accessAdminPanel || issue !== null,
      refetchOnMountOrArgChange: true,
    },
  );
  const visible = !issue && !error && !isFetching ? currentData : undefined;
  const missing = t("adminReservations.missing");
  const columns = useMemo<readonly ServerTableColumnDef<AdminReservation>[]>(
    () => [
      {
        id: "id",
        accessorKey: "id",
        header: t("adminReservations.reference"),
        cell: ({ row }) => (
          <Link to={`/reservations/${row.original.id}?${canonical}`}>
            {formatProductNumber(row.original.id, locale)}
          </Link>
        ),
      },
      {
        id: "patient_name",
        header: t("adminReservations.patient"),
        cell: ({ row }) =>
          row.original.patient ? (
            <Link to={`/reservations?user_id=${row.original.patient.id}`}>
              {row.original.patient.name || missing}
            </Link>
          ) : (
            missing
          ),
      },
      {
        id: "doctor_name",
        header: t("adminReservations.doctor"),
        cell: ({ row }) =>
          row.original.doctor ? (
            <Link to={`/reservations?doctor_id=${row.original.doctor.id}`}>
              {row.original.doctor.name || missing}
            </Link>
          ) : (
            missing
          ),
      },
      {
        id: "checkup_title",
        header: t("adminReservations.checkup"),
        cell: ({ row }) => row.original.checkup?.title || missing,
      },
      {
        id: "starts_at",
        accessorKey: "starts_at",
        header: t("adminReservations.startsAt"),
        cell: ({ row }) => formatProductTimestamp(row.original.starts_at, locale),
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("adminReservations.status"),
        cell: ({ row }) => (
          <StatusBadge
            label={t(`adminReservations.state.${row.original.status}`)}
            tone={row.original.status === "completed" ? "success" : "neutral"}
          />
        ),
      },
      {
        id: "booked",
        enableSorting: false,
        header: t("adminReservations.bookedAmount"),
        cell: ({ row }) =>
          `${formatProductNumber(row.original.booked_amount, locale)} ${row.original.booked_currency}`,
      },
      {
        id: "payment_status",
        header: t("adminReservations.paymentStatus"),
        cell: ({ row }) =>
          row.original.payment
            ? t(`adminReservations.payment.${row.original.payment.status}`)
            : missing,
      },
      {
        id: "workplace",
        enableSorting: false,
        header: t("adminReservations.workplace"),
        cell: ({ row }) => row.original.hospital_name || missing,
      },
      {
        id: "actions",
        enableSorting: false,
        header: t("adminReservations.details"),
        cell: ({ row }) => (
          <Link
            className="btn btn-sm btn-light"
            to={`/reservations/${row.original.id}?${canonical}`}
          >
            {t("adminReservations.view")}
          </Link>
        ),
      },
    ],
    [canonical, locale, missing, t],
  );
  if (!capabilities.accessAdminPanel)
    return (
      <p className="alert alert-danger" role="alert">
        {t("adminReservations.denied")}
      </p>
    );
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminReservations.title")}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <Row>
          <Col lg={12}>
            <Card>
              <CardHeader>
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <h5 className="card-title mb-0 flex-grow-1">{t("adminReservations.title")}</h5>
                  <button
                    className="btn btn-light"
                    type="button"
                    disabled={isFetching || !!issue}
                    onClick={() => void refetch()}
                  >
                    {t("adminReservations.refresh")}
                  </button>
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() =>
                      update({
                        filters: {},
                        page: 1,
                        perPage: query.perPage,
                        search: "",
                        sort: null,
                      })
                    }
                  >
                    {t("adminReservations.reset")}
                  </button>
                </div>
                <p className="text-muted mt-2 mb-2">{t("adminReservations.searchHint")}</p>
                <div
                  className="d-flex flex-wrap gap-2"
                  aria-label={t("adminReservations.quickFilters")}
                >
                  {quickFilters.map((quick) => (
                    <button
                      key={quick.key}
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      aria-pressed={
                        Object.entries(quick.filters).every(
                          ([key, value]) => query.filters[key] === value,
                        ) &&
                        temporalFilters.every(
                          (key) =>
                            quick.filters[key] !== undefined || query.filters[key] === undefined,
                        )
                      }
                      onClick={() =>
                        update({
                          ...query,
                          page: 1,
                          filters: {
                            ...Object.fromEntries(
                              Object.entries(query.filters).filter(
                                ([key]) => !temporalFilters.includes(key),
                              ),
                            ),
                            ...quick.filters,
                          },
                        })
                      }
                    >
                      {t(`adminReservations.quick.${quick.key}`)}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardBody>
                {issue ? (
                  <p className="alert alert-warning" role="alert">
                    {t(`adminReservations.${issue}`)}
                  </p>
                ) : null}
                {visible ? (
                  <p className="text-muted">
                    {t("adminReservations.total", {
                      total: formatProductNumber(visible.page.total, locale),
                    })}
                  </p>
                ) : null}
                <ServerDataTable
                  adapter={adminReservationAdapter}
                  columns={columns}
                  locale={locale}
                  query={query}
                  onQueryChange={update}
                  result={visible}
                  loading={isFetching}
                  error={!issue ? error : undefined}
                  onRetry={!issue ? () => void refetch() : undefined}
                  filterControls={({ filters, setFilter }) => (
                    <>
                      {["status", "payment_status"].map((key) => (
                        <label key={key} className="form-label mb-0">
                          {t(
                            key === "status"
                              ? "adminReservations.status"
                              : "adminReservations.paymentStatus",
                          )}
                          <select
                            className="form-select"
                            value={String(filters[key] ?? "")}
                            onChange={(event) => setFilter(key, event.target.value || undefined)}
                          >
                            <option value="">{t("adminReservations.all")}</option>
                            {(key === "status" ? reservationStates : paymentStates).map((value) => (
                              <option key={value} value={value}>
                                {t(
                                  `adminReservations.${key === "status" ? "state" : "payment"}.${value}`,
                                )}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                      <label className="form-label mb-0">
                        {t("adminReservations.period")}
                        <select
                          className="form-select"
                          value={String(filters.period ?? "")}
                          onChange={(event) => setFilter("period", event.target.value || undefined)}
                        >
                          <option value="">{t("adminReservations.all")}</option>
                          {["today", "upcoming"].map((value) => (
                            <option key={value} value={value}>
                              {t(`adminReservations.quick.${value}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {["doctor_id", "user_id", "workplace_id", "checkup_id"].map((key) => (
                        <label key={key} className="form-label mb-0">
                          {t(`adminReservations.filter.${key}`)}
                          <input
                            className="form-control"
                            type="number"
                            min="1"
                            step="1"
                            value={String(filters[key] ?? "")}
                            onChange={(event) =>
                              setFilter(
                                key,
                                adminReservationAdapter.filters?.[key].parse?.(event.target.value),
                              )
                            }
                          />
                        </label>
                      ))}
                      {["from", "to"].map((key) => (
                        <label key={key} className="form-label mb-0">
                          {t(`adminReservations.filter.${key}`)}
                          <input
                            className="form-control"
                            type="date"
                            value={String(filters[key] ?? "")}
                            onChange={(event) => setFilter(key, event.target.value || undefined)}
                          />
                        </label>
                      ))}
                    </>
                  )}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
export default AdminReservations;
