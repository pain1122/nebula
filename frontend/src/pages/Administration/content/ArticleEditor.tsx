import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  Row,
  TabContent,
  TabPane,
  Accordion,
  AccordionItem,
  AccordionBody,
} from "reactstrap";
import { Link } from "react-router-dom";
import { Dialog } from "../../../modules/checkupino/overlays";
import { useDirectAction } from "../../../modules/checkupino/content/useDirectAction";
import LanguageTabs from "./LanguageTabs";
import ArticleSeoFields from "./ArticleSeoFields";
import { emptySeo, validSeo, type ArticleSeo } from "../../../modules/checkupino/content/seo";
import {
  publicationTimezone,
  validPublicationInput,
} from "../../../modules/checkupino/content/publication";
import "./ArticleEditor.css";
import ArticleRichTextEditor, { type ArticleImageInserter } from "./ArticleRichTextEditor";
import ArticleFileManager from "./ArticleFileManager";
import { imageUrl, type ArticleImage } from "../../../modules/checkupino/content/media";
import { articleImageIds } from "./articleRichHtml";
import { parseScheduleResult } from "../../../modules/checkupino/content/schedules";
import {
  contentWrite,
  readContent,
  parseDraftContext,
  parseSavedArticle,
  conflict,
  localizedText,
  type ArticleTerm,
  type DraftContext,
} from "../../../modules/checkupino/content/api";
import { Preview, ContentState, TaxonomyPicker, useContent } from "./Shared";

type Translation = { title: string; summary: string; body_html: string; seo: ArticleSeo };
export type DraftFields = {
  slug: string;
  translations: Partial<Record<"en" | "fa", Translation>>;
  taxonomy: ArticleTerm[];
  health: string[];
  sources: { url: string; label: string }[];
  publication?: string;
  thumbnail: { asset: ArticleImage; alt: { en: string; fa: string } } | null;
  inline: { asset: ArticleImage; language: "en" | "fa" }[];
};
const emptyTranslation = (): Translation => ({
  title: "",
  summary: "",
  body_html: "",
  seo: emptySeo(),
});
export const draftFields = (context: DraftContext): DraftFields => {
  const current = context.current;
  return {
    slug: current?.slug ?? "",
    translations: current
      ? Object.fromEntries(
          Object.entries(current.working.translations).map(([lang, value]) => [
            lang,
            { ...value, body_html: value.body_html ?? "", seo: value.seo ?? emptySeo() },
          ]),
        )
      : { en: emptyTranslation(), fa: emptyTranslation() },
    taxonomy: current?.working.taxonomy ?? [],
    health: current?.working.health_references?.map((v) => v.id) ?? [],
    sources: current?.working.source_links ?? [],
    thumbnail: current?.working.presentation?.thumbnail ?? null,
    inline: current?.working.presentation?.inline ?? [],
    publication:
      context.presentation_enabled || current?.working.schema_version === 3
        ? (current?.working.presentation?.publication?.local_time ?? "")
        : undefined,
  };
};
const characters = (v: string) => Array.from(v).length;
const usedInline = (fields: DraftFields) =>
  fields.inline.filter((ref) =>
    articleImageIds(fields.translations[ref.language]?.body_html ?? "").includes(ref.asset.id),
  );
export const validDraftFields = (fields: DraftFields) =>
  (fields.publication === undefined || validPublicationInput(fields.publication)) &&
  usedInline(fields).length <= 30 &&
  (!fields.thumbnail ||
    Object.values(fields.thumbnail.alt).every(
      (value) => characters(value) <= 255 && !/[\x00-\x1f\x7f]/.test(value),
    )) &&
  /^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(fields.slug) &&
  Object.values(fields.translations).every(
    (v) =>
      characters(v.title) <= 200 &&
      characters(v.summary) <= 1000 &&
      validSeo(v.seo) &&
      v.body_html.length <= 20000 &&
      new TextEncoder().encode(v.body_html).length <= 80000,
  ) &&
  fields.taxonomy.length <= 30 &&
  fields.taxonomy.every((v) => v.is_active && v.currently_active !== false) &&
  fields.sources.length <= 20 &&
  fields.sources.every((v) => {
    try {
      const u = new URL(v.url);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        v.label.trim().length > 0 &&
        characters(v.label) <= 200 &&
        characters(v.url) <= 2048
      );
    } catch {
      return false;
    }
  }) &&
  new Set(fields.sources.map((v) => v.url)).size === fields.sources.length;

