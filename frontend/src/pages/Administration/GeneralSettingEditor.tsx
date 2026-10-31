import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TransportError } from "../../modules/checkupino/api/wire";
import {
  generalRuntimeValue,
  generalSettingNames,
  generalSettingPath,
  generalWriteFor,
  settingFor,
  verifyGeneralPair,
  type GeneralChange,
  type GeneralPair,
} from "../../modules/checkupino/settings/general";
import ActionDialog from "./ActionDialog";

export default function GeneralSettingEditor({
  baseline,
  change,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly baseline: GeneralPair;
  readonly change: GeneralChange;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const row = settingFor(baseline, change.scope, change.key);
  const inherited =
    change.scope === "site"
      ? settingFor(baseline, "platform", change.key).effective_value
      : row.default;
  useEffect(() => {
    const controller = new AbortController();
    void verifyGeneralPair(baseline, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [baseline]);
  return (
    <ActionDialog
      target={{
        title: t(change.operation === "reset" ? "generalSettings.reset" : "generalSettings.save"),
        path: generalSettingPath(change.key),
        method: "PUT",
        body: {
          operation: change.operation,
          scope_type: change.scope,
          scope_key: row.scope_key,
          expected_revision: baseline[change.scope].revision,
          confirmed,
          ...(change.operation === "set" ? { value: change.value } : {}),
        },
        verify: async (signal) => {
          try {
            if (!ready || failed) throw new Error("Setting preview unavailable.");
            await verifyGeneralPair(baseline, signal);
          } catch (error) {
            if (!signal.aborted) setFailed(true);
            throw error;
          }
        },
        write: async (...args) => {
          try {
            return await generalWriteFor(baseline, change)(...args);
          } catch (error) {
            if (error instanceof TransportError && [401, 403, 409].includes(error.wire.status ?? 0))
              setFailed(true);
            throw error;
          }
        },
      }}
      valid={ready && !failed && confirmed}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <p>
        <strong>{t(`generalSettings.${generalSettingNames[change.key]}`)}</strong> —{" "}
        {t(`generalSettings.${change.scope}`)}
      </p>
      <p className="text-muted">{t(`generalSettings.${generalSettingNames[change.key]}Hint`)}</p>
      {!ready && !failed ? <output>{t("adminManage.loading")}</output> : null}
      {failed ? (
        <p className="alert alert-warning" role="alert">
          {t("generalSettings.stale")}
        </p>
      ) : null}
      <dl className="row" data-general-setting-preview>
        {(
          [
            ["override", row.stored ? row.value : t("generalSettings.none")],
            ["proposed", change.operation === "reset" ? inherited : change.value],
            ["runtimeBefore", generalRuntimeValue(baseline, change.key)],
            ["runtimeAfter", generalRuntimeValue(baseline, change.key, change)],
          ] as const
        ).map(([label, value]) => (
          <div className="col-sm-6" key={label}>
            <dt>{t(`generalSettings.${label}`)}</dt>
            <dd>
              <bdi>{value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      {change.operation === "reset" ? <p>{t("generalSettings.resetHint")}</p> : null}
      {settingFor(baseline, "site", change.key).stored && change.scope === "platform" ? (
        <p className="alert alert-info">{t("generalSettings.siteWins")}</p>
      ) : null}
      <label className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          checked={confirmed}
          disabled={!ready || failed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span className="form-check-label">{t("generalSettings.confirm")}</span>
      </label>
    </ActionDialog>
  );
}
