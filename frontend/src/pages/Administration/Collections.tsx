import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  collectionAdapter,
  useAdminCollectionQuery,
  type AdminCollection,
  type AdminListRow,
} from "../../modules/checkupino/administration/api";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import {
  parseServerTableQuery,
  serializeServerTableQuery,
  serverTableBackendParameters,
  ServerDataTable,
  type ServerTableColumnDef,
} from "../../modules/checkupino/table";
import MedicalCreateDialog from "./MedicalCreateDialog";

const choices: Record<string, readonly string[]> = {
  medicalStatus: ["open", "in_review", "completed", "cancelled"],
  questionnaireStatus: ["draft", "published"],
  stage: ["awaiting_upload", "awaiting_checks", "ready", "in_review", "published", "attention"],
  owner_type: ["account", "guest"],
};
export function Collection({ kind }: { readonly kind: AdminCollection }) {
  const { capabilities } = useShellAuth();
  const [creating, setCreating] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters, setParameters] = useSearchParams();
  const adapter = useMemo(() => collectionAdapter(kind), [kind]);
  const query = useMemo(() => parseServerTableQuery(parameters, adapter), [parameters, adapter]);
  const canonical = serializeServerTableQuery(query, adapter).toString();
  useEffect(() => {
    if (parameters.toString() !== canonical) setParameters(canonical, { replace: true });
  }, [parameters, canonical, setParameters]);
  useEffect(() => {
    document.title = t(`adminManage.${kind}`);
  }, [t, kind]);
  const badDates =
    typeof query.filters.from === "string" &&
    typeof query.filters.to === "string" &&
    query.filters.to < query.filters.from;
  const { currentData, error, isFetching, refetch } = useAdminCollectionQuery(
    { kind, filters: serverTableBackendParameters(query, adapter) },
    { skip: !capabilities.accessAdminPanel || badDates, refetchOnMountOrArgChange: true },
  );
  const visible = !badDates && !error && !isFetching ? currentData : undefined;
  const refresh = async () => {
    const result = await refetch();
    if (!result.error) setUncertain(false);
  };
  const missing = t("adminReservations.missing");
  const columns = useMemo<readonly ServerTableColumnDef<AdminListRow>[]>(
    () => [
      {
        id: "title",
        accessorKey: "title",
        header: t("adminManage.title"),
        cell: ({ row }) => (
          <Link to={`/${kind}/${row.original.identifier}?${canonical}`}>{row.original.title}</Link>
        ),
      },
      ...(kind !== "questionnaires"
        ? [
            {
              id: "patient",
              header: t(
                kind === "questionnaire-submissions"
                  ? "adminManage.submitter"
                  : "adminManage.patient",
              ),
              enableSorting: false,
              cell: ({ row }: { row: { original: AdminListRow } }) =>
                row.original.patient ?? missing,
            },
          ]
        : []),
      ...(kind === "medical-requests"
        ? [
            {
              id: "doctor",
              header: t("adminReservations.doctor"),
              enableSorting: false,
              cell: ({ row }: { row: { original: AdminListRow } }) =>
                row.original.doctor ?? missing,
            },
            {
              id: "progress",
              header: t("adminManage.progress"),
              enableSorting: false,
              cell: ({ row }: { row: { original: AdminListRow } }) =>
                [row.original.received, row.original.checking, row.original.eligible]
                  .map((n) => formatProductNumber(n ?? 0, locale))
                  .join(" / "),
            },
          ]
        : [
            {
              id: "version",
              accessorKey: "version",
              enableSorting: false,
              header: t("adminManage.version"),
              cell: ({ row }: { row: { original: AdminListRow } }) =>
                formatProductNumber(row.original.version ?? 0, locale),
            },
          ]),
      {
        id: "state",
        accessorKey: "state",
        enableSorting: kind !== "questionnaire-submissions",
        header: t("adminManage.status"),
        cell: ({ row }) =>
          row.original.state ? t(`adminManage.state.${row.original.state}`) : missing,
      },
      ...(kind === "questionnaire-submissions"
        ? [
            {
              id: "score",
              accessorKey: "score" as const,
              header: t("questionnaire.score"),
              cell: ({ row }: { row: { original: AdminListRow } }) =>
                formatProductNumber(row.original.score ?? 0, locale),
            },
          ]
        : []),
      {
        id: "created_at",
        accessorKey: "created_at",
        header: t("adminManage.created_at"),
        cell: ({ row }) =>
          row.original.created_at
            ? formatProductTimestamp(row.original.created_at, locale)
            : missing,
      },
    ],
    [kind, canonical, t, locale, missing],
  );
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  const quick =
    kind === "medical-requests"
      ? choices.stage
      : kind === "questionnaires"
        ? choices.questionnaireStatus
        : choices.owner_type;
  const quickKey =
    kind === "medical-requests" ? "stage" : kind === "questionnaires" ? "status" : "owner_type";
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t(`adminManage.${kind}`)}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <Card>
          <CardHeader>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h5 className="card-title flex-grow-1 mb-0">{t(`adminManage.${kind}`)}</h5>
              {kind === "questionnaires" ? (
                <Link className="btn btn-primary" to="/questionnaires/0">
                  {t("adminManage.create")}
                </Link>
              ) : null}
              {kind === "medical-requests" ? (
                <button
                  className="btn btn-primary"
                  disabled={uncertain}
                  onClick={() => setCreating(true)}
                >
                  {t("adminManage.newMedicalRequest")}
                </button>
              ) : null}
              <button
                className="btn btn-light"
                disabled={isFetching || badDates}
                onClick={() => void refresh()}
              >
                {t("adminReservations.refresh")}
              </button>
              <button
                className="btn btn-light"
                onClick={() =>
                  setParameters(
                    serializeServerTableQuery(
                      { ...query, page: 1, search: "", sort: null, filters: {} },
                      adapter,
                    ),
                  )
                }
              >
                {t("adminReservations.reset")}
              </button>
            </div>
            {kind === "medical-requests" ? (
              <p className="text-muted mt-2">{t("adminManage.progressHint")}</p>
            ) : null}
            <div className="d-flex flex-wrap gap-2 mt-2">
              {quick.map((value) => (
                <button
                  className="btn btn-sm btn-outline-primary"
                  key={value}
                  aria-pressed={query.filters[quickKey] === value}
                  onClick={() =>
                    setParameters(
                      serializeServerTableQuery(
                        { ...query, page: 1, filters: { ...query.filters, [quickKey]: value } },
                        adapter,
                      ),
                    )
                  }
                >
                  {t(`adminManage.state.${value}`)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody>
            {uncertain ? (
              <p className="alert alert-warning" role="alert">
                {t("adminManage.uncertain")}
              </p>
            ) : null}
            {badDates ? (
              <p className="alert alert-warning" role="alert">
                {t("adminReservations.dateRangeInvalid")}
              </p>
            ) : null}
            <ServerDataTable
              adapter={adapter}
              columns={columns}
              locale={locale}
              query={query}
              onQueryChange={(next) => setParameters(serializeServerTableQuery(next, adapter))}
              result={visible}
              loading={isFetching}
              error={error}
              onRetry={() => void refetch()}
              filterControls={({ filters, setFilter }) => (
                <>
                  {Object.keys(adapter.filters ?? {}).map((key) => {
                    const options =
                      key === "status"
                        ? choices[
                            kind === "medical-requests" ? "medicalStatus" : "questionnaireStatus"
                          ]
                        : choices[key];
                    return (
                      <label key={key} className="form-label mb-0">
                        {t(
                          kind === "questionnaire-submissions" && key === "user_id"
                            ? "adminManage.account_id"
                            : `adminManage.${key}`,
                        )}
                        {options ? (
                          <select
                            className="form-select"
                            value={String(filters[key] ?? "")}
                            onChange={(event) => setFilter(key, event.target.value || undefined)}
                          >
                            <option value="">{t("adminReservations.all")}</option>
                            {options.map((value) => (
                              <option key={value} value={value}>
                                {t(`adminManage.state.${value}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="form-control"
                            type={key === "from" || key === "to" ? "date" : "number"}
                            min={
                              key === "from" || key === "to" || key.startsWith("score_")
                                ? undefined
                                : 1
                            }
                            value={String(filters[key] ?? "")}
                            onChange={(event) => setFilter(key, event.target.value || undefined)}
                          />
                        )}
                      </label>
                    );
                  })}
                </>
              )}
            />
          </CardBody>
        </Card>
        {creating && kind === "medical-requests" ? (
          <MedicalCreateDialog
            onUncertain={() => setUncertain(true)}
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              void refetch();
            }}
          />
        ) : null}
      </Container>
    </div>
  );
}
export default function MedicalRequests() {
  return <Collection kind="medical-requests" />;
}
export function Questionnaires() {
  return <Collection kind="questionnaires" />;
}
export function Submissions() {
  return <Collection kind="questionnaire-submissions" />;
}
