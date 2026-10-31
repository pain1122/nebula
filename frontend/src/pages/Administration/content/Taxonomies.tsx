import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader, TabContent, TabPane } from "reactstrap";
import LanguageTabs from "./LanguageTabs";
import {
  conflict,
  contentWrite,
  localizedText,
  parsePage,
  parseTerm,
  parseTermContext,
  readContent,
  termSchema,
  type ArticleTerm,
  type TermKind,
} from "../../../modules/checkupino/content/api";
import {
  ContentAccess,
  ContentPage,
  ContentState,
  ConfirmContent,
  ContentDate,
  PageButtons,
  TaxonomyPicker,
  UncertainNotice,
  useContent,
} from "./Shared";

function TermEditor({
  id,
  kind,
  retire,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly id: string | null;
  readonly kind: TermKind;
  readonly retire: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [termLanguage, setTermLanguage] = useState<"en" | "fa">(
    i18n.resolvedLanguage === "fa" ? "fa" : "en",
  );
  const path = `/api/admin/article-taxonomies${id ? "/" + id : ""}`;
  const contextRead = useContent(path + "/write-context", {}, (wire) => parseTermContext(wire, id));
  const context = contextRead.data;
  const [values, setValues] = useState({
    slug: "",
    en: "",
    fa: "",
    enDescription: "",
    faDescription: "",
    parent: null as string | null,
  });
  const parentRead = useContent(
    values.parent ? "/api/admin/article-taxonomies/" + values.parent : null,
    {},
    (wire) => parseTerm(wire, values.parent ?? undefined),
  );
  const [loaded, setLoaded] = useState<typeof context>();
  if (context && loaded !== context) {
    setLoaded(context);
    setValues({
      slug: context.current?.slug ?? "",
      en: context.current?.labels.en ?? "",
      fa: context.current?.labels.fa ?? "",
      enDescription: context.current?.descriptions.en ?? "",
      faDescription: context.current?.descriptions.fa ?? "",
      parent: context.current?.parent_id ?? null,
    });
  }
  const currentKind = context?.current?.kind ?? kind;
  const permitted =
    !!context && (retire ? context.can_retire : id ? context.can_update : context.can_create);
  const valid =
    permitted &&
    !contextRead.error &&
    !contextRead.busy &&
    (retire ||
      (/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(values.slug) &&
        !!(values.en.trim() || values.fa.trim()) &&
        [values.en, values.fa].every((v) => Array.from(v).length <= 200) &&
        [values.enDescription, values.faDescription].every((v) => Array.from(v).length <= 1000) &&
        (!values.parent ||
          (!!parentRead.data?.is_active && !parentRead.busy && !parentRead.error))));
  const operation = retire ? "retire" : id ? "update" : "create";
  return (
    <ConfirmContent
      target={{
        title: t(`content.term.${operation}`),
        path: retire ? path + "/actions" : path,
        method: id && !retire ? "PUT" : "POST",
        body: {
          expected_revision: context?.revision ?? "",
          ...(retire
            ? { action: "retire" }
            : {
                ...(id ? {} : { kind: currentKind, slug: values.slug }),
                labels: Object.fromEntries(
                  (["en", "fa"] as const)
                    .filter((lang) => values[lang] || context?.current?.labels[lang] !== undefined)
                    .map((lang) => [lang, values[lang]]),
                ),
                descriptions: Object.fromEntries(
                  (["en", "fa"] as const)
                    .filter(
                      (lang) =>
                        values[`${lang}Description`] ||
                        context?.current?.descriptions[lang] !== undefined,
                    )
                    .map((lang) => [lang, values[`${lang}Description`]]),
                ),
                parent_id: currentKind === "category" ? values.parent : null,
              }),
        },
        verify: async (signal) => {
          if (!context) throw conflict();
          const fresh = parseTermContext(
            await readContent(path + "/write-context", {}, signal),
            id,
          );
          if (
            fresh.revision !== context.revision ||
            !(retire ? fresh.can_retire : id ? fresh.can_update : fresh.can_create)
          )
            throw conflict();
        },
        write: async (target, method, body, signal) => {
          const response = await contentWrite(target, method, body, signal);
          parseTerm(response.data, id ?? undefined);
          return response;
        },
      }}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <ContentState busy={contextRead.busy} error={contextRead.error} />
      {contextRead.error || (context && !permitted) ? (
        <p role="alert" className="alert alert-warning">
          {t("content.termBlocked")}
        </p>
      ) : null}
      <fieldset disabled={!permitted || contextRead.busy || contextRead.error}>
        {retire ? (
          <p>{t("content.retireNotice")}</p>
        ) : (
          <>
            <p className="text-muted">{t(`content.kind.${currentKind}`)}</p>
            <label className="form-label" htmlFor="article-term-slug">
              {t("content.slug")}
            </label>
            <input
              id="article-term-slug"
              dir="ltr"
              className="form-control mb-3"
              maxLength={160}
              disabled={!!id}
              value={values.slug}
              onChange={(e) => setValues({ ...values, slug: e.target.value })}
            />
            <Card className="border shadow-none">
              <CardHeader>
                <LanguageTabs
                  id="article-term-content"
                  active={termLanguage}
                  onChange={setTermLanguage}
                  disabled={!permitted}
                />
              </CardHeader>
              <CardBody>
                <TabContent activeTab={termLanguage}>
                  {(["en", "fa"] as const).map((lang) => (
                    <TabPane
                      key={lang}
                      tabId={lang}
                      id={`article-term-content-pane-${lang}`}
                      role="tabpanel"
                      aria-labelledby={`article-term-content-tab-${lang}`}
                      hidden={termLanguage !== lang}
                    >
                      <div lang={lang} dir={lang === "fa" ? "rtl" : "ltr"}>
                        <label className="form-label" htmlFor={`article-term-${lang}`}>
                          {t("content.labelLanguage", { language: t(`content.language.${lang}`) })}
                        </label>
                        <input
                          id={`article-term-${lang}`}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          className="form-control mb-3"
                          value={values[lang]}
                          onChange={(e) => setValues({ ...values, [lang]: e.target.value })}
                        />
                        <label className="form-label" htmlFor={`article-term-description-${lang}`}>
                          {t("content.descriptionLanguage", {
                            language: t(`content.language.${lang}`),
                          })}
                        </label>
                        <textarea
                          id={`article-term-description-${lang}`}
                          dir={lang === "fa" ? "rtl" : "ltr"}
                          className="form-control mb-3"
                          value={values[`${lang}Description`]}
                          onChange={(e) =>
                            setValues({ ...values, [`${lang}Description`]: e.target.value })
                          }
                        />
                      </div>
                    </TabPane>
                  ))}
                </TabContent>
              </CardBody>
            </Card>
            {currentKind === "category" ? (
              <>
                <p>{t("content.parentHint")}</p>
                {values.parent && !parentRead.data ? (
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <bdi>{values.parent}</bdi>
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      onClick={() => setValues({ ...values, parent: null })}
                    >
                      {t("content.clearParent")}
                    </button>
                  </div>
                ) : null}
                <TaxonomyPicker
                  kind="category"
                  max={1}
                  excluded={id ?? undefined}
                  selected={parentRead.data ? [parentRead.data] : []}
                  onChange={(value) => setValues({ ...values, parent: value[0]?.id ?? null })}
                />
              </>
            ) : null}
          </>
        )}
      </fieldset>
    </ConfirmContent>
  );
}
function TermHistory({
  term,
  onClose,
}: {
  readonly term: ArticleTerm;
  readonly onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [page, setPage] = useState(1);
  const result = useContent(
    `/api/admin/article-taxonomies/${term.id}/versions`,
    { page, per_page: 10 },
    (wire) =>
      parsePage(
        wire,
        (v) => termSchema.parse(v),
        (v) => v.version_id,
      ),
  );
  return (
    <Card data-term-history>
      <CardHeader className="d-flex align-items-center flex-wrap gap-2">
        <h5 className="card-title mb-0 flex-grow-1">
          {t("content.history")}: <bdi>{localizedText(term.labels, lang)}</bdi>
        </h5>
        <button type="button" className="btn btn-light" onClick={onClose}>
          {t("content.close")}
        </button>
      </CardHeader>
      <CardBody>
        <ContentState busy={result.busy} error={result.error} />
        {result.error ? (
          <button className="btn btn-light" type="button" onClick={result.refresh}>
            {t("adminReservations.refresh")}
          </button>
        ) : null}
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                {["version", "title", "state", "actor", "recorded"].map((v) => (
                  <th key={v}>{t(`content.${v}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data?.data.map((v) => (
                <tr key={v.version_id}>
                  <td>{v.version}</td>
                  <td>
                    <bdi>{localizedText(v.labels, lang)}</bdi>
                  </td>
                  <td>{t(v.is_active ? "content.active" : "content.inactive")}</td>
                  <td>
                    <bdi>{v.actor?.name ?? "—"}</bdi>
                  </td>
                  <td>
                    <ContentDate value={v.recorded_at ?? null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PageButtons page={result.data?.pagination} onPage={setPage} disabled={result.busy} />
      </CardBody>
    </Card>
  );
}
function TaxonomySession() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === "fa" ? "fa" : "en";
  const [kind, setKind] = useState<"category" | "tag">("category");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("all");
  const [page, setPage] = useState(1);
  const [epoch, setEpoch] = useState(0);
  const [modal, setModal] = useState<{ id: string | null; retire: boolean } | null>(null);
  const [history, setHistory] = useState<ArticleTerm | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const result = useContent(
    "/api/admin/article-taxonomies",
    { kind, q: search, active, page, per_page: 20 },
    (wire) => parsePage(wire, (v) => termSchema.parse(v)),
  );
  const [observed, setObserved] = useState<typeof result.data>();
  if (result.data && observed !== result.data) {
    setObserved(result.data);
    setUncertain(false);
  }
  return (
    <ContentPage title={t("content.taxonomies")}>
      <Card>
        <CardHeader>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <h5 className="card-title mb-0 flex-grow-1">{t("content.taxonomies")}</h5>
            <button
              type="button"
              className="btn btn-primary"
              disabled={uncertain}
              onClick={() => setModal({ id: null, retire: false })}
            >
              {t("content.term.create")}
            </button>
            <button
              type="button"
              className="btn btn-light"
              disabled={result.busy}
              onClick={result.refresh}
            >
              {t("adminReservations.refresh")}
            </button>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-muted">{t("content.taxonomyHint")}</p>
          <UncertainNotice uncertain={uncertain} />
          <div className="d-flex flex-wrap gap-2 mb-3">
            {(["category", "tag"] as const).map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={kind === v}
                className={kind === v ? "btn btn-primary" : "btn btn-light"}
                onClick={() => {
                  setKind(v);
                  setPage(1);
                  setHistory(null);
                }}
              >
                {t(`content.tabs.${v}`)}
              </button>
            ))}
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-8">
              <label className="form-label" htmlFor="taxonomy-search">
                {t("content.searchTerms")}
              </label>
              <input
                id="taxonomy-search"
                type="search"
                className="form-control"
                maxLength={120}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="taxonomy-active">
                {t("content.state")}
              </label>
              <select
                id="taxonomy-active"
                className="form-select"
                value={active}
                onChange={(e) => {
                  setActive(e.target.value);
                  setPage(1);
                }}
              >
                {[
                  ["all", "content.all"],
                  ["1", "content.active"],
                  ["0", "content.inactive"],
                ].map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(key!)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ContentState busy={result.busy} error={result.error} />
          <div className="table-responsive">
            <table className="table align-middle table-nowrap">
              <thead>
                <tr>
                  {["title", "slug", "state", "version", "actions"].map((v) => (
                    <th key={v}>{t(`content.${v}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data?.data.map((term) => (
                  <tr key={term.id}>
                    <td>
                      <bdi>{localizedText(term.labels, lang)}</bdi>
                    </td>
                    <td>
                      <bdi>{term.slug}</bdi>
                    </td>
                    <td>{t(term.is_active ? "content.active" : "content.inactive")}</td>
                    <td>{term.version}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-soft-primary"
                          disabled={!term.is_active || uncertain}
                          aria-label={t("content.term.update")}
                          onClick={() => setModal({ id: term.id, retire: false })}
                        >
                          {t("content.term.update")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-soft-danger"
                          disabled={!term.is_active || uncertain}
                          onClick={() => setModal({ id: term.id, retire: true })}
                        >
                          {t("content.term.retire")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light"
                          onClick={() => setHistory(term)}
                        >
                          {t("content.history")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.data?.data.length === 0 ? <p>{t("content.emptyTerms")}</p> : null}
          <PageButtons page={result.data?.pagination} onPage={setPage} disabled={result.busy} />
        </CardBody>
      </Card>
      {history ? (
        <TermHistory
          key={history.id + ":" + epoch}
          term={history}
          onClose={() => setHistory(null)}
        />
      ) : null}
      {modal ? (
        <TermEditor
          id={modal.id}
          kind={kind}
          retire={modal.retire}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setEpoch((v) => v + 1);
            result.refresh();
          }}
          onUncertain={() => setUncertain(true)}
        />
      ) : null}
    </ContentPage>
  );
}
export default function Taxonomies() {
  return (
    <ContentAccess>
      <TaxonomySession />
    </ContentAccess>
  );
}
