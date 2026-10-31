import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  catalogWrite,
  readCatalogContext,
  useAdminCatalogQuery,
  validCatalogId,
  verifyCatalogContext,
  type CatalogContext,
  type CatalogDetail,
  type CatalogKind,
} from "../../modules/checkupino/catalog/api";
import ActionDialog from "./ActionDialog";

export default function CatalogEditor({
  kind,
  initial,
  operation,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly kind: CatalogKind;
  readonly initial: CatalogDetail | null;
  readonly operation: "create" | "update" | "archive";
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t } = useTranslation();
  const [context, setContext] = useState<CatalogContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [choice, setChoice] = useState("detach");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [values, setValues] = useState({
    name: initial?.label ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    price: initial?.kind === "checkups" ? initial.price : "0",
    currency: initial?.kind === "checkups" ? initial.currency : "IRR",
    duration: initial?.kind === "checkups" ? String(initial.default_duration_minutes) : "30",
    relation:
      initial?.kind === "checkups"
        ? String(initial.category?.id ?? "")
        : initial?.kind === "specialties"
          ? String(initial.parent?.id ?? "")
          : "",
    active: initial?.is_active ?? true,
  });
  useEffect(() => {
    const controller = new AbortController();
    void readCatalogContext(kind, initial?.id ?? null, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setContext(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [kind, initial?.id]);
  const needsRelation =
    (operation !== "archive" && kind !== "checkup-categories") ||
    (operation === "archive" && kind === "checkup-categories" && choice === "reassign");
  const choiceKind = kind === "specialties" ? "specialties" : "checkup-categories";
  const choices = useAdminCatalogQuery(
    {
      kind: choiceKind,
      query: { page, perPage: 20, search, sort: null, filters: { state: "active" } },
    },
    { skip: !needsRelation, refetchOnMountOrArgChange: true },
  );
  const options = !choices.error && !choices.isFetching ? choices.currentData : undefined;
  const relationValid = !values.relation || validCatalogId(values.relation);
  const priceValid =
    /^(0|[1-9]\d*)$/.test(values.price) &&
    BigInt(values.price) <= BigInt(context?.limits.max_price ?? "0");
  const editableValid =
    values.name.trim().length > 0 &&
    values.name.length <= (context?.limits.name ?? 190) &&
    /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(values.slug) &&
    values.slug.length <= (context?.limits.slug ?? 190) &&
    values.description.length <= (context?.limits.description ?? 5000) &&
    relationValid &&
    (kind !== "checkups" ||
      (priceValid &&
        /^[A-Z]{3}$/.test(values.currency) &&
        /^\d+$/.test(values.duration) &&
        Number(values.duration) >= (context?.limits.min_duration ?? 5) &&
        Number(values.duration) <= (context?.limits.max_duration ?? 720)));
  const valid =
    !!context?.[`can_${operation}`] &&
    confirmed &&
    (operation === "archive"
      ? kind !== "checkup-categories" ||
        choice === "detach" ||
        (!!values.relation && relationValid && Number(values.relation) !== initial?.id)
      : editableValid);
  const body =
    operation === "archive"
      ? kind === "checkup-categories"
        ? {
            checkup_action: choice,
            replacement_category_id: choice === "reassign" ? Number(values.relation) : null,
          }
        : {}
      : {
          [kind === "checkups" ? "title" : "name"]: values.name.trim(),
          slug: values.slug.trim(),
          is_active: values.active,
          ...(kind !== "specialties" ? { description: values.description || null } : {}),
          ...(kind === "checkups"
            ? {
                price: values.price,
                currency: values.currency,
                default_duration_minutes: Number(values.duration),
                checkup_category_id: values.relation ? Number(values.relation) : null,
              }
            : {}),
          ...(kind === "specialties"
            ? { parent_id: values.relation ? Number(values.relation) : null }
            : {}),
        };
  const field = (key: "name" | "slug" | "price" | "currency" | "duration", label: string) => (
    <div className="mb-3" key={key}>
      <label className="form-label" htmlFor={`catalog-edit-${key}`}>
        {t(label)}
      </label>
      <input
        id={`catalog-edit-${key}`}
        dir={key === "name" ? "auto" : "ltr"}
        className="form-control"
        value={values[key]}
        maxLength={
          key === "name"
            ? context?.limits.name
            : key === "slug"
              ? context?.limits.slug
              : key === "currency"
                ? 3
                : 20
        }
        onChange={(event) =>
          setValues({
            ...values,
            [key]: key === "currency" ? event.target.value.toUpperCase() : event.target.value,
          })
        }
      />
    </div>
  );
  return (
    <ActionDialog
      target={{
        title: t(`catalog.${operation}`),
        method: operation === "create" ? "POST" : operation === "update" ? "PUT" : "DELETE",
        path: `/api/admin/${kind}${initial ? "/" + initial.id : ""}`,
        body: { ...body, expected_revision: context?.revision ?? "", confirmed },
        write: catalogWrite,
        verify: async (signal) => {
          if (!context) throw new Error("Catalog context unavailable.");
          await verifyCatalogContext(kind, context, operation, signal);
        },
      }}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <fieldset disabled={!context || failed}>
        <p className="text-muted">
          {t(`adminManage.${kind}`)}
          {initial ? ": " + initial.label : ""}
        </p>
        {failed || (context && !context[`can_${operation}`]) ? (
          <p role="alert" className="alert alert-warning">
            {t("catalog.actionUnavailable")}
          </p>
        ) : !context ? (
          <output>{t("adminManage.loading")}</output>
        ) : null}
        {operation !== "archive" ? (
          <>
            {field("name", kind === "checkups" ? "catalog.title" : "catalog.name")}
            {field("slug", "catalog.slug")}
            {kind !== "specialties" ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="catalog-edit-description">
                  {t("catalog.content")}
                </label>
                <textarea
                  id="catalog-edit-description"
                  dir="auto"
                  className="form-control"
                  maxLength={context?.limits.description}
                  value={values.description}
                  onChange={(event) => setValues({ ...values, description: event.target.value })}
                />
              </div>
            ) : null}
            {kind === "checkups" ? (
              <>
                {field("price", "catalog.price")}
                {field("currency", "catalog.currency")}
                {field("duration", "catalog.duration")}
              </>
            ) : null}
            <label className="form-check-label mb-3 d-block">
              <input
                type="checkbox"
                className="form-check-input"
                checked={values.active}
                onChange={(event) => setValues({ ...values, active: event.target.checked })}
              />{" "}
              {t("catalog.state.active")}
            </label>
          </>
        ) : (
          <p className="alert alert-warning">{t("catalog.archiveNotice")}</p>
        )}
        {operation === "archive" && kind === "checkup-categories" ? (
          <div className="mb-3">
            <label className="form-label" htmlFor="catalog-archive-choice">
              {t("catalog.childAction")}
            </label>
            <select
              id="catalog-archive-choice"
              className="form-select"
              value={choice}
              onChange={(event) => {
                setChoice(event.target.value);
                setValues({ ...values, relation: "" });
              }}
            >
              <option value="detach">{t("catalog.detach")}</option>
              <option value="reassign">{t("catalog.reassign")}</option>
            </select>
          </div>
        ) : null}
        {needsRelation ? (
          <fieldset className="mb-3">
            <legend className="fs-6">
              {t(kind === "specialties" ? "catalog.parent" : "catalog.category")}
            </legend>
            <label className="form-label" htmlFor="catalog-choice-search">
              {t("catalog.findRelation")}
            </label>
            <input
              id="catalog-choice-search"
              type="search"
              className="form-control mb-2"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label={t(kind === "specialties" ? "catalog.parent" : "catalog.category")}
              className="form-select mb-2"
              value={values.relation}
              onChange={(event) => setValues({ ...values, relation: event.target.value })}
            >
              <option value="">{t("catalog.noRelation")}</option>
              {values.relation &&
              !options?.items.some((row) => String(row.id) === values.relation) ? (
                <option value={values.relation}>
                  {t("catalog.categoryReference", { id: values.relation })}
                </option>
              ) : null}
              {options?.items
                .filter(
                  (row) =>
                    !(kind === "specialties" || operation === "archive") || row.id !== initial?.id,
                )
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
            </select>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-light btn-sm"
                disabled={page <= 1 || choices.isFetching}
                onClick={() => setPage(page - 1)}
              >
                {t("catalog.previousChoices")}
              </button>
              <button
                type="button"
                className="btn btn-light btn-sm"
                disabled={!options || page >= options.page.lastPage || choices.isFetching}
                onClick={() => setPage(page + 1)}
              >
                {t("catalog.nextChoices")}
              </button>
            </div>
            {choices.error ? <p role="alert">{t("adminManage.unavailable")}</p> : null}
          </fieldset>
        ) : null}
        <label className="form-check-label mb-3 d-block">
          <input
            type="checkbox"
            className="form-check-input"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{" "}
          {t("catalog.confirmChange")}
        </label>
      </fieldset>
    </ActionDialog>
  );
}
