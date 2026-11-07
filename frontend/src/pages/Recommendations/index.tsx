import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ContentPage, ContentState } from "../Administration/content/Shared";
import {
  useClinicalRead,
  useClinicalWrite,
} from "../../modules/checkupino/profiles/useClinicalWrite";
import { RuleAccess, useRuleRole, WriteStatus } from "./Shared";
import {
  ruleBoard,
  ruleDetail,
  ruleRequest,
  mutationReceipt,
  type RuleBoard,
} from "../../modules/checkupino/recommendations/api";
import RuleEditor from "./RuleEditor";
import RuleReview from "./RuleReview";

function Board() {
  const { t } = useTranslation();
  const { staff, root, prefix } = useRuleRole();
  const [query, setQuery] = useSearchParams();
  const parameters = new URLSearchParams();
  for (const key of ["q", "state", "page"]) {
    const value = query.get(key);
    if (value) parameters.set(key, value);
  }
  const read = useClinicalRead(`${prefix}${parameters.size ? `?${parameters}` : ""}`, ruleBoard);
  const [search, setSearch] = useState(query.get("q") ?? "");
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setQuery(next);
  };
  return (
    <ContentPage title={t("recommendationRules.title")}>
      <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
        <p className="text-muted">
          {t(staff ? "recommendationRules.staffHint" : "recommendationRules.reviewerHint")}
        </p>
        {staff && (
          <Link className="btn btn-primary" to="/recommendation-rules/new">
            {t("recommendationRules.new")}
          </Link>
        )}
      </div>
      <div className="card">
        <div className="card-body">
          <form
            className="row g-2"
            onSubmit={(event) => {
              event.preventDefault();
              update("q", search);
            }}
          >
            <div className="col-md-7">
              <label className="form-label" htmlFor="rule-search">
                {t("recommendationRules.search")}
              </label>
              <input
                id="rule-search"
                className="form-control"
                maxLength={100}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="rule-state">
                {t("recommendationRules.state")}
              </label>
              <select
                id="rule-state"
                className="form-select"
                value={query.get("state") ?? ""}
                onChange={(event) => update("state", event.target.value)}
              >
                <option value="">{t("recommendationRules.allStates")}</option>
                {["draft", "in_review", "reviewed", "rejected", "published", "retired"].map(
                  (state) => (
                    <option key={state} value={state}>
                      {t(`recommendationRules.states.${state}`)}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="col-md-2 align-self-end">
              <button className="btn btn-primary" type="submit">
                {t("recommendationRules.search")}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ContentState busy={!read.data && !read.error} error={read.error} />
      {read.data && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    {["slug", "state", "version", "author"].map((key) => (
                      <th key={key}>{t(`recommendationRules.${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {read.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link aria-label={item.slug} to={`/recommendation-rules/${item.id}`}>
                          <bdi>{item.slug}</bdi>
                        </Link>
                      </td>
                      <td>{t(`recommendationRules.states.${item.state}`)}</td>
                      <td>{item.working_version}</td>
                      <td>
                        <bdi>{item.author.name}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!read.data.items.length && <p className="p-3">{t("recommendationRules.empty")}</p>}
            </div>
          </div>
          <div className="d-flex gap-2 mb-4">
            <button
              type="button"
              className="btn btn-light"
              disabled={read.data.pagination.current_page <= 1}
              onClick={() => update("page", String(read.data!.pagination.current_page - 1))}
            >
              {t("recommendationRules.previous")}
            </button>
            <span className="align-self-center">
              {read.data.pagination.current_page} / {read.data.pagination.last_page}
            </span>
            <button
              type="button"
              className="btn btn-light"
              disabled={read.data.pagination.current_page >= read.data.pagination.last_page}
              onClick={() => update("page", String(read.data!.pagination.current_page + 1))}
            >
              {t("recommendationRules.next")}
            </button>
          </div>
          {root && (
            <ReviewerGrants
              key={read.data.grant_revision}
              board={read.data}
              refresh={read.refetch}
            />
          )}
        </>
      )}
    </ContentPage>
  );
}
function ReviewerGrants({
  board,
  refresh,
}: {
  readonly board: RuleBoard;
  readonly refresh: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  const candidates = useClinicalRead(
    `/api/admin/recommendation-rules${term ? `?reviewer_q=${encodeURIComponent(term)}` : ""}`,
    ruleBoard,
  );
  const [reviewer, setReviewer] = useState(""),
    [evidence, setEvidence] = useState(""),
    [until, setUntil] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const write = useClinicalWrite("recommendation-reviewers");
  const mutate = (id?: string) => {
    const revision = id
      ? board.grants.find((grant) => grant.id === id)?.revoke_revision
      : board.grant_revision;
    if (!revision) return;
    void write.run(
      async (signal) => {
        const current = await ruleRequest(
          "GET",
          "/api/admin/recommendation-rules",
          ruleBoard,
          signal,
        );
        return {
          revision:
            (id
              ? current.grants.find((grant) => grant.id === id)?.revoke_revision
              : current.grant_revision) ?? "",
        };
      },
      revision,
      (signal) =>
        ruleRequest(
          "POST",
          `/api/admin/recommendation-rules/reviewer-grants${id ? `/${id}/revoke` : ""}`,
          mutationReceipt,
          signal,
          {
            expected_revision: revision,
            action_key: crypto.randomUUID(),
            confirmed: id ? true : confirmed,
            ...(id
              ? {}
              : { reviewer_id: reviewer, evidence_ref: evidence, valid_until_local: until }),
          },
        ),
      refresh,
    );
  };
  return (
    <section className="card">
      <div className="card-header">
        <h5>{t("recommendationRules.reviewerAccess")}</h5>
      </div>
      <div className="card-body">
        <p className="text-muted">{t("recommendationRules.grantHint")}</p>
        <WriteStatus write={write} refresh={refresh} />
        <form
          className="row g-2 mb-3"
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(search);
          }}
        >
          <div className="col-md-9">
            <label htmlFor="reviewer-search" className="form-label">
              {t("recommendationRules.searchDoctors")}
            </label>
            <input
              id="reviewer-search"
              className="form-control"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-3 align-self-end">
            <button type="submit" className="btn btn-light">
              {t("recommendationRules.search")}
            </button>
          </div>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutate();
          }}
        >
          <fieldset disabled={write.busy || write.uncertain}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label" htmlFor="grant-reviewer">
                  {t("recommendationRules.reviewer")}
                </label>
                <select
                  className="form-select"
                  id="grant-reviewer"
                  required
                  value={reviewer}
                  onChange={(event) => setReviewer(event.target.value)}
                >
                  <option value="">{t("recommendationRules.choose")}</option>
                  {(candidates.data?.designation_candidates ?? []).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="grant-evidence">
                  {t("recommendationRules.evidence")}
                </label>
                <input
                  className="form-control"
                  id="grant-evidence"
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}"
                  maxLength={200}
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="grant-expiry">
                  {t("recommendationRules.validUntil")}
                </label>
                <input
                  className="form-control"
                  id="grant-expiry"
                  type="datetime-local"
                  required
                  value={until}
                  onChange={(event) => setUntil(event.target.value)}
                />
              </div>
            </div>
            <label className="form-check my-3">
              <input
                type="checkbox"
                className="form-check-input"
                required
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span className="form-check-label">{t("recommendationRules.qualifications")}</span>
            </label>
            <button className="btn btn-primary" type="submit">
              {t("recommendationRules.designate")}
            </button>
          </fieldset>
        </form>
        <div className="table-responsive mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>{t("recommendationRules.reviewer")}</th>
                <th>{t("recommendationRules.validUntilUtc")}</th>
                <th>{t("recommendationRules.state")}</th>
              </tr>
            </thead>
            <tbody>
              {board.grants.map((grant) => (
                <tr key={grant.id}>
                  <td>{grant.reviewer.name}</td>
                  <td>
                    <bdi>{grant.valid_until} UTC</bdi>
                  </td>
                  <td>
                    {grant.revoked ? (
                      t("recommendationRules.revoked")
                    ) : (
                      <button
                        className="btn btn-sm btn-soft-danger"
                        type="button"
                        disabled={write.busy || write.uncertain}
                        onClick={() => mutate(grant.id)}
                      >
                        {t("recommendationRules.revoke")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
function Workspace({ fresh = false }: { readonly fresh?: boolean }) {
  const { ruleId = "" } = useParams();
  const { t } = useTranslation();
  const { staff, prefix } = useRuleRole();
  const navigate = useNavigate();
  const valid = /^[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(ruleId);
  const board = useClinicalRead(prefix, ruleBoard);
  const read = useClinicalRead(`${prefix}/${ruleId}`, ruleDetail, !fresh && valid);
  const [editing, setEditing] = useState(fresh);
  const refresh = () => {
    read.refetch();
    board.refetch();
    setEditing(false);
  };
  return (
    <ContentPage title={t(fresh ? "recommendationRules.new" : "recommendationRules.title")}>
      <Link className="btn btn-light mb-3" to="/recommendation-rules">
        {t("recommendationRules.back")}
      </Link>
      <ContentState
        busy={(!board.data && !board.error) || (!fresh && valid && !read.data && !read.error)}
        error={board.error || (!fresh && (read.error || !valid))}
      />
      {board.data &&
        (fresh || read.data) &&
        (fresh && !staff ? (
          <p role="alert">{t("adminReservations.denied")}</p>
        ) : editing && staff ? (
          <RuleEditor
            key={read.data?.working.id ?? "new"}
            board={board.data}
            detail={fresh ? undefined : (read.data ?? undefined)}
            accepted={(id) => {
              if (fresh) void navigate(`/recommendation-rules/${id}`, { replace: true });
              refresh();
            }}
            cancel={() => (fresh ? navigate("/recommendation-rules") : setEditing(false))}
            reload={refresh}
          />
        ) : (
          read.data && (
            <>
              <div className="card">
                <div className="card-body">
                  <div className="d-flex flex-wrap gap-3 justify-content-between">
                    <div>
                      <h4>
                        <bdi>{read.data.slug}</bdi>
                      </h4>
                      <p>
                        {t(`recommendationRules.states.${read.data.state}`)} ·{" "}
                        {t("recommendationRules.version")} {read.data.working.version}
                      </p>
                      <p>
                        {t("recommendationRules.publishedVersion")}:{" "}
                        {read.data.published_version ?? "—"} ·{" "}
                        {t(
                          read.data.publication_eligible
                            ? "recommendationRules.eligible"
                            : "recommendationRules.inactive",
                        )}
                      </p>
                    </div>
                    {staff && read.data.state !== "retired" && (
                      <button
                        type="button"
                        className="btn btn-primary align-self-start"
                        onClick={() => setEditing(true)}
                      >
                        {t("recommendationRules.edit")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <RuleReview
                key={`${read.data.id}:${read.data.working.id}:${read.data.contexts.publish ?? read.data.contexts.approve}`}
                detail={read.data}
                board={board.data}
                refresh={refresh}
              />
            </>
          )
        ))}
    </ContentPage>
  );
}
export default function Rules() {
  return (
    <RuleAccess>
      <Board />
    </RuleAccess>
  );
}
export function NewRule() {
  return (
    <RuleAccess>
      <Workspace fresh />
    </RuleAccess>
  );
}
export function RuleWorkspace() {
  return (
    <RuleAccess>
      <Workspace />
    </RuleAccess>
  );
}