export default function ArticleEditor({
  id,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly id: string | null;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
  readonly onUncertain: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const path = `/api/admin/articles${id ? "/" + id : ""}`;
  const contextRead = useContent(path + "/write-context", {}, (wire) =>
    parseDraftContext(wire, id),
  );
  const [fields, setFields] = useState<DraftFields | null>(null);
  const [tab, setTab] = useState<"en" | "fa">(lang);
  const [ready, setReady] = useState<Record<string, boolean | null>>({});
  const direct = useDirectAction(onUncertain);
  const saving = direct.busy;
  const [preview, setPreview] = useState(false);
  const [seoOpen, setSeoOpen] = useState("");
  const [intent, setIntent] = useState<"draft" | "publish" | "schedule">("draft");
  const [mediaTarget, setMediaTarget] = useState<
    { language: "en" | "fa"; insert: ArticleImageInserter } | "thumbnail" | null
  >(null);
  const closeMedia = useCallback(() => setMediaTarget(null), []);
  const uncertain = direct.uncertain;
  const readyEn = useCallback(
    (value: boolean | null) => setReady((v) => ({ ...v, en: value })),
    [],
  );
  const readyFa = useCallback(
    (value: boolean | null) => setReady((v) => ({ ...v, fa: value })),
    [],
  );
  const context = contextRead.data;
  const [loaded, setLoaded] = useState<typeof context>();
  if (context && loaded !== context) {
    setLoaded(context);
    setFields(draftFields(context));
    setReady({});
    setMediaTarget(null);
  }
  const update = <K extends keyof Translation>(
    language: "en" | "fa",
    key: K,
    value: Translation[K],
  ) =>
    setFields((old) =>
      old
        ? {
            ...old,
            translations: {
              ...old.translations,
              [language]: { ...(old.translations[language] ?? emptyTranslation()), [key]: value },
            },
          }
        : old,
    );
  const editable =
    !!context &&
    !!fields &&
    !contextRead.busy &&
    !contextRead.error &&
    (id ? context.can_update : context.can_create);
  const valid =
    editable &&
    !!fields &&
    validDraftFields(fields) &&
    Object.keys(fields.translations).every((v) => ready[v] === true) &&
    (intent === "draft" ||
      (!!context?.composer_enabled &&
        Object.values(fields.translations).some(
          (value) =>
            value.title.trim() &&
            value.body_html
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim(),
        ))) &&
    (intent !== "schedule" || (!!context?.scheduling_available && !!fields.publication));
  const actionLabel = intent === "draft" ? "content.saveDraft" : `content.composer.${intent}`;
  const save = async () => {
    if (!valid || !context || !fields || uncertain || saving) return;
    await direct.run(async ({ signal, dispatch }) => {
      const fresh = parseDraftContext(await readContent(path + "/write-context", {}, signal), id);
      if (
        fresh.revision !== context.revision ||
        !(id ? fresh.can_update : fresh.can_create) ||
        (intent !== "draft" && !fresh.composer_enabled) ||
        (intent === "schedule" && !fresh.scheduling_available)
      )
        throw conflict();
      const body = {
        slug: fields.slug,
        translations: fields.translations,
        taxonomy: fields.taxonomy.map(({ id, kind }) => ({ id, kind })),
        health_references: fields.health,
        source_links: fields.sources,
        expected_revision: context.revision,
        intent,
        ...(context.presentation_enabled || context.current?.working.schema_version === 3
          ? {
              presentation: {
                publication: fields.publication
                  ? { local_time: fields.publication, timezone: publicationTimezone }
                  : null,
                thumbnail: fields.thumbnail
                  ? { id: fields.thumbnail.asset.id, alt: fields.thumbnail.alt }
                  : null,
                inline: usedInline(fields).map((ref) => ({
                  id: ref.asset.id,
                  language: ref.language,
                })),
              },
            }
          : {}),
      };
      const response = await dispatch(() => contentWrite(path, id ? "PUT" : "POST", body, signal));
      const row = parseSavedArticle(response.data, id ?? undefined);
      if (
        intent === "publish" &&
        (row.working_state !== "published" ||
          row.published?.content_hash !== row.working.content_hash)
      )
        throw new Error("Publication result requires a fresh read.");
      if (intent === "schedule") {
        const scheduled = parseScheduleResult(response.data, row.id);
        if (scheduled.status !== "armed" || scheduled.content_hash !== row.working.content_hash)
          throw new Error("Schedule result requires a fresh read.");
      }
      if (!signal.aborted) onSaved(row.id);
    });
  };
  if (contextRead.error)
    return (
      <Card data-article-editor>
        <CardBody>
          <h5>{t("content.newArticle")}</h5>
          <output className="text-muted small d-block mb-2">
            {t("content.authoringUnavailable")}
          </output>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                direct.reset();
                contextRead.refresh();
              }}
            >
              {t("adminReservations.refresh")}
            </button>
            <button type="button" className="btn btn-light" onClick={onClose}>
              {t("content.cancel")}
            </button>
          </div>
        </CardBody>
      </Card>
    );
  return (
    <div data-article-editor>
      <ContentState busy={contextRead.busy} error={false} />
      {direct.failure ? (
        <output className="text-muted small">{t(`content.operation.${direct.failure}`)}</output>
      ) : null}

      <Row>
        <Col lg={8} data-article-content-column>
          <fieldset className="border-0 p-0 m-0" disabled={!editable || uncertain || saving}>
            <Card>
              <CardHeader>
                <LanguageTabs
                  id="article-content"
                  active={tab}
                  onChange={setTab}
                  disabled={!editable || uncertain || saving}
                />
              </CardHeader>
              <CardBody>
                <p className="text-muted">{t("content.draftHint")}</p>
                <TabContent activeTab={tab}>
                  {(["en", "fa"] as const).map((language) => (
                    <TabPane
                      key={language}
                      tabId={language}
                      id={`article-content-pane-${language}`}
                      role="tabpanel"
                      aria-labelledby={`article-content-tab-${language}`}
                      hidden={tab !== language}
                    >
                      <label className="form-check mb-3">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={!!fields?.translations[language]}
                          onChange={(event) =>
                            setFields((value) => {
                              if (!value) return value;
                              const translations = { ...value.translations };
                              if (event.target.checked) translations[language] = emptyTranslation();
                              else delete translations[language];
                              return { ...value, translations };
                            })
                          }
                        />
                        <span className="form-check-label">
                          {t("content.includeTranslation", {
                            language: t(`content.language.${language}`),
                          })}
                        </span>
                      </label>
                      {fields?.translations[language] ? (
                        <div lang={language} dir={language === "fa" ? "rtl" : "ltr"}>
                          <div className="mb-3">
                            <label className="form-label" htmlFor={`article-title-${language}`}>
                              {t("content.title")}
                            </label>
                            <input
                              id={`article-title-${language}`}
                              className="form-control"
                              maxLength={400}
                              value={fields.translations[language].title}
                              onChange={(event) => update(language, "title", event.target.value)}
                            />
                            <small className="text-muted">
                              {characters(fields.translations[language].title)} / 200
                            </small>
                          </div>
                          {tab === language ? (
                            <div className="mb-3">
                              <label className="form-label" htmlFor="article-slug">
                                {t("content.slug")}
                              </label>
                              <input
                                id="article-slug"
                                dir="ltr"
                                lang="en"
                                className="form-control"
                                maxLength={160}
                                disabled={!context?.can_edit_slug}
                                value={fields.slug}
                                onChange={(event) =>
                                  setFields((value) =>
                                    value ? { ...value, slug: event.target.value } : value,
                                  )
                                }
                              />
                              <small className="text-muted d-block mt-1">
                                {t("content.slugHint")}
                              </small>
                            </div>
                          ) : null}
                          <ArticleRichTextEditor
                            key={`${context?.revision}-${language}-${lang}`}
                            id={`article-body-${language}`}
                            label={t("content.body")}
                            value={fields.translations[language].body_html}
                            contentLocale={language}
                            images={fields.inline
                              .filter((ref) => ref.language === language)
                              .map((ref) => ref.asset.id)}
                            onBrowse={(insert) => setMediaTarget({ language, insert })}
                            disabled={!editable || uncertain || saving}
                            onChange={(html) =>
                              setFields((old) =>
                                old
                                  ? {
                                      ...old,
                                      translations: {
                                        ...old.translations,
                                        [language]: {
                                          ...(old.translations[language] ?? emptyTranslation()),
                                          body_html: html,
                                        },
                                      },
                                    }
                                  : old,
                              )
                            }
                            onValidityChange={language === "en" ? readyEn : readyFa}
                          />
                        </div>
                      ) : null}
                    </TabPane>
                  ))}
                </TabContent>
              </CardBody>
            </Card>
            <Accordion
              open={seoOpen}
              toggle={(value: string) => setSeoOpen((old) => (old === value ? "" : value))}
              className="mb-4"
              data-article-seo
            >
              <AccordionItem>
                <h2 className="accordion-header">
                  <button
                    id="article-seo-toggle"
                    type="button"
                    className={"accordion-button" + (seoOpen ? "" : " collapsed")}
                    aria-expanded={seoOpen === "article-seo"}
                    aria-controls="article-seo-body"
                    onClick={() => setSeoOpen((value) => (value ? "" : "article-seo"))}
                  >
                    {t("content.seo.heading")}
                  </button>
                </h2>
                <AccordionBody
                  accordionId="article-seo"
                  id="article-seo-body"
                  aria-labelledby="article-seo-toggle"
                  hidden={!seoOpen}
                >
                  <p className="text-muted small">{t("content.seo.guidance")}</p>
                  <label className="form-label" htmlFor="article-seo-language">
                    {t("content.contentLanguage")}
                  </label>
                  <select
                    id="article-seo-language"
                    className="form-select mb-3"
                    value={tab}
                    onChange={(event) => setTab(event.target.value === "fa" ? "fa" : "en")}
                  >
                    <option value="en">{t("content.language.en")}</option>
                    <option value="fa">{t("content.language.fa")}</option>
                  </select>
                  <div className="mt-3">
                    {(["en", "fa"] as const).map((language) => (
                      <div key={language} hidden={tab !== language}>
                        {fields?.translations[language] ? (
                          <ArticleSeoFields
                            language={language}
                            value={fields.translations[language].seo}
                            onChange={(value) => update(language, "seo", value)}
                          />
                        ) : (
                          <p>{t("content.noTranslation")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionBody>
              </AccordionItem>
            </Accordion>
          </fieldset>
        </Col>
        <Col lg={4} data-article-sidebar>
          <Card>
            <CardHeader>
              <h5 className="card-title mb-0">{t("content.composer.publication")}</h5>
            </CardHeader>
            <CardBody>
              <span className="badge bg-warning-subtle text-warning mb-3">
                {t(`content.state.${context?.current?.status ?? "draft"}`)}
              </span>
              <label className="form-label d-block" htmlFor="article-publication-action">
                {t("content.composer.action")}
              </label>
              <select
                id="article-publication-action"
                className="form-select mb-3"
                value={intent}
                disabled={!editable || uncertain || saving}
                onChange={(event) =>
                  setIntent(event.target.value as "draft" | "publish" | "schedule")
                }
              >
                <option value="draft">{t("content.composer.draft")}</option>
                <option value="publish">{t("content.composer.publish")}</option>
                <option value="schedule">{t("content.composer.schedule")}</option>
              </select>
              <p className="text-muted small">{t(`content.composer.hint.${intent}`)}</p>
              {intent === "schedule" ? (
                <div className="mb-3">
                  <label className="form-label" htmlFor="article-publish-on">
                    {t("content.schedule.publishOn")}
                  </label>
                  <input
                    id="article-publish-on"
                    type="datetime-local"
                    className="form-control"
                    dir="ltr"
                    value={fields?.publication ?? ""}
                    step={60}
                    aria-describedby="article-publish-on-hint"
                    disabled={!editable || uncertain || saving}
                    onChange={(event) =>
                      setFields((value) =>
                        value ? { ...value, publication: event.target.value } : value,
                      )
                    }
                  />
                  <p id="article-publish-on-hint" className="text-muted small mt-2">
                    {t("content.composer.tehranHint")}
                  </p>
                  {!context?.scheduling_available ? (
                    <output className="text-muted small">
                      {t("content.composer.scheduleUnavailable")}
                    </output>
                  ) : null}
                </div>
              ) : null}
              {!valid && editable ? <p className="text-muted">{t("content.draftLimits")}</p> : null}
              <div className="d-flex flex-wrap align-items-center gap-2" data-article-actions>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={!valid || uncertain || saving}
                  onClick={() => void save()}
                >
                  <i className="ri-save-line me-1" aria-hidden="true" />
                  {t(actionLabel)}
                </button>
                <button type="button" className="btn btn-light" disabled={saving} onClick={onClose}>
                  {t("content.cancel")}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-soft-info mt-3"
                disabled={!fields || !editable || saving}
                onClick={() => setPreview(true)}
              >
                <i className="ri-eye-line me-1" aria-hidden="true" />
                {t("content.previewDraft")}
              </button>
            </CardBody>
          </Card>
          <Card data-article-thumbnail>
            <CardHeader>
              <h5 className="card-title mb-0">{t("content.media.thumbnail")}</h5>
            </CardHeader>
            <CardBody>
              <div className="row g-3">
                <div className="col-12">
                  <button
                    type="button"
                    className="card card-body border w-100 text-center align-items-center mb-0"
                    disabled={!editable || uncertain || saving}
                    onClick={() => setMediaTarget("thumbnail")}
                  >
                    {fields?.thumbnail ? (
                      <img
                        className="img-fluid rounded"
                        style={{ maxHeight: 180, objectFit: "contain" }}
                        src={imageUrl(fields.thumbnail.asset.id)}
                        alt={fields.thumbnail.alt[lang]}
                      />
                    ) : (
                      <i className="ri-image-add-line display-4 text-muted" aria-hidden="true" />
                    )}
                    <span className="mt-2">
                      {t(
                        fields?.thumbnail
                          ? "content.media.change"
                          : "content.media.chooseThumbnail",
                      )}
                    </span>
                  </button>
                </div>
                {fields?.thumbnail ? (
                  <>
                    {(["en", "fa"] as const).map((language) => (
                      <div className="col-12" key={language}>
                        <label htmlFor={`article-thumbnail-alt-${language}`} className="form-label">
                          {t("content.media.alt", { language: t(`content.language.${language}`) })}
                        </label>
                        <input
                          id={`article-thumbnail-alt-${language}`}
                          className="form-control"
                          lang={language}
                          dir={language === "fa" ? "rtl" : "ltr"}
                          value={fields.thumbnail?.alt[language] ?? ""}
                          maxLength={255}
                          disabled={!editable || uncertain || saving}
                          onChange={(event) =>
                            setFields((old) =>
                              old?.thumbnail
                                ? {
                                    ...old,
                                    thumbnail: {
                                      ...old.thumbnail,
                                      alt: { ...old.thumbnail.alt, [language]: event.target.value },
                                    },
                                  }
                                : old,
                            )
                          }
                        />
                      </div>
                    ))}
                    <div className="col-12">
                      <button
                        type="button"
                        className="btn btn-soft-danger"
                        disabled={!editable || uncertain || saving}
                        onClick={() =>
                          setFields((old) => (old ? { ...old, thumbnail: null } : old))
                        }
                      >
                        {t("content.media.remove")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="col-12">
                    <p className="small text-muted mb-0">{t("content.media.thumbnailHint")}</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
          <Card data-article-organization>
            <CardHeader className="d-flex flex-wrap gap-2 align-items-center">
              <h5 className="card-title mb-0 flex-grow-1">{t("content.composer.organization")}</h5>
              <Link
                to="/article-taxonomies"
                target="_blank"
                rel="noopener noreferrer"
                className="link-primary"
              >
                {t("content.manageTerms")}
              </Link>
            </CardHeader>
            <CardBody>
              {(["category", "tag"] as const).map((kind) => (
                <div className="mb-3" key={kind}>
                  <h6>{t(`content.tabs.${kind}`)}</h6>
                  <TaxonomyPicker
                    disabled={!editable || uncertain || saving}
                    kind={kind}
                    selected={fields?.taxonomy.filter((term) => term.kind === kind) ?? []}
                    max={30 - (fields?.taxonomy.filter((term) => term.kind !== kind).length ?? 0)}
                    onChange={(terms) =>
                      setFields((value) =>
                        value
                          ? {
                              ...value,
                              taxonomy: [
                                ...value.taxonomy.filter((term) => term.kind !== kind),
                                ...terms,
                              ],
                            }
                          : value,
                      )
                    }
                  />
                </div>
              ))}
              <p className="text-muted small mb-0">{t("content.sharedTermsHint")}</p>
            </CardBody>
          </Card>
          <Card data-article-health-links>
            <details>
              <summary className="card-header">{t("content.medicalReferences")}</summary>
              <CardBody>
                <p className="text-muted">{t("content.medicalHint")}</p>
                <fieldset className="border-0 p-0 m-0" disabled={!editable || uncertain || saving}>
                  <div className="row g-2">
                    {context?.health_catalog.terms.map((term) => (
                      <div className="col-12" key={term.id}>
                        <label
                          className="form-check"
                          htmlFor={`article-health-${term.id}`}
                          aria-label={localizedText(term.labels, lang)}
                        >
                          <input
                            id={`article-health-${term.id}`}
                            className="form-check-input"
                            type="checkbox"
                            disabled={!term.active}
                            checked={fields?.health.includes(term.id) ?? false}
                            onChange={(event) =>
                              setFields((value) =>
                                value
                                  ? {
                                      ...value,
                                      health: event.target.checked
                                        ? [...value.health, term.id]
                                        : value.health.filter((id) => id !== term.id),
                                    }
                                  : value,
                              )
                            }
                          />
                          <span className="form-check-label">
                            <bdi>{localizedText(term.labels, lang)}</bdi>
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>
              </CardBody>
            </details>
          </Card>
        </Col>
      </Row>
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="btn btn-light"
          disabled={contextRead.busy || saving}
          onClick={contextRead.refresh}
        >
          {t("content.reloadDraft")}
        </button>
      </div>
      {preview && fields ? (
        <Dialog
          open
          title={t("content.previewDraft")}
          locale={lang}
          onClose={() => setPreview(false)}
        >
          <p className="text-muted small">{t("content.unsavedPreview")}</p>
          <Preview
            initialLanguage={tab}
            version={{
              translations: fields.translations,
              source_links: fields.sources,
              presentation: {
                publication: null,
                thumbnail: fields.thumbnail,
                inline: usedInline(fields),
              },
              health_references:
                context?.health_catalog.terms.filter((term) => fields.health.includes(term.id)) ??
                [],
            }}
          />
          <button type="button" className="btn btn-light mt-3" onClick={() => setPreview(false)}>
            {t("content.close")}
          </button>
        </Dialog>
      ) : null}
      {mediaTarget && editable && !saving && !uncertain ? (
        <ArticleFileManager
          onClose={closeMedia}
          onSelect={(asset) => {
            if (mediaTarget === "thumbnail")
              setFields((old) =>
                old
                  ? { ...old, thumbnail: { asset, alt: old.thumbnail?.alt ?? { en: "", fa: "" } } }
                  : old,
              );
            else {
              const { language, insert } = mediaTarget;
              setFields((old) =>
                old
                  ? {
                      ...old,
                      inline: [
                        ...old.inline.filter(
                          (ref) => ref.language !== language || ref.asset.id !== asset.id,
                        ),
                        { asset, language },
                      ],
                    }
                  : old,
              );
              insert(asset);
            }
            setMediaTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
