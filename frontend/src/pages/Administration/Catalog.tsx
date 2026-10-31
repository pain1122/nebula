import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import CatalogEditor from "./CatalogEditor";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  catalogAdapter,
  catalogStates,
  formatCatalogPrice,
  useAdminCatalogQuery,
  validCatalogQuery,
  type CatalogKind,
  type CatalogRow,
} from "../../modules/checkupino/catalog/api";
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
} from "../../modules/checkupino/table";

export function CatalogList({ kind }: { readonly kind: CatalogKind }) {
  const { capabilities } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters, setParameters] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const adapter = useMemo(() => catalogAdapter(kind), [kind]);
  const query = useMemo(() => parseServerTableQuery(parameters, adapter), [parameters, adapter]);
  const canonical = serializeServerTableQuery(query, adapter).toString();
  const valid = validCatalogQuery(query, kind);
  useEffect(() => {
    if (parameters.toString() !== canonical) setParameters(canonical, { replace: true });
  }, [parameters, canonical, setParameters]);
  useEffect(() => {
    document.title = t(`adminManage.${kind}`);
  }, [kind, t]);
  const { currentData, error, isFetching, refetch } = useAdminCatalogQuery(
    { kind, query },
    { skip: !capabilities.accessAdminPanel || !valid, refetchOnMountOrArgChange: true },
  );
  const visible = valid && !error && !isFetching ? currentData : undefined;
  const categoryQuery = useMemo(
    () => ({ page: 1, perPage: 100, search: "", sort: null, filters: { state: "all" } }),
    [],
  );
  const categories = useAdminCatalogQuery(
    { kind: "checkup-categories", query: categoryQuery },
    {
      skip: !capabilities.accessAdminPanel || kind !== "checkups",
      refetchOnMountOrArgChange: true,
    },
  );
  const categoryOptions =
    !categories.error && !categories.isFetching ? categories.currentData?.items : undefined;
  const missing = t("adminReservations.missing");
  const columns = useMemo<readonly ServerTableColumnDef<CatalogRow>[]>(
    () => [
      {
        id: "label",
        accessorKey: "label",
        header: t(kind === "checkups" ? "catalog.title" : "catalog.name"),
        cell: ({ row }) => (
          <Link to={`/${kind}/${row.original.id}?${canonical}`}>{row.original.label}</Link>
        ),
      },
      { id: "slug", accessorKey: "slug", header: t("catalog.slug") },
      ...(kind === "checkups"
        ? [
            {
              id: "category",
              header: t("catalog.category"),
              enableSorting: false,
              cell: ({ row }: { row: { original: CatalogRow } }) =>
                row.original.kind === "checkups" && row.original.category ? (
                  <Link to={`/checkup-categories/${row.original.category.id}`}>
                    {row.original.category.name}
                  </Link>
                ) : (
                  missing
                ),
            },
            {
              id: "price",
              header: t("catalog.price"),
              cell: ({ row }: { row: { original: CatalogRow } }) =>
                row.original.kind === "checkups"
                  ? formatCatalogPrice(row.original.price, row.original.currency, locale)
                  : missing,
            },
            {
              id: "duration",
              header: t("catalog.duration"),
              enableSorting: false,
              cell: ({ row }: { row: { original: CatalogRow } }) =>
                row.original.kind === "checkups"
                  ? formatProductNumber(row.original.default_duration_minutes, locale)
                  : missing,
            },
          ]
        : []),
      {
        id: "state",
        header: t("catalog.state"),
        enableSorting: false,
        cell: ({ row }) => t(`catalog.state.${row.original.state}`),
      },
      {
        id: "usage",
        header: t(
          kind === "checkups"
            ? "catalog.reservations"
            : kind === "specialties"
              ? "catalog.doctorAssociations"
              : "catalog.checkups",
        ),
        enableSorting: false,
        cell: ({ row }) =>
          formatProductNumber(
            row.original.kind === "checkups"
              ? row.original.counts.reservations
              : row.original.kind === "checkup-categories"
                ? row.original.counts.checkups
                : row.original.counts.primary_doctors + row.original.counts.secondary_associations,
            locale,
          ),
      },
      {
        id: "updated_at",
        header: t("catalog.updated_at"),
        cell: ({ row }) =>
          row.original.updated_at
            ? formatProductTimestamp(row.original.updated_at, locale)
            : missing,
      },
    ],
    [t, kind, canonical, locale, missing],
  );
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t(`adminManage.${kind}`)}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <Card data-catalog-panel={kind}>
          <CardHeader>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h5 className="card-title flex-grow-1 mb-0">{t(`adminManage.${kind}`)}</h5>
              <button
                type="button"
                className="btn btn-primary"
                disabled={uncertain || isFetching || !valid}
                onClick={() => setCreating(true)}
              >
                {t("catalog.create")}
              </button>
              <button
                type="button"
                className="btn btn-light"
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
                type="button"
                className="btn btn-light"
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
            <p className="text-muted mt-2">{t("catalog.description")}</p>
            <div className="d-flex gap-2 flex-wrap">
              {["current", "active", "inactive", "archived"].map((state) => (
                <button
                  key={state}
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  aria-pressed={(query.filters.state ?? "current") === state}
                  onClick={() =>
                    setParameters(
                      serializeServerTableQuery(
                        { ...query, page: 1, filters: { ...query.filters, state } },
                        adapter,
                      ),
                    )
                  }
                >
                  {t(`catalog.state.${state}`)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody>
            {uncertain ? (
              <p role="alert" className="alert alert-warning">
                {t("adminManage.uncertain")}
              </p>
            ) : null}
            {!valid ? (
              <p role="alert" className="alert alert-warning">
                {t("catalog.invalidQuery")}
              </p>
            ) : null}
            {visible ? (
              <p className="text-muted" data-catalog-generated>
                {t("catalog.generated", {
                  total: formatProductNumber(visible.page.total, locale),
                  at: formatProductTimestamp(visible.generatedAt, locale),
                })}
              </p>
            ) : null}
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
                      <label className="form-label" htmlFor={`catalog-${key}`}>
                        {t(`catalog.${key}`)}
                      </label>
                      {key === "state" ? (
                        <select
                          id={`catalog-${key}`}
                          className="form-select"
                          value={String(filters[key] ?? "current")}
                          onChange={(event) => setFilter(key, event.target.value)}
                        >
                          {catalogStates.map((state) => (
                            <option key={state} value={state}>
                              {t(`catalog.state.${state}`)}
                            </option>
                          ))}
                        </select>
                      ) : key === "uncategorized" || key === "root_only" ? (
                        <select
                          id={`catalog-${key}`}
                          className="form-select"
                          value={String(filters[key] ?? "")}
                          onChange={(event) => setFilter(key, event.target.value || undefined)}
                        >
                          <option value="">{t("adminReservations.all")}</option>
                          <option value="1">
                            {t(
                              key === "root_only"
                                ? "catalog.rootsOnly"
                                : "catalog.uncategorizedOnly",
                            )}
                          </option>
                        </select>
                      ) : key === "category_id" ? (
                        <>
                          <select
                            id={`catalog-${key}`}
                            className="form-select"
                            value={String(filters[key] ?? "")}
                            onChange={(event) => setFilter(key, event.target.value || undefined)}
                          >
                            <option value="">{t("adminReservations.all")}</option>
                            {filters[key] &&
                            !categoryOptions?.some(
                              (row) => String(row.id) === String(filters[key]),
                            ) ? (
                              <option value={String(filters[key])}>
                                {t("catalog.categoryReference", { id: String(filters[key]) })}
                              </option>
                            ) : null}
                            {categoryOptions?.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.label}
                                {row.state === "archived"
                                  ? ` (${t("catalog.state.archived")})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                          <small className="text-muted">
                            {t("catalog.categoryBound")}{" "}
                            <Link to="/checkup-categories">
                              {t("adminManage.checkup-categories")}
                            </Link>
                          </small>
                        </>
                      ) : (
                        <input
                          id={`catalog-${key}`}
                          className="form-control"
                          type={key === "currency" ? "text" : "number"}
                          min={key === "currency" ? undefined : key === "parent_id" ? 1 : 0}
                          step={key === "currency" ? undefined : 1}
                          maxLength={key === "currency" ? 3 : undefined}
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
        {creating ? (
          <CatalogEditor
            key={kind}
            kind={kind}
            initial={null}
            operation="create"
            onClose={() => setCreating(false)}
            onUncertain={() => setUncertain(true)}
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
export default function Checkups() {
  return <CatalogList kind="checkups" />;
}
export function Categories() {
  return <CatalogList kind="checkup-categories" />;
}
export function Specialties() {
  return <CatalogList kind="specialties" />;
}
