import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  scheduleAdapter,
  useAdminScheduleDetailQuery,
  useAdminSchedulesQuery,
  validScheduleQuery,
  validWorkplaceId,
  type ScheduleDetail,
  type ScheduleKind,
  type ScheduleRow,
} from "../../modules/checkupino/schedules/api";
import { formatCatalogPrice } from "../../modules/checkupino/catalog/api";
import {
  formatProductDate,
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
  type ProductLocale,
} from "../../modules/checkupino/preferences/localization";
import {
  parseServerTableQuery,
  serializeServerTableQuery,
  ServerDataTable,
  type ServerTableColumnDef,
  type ServerTableQuery,
} from "../../modules/checkupino/table";
import DetailBox from "./DetailBox";
import SlotControlEditor from "./SlotControlEditor";

const sliceParameters = (parameters: URLSearchParams, prefix: string) =>
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
const slotTimestamp = (value: string, timezone: string, locale: ProductLocale) =>
  new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    timeZone: timezone,
    timeZoneName: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const filterChoices: Readonly<Record<string, readonly string[]>> = {
  conflict: ["blocking", "unblocked"],
  history: ["with", "without"],
  timing: ["all", "future", "past"],
};

function ScheduleCollection({
  kind,
  workplaceId,
  services,
}: {
  readonly kind: ScheduleKind;
  readonly workplaceId?: string;
  readonly services?: ScheduleDetail["services"];
}) {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters, setParameters] = useSearchParams();
  const prefix = kind === "workplaces" ? "" : kind + "_";
  const [editing, setEditing] = useState<{
    readonly slot?: Extract<ScheduleRow, { kind: "slots" }>;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const adapter = useMemo(() => scheduleAdapter(kind), [kind]);
  const query = useMemo(
    () => parseServerTableQuery(sliceParameters(parameters, prefix), adapter),
    [parameters, prefix, adapter],
  );
  const canonical = serializeServerTableQuery(query, adapter).toString();
  const valid =
    validScheduleQuery(query, kind) &&
    (kind === "workplaces" || validWorkplaceId(workplaceId ?? ""));
  useEffect(() => {
    if (!prefix && parameters.toString() !== canonical) setParameters(canonical, { replace: true });
  }, [prefix, parameters, canonical, setParameters]);
  const update = (next: ServerTableQuery) =>
    setParameters((previous) =>
      replaceSlice(previous, prefix, serializeServerTableQuery(next, adapter)),
    );
  const { currentData, error, isFetching, refetch } = useAdminSchedulesQuery(
    { kind, workplaceId, query },
    { skip: !capabilities.accessAdminPanel || !valid, refetchOnMountOrArgChange: true },
  );
  const visible = valid && !error && !isFetching && !uncertain ? currentData : undefined;
  const missing = t("adminReservations.missing");
  const columns = useMemo<readonly ServerTableColumnDef<ScheduleRow>[]>(() => {
    const yesNo = (value: boolean) => t(value ? "activity.yes" : "activity.no");
    if (kind === "workplaces")
      return [
        {
          id: "label",
          accessorFn: (row) =>
            row.kind === "workplaces"
              ? (row.display_name ?? row.hospital?.name ?? row.public_id)
              : "",
          header: t("schedule.workplace"),
          cell: ({ row }) =>
            row.original.kind === "workplaces" ? (
              <Link to={`/schedules/workplaces/${row.original.id}?${canonical}`}>
                {row.original.display_name || row.original.hospital?.name || row.original.public_id}
              </Link>
            ) : (
              missing
            ),
        },
        {
          id: "doctor",
          header: t("schedule.doctor"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "workplaces" ? (row.original.doctor?.name ?? missing) : missing,
        },
        {
          id: "hospital",
          header: t("schedule.hospital"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "workplaces" ? (row.original.hospital?.name ?? missing) : missing,
        },
        {
          id: "state",
          header: t("catalog.state"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "workplaces" ? t(`catalog.state.${row.original.state}`) : missing,
        },
        {
          id: "rules",
          header: t("schedule.rules"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "workplaces"
              ? formatProductNumber(row.original.counts.rules, locale)
              : missing,
        },
        {
          id: "slots",
          header: t("schedule.slots"),
          enableSorting: false,
          cell: ({ row }) =>
            row.original.kind === "workplaces"
              ? formatProductNumber(row.original.counts.slots, locale)
              : missing,
        },
        {
          id: "updated_at",
          header: t("catalog.updated_at"),
          cell: ({ row }) =>
            row.original.kind === "workplaces" && row.original.updated_at
              ? formatProductTimestamp(row.original.updated_at, locale)
              : missing,
        },
      ];
    if (kind === "rules")
      return [
        {
          id: "service",
          header: t("schedule.service"),
          cell: ({ row }) =>
            row.original.kind === "rules" ? (row.original.checkup?.title ?? missing) : missing,
        },
        {
          id: "weekday",
          header: t("schedule.weekday"),
          cell: ({ row }) =>
            row.original.kind === "rules" ? t(`schedule.weekday.${row.original.weekday}`) : missing,
        },
        {
          id: "hours",
          header: t("schedule.localHours"),
          cell: ({ row }) =>
            row.original.kind === "rules" ? (
              <bdi dir="ltr">
                {row.original.starts_at.slice(0, 5)} – {row.original.ends_at.slice(0, 5)}
              </bdi>
            ) : (
              missing
            ),
        },
        {
          id: "duration",
          header: t("catalog.duration"),
          cell: ({ row }) =>
            row.original.kind === "rules"
              ? formatProductNumber(row.original.duration_minutes, locale)
              : missing,
        },
        {
          id: "state",
          header: t("schedule.enabled"),
          cell: ({ row }) =>
            row.original.kind === "rules" ? yesNo(row.original.is_active) : missing,
        },
        {
          id: "effective",
          header: t("schedule.effective"),
          cell: ({ row }) =>
            row.original.kind === "rules" ? (
              <>
                {row.original.effective_from
                  ? formatProductDate(row.original.effective_from, locale)
                  : missing}{" "}
                –{" "}
                {row.original.effective_until
                  ? formatProductDate(row.original.effective_until, locale)
                  : missing}
              </>
            ) : (
              missing
            ),
        },
        {
          id: "override",
          header: t("schedule.ruleOverride"),
          cell: ({ row }) =>
            row.original.kind === "rules" && row.original.price_override !== null ? (
              <bdi>
                {formatCatalogPrice(
                  row.original.price_override,
                  row.original.currency_override ?? t("schedule.inheritedCurrency"),
                  locale,
                )}
              </bdi>
            ) : (
              missing
            ),
        },
        {
          id: "breaks",
          header: t("schedule.breaks"),
          cell: ({ row }) =>
            row.original.kind === "rules" && row.original.breaks.length
              ? row.original.breaks.map((b, index) => (
                  <bdi key={index} dir="ltr" className="d-block">
                    {b.starts_at.slice(0, 5)} – {b.ends_at.slice(0, 5)}
                  </bdi>
                ))
              : missing,
        },
      ];
    return [
      {
        id: "time",
        header: t("schedule.occurrence"),
        cell: ({ row }) =>
          row.original.kind === "slots" ? (
            <>
              <span className="d-block">
                {slotTimestamp(
                  row.original.starts_at,
                  currentData?.period?.timezone ?? "UTC",
                  locale,
                )}
              </span>
              <span className="d-block">
                {slotTimestamp(
                  row.original.ends_at,
                  currentData?.period?.timezone ?? "UTC",
                  locale,
                )}
              </span>
            </>
          ) : (
            missing
          ),
      },
      {
        id: "service",
        header: t("schedule.service"),
        cell: ({ row }) =>
          row.original.kind === "slots" ? (row.original.checkup?.title ?? missing) : missing,
      },
      {
        id: "price",
        header: t("catalog.price"),
        cell: ({ row }) =>
          row.original.kind === "slots" ? (
            <bdi>{formatCatalogPrice(row.original.price, row.original.currency, locale)}</bdi>
          ) : (
            missing
          ),
      },
      ...(
        [
          "is_active",
          "is_future",
          "blocking_reservation",
          "has_reservation_history",
          "binding_consistent",
        ] as const
      ).map((key) => ({
        id: key,
        header: t(`schedule.${key}`),
        cell: ({ row }: { row: { original: ScheduleRow } }) =>
          row.original.kind === "slots" ? yesNo(row.original[key]) : missing,
      })),
      {
        id: "rule",
        header: t("schedule.ruleEnabled"),
        cell: ({ row }) =>
          row.original.kind === "slots" && row.original.rule
            ? yesNo(row.original.rule.is_active)
            : missing,
      },
      {
        id: "control",
        header: t("schedule.control.title"),
        cell: ({ row }) =>
          row.original.kind === "slots" ? (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              disabled={
                uncertain ||
                !row.original.is_future ||
                row.original.has_reservation_history ||
                row.original.blocking_reservation ||
                !row.original.binding_consistent ||
                !row.original.rule?.is_active ||
                !row.original.checkup ||
                row.original.checkup.archived ||
                !row.original.checkup.is_active
              }
              onClick={() => {
                if (row.original.kind === "slots") setEditing({ slot: row.original });
              }}
            >
              {t("schedule.control.editSlot")}
            </button>
          ) : (
            missing
          ),
      },
    ];
  }, [kind, t, locale, canonical, missing, currentData?.period?.timezone, uncertain]);
  if (!capabilities.accessAdminPanel) return null;
  return (
    <Card tag="section" aria-labelledby={`schedule-${kind}-heading`} data-schedule-kind={kind}>
      <CardHeader>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <h5 id={`schedule-${kind}-heading`} className="card-title flex-grow-1 mb-0">
            {t(`schedule.${kind}`)}
          </h5>
          {kind === "slots" && services?.length ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!visible}
              onClick={() => setEditing({})}
            >
              {t("schedule.control.bulk")}
            </button>
          ) : null}
          <button
            className="btn btn-light"
            type="button"
            disabled={!valid || isFetching}
            onClick={() => {
              void refetch().then((result) => {
                if (!result.error) setUncertain(false);
              });
            }}
          >
            {t("adminReservations.refresh")}
          </button>
          <button
            className="btn btn-light"
            type="button"
            onClick={() => update({ page: 1, perPage: 20, search: "", sort: null, filters: {} })}
          >
            {t("adminReservations.reset")}
          </button>
        </div>
        {kind === "workplaces" ? (
          <div className="d-flex flex-wrap gap-2 mt-3">
            {["current", "active", "inactive", "archived"].map((state) => (
              <button
                key={state}
                type="button"
                className="btn btn-outline-primary btn-sm"
                aria-pressed={(query.filters.state ?? "current") === state}
                onClick={() => update({ ...query, page: 1, filters: { ...query.filters, state } })}
              >
                {t(`catalog.state.${state}`)}
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardBody>
        {uncertain ? (
          <p role="alert" className="alert alert-warning">
            {t("adminManage.uncertain")}
          </p>
        ) : null}
        {!valid ? (
          <p role="alert" className="alert alert-warning">
            {t("schedule.invalidQuery")}
          </p>
        ) : null}
        {visible ? (
          <p className="text-muted" data-schedule-generated>
            {t("catalog.generated", {
              total: formatProductNumber(visible.page.total, locale),
              at: formatProductTimestamp(visible.generatedAt, locale),
            })}
          </p>
        ) : null}
        {visible?.timezone ? (
          <p className="text-muted">
            {t("schedule.timezone")}: <bdi>{visible.timezone}</bdi>
          </p>
        ) : null}
        {visible?.period ? (
          <p className="text-muted" data-schedule-period>
            {formatProductDate(visible.period.from, locale)} –{" "}
            {formatProductDate(visible.period.to, locale)} (<bdi>{visible.period.timezone}</bdi>)
          </p>
        ) : null}
        {kind === "slots" ? <p className="text-muted">{t("schedule.stateHint")}</p> : null}
        <ServerDataTable
          adapter={adapter}
          columns={columns}
          searchable={kind === "workplaces"}
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
                const choices =
                  key === "state"
                    ? kind === "workplaces"
                      ? ["current", "active", "inactive", "archived", "all"]
                      : ["all", "active", "inactive"]
                    : key === "weekday"
                      ? ["0", "1", "2", "3", "4", "5", "6"]
                      : filterChoices[key];
                const value = String(
                  filters[key] ??
                    (key === "state" ? (kind === "workplaces" ? "current" : "all") : ""),
                );
                return (
                  <div key={key}>
                    <label className="form-label" htmlFor={`schedule-${kind}-${key}`}>
                      {t(`schedule.filter.${key}`)}
                    </label>
                    {choices ? (
                      <select
                        className="form-select"
                        id={`schedule-${kind}-${key}`}
                        value={value}
                        onChange={(event) => setFilter(key, event.target.value || undefined)}
                      >
                        {key !== "state" ? (
                          <option value="">{t("adminReservations.all")}</option>
                        ) : null}
                        {choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {t(
                              key === "state"
                                ? `catalog.state.${choice}`
                                : key === "weekday"
                                  ? `schedule.weekday.${choice}`
                                  : `schedule.choice.${choice}`,
                            )}
                          </option>
                        ))}
                      </select>
                    ) : key === "checkup_id" && services ? (
                      <select
                        className="form-select"
                        id={`schedule-${kind}-${key}`}
                        value={value}
                        onChange={(event) => setFilter(key, event.target.value || undefined)}
                      >
                        <option value="">{t("adminReservations.all")}</option>
                        {value && !services.some((s) => String(s.id) === value) ? (
                          <option value={value}>
                            {t("schedule.serviceReference", { id: value })}
                          </option>
                        ) : null}
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.title}
                            {service.archived ? ` (${t("catalog.state.archived")})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="form-control"
                        id={`schedule-${kind}-${key}`}
                        type={key === "from" || key === "to" ? "date" : "number"}
                        dir="ltr"
                        min={key === "from" || key === "to" ? undefined : 1}
                        step={key === "from" || key === "to" ? undefined : 1}
                        value={value}
                        onChange={(event) => setFilter(key, event.target.value || undefined)}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}
        />
      </CardBody>
      {editing && workplaceId && services ? (
        <SlotControlEditor
          workplaceId={workplaceId}
          services={services}
          initial={editing.slot}
          date={visible?.period?.from ?? ""}
          onClose={() => setEditing(null)}
          onUncertain={() => setUncertain(true)}
          onSaved={() => {
            setEditing(null);
            void refetch();
          }}
        />
      ) : null}
    </Card>
  );
}

export default function Schedules() {
  const { capabilities } = useShellAuth();
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("adminManage.schedules");
  }, [t]);
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.schedules")}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <ScheduleCollection kind="workplaces" />
      </Container>
    </div>
  );
}

export function WorkplaceSchedule() {
  const { capabilities } = useShellAuth();
  const { workplaceId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters] = useSearchParams();
  const valid = validWorkplaceId(workplaceId);
  const { currentData, error, isFetching, refetch } = useAdminScheduleDetailQuery(
    { workplaceId },
    { skip: !valid || !capabilities.accessAdminPanel, refetchOnMountOrArgChange: true },
  );
  const row = valid && !error && !isFetching ? currentData : undefined;
  useEffect(() => {
    document.title = t("adminManage.schedule-detail");
  }, [t]);
  const missing = t("adminReservations.missing");
  const flag = (value: boolean | undefined) =>
    value === undefined ? missing : t(value ? "activity.yes" : "activity.no");
  const back =
    "/schedules?" +
    serializeServerTableQuery(
      parseServerTableQuery(parameters, scheduleAdapter("workplaces")),
      scheduleAdapter("workplaces"),
    );
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("adminManage.schedule-detail")}
          pageTitle={t("adminManage.schedules")}
        />
        <Card data-schedule-detail>
          <CardHeader className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="card-title flex-grow-1 mb-0">
              {row?.display_name || row?.hospital?.name || t("adminManage.schedule-detail")}
            </h5>
            <Link to={back} className="btn btn-light">
              {t("adminManage.back")}
            </Link>
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
          </CardHeader>
          <CardBody>
            {!valid ? (
              <p role="alert" className="alert alert-warning">
                {t("catalog.invalidId")}
              </p>
            ) : error ? (
              <p role="alert" className="alert alert-warning">
                {t("adminManage.unavailable")}
              </p>
            ) : isFetching ? (
              <output>{t("adminManage.loading")}</output>
            ) : null}
            <p className="mb-0 text-muted">{t("schedule.stateHint")}</p>
          </CardBody>
        </Card>
        {row ? (
          <>
            <Row data-schedule-boxes>
              <DetailBox
                id="schedule-workplace-box"
                title={t("schedule.workplace")}
                icon="ri-hospital-line"
                fields={[
                  [t("catalog.state"), t(`catalog.state.${row.state}`)],
                  [t("schedule.timezone"), row.hospital?.timezone ?? missing],
                  [t("catalog.record"), row.public_id],
                  [
                    t("catalog.updated_at"),
                    row.updated_at ? formatProductTimestamp(row.updated_at, locale) : missing,
                  ],
                ]}
              />
              <DetailBox
                id="schedule-people-box"
                title={t("schedule.doctorHospital")}
                icon="ri-stethoscope-line"
                fields={[
                  [
                    t("schedule.doctor"),
                    row.doctor ? (
                      <Link
                        key="doctor"
                        to={`/users/${row.doctor.user_public_id}?directory=doctors`}
                      >
                        {row.doctor.name}
                      </Link>
                    ) : (
                      missing
                    ),
                  ],
                  [t("schedule.verified"), flag(row.doctor?.verified)],
                  [t("schedule.accountActive"), flag(row.doctor?.account_active)],
                  [t("schedule.hospital"), row.hospital?.name ?? missing],
                  [t("schedule.hospitalActive"), flag(row.hospital?.is_active)],
                  [t("schedule.hospitalArchived"), flag(row.hospital?.archived)],
                ]}
                actions={
                  <Link
                    className="btn btn-light btn-sm"
                    to={`/reservations?workplace_id=${row.id}`}
                  >
                    {t("adminReservations.title")}
                  </Link>
                }
              />
              <DetailBox
                id="schedule-services-box"
                title={t("schedule.services")}
                icon="ri-stethoscope-line"
                columns={12}
              >
                <div className="table-responsive">
                  <table className="table table-nowrap align-middle mb-0">
                    <thead>
                      <tr>
                        {[
                          "service",
                          "enabled",
                          "catalogActive",
                          "basePrice",
                          "workplaceOverride",
                        ].map((key) => (
                          <th key={key} scope="col">
                            {t(`schedule.${key}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {row.services.map((service) => (
                        <tr key={service.id}>
                          <td>
                            <Link to={`/checkups/${service.id}`}>{service.title}</Link>
                            {service.archived ? (
                              <span className="d-block text-muted">
                                {t("catalog.state.archived")}
                              </span>
                            ) : null}
                          </td>
                          <td>{flag(service.offering_active)}</td>
                          <td>{flag(service.is_active)}</td>
                          <td>
                            <bdi>
                              {formatCatalogPrice(
                                service.base_price,
                                service.base_currency,
                                locale,
                              )}
                            </bdi>
                          </td>
                          <td>
                            {service.price_override !== null ? (
                              <bdi>
                                {formatCatalogPrice(
                                  service.price_override,
                                  service.currency_override ?? service.base_currency,
                                  locale,
                                )}
                              </bdi>
                            ) : (
                              missing
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!row.services.length ? <p>{t("schedule.noServices")}</p> : null}
                <p className="text-muted small mt-2 mb-0">{t("schedule.serviceBound")}</p>
              </DetailBox>
            </Row>
            <ScheduleCollection kind="rules" workplaceId={workplaceId} services={row.services} />
            <ScheduleCollection kind="slots" workplaceId={workplaceId} services={row.services} />
          </>
        ) : null}
      </Container>
    </div>
  );
}
