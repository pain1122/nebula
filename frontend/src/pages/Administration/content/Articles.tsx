import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Col, Row } from "reactstrap";
import DetailBox from "../DetailBox";
import ArticleEditor from "./ArticleEditor";
import ArticleSchedule from "./ArticleSchedule";
import {
  ContentAccess,
  ContentDate,
  ContentPage,
  ContentState,
  ConfirmContent,
  EmptyContent,
  PageButtons,
  Preview,
  useContent,
} from "./Shared";
import {
  conflict,
  contentId,
  contentWrite,
  editorialActions,
  eventSchema,
  localizedText,
  parseActionContext,
  parseArticle,
  parsePage,
  parseSavedArticle,
  parseVersion,
  readContent,
  validateArticle,
  versionSchema,
  type EditorialAction,
} from "../../../modules/checkupino/content/api";
import { Dialog } from "../../../modules/checkupino/overlays";
import { useDirectAction } from "../../../modules/checkupino/content/useDirectAction";

const states = [
  "all",
  "draft",
  "in_review",
  "reviewed",
  "published",
  "published_with_draft",
  "archived",
] as const;
export function articleListQuery(parameters: URLSearchParams) {
  const page = Number(parameters.get("page") ?? "1");
  const per_page = Number(parameters.get("per_page") ?? "12");
  const q = parameters.get("q") ?? "";
  const status = parameters.get("status") ?? "all";
  const sort = parameters.get("sort") ?? "updated_at";
  const direction = parameters.get("direction") ?? "desc";
  const extra = Object.fromEntries(
    ["author_id", "category_id", "tag_id"].map((key) => [key, parameters.get(key) || undefined]),
  );
  const valid =
    Number.isInteger(page) &&
    page >= 1 &&
    page <= 10000 &&
    Number.isInteger(per_page) &&
    per_page >= 1 &&
    per_page <= 50 &&
    q.length <= 120 &&
    !Array.from(q).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) &&
    (states as readonly string[]).includes(status) &&
    ["id", "slug", "created_at", "updated_at", "title"].includes(sort) &&
    ["asc", "desc"].includes(direction) &&
    Object.values(extra).every((value) => !value || contentId.safeParse(value).success);
  return { valid, query: { page, per_page, q, status, sort, direction, ...extra } };
}
function ArticleListSession() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [parameters, setParameters] = useSearchParams();
  const { valid, query } = articleListQuery(parameters);
  const grid = parameters.get("view") !== "list";
  const result = useContent(
    valid ? "/api/admin/articles" : null,
    { ...query, language: lang },
    (wire) => parsePage(wire, (row) => validateArticle(row)),
  );
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page" && key !== "view") next.delete("page");
    setParameters(next);
  };
  const title = (row: ReturnType<typeof validateArticle>) =>
    localizedText(
      Object.fromEntries(
        Object.entries(row.working.translations).map(([key, text]) => [key, text.title]),
      ),
      lang,
    );
  return (
    <ContentPage title={t("content.articles")}>
      <Card>
        <CardHeader>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <h5 className="card-title mb-0 flex-grow-1">{t("content.articles")}</h5>
            <Link className="btn btn-primary" to="/articles/new">
              <span className="ri-add-line me-1" aria-hidden="true" />
              {t("content.newArticle")}
            </Link>
            <button
              type="button"
              className="btn btn-light"
              disabled={!valid || result.busy}
              onClick={result.refresh}
            >
              {t("adminReservations.refresh")}
            </button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="row g-3 mb-3">
            <div className="col-md-5">
              <label className="form-label" htmlFor="article-search">
                {t("content.searchArticles")}
              </label>
              <input
                id="article-search"
                type="search"
                className="form-control"
                maxLength={120}
                value={query.q}
                onChange={(e) => set("q", e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="article-state">
                {t("content.state")}
              </label>
              <select
                id="article-state"
                className="form-select"
                value={query.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {states.map((state) => (
                  <option key={state} value={state}>
                    {t(`content.state.${state}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="article-sort">
                {t("content.sort")}
              </label>
              <select
                id="article-sort"
                className="form-select"
                value={query.sort}
                onChange={(e) => set("sort", e.target.value)}
              >
                {["updated_at", "created_at", "title", "slug"].map((key) => (
                  <option key={key} value={key}>
                    {t(`content.sort.${key}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="article-direction">
                {t("content.order")}
              </label>
              <select
                id="article-direction"
                className="form-select"
                value={query.direction}
                onChange={(e) => set("direction", e.target.value)}
              >
                <option value="desc">{t("content.descending")}</option>
                <option value="asc">{t("content.ascending")}</option>
              </select>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {["draft", "in_review", "published", "archived"].map((status) => (
              <button
                key={status}
                type="button"
                className="btn btn-sm btn-outline-primary"
                aria-pressed={query.status === status}
                onClick={() => set("status", status)}
              >
                {t(`content.state.${status}`)}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => setParameters({})}
            >
              {t("adminReservations.reset")}
            </button>
            <div className="d-flex gap-2 ms-auto">
              <button
                type="button"
                className={grid ? "btn btn-sm btn-primary" : "btn btn-sm btn-light"}
                aria-pressed={grid}
                onClick={() => set("view", "grid")}
              >
                {t("content.grid")}
              </button>
              <button
                type="button"
                className={!grid ? "btn btn-sm btn-primary" : "btn btn-sm btn-light"}
                aria-pressed={!grid}
                onClick={() => set("view", "list")}
              >
                {t("content.list")}
              </button>
            </div>
          </div>
          <details className="mb-3">
            <summary>{t("content.advanced")}</summary>
            <p className="text-muted small mt-2">{t("content.publicIdHint")}</p>
            <div className="row g-3">
              {["author_id", "category_id", "tag_id"].map((key) => (
                <div className="col-md-3" key={key}>
                  <label className="form-label" htmlFor={`article-filter-${key}`}>
                    {t(`content.filter.${key}`)}
                  </label>
                  <input
                    id={`article-filter-${key}`}
                    dir="ltr"
                    className="form-control"
                    maxLength={26}
                    value={parameters.get(key) ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </details>
          {!valid ? (
            <p role="alert" className="alert alert-warning">
              {t("content.invalidQuery")}
            </p>
          ) : null}
          <ContentState busy={result.busy} error={result.error} />
        </CardBody>
      </Card>
      {result.data?.data.length === 0 ? <EmptyContent /> : null}
      {grid ? (
        <Row className="g-3" data-article-grid>
          {result.data?.data.map((row) => (
            <Col xl={4} md={6} key={row.id}>
              <Card className="h-100">
                <div
                  className="bg-primary-subtle text-primary text-center py-4 rounded-top"
                  aria-label={t("content.coverPlaceholder")}
                >
                  <span className="display-5 ri-article-line" aria-hidden="true" />
                </div>
                <CardBody className="d-flex flex-column">
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <span className="badge bg-primary-subtle text-primary">
                      {t(`content.state.${row.status}`)}
                    </span>
                    <span className="text-muted small d-block mb-2">
                      {t("content.versionNumber", { version: row.working.version })}
                    </span>
                  </div>
                  <h5>
                    <Link aria-label={title(row)} to={`/articles/${row.id}`}>
                      <bdi>{title(row) === "—" ? t("content.untitled") : title(row)}</bdi>
                    </Link>
                  </h5>
                  <p className="text-muted text-break">
                    <bdi>
                      {localizedText(
                        Object.fromEntries(
                          Object.entries(row.working.translations).map(([key, text]) => [
                            key,
                            text.summary,
                          ]),
                        ),
                        lang,
                      )}
                    </bdi>
                  </p>
                  <div className="d-flex gap-1 flex-wrap mb-3">
                    {row.working.taxonomy.map((term) => (
                      <span key={term.id} className="badge bg-light text-body">
                        <bdi>{localizedText(term.labels, lang)}</bdi>
                      </span>
                    ))}
                  </div>
                  <div className="d-flex justify-content-between flex-wrap gap-2 mt-auto small text-muted">
                    <bdi>{row.author.name}</bdi>
                    <ContentDate value={row.updated_at} />
                  </div>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>
      ) : result.data ? (
        <Card>
          <CardBody>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    {["title", "state", "actor", "version", "updated"].map((key) => (
                      <th key={key}>{t(`content.${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.data.map((row) => (
                    <tr key={row.id}>
                      <td aria-label={title(row)}>
                        <Link aria-label={title(row)} to={`/articles/${row.id}`}>
                          <bdi>{title(row) === "—" ? t("content.untitled") : title(row)}</bdi>
                        </Link>
                      </td>
                      <td>{t(`content.state.${row.status}`)}</td>
                      <td>
                        <bdi>{row.author.name}</bdi>
                      </td>
                      <td>{row.working.version}</td>
                      <td>
                        <ContentDate value={row.updated_at} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
      <div className="d-flex gap-3 flex-wrap align-items-center">
        <PageButtons
          page={result.data?.pagination}
          onPage={(value) => set("page", String(value))}
          disabled={result.busy}
        />
        <label className="form-label mt-3">
          {t("content.perPage")}
          <select
            className="form-select"
            value={query.per_page}
            onChange={(e) => set("per_page", e.target.value)}
          >
            {[12, 24, 48].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ContentPage>
  );
}
export default function Articles() {
  return (
    <ContentAccess>
      <ArticleListSession />
    </ContentAccess>
  );
}

function EditorialModal({
  id,
  action,
  source,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly id: string;
  readonly action: EditorialAction;
  readonly source?: string;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t } = useTranslation();
  const path = `/api/admin/articles/${id}`;
  const query = { action, source_version_id: source };
  const result = useContent(path + "/action-context", query, (wire) =>
    parseActionContext(wire, id, action, source),
  );
  const context = result.data;
  return (
    <ConfirmContent
      target={{
        title: t(`content.action.${action}`),
        path: path + "/actions",
        method: "POST",
        body: {
          action,
          expected_revision: context?.revision ?? "",
          expected_version: context?.current.working.version ?? 0,
          expected_hash: context?.current.working.content_hash ?? "",
          ...(source
            ? { source_version_id: source, source_hash: context?.source?.content_hash ?? "" }
            : {}),
        },
        verify: async (signal) => {
          if (!context) throw conflict();
          const fresh = parseActionContext(
            await readContent(path + "/action-context", query, signal),
            id,
            action,
            source,
          );
          if (!fresh.eligible || fresh.revision !== context.revision) throw conflict();
        },
        write: async (target, method, body, signal) => {
          const response = await contentWrite(target, method, body, signal);
          parseSavedArticle(response.data, id);
          return response;
        },
      }}
      valid={!!context?.eligible && !result.busy && !result.error}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <ContentState busy={result.busy} error={result.error} />
      {context ? (
        <>
          <p>{t("content.editorialNotice")}</p>
          <p>{t("content.versionNumber", { version: context.current.working.version })}</p>
          {action === "archive" ? (
            <p className="alert alert-warning">{t("content.archiveNotice")}</p>
          ) : null}
          {action === "copy_version" ? (
            <p className="alert alert-info">{t("content.recoveryNotice")}</p>
          ) : null}
          {context.blockers.map((blocker) => (
            <p role="alert" key={blocker} className="alert alert-warning">
              {t(`content.blocker.${blocker}`)}
            </p>
          ))}
          <Preview
            key={(context.source ?? context.current.working).id}
            version={context.source ?? context.current.working}
          />
        </>
      ) : null}
    </ConfirmContent>
  );
}
function VersionPreview({
  id,
  version,
  onClose,
  onRecover,
  recoverable,
}: {
  readonly id: string;
  readonly version: string;
  readonly onClose: () => void;
  readonly onRecover: () => void;
  readonly recoverable: boolean;
}) {
  const { t, i18n } = useTranslation();
  const result = useContent(`/api/admin/articles/${id}/versions/${version}`, {}, (wire) =>
    parseVersion(wire, version),
  );
  return (
    <Dialog
      open
      title={t("content.versionPreview")}
      locale={i18n.resolvedLanguage === "fa" ? "fa" : "en"}
      onClose={onClose}
    >
      <ContentState busy={result.busy} error={result.error} />
      {result.data ? (
        <>
          <p>{t("content.versionNumber", { version: result.data.version })}</p>
          <ContentDate value={result.data.recorded_at} />
          <Preview version={result.data} />
        </>
      ) : null}
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!result.data || !recoverable || result.error || result.busy}
          onClick={onRecover}
        >
          {t("content.action.copy_version")}
        </button>
        <button type="button" className="btn btn-light" onClick={onClose}>
          {t("content.close")}
        </button>
      </div>
    </Dialog>
  );
}
function ArticleHistory({
  id,
  workingVersion,
  archived,
  uncertain,
  onAction,
}: {
  readonly id: string;
  readonly workingVersion: number;
  readonly archived: boolean;
  readonly uncertain: boolean;
  readonly onAction: (source: string) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"versions" | "events">("versions");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ id: string; version: number } | null>(null);
  const versions = useContent(
    tab === "versions" ? `/api/admin/articles/${id}/versions` : null,
    { page, per_page: 10 },
    (wire) => parsePage(wire, (v) => versionSchema.parse(v)),
  );
  const events = useContent(
    tab === "events" ? `/api/admin/articles/${id}/events` : null,
    { page, per_page: 10 },
    (wire) => parsePage(wire, (v) => eventSchema.parse(v)),
  );
  const result = tab === "versions" ? versions : events;
  return (
    <Card data-article-history>
      <CardHeader>
        <h5 className="card-title">{t("content.history")}</h5>
        <div className="d-flex gap-2">
          <button
            className={tab === "versions" ? "btn btn-primary" : "btn btn-light"}
            type="button"
            aria-pressed={tab === "versions"}
            onClick={() => {
              setTab("versions");
              setPage(1);
            }}
          >
            {t("content.versions")}
          </button>
          <button
            className={tab === "events" ? "btn btn-primary" : "btn btn-light"}
            type="button"
            aria-pressed={tab === "events"}
            onClick={() => {
              setTab("events");
              setPage(1);
            }}
          >
            {t("content.events")}
          </button>
          <button
            className="btn btn-light"
            type="button"
            disabled={result.busy}
            onClick={result.refresh}
          >
            {t("adminReservations.refresh")}
          </button>
        </div>
      </CardHeader>
      <CardBody>
        <ContentState busy={result.busy} error={result.error} />
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                {[tab === "versions" ? "version" : "action", "actor", "recorded", "actions"].map(
                  (key) => (
                    <th key={key}>{t(`content.${key}`)}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {tab === "versions"
                ? versions.data?.data.map((version) => (
                    <tr key={version.id}>
                      <td>{t("content.versionNumber", { version: version.version })}</td>
                      <td>
                        <bdi>{version.actor.name}</bdi>
                      </td>
                      <td>
                        <ContentDate value={version.recorded_at} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-soft-primary"
                          onClick={() => setPreview({ id: version.id, version: version.version })}
                        >
                          {t("content.preview")}
                        </button>
                      </td>
                    </tr>
                  ))
                : events.data?.data.map((event) => (
                    <tr key={event.id}>
                      <td>
                        {t(`content.event.${event.action.split(".").at(-1)}`)}
                        <div className="text-muted small">
                          {t("content.versionNumber", { version: event.after.version })}
                        </div>
                      </td>
                      <td>
                        <bdi>{event.actor.name}</bdi>
                      </td>
                      <td>
                        <ContentDate value={event.recorded_at} />
                      </td>
                      <td>
                        {event.after.source_version_id ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={() =>
                              setPreview({ id: event.after.source_version_id!, version: 0 })
                            }
                          >
                            {t("content.viewSource")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {result.data?.data.length === 0 ? <p>{t("content.emptyHistory")}</p> : null}
        <PageButtons page={result.data?.pagination} onPage={setPage} disabled={result.busy} />
        {preview ? (
          <VersionPreview
            id={id}
            version={preview.id}
            recoverable={
              !archived && !uncertain && (preview.version === 0 || preview.version < workingVersion)
            }
            onClose={() => setPreview(null)}
            onRecover={() => {
              onAction(preview.id);
              setPreview(null);
            }}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}
function WorkspaceSession({ id }: { readonly id: string }) {
  const { t } = useTranslation();
  const direct = useDirectAction();
  const [parameters] = useSearchParams();
  const [editing, setEditing] = useState(() => parameters.get("edit") === "1");
  const [uncertain, setUncertain] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [showPublished, setShowPublished] = useState(false);
  const [action, setAction] = useState<{ action: EditorialAction; source?: string } | null>(null);
  const valid = contentId.safeParse(id).success;
  const result = useContent(valid ? `/api/admin/articles/${id}` : null, {}, (wire) =>
    parseArticle(wire, id),
  );
  const row = result.data;
  const [observed, setObserved] = useState<typeof result.data>();
  if (result.data && observed !== result.data) {
    setObserved(result.data);
    setUncertain(false);
  }
  const saved = () => {
    setAction(null);
    setEditing(false);
    setEpoch((v) => v + 1);
    result.refresh();
  };
  const publish = () =>
    direct.run(async ({ signal, dispatch }) => {
      if (!row) return;
      const context = parseActionContext(
        await readContent(
          `/api/admin/articles/${id}/action-context`,
          { action: "publish" },
          signal,
        ),
        id,
        "publish",
      );
      if (
        !context.eligible ||
        context.current.working.version !== row.working.version ||
        context.current.working.content_hash !== row.working.content_hash
      )
        throw conflict();
      const response = await dispatch(() =>
        contentWrite(
          `/api/admin/articles/${id}/actions`,
          "POST",
          {
            action: "publish",
            expected_revision: context.revision,
            expected_version: row.working.version,
            expected_hash: row.working.content_hash,
          },
          signal,
        ),
      );
      const updated = parseSavedArticle(response.data, id);
      if (
        updated.working_state !== "published" ||
        updated.published?.content_hash !== row.working.content_hash
      )
        throw new Error("Publication requires a fresh read.");
      if (!signal.aborted) saved();
    });
  return (
    <ContentPage title={t("content.workspace")}>
      <Card>
        <CardBody>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <Link className="btn btn-light" to="/articles">
              {t("content.backArticles")}
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                !row || !!row.archived_at || uncertain || editing || direct.busy || direct.uncertain
              }
              onClick={() => setEditing(true)}
            >
              {t("content.editDraft")}
            </button>
            {editorialActions
              .filter((v) => v !== "copy_version")
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === "archive" ? "btn btn-soft-danger" : "btn btn-soft-primary"}
                  disabled={
                    !row ||
                    !!row.archived_at ||
                    uncertain ||
                    editing ||
                    direct.busy ||
                    direct.uncertain ||
                    !!action ||
                    (value !== "archive" &&
                      row.working_state !==
                        (
                          { submit: "draft", review: "in_review", publish: "reviewed" } as Record<
                            string,
                            string
                          >
                        )[value])
                  }
                  onClick={() =>
                    value === "publish" ? void publish() : setAction({ action: value })
                  }
                >
                  {t(`content.action.${value}`)}
                </button>
              ))}
            <button
              type="button"
              className="btn btn-light"
              disabled={!valid || result.busy || editing || direct.busy}
              onClick={() => {
                direct.reset();
                result.refresh();
              }}
            >
              {t("adminReservations.refresh")}
            </button>
          </div>
          {uncertain || direct.failure ? (
            <output className="text-muted small">
              {t(`content.operation.${uncertain ? "uncertain" : direct.failure}`)}
            </output>
          ) : null}
          {!valid ? (
            <p role="alert" className="alert alert-warning">
              {t("content.invalidId")}
            </p>
          ) : null}
          <ContentState busy={result.busy} error={result.error} />
        </CardBody>
      </Card>
      {editing ? (
        <ArticleEditor
          key={id + ":" + epoch}
          id={id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEpoch((value) => value + 1);
            result.refresh();
          }}
          onUncertain={() => setUncertain(true)}
        />
      ) : row ? (
        <>
          <Row data-article-boxes>
            <DetailBox
              id="article-identity"
              title={t("content.record")}
              icon="ri-article-line"
              fields={[
                [t("content.slug"), row.slug],
                [t("content.state"), t(`content.state.${row.status}`)],
                [t("content.actor"), row.author.name],
                [t("content.updated"), <ContentDate key="updated" value={row.updated_at} />],
              ]}
            />
            <DetailBox
              id="article-publication"
              title={t("content.publication")}
              icon="ri-shield-check-line"
              fields={[
                [t("content.workingVersion"), row.working.version],
                [t("content.publishedVersion"), row.published?.version ?? "—"],
                [t("content.reviewer"), row.review?.actor.name ?? "—"],
                [
                  t("content.reviewedAt"),
                  <ContentDate key="reviewed" value={row.review?.recorded_at ?? null} />,
                ],
              ]}
            >
              <p className="text-muted small">{t("content.editorialNotice")}</p>
            </DetailBox>
          </Row>
          {row.scheduling_enabled ? (
            <ArticleSchedule
              key={`${id}:${epoch}`}
              id={id}
              disabled={uncertain || !!action}
              onSaved={saved}
              onUncertain={() => setUncertain(true)}
            />
          ) : null}
          <Card>
            <CardHeader className="d-flex gap-2 flex-wrap align-items-center">
              <h5 className="card-title mb-0 flex-grow-1">{t("content.preview")}</h5>
              <button
                type="button"
                className={!showPublished ? "btn btn-primary" : "btn btn-light"}
                aria-pressed={!showPublished}
                onClick={() => setShowPublished(false)}
              >
                {t("content.workingCopy")}
              </button>
              <button
                type="button"
                className={showPublished ? "btn btn-primary" : "btn btn-light"}
                aria-pressed={showPublished}
                disabled={!row.published}
                onClick={() => setShowPublished(true)}
              >
                {t("content.publishedCopy")}
              </button>
            </CardHeader>
            <CardBody>
              <Preview
                key={(showPublished && row.published ? row.published : row.working).id}
                version={showPublished && row.published ? row.published : row.working}
              />
            </CardBody>
          </Card>
          <ArticleHistory
            key={id + ":" + epoch}
            id={id}
            workingVersion={row.working.version}
            archived={!!row.archived_at}
            uncertain={uncertain || direct.busy || direct.uncertain}
            onAction={(source) => setAction({ action: "copy_version", source })}
          />
        </>
      ) : null}
      {action ? (
        <EditorialModal
          id={id}
          action={action.action}
          source={action.source}
          onClose={() => setAction(null)}
          onSaved={saved}
          onUncertain={() => setUncertain(true)}
        />
      ) : null}
    </ContentPage>
  );
}
export function ArticleWorkspace() {
  const { articleId = "" } = useParams();
  return (
    <ContentAccess>
      <WorkspaceSession key={articleId} id={articleId} />
    </ContentAccess>
  );
}
function NewArticleSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <ContentPage title={t("content.newArticle")}>
      <ArticleEditor
        id={null}
        onClose={() => navigate("/articles")}
        onSaved={(id) => navigate(`/articles/${id}?edit=1`)}
        onUncertain={() => {
          /* editor retains delivery guard until explicit refresh */
        }}
      />
    </ContentPage>
  );
}
export function NewArticle() {
  return (
    <ContentAccess>
      <NewArticleSession />
    </ContentAccess>
  );
}
