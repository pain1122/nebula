import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, Container } from "reactstrap";
import { useShellAuth } from "../../../Layouts/ShellAuthContext";
import Select from "react-select";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import ActionDialog, { type ActionTarget } from "../ActionDialog";
import { adminAuthAuthority } from "../../../modules/checkupino/auth/authority";
import {
  readContent,
  parsePage,
  termSchema,
  localizedText,
  contentDate,
  type ArticleTerm,
  type ArticleVersion,
  type ContentQuery,
  type Page,
  type TermKind,
} from "../../../modules/checkupino/content/api";
import {
  formatProductTimestamp,
  formatProductNumber,
} from "../../../modules/checkupino/preferences/localization";
import { questionnaireRichHtml } from "../questionnaireRichHtml";
import { articleRichHtml } from "./articleRichHtml";
import { imageUrl } from "../../../modules/checkupino/content/media";

export function ContentAccess({ children }: { readonly children: ReactNode }) {
  const { capabilities, userProfile } = useShellAuth();
  const { t } = useTranslation();
  if (!capabilities.accessAdminPanel)
    return (
      <div className="page-content">
        <p role="alert">{t("adminReservations.denied")}</p>
      </div>
    );
  return (
    <div key={String(userProfile?.id) + ":" + [...(userProfile?.roles ?? [])].sort().join("|")}>
      {children}
    </div>
  );
}
export function ContentPage({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <div className="page-content" data-content-page>
      <Container fluid>
        <BreadCrumb title={title} pageTitle={t("content.navigation")} />
        {children}
      </Container>
    </div>
  );
}
export function useContent<T>(
  path: string | null,
  query: ContentQuery,
  parse: (wire: unknown) => T,
) {
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: boolean }>({ key: "" });
  const parser = useRef(parse);
  useEffect(() => {
    parser.current = parse;
  }, [parse]);
  const key = JSON.stringify([path, query, epoch]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const identity = adminAuthAuthority.getSnapshot().identity;
    const unsubscribe = adminAuthAuthority.subscribe(() => {
      const current = adminAuthAuthority.getSnapshot().identity;
      if (current?.id !== identity?.id || current?.roles.join("|") !== identity?.roles.join("|")) {
        controller.abort();
        setResult({ key, error: true });
      }
    });
    const parameters = JSON.parse(key) as [string, ContentQuery, number];
    void readContent(parameters[0], parameters[1], controller.signal)
      .then((wire) => {
        if (!controller.signal.aborted) setResult({ key, data: parser.current(wire) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, error: true });
      });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [key, path]);
  return {
    data: path && result.key === key && !result.error ? result.data : undefined,
    error: !!path && result.key === key && !!result.error,
    busy: !!path && (result.key !== key || (!result.data && !result.error)),
    refresh: () => setEpoch((v) => v + 1),
  };
}
export function ContentState({ busy, error }: { readonly busy: boolean; readonly error: boolean }) {
  const { t } = useTranslation();
  return busy ? (
    <output className="d-block py-3">{t("adminManage.loading")}</output>
  ) : error ? (
    <p role="alert" className="alert alert-warning">
      {t("content.unavailable")}
    </p>
  ) : null;
}
export function PageButtons({
  page,
  onPage,
  disabled = false,
}: {
  readonly page?: Page<unknown>["pagination"];
  readonly onPage: (value: number) => void;
  readonly disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  if (!page) return null;
  return (
    <div
      className="d-flex flex-wrap align-items-center gap-2 mt-3"
      aria-label={t("content.pagination")}
    >
      <button
        type="button"
        className="btn btn-light"
        disabled={disabled || page.current_page <= 1}
        onClick={() => onPage(page.current_page - 1)}
      >
        {t("content.previous")}
      </button>
      <span>
        {t("content.pageCount", {
          page: formatProductNumber(page.current_page, lang),
          pages: formatProductNumber(page.last_page, lang),
          total: formatProductNumber(page.total, lang),
        })}
      </span>
      <button
        type="button"
        className="btn btn-light"
        disabled={disabled || page.current_page >= page.last_page}
        onClick={() => onPage(page.current_page + 1)}
      >
        {t("content.next")}
      </button>
    </div>
  );
}
export function ContentDate({ value }: { readonly value: string | null }) {
  const { i18n } = useTranslation();
  const stamp = contentDate(value);
  return (
    <bdi>
      {stamp ? formatProductTimestamp(stamp, i18n.resolvedLanguage === "fa" ? "fa" : "en") : "—"}
    </bdi>
  );
}
export function Preview({
  version,
  initialLanguage,
}: {
  readonly version: Pick<
    ArticleVersion,
    "translations" | "health_references" | "source_links" | "presentation"
  >;
  readonly initialLanguage?: "en" | "fa";
}) {
  const { t, i18n } = useTranslation();
  const preferred = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [choice, setChoice] = useState<"en" | "fa">(initialLanguage ?? preferred);
  const lang = version.translations[choice] ? choice : choice === "en" ? "fa" : "en";
  const text = version.translations[lang];
  let html: string;
  try {
    html = version.presentation
      ? articleRichHtml(
          text?.body_html ?? "",
          version.presentation.inline
            .filter((ref) => ref.language === lang)
            .map((ref) => ref.asset.id),
          true,
        )
      : questionnaireRichHtml(text?.body_html ?? "");
  } catch {
    return <p role="alert">{t("content.invalidContent")}</p>;
  }
  return (
    <div data-article-preview>
      {version.presentation?.publication ? (
        <p className="alert alert-info">
          {t("content.schedule.publishOn")}:{" "}
          <bdi>{version.presentation.publication.local_time.replace("T", " ")}</bdi>
          <span className="d-block small">{t("content.schedule.preferenceHint")}</span>
        </p>
      ) : null}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {(["en", "fa"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={lang === key ? "btn btn-sm btn-primary" : "btn btn-sm btn-light"}
            disabled={!version.translations[key]}
            onClick={() => setChoice(key)}
          >
            {t(`content.language.${key}`)}
          </button>
        ))}
      </div>
      <p className="text-muted small">
        {t("content.previewLanguage", { language: t(`content.language.${lang}`) })}
      </p>
      {text ? (
        <article dir={lang === "fa" ? "rtl" : "ltr"} lang={lang} className="text-break">
          <h4>{text.title || t("content.untitled")}</h4>
          {version.presentation?.thumbnail ? (
            <img
              className="img-fluid rounded mb-3"
              style={{ maxHeight: 300, objectFit: "contain" }}
              src={imageUrl(version.presentation.thumbnail.asset.id)}
              alt={version.presentation.thumbnail.alt[lang]}
            />
          ) : null}
          {text.summary ? <p className="text-muted">{text.summary}</p> : null}
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {text.seo ? (
            <details className="card mt-3" data-article-seo-preview>
              <summary className="card-header">{t("content.seo.heading")}</summary>
              <dl className="card-body mb-0">
                {(
                  ["title", "description", "keywords", "canonical_url", "schema_json"] as const
                ).map((key) => (
                  <div className="mb-2" key={key}>
                    <dt>{t(`content.seo.${key}`)}</dt>
                    <dd className="mb-0">
                      {key === "schema_json" ? (
                        <pre dir="ltr" className="text-wrap mb-0">
                          {text.seo?.[key]}
                        </pre>
                      ) : (
                        <bdi>{text.seo?.[key] || "—"}</bdi>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </article>
      ) : (
        <p>{t("content.noTranslation")}</p>
      )}
      {version.health_references?.length ? (
        <div className="d-flex gap-2 flex-wrap mt-3">
          {version.health_references.map((ref) => (
            <span className="badge bg-info-subtle text-info" key={ref.id}>
              <bdi>{localizedText(ref.labels, preferred)}</bdi>
            </span>
          ))}
        </div>
      ) : null}
      {version.source_links?.length ? (
        <ul className="mt-3">
          {version.source_links.map((source) => {
            let safe = false;
            try {
              const u = new URL(source.url);
              safe = u.protocol === "https:" && !u.username && !u.password;
            } catch {
              /* display as plain text */
            }
            return (
              <li key={source.url}>
                {safe ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    <bdi>{source.label}</bdi>
                  </a>
                ) : (
                  <bdi>{source.label}</bdi>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
export function ConfirmContent({
  target,
  valid,
  onClose,
  onSaved,
  onUncertain,
  children,
  editorialReview = false,
}: {
  readonly target: ActionTarget;
  readonly valid: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
  readonly children?: ReactNode;
  readonly editorialReview?: boolean;
}) {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  return (
    <ActionDialog
      target={{
        ...target,
        body: {
          ...target.body,
          confirmed,
          ...(editorialReview ? { editorial_confirmed: confirmed } : {}),
        },
      }}
      valid={valid && confirmed}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      {children}
      <label className="form-check my-3">
        <input
          className="form-check-input"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="form-check-label">
          {t(editorialReview ? "content.composer.confirmReview" : "content.confirmChange")}
        </span>
      </label>
    </ActionDialog>
  );
}
export function TaxonomyPicker({
  selected,
  onChange,
  kind: fixedKind,
  disabled = false,
  max = 30,
  excluded,
}: {
  readonly selected: ArticleTerm[];
  readonly onChange: (value: ArticleTerm[]) => void;
  readonly kind?: TermKind;
  readonly disabled?: boolean;
  readonly max?: number;
  readonly excluded?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [kind, setKind] = useState<TermKind>(fixedKind ?? "category");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = { kind: fixedKind ?? kind, q: search, page, per_page: 10, active: "1" };
  const result = useContent("/api/admin/article-taxonomies", query, (wire) =>
    parsePage(wire, (row) => termSchema.parse(row)),
  );
  const prefix = fixedKind ? "content-picker-" + fixedKind : "content-picker";
  const available =
    result.data?.data.filter(
      (term: ArticleTerm) =>
        term.id !== excluded &&
        term.kind === (fixedKind ?? kind) &&
        term.is_active &&
        term.currently_active !== false,
    ) ?? [];
  return (
    <fieldset disabled={disabled}>
      {!fixedKind ? (
        <div className="mb-3">
          <label className="form-label" htmlFor={prefix + "-kind"}>
            {t("content.kind")}
          </label>
          <select
            id={prefix + "-kind"}
            className="form-select"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as TermKind);
              setPage(1);
            }}
          >
            <option value="category">{t("content.kind.category")}</option>
            <option value="tag">{t("content.kind.tag")}</option>
          </select>
        </div>
      ) : null}
      <label className="form-label" htmlFor={prefix + "-search"}>
        {t("content.searchTerms")}
      </label>
      <Select<ArticleTerm, true>
        inputId={prefix + "-search"}
        instanceId={prefix}
        classNamePrefix="react-select"
        isMulti
        isRtl={lang === "fa"}
        isDisabled={disabled}
        isLoading={result.busy}
        options={available}
        value={selected}
        getOptionValue={(term: ArticleTerm) => term.id}
        getOptionLabel={(term: ArticleTerm) => localizedText(term.labels, lang)}
        formatOptionLabel={(term: ArticleTerm) => (
          <div className="text-break">
            <bdi>{localizedText(term.labels, lang)}</bdi>
            {term.labels.en && term.labels.fa ? (
              <small className="d-block text-muted">
                <bdi>{term.labels[lang === "en" ? "fa" : "en"]}</bdi>
              </small>
            ) : null}
          </div>
        )}
        onChange={(values: readonly ArticleTerm[]) => onChange([...values])}
        onInputChange={(value: string, action: { action: string }) => {
          if (action.action === "input-change") {
            setSearch(value);
            setPage(1);
          }
        }}
        inputValue={search}
        filterOption={null}
        isOptionDisabled={(term: ArticleTerm) =>
          !selected.some((value) => value.id === term.id) && selected.length >= max
        }
        closeMenuOnSelect={false}
        menuPlacement="auto"
        placeholder={t("content.selectTerms")}
        noOptionsMessage={() => t("content.emptyTerms")}
      />
      <ContentState busy={result.busy} error={result.error} />
      {result.error ? (
        <button type="button" className="btn btn-light mt-2" onClick={result.refresh}>
          {t("adminReservations.refresh")}
        </button>
      ) : null}
      <PageButtons
        page={result.data?.pagination}
        onPage={setPage}
        disabled={disabled || result.busy}
      />
    </fieldset>
  );
}
export function UncertainNotice({ uncertain }: { readonly uncertain: boolean }) {
  const { t } = useTranslation();
  return uncertain ? (
    <p role="alert" className="alert alert-warning">
      {t("adminManage.uncertain")}
    </p>
  ) : null;
}
export function EmptyContent() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardBody className="text-center py-5">
        <span className="display-5 text-muted ri-article-line" aria-hidden="true" />
        <h5 className="mt-3">{t("content.emptyArticles")}</h5>
        <p className="text-muted">{t("content.emptyHint")}</p>
      </CardBody>
    </Card>
  );
}
