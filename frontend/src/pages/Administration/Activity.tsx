import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  activityActions,
  activityAdapter,
  activityCategories,
  activityRisks,
  activityRoles,
  useAdminActivityQuery,
  validActivityQuery,
  type ActivityRow,
} from "../../modules/checkupino/activity/api";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import { StatusBadge } from "../../modules/checkupino/feedback";
import {
  parseServerTableQuery,
  serializeServerTableQuery,
  ServerDataTable,
  type ServerTableColumnDef,
} from "../../modules/checkupino/table";

export default function Activity() {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const root = capabilities.manageAdminIdentities;
  const [parameters, setParameters] = useSearchParams();
  const adapter = useMemo(() => activityAdapter(root), [root]);
  const query = useMemo(() => parseServerTableQuery(parameters, adapter), [parameters, adapter]);
  const canonical = serializeServerTableQuery(query, adapter).toString();
  const valid = validActivityQuery(query);
  useEffect(() => {
    if (parameters.toString() !== canonical) setParameters(canonical, { replace: true });
  }, [parameters, canonical, setParameters]);
  useEffect(() => {
    document.title = t("adminManage.activity");
  }, [t]);
  const { currentData, error, isFetching, refetch } = useAdminActivityQuery(
    { query, root },
    { skip: !capabilities.accessAdminPanel || !valid, refetchOnMountOrArgChange: true },
  );
  const visible = valid && !error && !isFetching ? currentData : undefined;
  const missing = t("adminReservations.missing");
  const columns = useMemo<readonly ServerTableColumnDef<ActivityRow>[]>(
    () => [
      {
        id: "created_at",
        header: t("activity.time"),
        enableSorting: false,
        cell: ({ row }) => formatProductTimestamp(row.original.created_at, locale),
      },
      {
        id: "action",
        header: t("activity.action"),
        enableSorting: false,
        cell: ({ row }) => t(`activity.action.${row.original.action}`),
      },
      {
        id: "public_id",
        header: t("activity.reference"),
        enableSorting: false,
        cell: ({ row }) => row.original.public_id,
      },
      {
        id: "actor",
        header: t("activity.actor"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.actor.identity_available ? (
            <>
              {row.original.actor.public_id &&
              (row.original.actor.role === "patient" || row.original.actor.role === "doctor") ? (
                <Link
                  to={`/users/${row.original.actor.public_id}?directory=${row.original.actor.role}s`}
                >
                  {row.original.actor.name || missing}
                </Link>
              ) : (
                row.original.actor.name || missing
              )}
              {row.original.actor.role ? (
                <small className="d-block text-muted">
                  {t(
                    row.original.actor.role === "root-admin"
                      ? "product.role.rootAdmin"
                      : `users.role.${row.original.actor.role}`,
                  )}
                </small>
              ) : null}
            </>
          ) : (
            t("activity.identityUnavailable")
          ),
      },
      {
        id: "category",
        header: t("activity.category"),
        enableSorting: false,
        cell: ({ row }) => t(`activity.category.${row.original.category}`),
      },
      {
        id: "subject",
        header: t("activity.subject"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.subject_public_id ? (
            row.original.category === "reservation" ? (
              <Link to={`/reservations?q=${row.original.subject_public_id}`}>
                {row.original.subject_public_id}
              </Link>
            ) : (
              row.original.subject_public_id
            )
          ) : (
            missing
          ),
      },
      {
        id: "risk",
        header: t("activity.risk"),
        enableSorting: false,
        cell: ({ row }) => (
          <StatusBadge
            label={t(`activity.risk.${row.original.risk}`)}
            tone={
              row.original.risk === "critical"
                ? "danger"
                : row.original.risk === "high"
                  ? "warning"
                  : "neutral"
            }
          />
        ),
      },
      {
        id: "outcome",
        header: t("activity.outcome"),
        enableSorting: false,
        cell: ({ row }) => t(`activity.outcome.${row.original.outcome}`),
      },
      {
        id: "reason",
        header: t("activity.reasonRecorded"),
        enableSorting: false,
        cell: ({ row }) => t(row.original.reason_recorded ? "activity.yes" : "activity.no"),
      },
    ],
    [t, locale, missing],
  );
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  const choices: Record<string, readonly string[]> = {
    category: activityCategories,
    action: Object.keys(activityActions),
    risk: activityRisks,
    actor_role: root ? activityRoles : activityRoles.filter((role) => role !== "root-admin"),
    sort_dir: ["desc", "asc"],
  };
  const label = (key: string, value: string) =>
    key === "actor_role"
      ? t(value === "root-admin" ? "product.role.rootAdmin" : `users.role.${value}`)
      : t(`activity.${key}.${value}`);
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.activity")}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <Card data-activity-panel>
          <CardHeader>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h5 className="card-title flex-grow-1 mb-0">{t("adminManage.activity")}</h5>
              <button
                className="btn btn-light"
                type="button"
                disabled={!valid || isFetching}
                onClick={() => {
                  void refetch();
                }}
              >
                {t("adminReservations.refresh")}
              </button>
              <button
                className="btn btn-light"
                type="button"
                onClick={() =>
                  setParameters(
                    serializeServerTableQuery(
                      { page: 1, perPage: 20, search: "", sort: null, filters: {} },
                      adapter,
                    ),
                  )
                }
              >
                {t("adminReservations.reset")}
              </button>
            </div>
            <p className="text-muted mt-2 mb-2">{t("activity.description")}</p>
            <div className="d-flex gap-2 flex-wrap">
              {["reservation", "medical", "questionnaire"].map((category) => (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  key={category}
                  aria-pressed={query.filters.category === category}
                  onClick={() =>
                    setParameters(
                      serializeServerTableQuery(
                        { ...query, page: 1, filters: { ...query.filters, category } },
                        adapter,
                      ),
                    )
                  }
                >
                  {t(`activity.category.${category}`)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody>
            {!valid ? (
              <p role="alert" className="alert alert-warning">
                {t("activity.invalidQuery")}
              </p>
            ) : null}
            {visible ? (
              <p className="text-muted" data-activity-period>
                {t("activity.period", {
                  from: visible.period.from,
                  to: visible.period.to,
                  generated: formatProductTimestamp(visible.generatedAt, locale),
                  total: formatProductNumber(visible.page.total, locale),
                })}
              </p>
            ) : null}
            <p className="text-muted small">{t("activity.searchHint")}</p>
            <ServerDataTable
              adapter={adapter}
              columns={columns}
              locale={locale}
              query={query}
              onQueryChange={(next) => setParameters(serializeServerTableQuery(next, adapter))}
              result={visible}
              loading={valid && isFetching}
              error={valid ? error : undefined}
              onRetry={() => {
                if (valid) void refetch();
              }}
              debounceMilliseconds={250}
              filterControls={({ filters, setFilter }) => (
                <>
                  {Object.keys(adapter.filters ?? {}).map((key) => (
                    <div key={key}>
                      <label className="form-label" htmlFor={`activity-${key}`}>
                        {t(`activity.${key}`)}
                      </label>
                      {choices[key] ? (
                        <select
                          className="form-select"
                          id={`activity-${key}`}
                          value={String(filters[key] ?? "")}
                          onChange={(event) => setFilter(key, event.target.value || undefined)}
                        >
                          <option value="">{t("adminReservations.all")}</option>
                          {choices[key].map((value) => (
                            <option key={value} value={value}>
                              {label(key, value)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="form-control"
                          id={`activity-${key}`}
                          type={
                            key === "from" || key === "to"
                              ? "date"
                              : key === "actor_id"
                                ? "number"
                                : "text"
                          }
                          min={key === "actor_id" ? 1 : undefined}
                          step={key === "actor_id" ? 1 : undefined}
                          maxLength={key === "subject_public_id" ? 26 : undefined}
                          value={String(filters[key] ?? "")}
                          onChange={(event) => setFilter(key, event.target.value || undefined)}
                        />
                      )}
                    </div>
                  ))}
                </>
              )}
            />
          </CardBody>
        </Card>
      </Container>
    </div>
  );
}
