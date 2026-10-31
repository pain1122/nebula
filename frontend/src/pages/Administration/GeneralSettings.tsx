import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader, Col, Container, Row } from "reactstrap";
import BreadCrumb from "../../Components/Common/BreadCrumb";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";
import {
  generalRuntimeValue,
  generalSettingKeys,
  generalSettingNames,
  parseGeneralDraft,
  readGeneralPair,
  settingFor,
  type GeneralChange,
  type GeneralPair,
  type GeneralScope,
  type GeneralSettingKey,
} from "../../modules/checkupino/settings/general";
import GeneralSettingEditor from "./GeneralSettingEditor";

function SettingCard({
  pair,
  scope,
  settingKey,
  onAction,
}: {
  readonly pair: GeneralPair;
  readonly scope: GeneralScope;
  readonly settingKey: GeneralSettingKey;
  readonly onAction: (change: GeneralChange) => void;
}) {
  const { t } = useTranslation();
  const row = settingFor(pair, scope, settingKey);
  const name = generalSettingNames[settingKey];
  const [draft, setDraft] = useState(String(row.value ?? row.effective_value));
  const parsed = parseGeneralDraft(settingKey, draft);
  return (
    <Card data-general-setting={name}>
      <CardHeader>
        <h2 className="card-title mb-0">{t(`generalSettings.${name}`)}</h2>
      </CardHeader>
      <CardBody>
        <p className="text-muted">{t(`generalSettings.${name}Hint`)}</p>
        <dl className="row">
          {(
            [
              ["override", row.stored ? row.value : t("generalSettings.none")],
              ["effective", row.effective_value],
              ["runtime", generalRuntimeValue(pair, settingKey)],
            ] as const
          ).map(([label, value]) => (
            <div className="col-sm-6" key={label}>
              <dt>{t(`generalSettings.${label}`)}</dt>
              <dd>
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
          {name === "hold" ? (
            <div className="col-sm-6">
              <dt>{t("generalSettings.operatorFallback")}</dt>
              <dd>
                <bdi>{row.runtime_default}</bdi>
              </dd>
            </div>
          ) : null}
        </dl>
        <p>
          {t("generalSettings.source")}: {t(`generalSettings.${row.effective_source}`)}
        </p>
        {scope === "platform" && settingFor(pair, "site", settingKey).stored ? (
          <p className="alert alert-info">
            {t("generalSettings.siteWins")} <bdi>{settingFor(pair, "site", settingKey).value}</bdi>
          </p>
        ) : null}
        <label className="form-label" htmlFor={`general-${name}`}>
          {t("generalSettings.newValue", { setting: t(`generalSettings.${name}`) })}
        </label>
        <input
          id={`general-${name}`}
          className="form-control mb-2"
          dir="ltr"
          value={draft}
          maxLength={name === "hold" ? 3 : name === "currency" ? 3 : 100}
          inputMode={name === "hold" ? "numeric" : "text"}
          onChange={(event) => setDraft(event.target.value)}
          aria-invalid={parsed === null}
          aria-describedby={`general-${name}-help`}
        />
        <p className="text-muted" id={`general-${name}-help`}>
          {t(`generalSettings.${name}Format`)}
        </p>
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            type="button"
            disabled={parsed === null || (row.stored && row.value === parsed)}
            onClick={() => onAction({ key: settingKey, scope, operation: "set", value: parsed })}
          >
            {t("generalSettings.save")}
          </button>
          <button
            className="btn btn-light"
            type="button"
            disabled={!row.stored}
            onClick={() => onAction({ key: settingKey, scope, operation: "reset", value: null })}
          >
            {t("generalSettings.reset")}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

function Workspace({
  scope,
  onScope,
}: {
  readonly scope: GeneralScope;
  readonly onScope: (scope: GeneralScope) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [pair, setPair] = useState<GeneralPair | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const [action, setAction] = useState<GeneralChange | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void readGeneralPair(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setPair(value);
          setUncertain(false);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      });
    return () => controller.abort();
  }, [version]);
  const refresh = () => {
    setAction(null);
    setPair(null);
    setError(null);
    setVersion((value) => value + 1);
  };
  return (
    <>
      <fieldset disabled={action !== null} className="mb-3">
        <label htmlFor="general-scope" className="form-label">
          {t("generalSettings.scope")}
        </label>
        <select
          id="general-scope"
          className="form-select mb-3"
          value={scope}
          onChange={(event) => onScope(event.target.value === "site" ? "site" : "platform")}
        >
          <option value="platform">{t("generalSettings.platform")}</option>
          <option value="site">{t("generalSettings.site")}</option>
        </select>
        <button type="button" className="btn btn-light" onClick={refresh}>
          {t("generalSettings.refresh")}
        </button>
      </fieldset>
      {uncertain ? (
        <p role="alert" className="alert alert-warning">
          {t("adminManage.uncertain")}
        </p>
      ) : null}
      {error ? (
        <ErrorState error={error} locale={locale} onRetry={refresh} />
      ) : !pair ? (
        <LoadingState locale={locale} />
      ) : (
        <fieldset disabled={action !== null || uncertain}>
          <Row key={`${pair.platform.revision}:${pair.site.revision}:${version}`}>
            {generalSettingKeys.map((key) => (
              <Col xl={4} lg={6} key={key}>
                <SettingCard pair={pair} scope={scope} settingKey={key} onAction={setAction} />
              </Col>
            ))}
          </Row>
        </fieldset>
      )}
      {action && pair ? (
        <GeneralSettingEditor
          baseline={pair}
          change={action}
          onClose={() => setAction(null)}
          onSaved={refresh}
          onUncertain={() => setUncertain(true)}
        />
      ) : null}
    </>
  );
}

export default function GeneralSettings() {
  const { t } = useTranslation();
  const { capabilities, userProfile } = useShellAuth();
  const [scope, setScope] = useState<GeneralScope>("platform");
  useEffect(() => {
    document.title = t("generalSettings.title");
  }, [t]);
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb
          title={t("generalSettings.title")}
          pageTitle={t("product.navigation.productAdmin")}
        />
        <p className="text-muted">{t("generalSettings.description")}</p>
        {capabilities.managePlatformConfiguration && userProfile ? (
          <Workspace
            key={`${userProfile.id}:${userProfile.roles.join(",")}:${scope}`}
            scope={scope}
            onScope={setScope}
          />
        ) : (
          <div role="alert" className="alert alert-danger">
            {t("uploads.rootOnly")}
          </div>
        )}
      </Container>
    </div>
  );
}
