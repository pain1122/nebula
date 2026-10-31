import { useEffect, useMemo, useState } from "react";
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
import { useAdminUsersQuery } from "../../modules/checkupino/query/api";
import {
  parseServerTableQuery,
  createDefaultServerTableQuery,
  serializeServerTableQuery,
  ServerDataTable,
  type ServerTableColumnDef,
} from "../../modules/checkupino/table";
import {
  createUserDirectoryAdapter,
  userDirectoryRequest,
  scopedDirectoryQuery,
  type AdminDirectoryUser,
  type DirectoryScope,
} from "../../modules/checkupino/users/directory";
import { UserEditor } from "../../modules/checkupino/users/UserEditor";

const UserDirectory = ({ scope }: { readonly scope?: DirectoryScope }) => {
  const { capabilities } = useShellAuth();
  const allowed = scope ? capabilities.manageMarketplaceUsers : capabilities.manageAdminIdentities;
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [editor, setEditor] = useState<{ readonly userId: number | null } | null>(null);
  const [saved, setSaved] = useState(false);
  const [parameters, setParameters] = useSearchParams();
  const adapter = useMemo(
    () => createUserDirectoryAdapter(capabilities.manageAdminIdentities, scope),
    [capabilities.manageAdminIdentities, scope],
  );
  const query = useMemo(() => {
    const parsed = scopedDirectoryQuery(parseServerTableQuery(parameters, adapter), scope);
    return scope ? parsed : { ...parsed, filters: { ...parsed.filters, role: "admin" } };
  }, [adapter, parameters, scope]);
  const titleKey =
    scope === "doctor"
      ? "operations.doctors"
      : scope === "patient"
        ? "operations.patients"
        : "users.staff";
  const canonical = serializeServerTableQuery(query, adapter).toString();
  const search = parameters.toString();

  useEffect(() => {
    if (search !== canonical) setParameters(canonical, { replace: true });
  }, [canonical, search, setParameters]);

  const { currentData, error, isFetching, refetch } = useAdminUsersQuery(
    userDirectoryRequest(query, capabilities.manageAdminIdentities, !scope),
    { refetchOnMountOrArgChange: true, skip: !allowed },
  );

  useEffect(() => {
    document.title = t(titleKey);
  }, [t, titleKey, scope]);

  const missing = t("users.notAvailable");
  const columns = useMemo<readonly ServerTableColumnDef<AdminDirectoryUser>[]>(
    () => [
      {
        accessorKey: "name",
        cell: ({ row }) =>
          row.original.name?.trim() ||
          [row.original.first_name, row.original.last_name].filter(Boolean).join(" ") ||
          missing,
        header: t("users.name"),
        id: "name",
      },
      {
        accessorKey: "role",
        cell: ({ row }) => (row.original.role ? t(`users.role.${row.original.role}`) : missing),
        header: t("users.role"),
        id: "role",
      },
      {
        accessorKey: "account_state",
        cell: ({ row }) => {
          const state = row.original.account_state;
          return (
            <StatusBadge
              label={state ? t(`users.account.${state}`) : missing}
              tone={state === "active" ? "success" : state === "suspended" ? "warning" : "neutral"}
            />
          );
        },
        header: t("users.accountState"),
        id: "account_state",
      },
      ...(scope === "patient"
        ? [
            {
              accessorKey: "patient_status",
              cell: ({ row }: { row: { original: AdminDirectoryUser } }) =>
                row.original.role === "patient" && row.original.patient_status
                  ? t(`users.patient.${row.original.patient_status}`)
                  : missing,
              header: t("users.patientStatus"),
              id: "patient_status",
            },
          ]
        : []),
      {
        accessorKey: "created_at",
        cell: ({ row }) => {
          const value = row.original.created_at;
          return value && !Number.isNaN(new Date(value).getTime())
            ? formatProductTimestamp(value, locale)
            : missing;
        },
        header: t("users.registeredAt"),
        id: "created_at",
      },
      {
        id: "actions",
        header: t("users.actions"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="d-flex flex-wrap gap-2">
            {scope ? (
              <Link
                className="btn btn-sm btn-light"
                to={`/activity?actor_id=${row.original.id}&actor_role=${scope}`}
              >
                {t("adminManage.activity")}
              </Link>
            ) : null}
            <Link
              className="btn btn-sm btn-light"
              aria-label={t("users.editNamed", { name: row.original.name || missing })}
              to={`/users/${encodeURIComponent(row.original.public_id)}?${canonical}${scope ? `&directory=${scope}s` : ""}`}
            >
              {t("users.edit")}
            </Link>
            {scope && (scope === "patient" || row.original.doctor_profile) ? (
              <>
                <Link
                  className="btn btn-sm btn-light"
                  to={`/reservations?${scope === "doctor" ? "doctor_id=" + row.original.doctor_profile!.id : "user_id=" + row.original.id}`}
                >
                  {t("adminReservations.title")}
                </Link>
                <Link
                  className="btn btn-sm btn-light"
                  to={`/medical-requests?${scope === "doctor" ? "doctor_id=" + row.original.doctor_profile!.id : "user_id=" + row.original.id}`}
                >
                  {t("adminManage.medical-requests")}
                </Link>
              </>
            ) : null}
            {scope === "patient" ? (
              <Link
                className="btn btn-sm btn-light"
                to={`/questionnaire-submissions?user_id=${row.original.id}`}
              >
                {t("adminManage.questionnaire-submissions")}
              </Link>
            ) : null}
          </div>
        ),
      },
      ...(scope === "doctor"
        ? [
            {
              id: "verification",
              header: t("operations.verification"),
              enableSorting: false,
              cell: ({ row }: { row: { original: AdminDirectoryUser } }) =>
                t(
                  !row.original.doctor_profile
                    ? "operations.missing"
                    : row.original.doctor_profile.verified
                      ? "operations.verified"
                      : "operations.unverified",
                ),
            },
            {
              id: "specialty",
              header: t("operations.specialty"),
              enableSorting: false,
              cell: ({ row }: { row: { original: AdminDirectoryUser } }) =>
                row.original.doctor_profile?.specialty || missing,
            },
            {
              id: "workplaces",
              header: t("operations.workplaces"),
              enableSorting: false,
              cell: ({ row }: { row: { original: AdminDirectoryUser } }) =>
                row.original.doctor_profile
                  ? formatProductNumber(row.original.doctor_profile.active_workplaces_count, locale)
                  : missing,
            },
          ]
        : []),
    ],
    [canonical, locale, missing, t, scope],
  );

  if (!allowed) {
    return (
      <p className="alert alert-danger" role="alert">
        {t("users.accessDenied")}
      </p>
    );
  }

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb pageTitle={t("product.navigation.productAdmin")} title={t(titleKey)} />
        <Row>
          <Col lg={12}>
            <Card id="userList">
              <CardHeader>
                <h5 className="card-title mb-0">{t(scope ? titleKey : "users.staffDirectory")}</h5>
                {scope ? (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <Link
                      className="btn btn-success"
                      to={scope === "doctor" ? "/doctors/new" : "/patients/new"}
                    >
                      {t(scope === "doctor" ? "onboarding.newDoctor" : "onboarding.newPatient")}
                    </Link>
                    <button
                      type="button"
                      className="btn btn-light"
                      disabled={isFetching}
                      onClick={() => {
                        void refetch();
                      }}
                    >
                      {t("adminReservations.refresh")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() =>
                        setParameters(
                          serializeServerTableQuery(
                            scopedDirectoryQuery(createDefaultServerTableQuery(adapter), scope),
                            adapter,
                          ),
                        )
                      }
                    >
                      {t("operations.reset")}
                    </button>
                  </div>
                ) : null}
                {!scope ? (
                  <button
                    className="btn btn-success mt-3"
                    onClick={() => {
                      setSaved(false);
                      setEditor({ userId: null });
                    }}
                    type="button"
                  >
                    {t("users.addStaff")}
                  </button>
                ) : null}
              </CardHeader>
              <CardBody>
                {scope ? (
                  <fieldset
                    className="d-flex gap-2 flex-wrap mb-3"
                    aria-label={t("operations.quickFilters")}
                  >
                    {(["active", "suspended"] as const).map((state) => (
                      <button
                        type="button"
                        className="btn btn-light"
                        key={state}
                        onClick={() =>
                          setParameters(
                            serializeServerTableQuery(
                              {
                                ...query,
                                page: 1,
                                filters: { ...query.filters, accountState: state },
                              },
                              adapter,
                            ),
                          )
                        }
                      >
                        {t(`users.account.${state}`)}
                      </button>
                    ))}
                    {scope === "doctor" ? (
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() =>
                          setParameters(
                            serializeServerTableQuery(
                              {
                                ...query,
                                page: 1,
                                filters: { ...query.filters, verification: "unverified" },
                              },
                              adapter,
                            ),
                          )
                        }
                      >
                        {t("operations.unverified")}
                      </button>
                    ) : null}
                  </fieldset>
                ) : null}
                {saved ? (
                  <output className="alert alert-success d-block">{t("users.saved")}</output>
                ) : null}
                {currentData ? (
                  <p className="text-muted">
                    {t("users.total", {
                      total: formatProductNumber(currentData.page.total, locale),
                    })}
                  </p>
                ) : null}
                <ServerDataTable
                  adapter={adapter}
                  columns={columns}
                  debounceMilliseconds={250}
                  error={error}
                  filterControls={({ filters, setFilter }) => (
                    <>
                      <div>
                        <label className="form-label" htmlFor="users-account-state">
                          {t("users.accountState")}
                        </label>
                        <select
                          className="form-select"
                          id="users-account-state"
                          value={String(filters.accountState ?? "")}
                          onChange={(event) => setFilter("accountState", event.target.value)}
                        >
                          <option value="">{t("operations.allStates")}</option>
                          {["active", "closed", "suspended"].map((state) => (
                            <option key={state} value={state}>
                              {t(`users.account.${state}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {scope === "doctor" ? (
                        <>
                          <div>
                            <label className="form-label" htmlFor="users-verification">
                              {t("operations.verification")}
                            </label>
                            <select
                              className="form-select"
                              id="users-verification"
                              value={String(filters.verification ?? "")}
                              onChange={(event) => setFilter("verification", event.target.value)}
                            >
                              <option value="">{t("operations.allVerification")}</option>
                              {["verified", "unverified", "missing"].map((state) => (
                                <option key={state} value={state}>
                                  {t(`operations.${state}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {["specialtyId", "workplaceId"].map((filter) => (
                            <div key={filter}>
                              <label className="form-label" htmlFor={`users-${filter}`}>
                                {t(`operations.${filter}`)}
                              </label>
                              <input
                                className="form-control"
                                type="number"
                                min={1}
                                step={1}
                                id={`users-${filter}`}
                                value={String(filters[filter] ?? "")}
                                onChange={(event) => setFilter(filter, event.target.value)}
                              />
                            </div>
                          ))}
                        </>
                      ) : null}
                      <div>
                        <label className="form-label" htmlFor="users-range">
                          {t("users.registrationRange")}
                        </label>
                        <select
                          className="form-select"
                          id="users-range"
                          onChange={(event) => setFilter("range", event.target.value)}
                          value={String(filters.range ?? "")}
                        >
                          <option value="">{t("users.range.all")}</option>
                          <option value="week">{t("users.range.week")}</option>
                          <option value="month">{t("users.range.month")}</option>
                          <option value="year">{t("users.range.year")}</option>
                        </select>
                      </div>
                    </>
                  )}
                  loading={isFetching}
                  locale={locale}
                  onQueryChange={(next) => setParameters(serializeServerTableQuery(next, adapter))}
                  onRetry={() => {
                    void refetch();
                  }}
                  query={query}
                  result={currentData}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
      {editor ? (
        <UserEditor
          key={editor.userId ?? "create"}
          manageAdminIdentities={capabilities.manageAdminIdentities}
          staffOnly={!scope}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setSaved(true);
          }}
          userId={editor.userId}
        />
      ) : null}
    </div>
  );
};

export default UserDirectory;
export const Doctors = () => <UserDirectory key="doctor" scope="doctor" />;
export const Patients = () => <UserDirectory key="patient" scope="patient" />;
