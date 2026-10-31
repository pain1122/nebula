import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader, Col, Row } from "reactstrap";

import { isRecentPasswordCancellation, recentPasswordCoordinator } from "../auth/recentPassword";
import { ErrorState } from "../feedback";
import { mapServerValidation, SelectField, TextareaField, TextField } from "../forms";
import { RecentPasswordDialog, useRecentPasswordDialogPrompt } from "../overlays";
import { formatProductNumber, normalizeProductLocale } from "../preferences/localization";
import {
  parseSizeInput,
  SizeInputError,
  uploadCapacity,
  uploadPolicyDraft,
  uploadPolicyGateway,
  uploadPolicyValue,
  type SizeInput,
  type UploadSetting,
} from "./policy";

export interface UploadPolicyCardProps {
  readonly setting: UploadSetting;
  readonly reload: () => Promise<UploadSetting>;
}

export const UploadPolicyCard = ({ setting, reload }: UploadPolicyCardProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [baseline, setBaseline] = useState(setting);
  const [draft, setDraft] = useState(() => uploadPolicyDraft(setting));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const [needsRead, setNeedsRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const password = useRecentPasswordDialogPrompt();
  const changed = stale || setting.revision !== baseline.revision;
  const id = baseline.key.replace(/\./g, "-");
  const ceiling = uploadCapacity(baseline);
  const title = t(baseline.key === "uploads.medical" ? "uploads.medical" : "uploads.public");
  const byteLabel = (value: number) =>
    `${formatProductNumber(value, locale)} ${t("uploads.bytes")}`;

  useEffect(() => () => operation.current?.abort(), []);

  const accept = (next: UploadSetting) => {
    setBaseline(next);
    setDraft(uploadPolicyDraft(next));
    setStale(false);
    setErrors({});
    setNeedsRead(false);
  };

  const refresh = async () => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailure(null);
    try {
      const next = await reload();
      if (!controller.signal.aborted) accept(next);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(error);
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const validateSize = (input: SizeInput, field: string, nextErrors: Record<string, string>) => {
    try {
      parseSizeInput(input, ceiling);
    } catch (error: unknown) {
      if (!(error instanceof SizeInputError)) throw error;
      nextErrors[field] = t(`uploads.${error.code}`);
    }
  };

  const save = async (reset = false) => {
    if (operation.current || changed || needsRead) return;
    const nextErrors: Record<string, string> = {};
    if (!draft.reason.trim() || draft.reason.trim().length > 1000)
      nextErrors.reason = t("uploads.reasonRequired");
    if (!reset) {
      validateSize(draft.defaultSize, "default", nextErrors);
      for (const mime of baseline.policy.allowed_mime_types) {
        if (draft.types[mime]?.amount.trim()) validateSize(draft.types[mime], mime, nextErrors);
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const value = reset ? ([] as const) : uploadPolicyValue(baseline, draft);
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setSaved(false);
    setFailure(null);
    try {
      await recentPasswordCoordinator.run(
        () => uploadPolicyGateway.save(baseline, value, draft.reason, controller.signal),
        password.prompt,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setSaved(true);
      setNeedsRead(true);
      const next = await reload();
      if (!controller.signal.aborted) accept(next);
    } catch (error: unknown) {
      if (controller.signal.aborted || isRecentPasswordCancellation(error)) return;
      if (mapServerValidation(error, ["expected_revision"])?.fieldErrors.expected_revision)
        setStale(true);
      setFailure(error);
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const sizeFields = (
    input: SizeInput,
    field: string,
    label: string,
    onChange: (input: SizeInput) => void,
    optional = false,
    errorField = field,
  ) => (
    <Row>
      <Col xs={8}>
        <TextField
          id={`${id}-${field}`}
          label={label}
          locale={locale}
          value={input.amount}
          inputMode="decimal"
          maxLength={40}
          required={!optional}
          errorMessages={errors[errorField] ? [errors[errorField]] : []}
          helpText={optional ? t("uploads.inherit") : undefined}
          onChange={(event) => onChange({ ...input, amount: event.currentTarget.value })}
        />
      </Col>
      <Col xs={4}>
        <SelectField
          id={`${id}-${field}-unit`}
          label={t("uploads.unit")}
          locale={locale}
          value={input.unit}
          options={[
            { value: "MiB", label: "MiB" },
            { value: "bytes", label: t("uploads.bytes") },
          ]}
          onChange={(event) => {
            const unit = event.currentTarget.value;
            if (unit === "bytes" || unit === "MiB") onChange({ ...input, unit });
          }}
        />
      </Col>
    </Row>
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };
  return (
    <Card>
      <CardHeader>
        <h2 className="card-title mb-0">{title}</h2>
      </CardHeader>
      <CardBody>
        <p className="text-muted">
          {t("uploads.capacity")}: {byteLabel(baseline.capacity_max_bytes)}
        </p>
        {baseline.scanner_max_bytes !== null ? (
          <p className="text-muted">
            {t("uploads.scannerCapacity")}: {byteLabel(baseline.scanner_max_bytes)}
          </p>
        ) : null}
        <p className="text-muted">
          {t("uploads.configuredDefault")}: {byteLabel(baseline.configured_default_max_bytes)}
        </p>
        {baseline.policy_state === "review_required" ? (
          <div className="alert alert-warning" role="alert">
            {t("uploads.reviewRequired")}
          </div>
        ) : null}
        {changed ? (
          <div className="alert alert-warning" role="alert">
            {t("uploads.changed")}
          </div>
        ) : null}
        {saved ? (
          <output className="alert alert-success d-block">{t("uploads.saved")}</output>
        ) : null}
        {failure ? <ErrorState error={failure} locale={locale} /> : null}
        <form id={`${id}-form`} noValidate onSubmit={submit}>
          <fieldset disabled={busy || changed || needsRead}>
            {sizeFields(draft.defaultSize, "default", t("uploads.default"), (defaultSize) =>
              setDraft({ ...draft, defaultSize }),
            )}
            {baseline.policy.allowed_mime_types.map((mime, index) => (
              <div key={mime}>
                {sizeFields(
                  draft.types[mime],
                  `type-${index}`,
                  mime,
                  (input) => setDraft({ ...draft, types: { ...draft.types, [mime]: input } }),
                  true,
                  mime,
                )}
              </div>
            ))}
            <TextareaField
              id={`${id}-reason`}
              label={t("uploads.reason")}
              locale={locale}
              required
              maxLength={1000}
              value={draft.reason}
              errorMessages={errors.reason ? [errors.reason] : []}
              onChange={(event) => setDraft({ ...draft, reason: event.currentTarget.value })}
            />
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-primary" type="submit">
                {busy ? t("uploads.saving") : t("uploads.save")}
              </button>
              <button className="btn btn-light" type="button" onClick={() => void save(true)}>
                {t("uploads.reset")}
              </button>
            </div>
          </fieldset>
        </form>
        <button
          className="btn btn-link mt-2"
          disabled={busy}
          onClick={() => void refresh()}
          type="button"
        >
          {t("uploads.reload")}
        </button>
        <RecentPasswordDialog
          locale={locale}
          request={password.request}
          onCancel={password.cancel}
          onSubmit={password.submit}
        />
      </CardBody>
    </Card>
  );
};
