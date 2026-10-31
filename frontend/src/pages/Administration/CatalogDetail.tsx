import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import {
  catalogAdapter,
  formatCatalogPrice,
  useAdminCatalogDetailQuery,
  validCatalogId,
  type CatalogKind,
} from "../../modules/checkupino/catalog/api";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import { parseServerTableQuery, serializeServerTableQuery } from "../../modules/checkupino/table";
import DetailBox from "./DetailBox";
import CatalogEditor from "./CatalogEditor";

export function CatalogDetail({ kind }: { readonly kind: CatalogKind }) {
  const { capabilities } = useShellAuth();
  const { checkupId, categoryId, specialtyId } = useParams();
  const id =
    (kind === "checkups" ? checkupId : kind === "checkup-categories" ? categoryId : specialtyId) ??
    "";
  const [editing, setEditing] = useState<"update" | "archive" | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const valid = validCatalogId(id);
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [parameters] = useSearchParams();
  const adapter = catalogAdapter(kind);
  const back = `/${kind}?${serializeServerTableQuery(parseServerTableQuery(parameters, adapter), adapter)}`;
  const { currentData, error, isFetching, refetch } = useAdminCatalogDetailQuery(
    { kind, id },
    { skip: !valid || !capabilities.accessAdminPanel, refetchOnMountOrArgChange: true },
  );
  const row = valid && !error && !isFetching ? currentData : undefined;
  const title = t(
    kind === "checkups"
      ? "adminManage.checkup-detail"
      : kind === "checkup-categories"
        ? "adminManage.category-detail"
        : "adminManage.specialty-detail",
  );
  useEffect(() => {
    document.title = title;
  }, [title]);
  const missing = t("adminReservations.missing");
  const date = (value: string | null) => (value ? formatProductTimestamp(value, locale) : missing);
  if (!capabilities.accessAdminPanel) return <p role="alert">{t("adminReservations.denied")}</p>;
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={title} pageTitle={t(`adminManage.${kind}`)} />
        <Card data-catalog-detail={kind}>
          <CardHeader className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="card-title flex-grow-1 mb-0">{row?.label ?? title}</h5>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!row || row.state === "archived" || uncertain}
              onClick={() => setEditing("update")}
            >
              {t("catalog.update")}
            </button>
            <button
              type="button"
              className="btn btn-warning"
              disabled={
                !row ||
                row.state === "archived" ||
                uncertain ||
                (row.kind === "specialties" &&
                  row.counts.children +
                    row.counts.primary_doctors +
                    row.counts.secondary_associations >
                    0)
              }
              onClick={() => setEditing("archive")}
            >
              {t("catalog.archive")}
            </button>
            <Link className="btn btn-light" to={back}>
              {t("adminManage.back")}
            </Link>
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
          </CardHeader>
          <CardBody>
            {uncertain ? (
              <p role="alert" className="alert alert-warning">
                {t("adminManage.uncertain")}
              </p>
            ) : null}
            <p className="text-muted mb-0">{t("catalog.description")}</p>
            {!valid ? (
              <p role="alert" className="alert alert-warning">
                {t("catalog.invalidId")}
              </p>
            ) : error ? (
              <p role="alert" className="alert alert-danger">
                {t("adminManage.unavailable")}
              </p>
            ) : isFetching ? (
              <output>{t("adminManage.loading")}</output>
            ) : null}
          </CardBody>
        </Card>
        {row ? (
          <Row data-catalog-boxes>
            <DetailBox
              id="catalog-record"
              title={t("catalog.record")}
              icon="ri-file-list-line"
              fields={[
                [t("catalog.name"), row.label],
                [t("catalog.slug"), row.slug],
                [t("adminReservations.publicId"), row.public_id],
                [t("catalog.state"), t(`catalog.state.${row.state}`)],
                [t("catalog.created_at"), date(row.created_at)],
                [t("catalog.updated_at"), date(row.updated_at)],
                [t("catalog.archived_at"), date(row.archived_at)],
              ]}
            />
            {row.kind === "checkups" ? (
              <>
                <DetailBox
                  id="catalog-offering"
                  title={t("catalog.offering")}
                  icon="ri-price-tag-3-line"
                  fields={[
                    [t("catalog.price"), formatCatalogPrice(row.price, row.currency, locale)],
                    [
                      t("catalog.duration"),
                      formatProductNumber(row.default_duration_minutes, locale),
                    ],
                    [
                      t("catalog.category"),
                      row.category ? (
                        <Link key="category" to={`/checkup-categories/${row.category.id}`}>
                          {row.category.name}
                        </Link>
                      ) : (
                        missing
                      ),
                    ],
                    [
                      t("catalog.categoryState"),
                      row.category ? t(`catalog.state.${row.category.state}`) : missing,
                    ],
                  ]}
                />
                <DetailBox
                  id="catalog-history"
                  title={t("catalog.history")}
                  icon="ri-history-line"
                  columns={12}
                  fields={[
                    [
                      t("catalog.reservations"),
                      <Link key="reservations" to={`/reservations?checkup_id=${row.id}`}>
                        {formatProductNumber(row.counts.reservations, locale)}
                      </Link>,
                    ],
                    [
                      t("catalog.assignments"),
                      formatProductNumber(row.counts.workplace_assignments, locale),
                    ],
                  ]}
                >
                  <p className="text-muted small mb-0">{t("catalog.snapshotHint")}</p>
                </DetailBox>
              </>
            ) : row.kind === "checkup-categories" ? (
              <DetailBox
                id="catalog-children"
                title={t("catalog.history")}
                icon="ri-folder-line"
                fields={[
                  [
                    t("catalog.checkups"),
                    <Link key="children" to={`/checkups?state=all&category_id=${row.id}`}>
                      {formatProductNumber(row.counts.checkups, locale)}
                    </Link>,
                  ],
                  [
                    t("catalog.activeChildren"),
                    <Link key="active" to={`/checkups?state=active&category_id=${row.id}`}>
                      {formatProductNumber(row.counts.active_checkups, locale)}
                    </Link>,
                  ],
                  [
                    t("catalog.archivedChildren"),
                    <Link key="archived" to={`/checkups?state=archived&category_id=${row.id}`}>
                      {formatProductNumber(row.counts.archived_checkups, locale)}
                    </Link>,
                  ],
                ]}
              >
                <p className="text-muted small mb-0">{t("catalog.snapshotHint")}</p>
              </DetailBox>
            ) : (
              <DetailBox
                id="catalog-specialty"
                title={t("catalog.hierarchy")}
                icon="ri-node-tree"
                fields={[
                  [t("catalog.level"), formatProductNumber(row.level, locale)],
                  [
                    t("catalog.parent"),
                    row.parent ? (
                      <Link key="parent" to={`/specialties/${row.parent.id}`}>
                        {row.parent.name}
                      </Link>
                    ) : (
                      missing
                    ),
                  ],
                  [
                    t("catalog.children"),
                    <Link key="children" to={`/specialties?parent_id=${row.id}&state=all`}>
                      {formatProductNumber(row.counts.children, locale)}
                    </Link>,
                  ],
                  [
                    t("catalog.primaryDoctors"),
                    <Link key="doctors" to={`/doctors?specialty_id=${row.id}`}>
                      {formatProductNumber(row.counts.primary_doctors, locale)}
                    </Link>,
                  ],
                  [
                    t("catalog.secondaryAssociations"),
                    formatProductNumber(row.counts.secondary_associations, locale),
                  ],
                ]}
              >
                <p className="text-muted small">{t("catalog.specialtyArchiveHint")}</p>
              </DetailBox>
            )}
            <DetailBox
              id="catalog-description"
              title={t("catalog.content")}
              icon="ri-file-text-line"
              columns={12}
            >
              <p className="mb-0 text-break">
                <bdi>{row.description || missing}</bdi>
              </p>
            </DetailBox>
          </Row>
        ) : null}
        {editing && row ? (
          <CatalogEditor
            key={`${kind}:${id}:${editing}`}
            kind={kind}
            initial={row}
            operation={editing}
            onClose={() => setEditing(null)}
            onUncertain={() => setUncertain(true)}
            onSaved={() => {
              setEditing(null);
              void refetch();
            }}
          />
        ) : null}
      </Container>
    </div>
  );
}
export default function CheckupDetail() {
  return <CatalogDetail kind="checkups" />;
}
export function CategoryDetail() {
  return <CatalogDetail kind="checkup-categories" />;
}
export function SpecialtyDetail() {
  return <CatalogDetail kind="specialties" />;
}
