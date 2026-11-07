import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ruleDetail,
  ruleRequest,
  mutationReceipt,
  rulePreviewHtml,
  syntheticPreview,
  type RuleBoard,
  type RuleDetail,
} from "../../modules/checkupino/recommendations/api";
import {
  useClinicalRead,
  useClinicalWrite,
} from "../../modules/checkupino/profiles/useClinicalWrite";
import ConditionEditor from "./ConditionEditor";
import { WriteStatus, useRuleRole } from "./Shared";
import { recommendationImageUrl } from "../../modules/checkupino/api/transport";

export default function RuleReview({
  detail,
  board,
  refresh,
}: {
  readonly detail: RuleDetail;
  readonly board: RuleBoard;
  readonly refresh: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { staff, doctor, prefix } = useRuleRole();
  const preferred = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [language, setLanguage] = useState<"en" | "fa">(preferred),
    [reviewer, setReviewer] = useState(detail.assigned_reviewer?.id ?? "");
  const [assessment, setAssessment] = useState(""),
    [until, setUntil] = useState(""),
    [attested, setAttested] = useState(false);
  const [reviewId, setReviewId] = useState("");
  const [previewCase, setPreviewCase] = useState("");
  const preview = useClinicalRead(
    `${prefix}/${detail.id}/preview?case=${previewCase}`,
    syntheticPreview,
    previewCase !== "",
  );
  const write = useClinicalWrite(`rule-action-${detail.id}`);
  const mutate = (action: string) => {
    const revision = detail.contexts[action];
    if (!revision) return;
    const extra =
      action === "submit"
        ? { reviewer_id: reviewer }
        : action === "approve"
          ? { assessment, valid_until_local: until, attested }
          : action === "withdraw"
            ? { assessment, review_id: reviewId }
            : action === "reject"
              ? { assessment }
              : {};
    void write.run(
      async (signal) => ({
        revision: (await ruleRequest("GET", `${prefix}/${detail.id}`, ruleDetail, signal)).contexts[
          action
        ],
      }),
      revision,
      (signal) =>
        ruleRequest("POST", `${prefix}/${detail.id}/actions`, mutationReceipt, signal, {
          expected_revision: revision,
          action_key: crypto.randomUUID(),
          action,
          ...extra,
        }),
      refresh,
    );
  };
  const working = detail.working;
  return (
    <>
      <WriteStatus write={write} refresh={refresh} />
      <section className="card">
        <div className="card-header">
          <h5>{t("recommendationRules.syntheticPreview")}</h5>
        </div>
        <div className="card-body">
          <p className="text-muted">{t("recommendationRules.syntheticHint")}</p>
          <label className="form-label" htmlFor="synthetic-case">
            {t("recommendationRules.syntheticCase")}
          </label>
          <select
            className="form-select"
            id="synthetic-case"
            value={previewCase}
            onChange={(event) => setPreviewCase(event.target.value)}
          >
            <option value="">{t("recommendationRules.choose")}</option>
            {["missing", "unknown", "recent", "stale"].map((item) => (
              <option key={item} value={item}>
                {t(`recommendationRules.cases.${item}`)}
              </option>
            ))}
          </select>
          {preview.data && preview.data.rule_version_id === working.id && (
            <output className="d-block mt-3">
              {t(`recommendationRules.predicateOutcomes.${preview.data.outcome}`)}
            </output>
          )}
          {(preview.error || (preview.data && preview.data.rule_version_id !== working.id)) && (
            <p className="mt-3" role="alert">
              {t("recommendationRules.unavailable")}
            </p>
          )}
        </div>
      </section>
      <section className="card">
        <div className="card-header">
          <h5>
            {t("recommendationRules.exactVersion")}: {working.version}
          </h5>
          <div className="small text-muted text-break">
            <bdi>{working.content_hash}</bdi>
          </div>
        </div>
        <div className="card-body">
          <div
            className="nav nav-tabs mb-3"
            role="tablist"
            aria-label={t("recommendationRules.language")}
          >
            {(["en", "fa"] as const).map((lang) => (
              <button
                className={`nav-link${language === lang ? " active" : ""}`}
                role="tab"
                aria-selected={language === lang}
                aria-controls="review-language"
                id={`review-tab-${lang}`}
                type="button"
                key={lang}
                onClick={() => setLanguage(lang)}
              >
                {t(`patientArticles.language.${lang}`)}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="review-language"
            aria-labelledby={`review-tab-${language}`}
            lang={language}
            dir={language === "fa" ? "rtl" : "ltr"}
          >
            <h4>
              {working.translations[language].title || t("recommendationRules.missingTranslation")}
            </h4>
            {(["explanation", "population", "limitations"] as const).map((key) => (
              <div className="mb-3" key={key}>
                <h6>{t(`recommendationRules.${key}`)}</h6>
                <p className="text-break">
                  {key === "explanation"
                    ? working.translations[language].explanation
                    : working[key][language]}
                </p>
              </div>
            ))}
          </div>
          <h6>{t("recommendationRules.sources")}</h6>
          <ul>
            {working.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
          <fieldset disabled>
            <legend className="fs-6">{t("recommendationRules.include")}</legend>
            <ConditionEditor
              node={working.definition.include}
              catalog={board.catalog}
              onChange={() => {}}
            />
            {working.definition.exclude && (
              <>
                <h6 className="mt-3">{t("recommendationRules.exclude")}</h6>
                <ConditionEditor
                  node={working.definition.exclude}
                  catalog={board.catalog}
                  onChange={() => {}}
                />
              </>
            )}
          </fieldset>
        </div>
      </section>
      <section className="card">
        <div className="card-header">
          <h5>{t("recommendationRules.targets")}</h5>
        </div>
        <div className="card-body">
          <p className="text-muted">{t("recommendationRules.previewHint")}</p>
          {detail.target_previews.map((preview) => {
            const lang = preview.languages.includes(language) ? language : preview.languages[0];
            return (
              <details className="border rounded p-3 mb-3" key={preview.version_id}>
                <summary>
                  {preview.translations[lang]?.title} · {t("recommendationRules.version")}{" "}
                  {preview.version} · {t(`patientArticles.language.${lang}`)}
                </summary>
                {preview.thumbnail && (
                  <img
                    className="img-fluid rounded mt-3"
                    alt={preview.thumbnail.alt[lang]}
                    src={recommendationImageUrl(
                      detail.id,
                      working.version,
                      preview.id,
                      preview.thumbnail.id,
                      lang,
                      !staff,
                    )}
                  />
                )}
                <div
                  className="patient-articles mt-3"
                  lang={lang}
                  dir={lang === "fa" ? "rtl" : "ltr"}
                  dangerouslySetInnerHTML={{
                    __html: rulePreviewHtml(preview, lang, detail.id, working.version, !staff),
                  }}
                />
                {preview.sources.length > 0 && (
                  <ul className="mt-3">
                    {preview.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            );
          })}
        </div>
      </section>
      {detail.state !== "retired" && staff && (
        <section className="card">
          <div className="card-header">
            <h5>{t("recommendationRules.publication")}</h5>
          </div>
          <div className="card-body">
            <fieldset disabled={write.busy || write.uncertain}>
              <label className="form-label" htmlFor="assigned-reviewer">
                {t("recommendationRules.reviewer")}
              </label>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <select
                  id="assigned-reviewer"
                  className="form-select w-auto"
                  value={reviewer}
                  onChange={(event) => setReviewer(event.target.value)}
                >
                  <option value="">{t("recommendationRules.choose")}</option>
                  {board.reviewers.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!reviewer}
                  onClick={() => mutate("submit")}
                >
                  {t("recommendationRules.submit")}
                </button>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-success"
                  type="button"
                  disabled={!detail.can_publish}
                  onClick={() => mutate("publish")}
                >
                  {t("recommendationRules.publish")}
                </button>
                <button
                  className="btn btn-soft-danger"
                  type="button"
                  onClick={() => mutate("retire")}
                >
                  {t("recommendationRules.retire")}
                </button>
              </div>
            </fieldset>
          </div>
        </section>
      )}
      {doctor && (
        <section className="card">
          <div className="card-header">
            <h5>{t("recommendationRules.clinicalReview")}</h5>
          </div>
          <div className="card-body">
            <p className="text-muted">{t("recommendationRules.attestationHint")}</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                mutate("approve");
              }}
            >
              <fieldset disabled={write.busy || write.uncertain}>
                <label className="form-label" htmlFor="review-assessment">
                  {t("recommendationRules.assessment")}
                </label>
                <textarea
                  id="review-assessment"
                  className="form-control mb-3"
                  rows={4}
                  maxLength={2000}
                  required
                  value={assessment}
                  onChange={(event) => setAssessment(event.target.value)}
                />
                {detail.can_review && (
                  <>
                    <label className="form-label" htmlFor="review-expiry">
                      {t("recommendationRules.validUntil")}
                    </label>
                    <input
                      id="review-expiry"
                      className="form-control mb-3"
                      type="datetime-local"
                      required
                      value={until}
                      onChange={(event) => setUntil(event.target.value)}
                    />
                    <label className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={attested}
                        required
                        onChange={(event) => setAttested(event.target.checked)}
                      />
                      <span className="form-check-label">{t("recommendationRules.attested")}</span>
                    </label>
                    <div className="d-flex gap-2 mb-3">
                      <button className="btn btn-success" type="submit">
                        {t("recommendationRules.approve")}
                      </button>
                      <button
                        className="btn btn-soft-danger"
                        type="button"
                        disabled={!assessment.trim()}
                        onClick={() => mutate("reject")}
                      >
                        {t("recommendationRules.reject")}
                      </button>
                    </div>
                  </>
                )}
                <label className="form-label" htmlFor="withdraw-review">
                  {t("recommendationRules.ownApproval")}
                </label>
                <select
                  id="withdraw-review"
                  className="form-select mb-3"
                  value={reviewId}
                  onChange={(event) => setReviewId(event.target.value)}
                >
                  <option value="">{t("recommendationRules.choose")}</option>
                  {detail.reviews
                    .filter((review) => review.withdrawable)
                    .map((review) => (
                      <option value={review.id} key={review.id}>
                        {t("recommendationRules.version")} {review.version} · {review.recorded_at}{" "}
                        UTC
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-soft-danger"
                  disabled={!reviewId || !assessment.trim()}
                  onClick={() => mutate("withdraw")}
                >
                  {t("recommendationRules.withdraw")}
                </button>
              </fieldset>
            </form>
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-header">
          <h5>{t("recommendationRules.history")}</h5>
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            {detail.versions.map((version) => (
              <span
                className="badge bg-light text-body"
                key={version.id}
                title={version.content_hash}
              >
                {t("recommendationRules.version")} {version.version} · {version.recorded_at} UTC
              </span>
            ))}
          </div>
          {detail.reviews.length ? (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    {["version", "reviewer", "outcome", "assessment", "recorded"].map((key) => (
                      <th key={key}>{t(`recommendationRules.${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.reviews.map((review) => (
                    <tr key={review.id}>
                      <td>{review.version}</td>
                      <td>{review.reviewer.name}</td>
                      <td>{t(`recommendationRules.outcomes.${review.outcome}`)}</td>
                      <td className="text-break">{review.assessment}</td>
                      <td>
                        <bdi>{review.recorded_at} UTC</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{t("recommendationRules.noReviews")}</p>
          )}
        </div>
      </section>
    </>
  );
}
