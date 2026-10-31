import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import FileManagerFrame from "./FileManagerFrame";
import SimpleDonutCharts from "./FileManagerCharts";
import { imageUrl, type ArticleMedia } from "../../modules/checkupino/content/media";
import "./embedded-file-manager.css";

export interface EditorialFileManagerProps {
  readonly assets: readonly ArticleMedia[];
  readonly selected: ArticleMedia | null;
  readonly total: number;
  readonly page: number;
  readonly query: string;
  readonly view: "all" | "released";
  readonly busy: boolean;
  readonly locked: boolean;
  readonly uploadEnabled: boolean;
  readonly notice: ReactNode;
  readonly onQuery: (value: string) => void;
  readonly onSearch: () => void;
  readonly onView: (value: "all" | "released") => void;
  readonly onPage: (value: number) => void;
  readonly onRefresh: () => void;
  readonly onUpload: (file: File) => void;
  readonly onSelect: (file: ArticleMedia) => void;
  readonly onChoose: () => void;
  readonly onAction: (row: ArticleMedia, action: "validate" | "retire") => void;
  readonly onClose: () => void;
}
export default function EditorialFileManager(p: EditorialFileManagerProps) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState(true),
    [menu, setMenu] = useState(false);
  const size = (bytes: number) =>
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1048576
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1048576).toFixed(2)} MB`;
  const bytes = p.assets.reduce((sum, row) => sum + row.asset.size_bytes, 0);
  const status = (row: ArticleMedia) =>
    t(`content.media.${row.status === "released" && !row.selectable ? "quarantined" : row.status}`);
  const badge = (row: ArticleMedia) => (
    <span
      className={
        "badge " +
        (row.selectable ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")
      }
    >
      {status(row)}
    </span>
  );
  const pick = (row: ArticleMedia) => {
    p.onSelect(row);
    setMenu(false);
  };
  const sidebar = (
    <div className="p-3 d-flex flex-column h-100">
      <h5 className="mb-3 fw-semibold">{t("content.media.myDrive")}</h5>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          p.onSearch();
        }}
      >
        <div className="search-box mb-2">
          <input
            className="form-control bg-light border-light"
            aria-label={t("content.search")}
            placeholder={t("content.search")}
            value={p.query}
            maxLength={120}
            onChange={(e) => p.onQuery(e.target.value)}
          />
          <i className="ri-search-2-line search-icon" aria-hidden="true" />
        </div>
        <button className="btn btn-soft-success w-100" disabled={p.busy} type="submit">
          {t("content.search")}
        </button>
      </form>
      <nav className="mt-3" aria-label={t("content.media.libraryNav")}>
        <ul className="list-unstyled file-manager-menu">
          <li>
            <button
              type="button"
              className="btn btn-ghost-success w-100 text-start"
              disabled={p.busy}
              onClick={() => p.onView("all")}
            >
              <i className="ri-folder-2-line align-bottom me-2" aria-hidden="true" />
              {t("content.media.articleImages")}
            </button>
          </li>
          {(["released", "all"] as const).map((view) => (
            <li key={view}>
              <button
                type="button"
                className={
                  "btn w-100 text-start " +
                  (p.view === view ? "btn-soft-success" : "btn-ghost-secondary")
                }
                aria-pressed={p.view === view}
                disabled={p.busy}
                onClick={() => p.onView(view)}
              >
                <i
                  className={
                    (view === "released" ? "ri-image-2-line" : "ri-history-line") +
                    " align-bottom me-2"
                  }
                  aria-hidden="true"
                />
                {t(`content.media.${view}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto pt-3 border-top border-top-dashed">
        <h6 className="fs-11 text-muted text-uppercase">{t("content.media.visibleStorage")}</h6>
        <div className="d-flex align-items-center gap-2">
          <i className="ri-database-2-line fs-17" aria-hidden="true" />
          <bdi>{size(bytes)}</bdi>
          <span className="text-muted">
            {t("content.media.visibleFiles", { count: p.assets.length })}
          </span>
        </div>
      </div>
    </div>
  );
  const content = (
    <div className="pt-3 file-manager-content-scroll overflow-x-hidden overflow-y-auto">
      <div className="d-flex align-items-center gap-2 mb-3">
        <button
          type="button"
          className="btn btn-soft-success btn-icon d-lg-none"
          aria-label={t("content.media.libraryNav")}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <i className="ri-menu-2-fill" aria-hidden="true" />
        </button>
        <h5 className="fs-16 mb-0 flex-grow-1">{t("content.media.folders")}</h5>
        <label
          className={"btn btn-success text-nowrap mb-0" + (!p.uploadEnabled ? " disabled" : "")}
        >
          <i className="ri-upload-cloud-2-line align-bottom me-1" aria-hidden="true" />
          {t("content.media.upload")}
          <input
            type="file"
            className="visually-hidden"
            accept="image/jpeg,image/png"
            disabled={!p.uploadEnabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) p.onUpload(file);
            }}
          />
        </label>
      </div>
      <div className="row" data-file-manager-folders>
        <div className="col-12 folder-card">
          <button
            type="button"
            aria-label={t("content.media.articleImages")}
            className="card card-body bg-light shadow-none w-100 text-start"
            disabled={p.busy}
            onClick={() => p.onView("all")}
          >
            <div className="d-flex align-items-center gap-3">
              <i className="ri-folder-2-fill text-warning display-5" aria-hidden="true" />
              <div>
                <h6 className="fs-15 folder-name mb-1">{t("content.media.articleImages")}</h6>
                <span className="text-muted small">{t("content.media.folderPurpose")}</span>
              </div>
            </div>
          </button>
        </div>
      </div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <h5 className="flex-grow-1 fs-16 mb-0">{t("content.media.files")}</h5>
        <button
          type="button"
          className="btn btn-light btn-sm"
          disabled={p.busy}
          onClick={p.onRefresh}
        >
          {t("adminReservations.refresh")}
        </button>
        <button
          type="button"
          className="btn btn-soft-primary btn-sm"
          onClick={() => setGrid(!grid)}
        >
          <i className={(grid ? "ri-list-check" : "ri-grid-fill") + " me-1"} aria-hidden="true" />
          {t(`content.media.${grid ? "list" : "grid"}`)}
        </button>
      </div>
      {p.notice}
      {!p.assets.length ? (
        <p className="text-muted py-4 text-center">{t("content.media.empty")}</p>
      ) : grid ? (
        <div className="row g-3" data-file-manager-grid>
          {p.assets.map((row) => (
            <div key={row.asset.id} className="col-6 col-xl-4">
              <button
                type="button"
                aria-label={row.name}
                aria-pressed={p.selected?.asset.id === row.asset.id}
                disabled={p.locked}
                className={
                  "card card-body w-100 h-100 text-start " +
                  (p.selected?.asset.id === row.asset.id
                    ? "border-primary bg-primary-subtle"
                    : "border")
                }
                onClick={() => pick(row)}
              >
                {row.selectable ? (
                  <img
                    src={imageUrl(row.asset.id)}
                    alt=""
                    className="img-fluid rounded mb-2"
                    style={{ height: 100, width: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <i className="ri-image-line display-5 text-muted mb-2" aria-hidden="true" />
                )}
                <span className="text-break fw-medium">
                  <bdi>{row.name}</bdi>
                </span>
                <span className="mt-2">{badge(row)}</span>
                <bdi className="small text-muted mt-1">{size(row.asset.size_bytes)}</bdi>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive" data-file-manager-table>
          <table className="table table-hover align-middle table-nowrap mb-0">
            <thead className="table-active">
              <tr>
                {["name", "type", "size", "status"].map((key) => (
                  <th key={key} scope="col">
                    {t(`content.media.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.assets.map((row) => (
                <tr
                  key={row.asset.id}
                  className={p.selected?.asset.id === row.asset.id ? "table-active" : ""}
                  aria-selected={p.selected?.asset.id === row.asset.id}
                  style={{ cursor: p.locked ? "default" : "pointer" }}
                  onClick={() => {
                    if (!p.locked) pick(row);
                  }}
                >
                  <td>
                    <button
                      type="button"
                      className="btn btn-link text-body text-start p-0"
                      aria-label={row.name}
                      aria-pressed={p.selected?.asset.id === row.asset.id}
                      disabled={p.locked}
                    >
                      <i className="ri-image-2-line text-success me-2" aria-hidden="true" />
                      <bdi>{row.name}</bdi>
                    </button>
                  </td>
                  <td>
                    <bdi>{row.asset.mime_type === "image/png" ? "PNG" : "JPEG"}</bdi>
                  </td>
                  <td>
                    <bdi>{size(row.asset.size_bytes)}</bdi>
                  </td>
                  <td>{badge(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 mb-3">
        <span className="text-muted small">
          {t("content.media.results", { shown: p.assets.length, total: p.total })}
        </span>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={p.busy || p.page <= 1}
            onClick={() => p.onPage(p.page - 1)}
          >
            {t("content.previous")}
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={p.busy || p.page * 12 >= p.total}
            onClick={() => p.onPage(p.page + 1)}
          >
            {t("content.next")}
          </button>
        </div>
      </div>
    </div>
  );
  const details = (
    <div className="pt-3 file-detail-content-scroll overflow-auto">
      <div className="d-flex align-items-center pb-3 border-bottom border-bottom-dashed mb-3">
        <h5 className="flex-grow-1 fw-semibold mb-0">
          {t(p.selected ? "content.media.preview" : "content.media.overview")}
        </h5>
        <i className="ri-information-line text-muted" aria-hidden="true" />
      </div>
      {p.selected ? (
        <>
          <div className="file-details-box bg-light p-3 text-center rounded-3 border border-light mb-3">
            {p.selected.selectable ? (
              <img
                src={imageUrl(p.selected.asset.id)}
                alt=""
                className="img-fluid h-100"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <i className="ri-image-line display-4 text-muted" aria-hidden="true" />
            )}
          </div>
          <h5 className="fs-16 mb-3 text-break">
            <bdi>{p.selected.name}</bdi>
          </h5>
          <dl className="row g-2 small mx-0">
            <dt className="col-5">{t("content.media.type")}</dt>
            <dd className="col-7">
              <bdi>{p.selected.asset.mime_type}</bdi>
            </dd>
            <dt className="col-5">{t("content.media.size")}</dt>
            <dd className="col-7">
              <bdi>{size(p.selected.asset.size_bytes)}</bdi>
            </dd>
            <dt className="col-5">{t("content.media.status")}</dt>
            <dd className="col-7">{badge(p.selected)}</dd>
            {p.selected.selectable ? (
              <>
                <dt className="col-5">{t("content.media.dimensions")}</dt>
                <dd className="col-7">
                  <bdi>
                    {p.selected.asset.width} × {p.selected.asset.height}
                  </bdi>
                </dd>
              </>
            ) : null}
          </dl>
          {!p.selected.selectable ? (
            <p className="text-muted small">{t("content.media.validationRequired")}</p>
          ) : null}
          {p.selected.status !== "retired" ? (
            <div className="d-flex flex-wrap gap-2 mt-3">
              {!p.selected.selectable ? (
                <button
                  className="btn btn-soft-primary btn-sm"
                  type="button"
                  disabled={p.locked}
                  onClick={() => p.onAction(p.selected!, "validate")}
                >
                  {t("content.media.retry")}
                </button>
              ) : null}
              <button
                className="btn btn-soft-danger btn-sm"
                type="button"
                disabled={p.locked}
                onClick={() => p.onAction(p.selected!, "retire")}
              >
                {t("content.media.retire")}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {p.assets.length ? (
            <>
              <h6 className="fs-11 text-muted text-uppercase">
                {t("content.media.visibleStorage")}
              </h6>
              <SimpleDonutCharts
                dataColors='["--vz-success","--vz-warning","--vz-secondary"]'
                height={220}
                values={[
                  p.assets.filter((r) => r.selectable).length,
                  p.assets.filter((r) => !r.selectable && r.status !== "retired").length,
                  p.assets.filter((r) => r.status === "retired").length,
                ]}
                labels={[
                  t("content.media.released"),
                  t("content.media.quarantined"),
                  t("content.media.retired"),
                ]}
              />
            </>
          ) : (
            <div className="file-details-box bg-light p-3 text-center rounded-3 border border-light mb-3">
              <i className="ri-folder-2-fill text-warning display-4" aria-hidden="true" />
            </div>
          )}
          <h6>{t("content.media.articleImages")}</h6>
          <p className="text-muted small">{t("content.media.scope")}</p>
          <div className="d-flex justify-content-between gap-2 mb-3">
            <span>{t("content.media.files")}</span>
            <bdi>{p.total}</bdi>
          </div>
          <div className="d-flex justify-content-between gap-2">
            <span>{t("content.media.visibleStorage")}</span>
            <bdi>{size(bytes)}</bdi>
          </div>
        </>
      )}
    </div>
  );
  return (
    <>
      <FileManagerFrame
        embedded
        sidebarOpen={menu}
        sidebar={sidebar}
        content={content}
        details={details}
      />
      <div
        className="d-flex flex-wrap align-items-center gap-2 border-top p-3"
        data-file-manager-footer
      >
        <span className="small text-muted text-break flex-grow-1">
          <bdi>{p.selected?.name}</bdi>
        </span>
        <div className="d-flex flex-wrap gap-2" data-file-manager-actions>
          <button
            type="button"
            className="btn btn-success"
            disabled={!p.selected?.selectable || p.locked}
            onClick={p.onChoose}
          >
            {t("content.media.choose")}
          </button>
          <button type="button" className="btn btn-light" disabled={p.busy} onClick={p.onClose}>
            {t("content.cancel")}
          </button>
        </div>
      </div>
    </>
  );
}
