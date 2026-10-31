import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader, Col, Row } from "reactstrap";
import {
  healthProfile,
  readHealth,
  healthChanges,
  lifestyleCodes,
  healthStatuses,
} from "../../modules/checkupino/profiles/health";
import type {
  HealthFacts,
  HealthMetric,
  HealthProfile,
  MeasurementDraft,
} from "../../modules/checkupino/profiles/health";
import { clinicalRequest } from "../../modules/checkupino/profiles/onboarding";
import {
  useClinicalRead,
  useClinicalWrite,
} from "../../modules/checkupino/profiles/useClinicalWrite";
import { RecentPasswordDialog } from "../../modules/checkupino/overlays";
import {
  formatProductDate,
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import HealthTaxonomy from "./HealthTaxonomy";

function HealthSummary({ profile }: { readonly profile: HealthProfile }) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage);
  const answer = (value: string | null | undefined) => t(`health.${value ?? "unanswered"}`);
  return (
    <div className="card bg-light border-0">
      <CardBody>
        <h5>{t("health.summary")}</h5>
        <dl>
          <dt>{t("health.birth_date")}</dt>
          <dd>
            {profile.facts.birth_date
              ? formatProductDate(profile.facts.birth_date, locale)
              : answer(null)}
          </dd>
          <dt>{t("health.age")}</dt>
          <dd>{profile.age === null ? answer(null) : formatProductNumber(profile.age, locale)}</dd>
          <dt>{t("health.gender")}</dt>
          <dd>{answer(profile.facts.gender)}</dd>
          {(["weight", "height"] as const).map((metric) => {
            const item = profile.measurements[metric];
            return (
              <div key={metric}>
                <dt>{t(`health.${metric}`)}</dt>
                <dd>
                  {item ? (
                    <>
                      <bdi>
                        {formatProductNumber(Number(item.value), locale)} {t(`health.${item.unit}`)}
                      </bdi>
                      <br />
                      {t("health.measured_on")}: {formatProductDate(item.measured_on, locale)}
                    </>
                  ) : (
                    answer(null)
                  )}
                </dd>
              </div>
            );
          })}
          <dt>{t("health.bmi")}</dt>
          <dd>{profile.bmi === null ? answer(null) : formatProductNumber(profile.bmi, locale)}</dd>
          {(["conditions", "allergies"] as const).map((kind) => {
            const selected = profile.facts[kind];
            return (
              <div key={kind}>
                <dt>{t(`health.${kind}`)}</dt>
                <dd>
                  {selected?.status === "yes" ? (
                    <>
                      {t("health.hasReported")}
                      <ul className="mb-1">
                        {selected.codes.map((code) => (
                          <li key={code}>
                            {profile.catalog.terms.find((term) => term.id === code)?.labels[
                              locale
                            ] ?? t("health.retiredTerm")}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : selected?.status === "no" ? (
                    t("health.noneReported")
                  ) : (
                    answer(selected?.status)
                  )}
                </dd>
              </div>
            );
          })}
          {lifestyleCodes.map((code) => (
            <div key={code}>
              <dt>{t(`health.${code}`)}</dt>
              <dd>{answer(profile.facts[code])}</dd>
            </div>
          ))}
        </dl>
        <p className="small text-muted mb-0">{t("health.bmiHint")}</p>
      </CardBody>
    </div>
  );
}

function HealthEditor({
  profile,
  onCancel,
  onSaved,
  onRefresh,
}: {
  readonly profile: HealthProfile;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
  readonly onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation(),
    write = useClinicalWrite("patient-health");
  const [draft, setDraft] = useState<HealthFacts>(() => ({ ...profile.facts }));
  const [measurements, setMeasurements] = useState<Record<HealthMetric, MeasurementDraft>>(() => ({
    weight: profile.measurements.weight ? { ...profile.measurements.weight } : null,
    height: profile.measurements.height ? { ...profile.measurements.height } : null,
  }));
  const [confirmed, setConfirmed] = useState(false);
  const patch = healthChanges(profile, draft, measurements);
  const changed = Object.keys(patch.changes).length + Object.keys(patch.measurements).length > 0;
  const setMeasurement = (metric: HealthMetric, field: "value" | "measured_on", value: string) =>
    setMeasurements((previous) => ({
      ...previous,
      [metric]: {
        value: previous[metric]?.value ?? "",
        measured_on: previous[metric]?.measured_on ?? "",
        [field]: value,
      },
    }));
  return (
    <>
      {write.failure && (
        <p role="alert" className="alert alert-danger">
          {t(write.failure)}
        </p>
      )}
      {write.uncertain && (
        <p role="alert" className="alert alert-warning">
          {t("health.uncertain")}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirmed || !changed) return;
          void write.run(
            async (signal) => {
              const fresh = await readHealth(signal);
              if (fresh.owner_id !== profile.owner_id) throw new Error("Owner changed");
              return fresh;
            },
            profile.revision,
            (signal) =>
              clinicalRequest("PUT", "/api/my/health-profile", healthProfile, signal, {
                ...patch,
                catalog_version: profile.catalog.version,
                expected_revision: profile.revision,
                confirmed: true,
              }),
            (receipt) => {
              if (receipt.owner_id === profile.owner_id) onSaved();
            },
          );
        }}
      >
        <fieldset disabled={write.busy || write.uncertain}>
          <Row className="g-3 mb-3">
            <Col md={6}>
              <label className="form-label" htmlFor="health-birth">
                {t("health.birthGregorian")}
              </label>
              <input
                id="health-birth"
                className="form-control"
                type="date"
                min="1900-01-01"
                value={draft.birth_date ?? ""}
                onChange={(e) => setDraft((v) => ({ ...v, birth_date: e.target.value || null }))}
              />
            </Col>
            <Col md={6}>
              <label className="form-label" htmlFor="health-gender">
                {t("health.gender")}
              </label>
              <select
                id="health-gender"
                className="form-select"
                value={draft.gender ?? ""}
                onChange={(e) =>
                  setDraft((v) => ({
                    ...v,
                    gender: e.target.value ? (e.target.value as "male" | "female") : null,
                  }))
                }
              >
                <option value="">{t("health.unanswered")}</option>
                <option value="male">{t("health.male")}</option>
                <option value="female">{t("health.female")}</option>
              </select>
            </Col>
          </Row>
          <p className="text-muted small">{t("health.dateHint")}</p>
          <Row className="g-3 mb-3">
            {(["weight", "height"] as const).map((metric) => (
              <Col md={6} key={metric}>
                <fieldset className="border rounded p-3">
                  <legend className="float-none w-auto fs-6 px-1">
                    {t(`health.${metric}`)} ({t(metric === "weight" ? "health.kg" : "health.cm")})
                  </legend>
                  <label htmlFor={`health-${metric}`} className="form-label">
                    {t("health.quantity")}
                  </label>
                  <input
                    id={`health-${metric}`}
                    className="form-control mb-2"
                    inputMode="decimal"
                    required={!!measurements[metric]}
                    maxLength={8}
                    value={measurements[metric]?.value ?? ""}
                    onChange={(e) => setMeasurement(metric, "value", e.target.value)}
                  />
                  <label className="form-label" htmlFor={`health-${metric}-date`}>
                    {t("health.measuredGregorian")}
                  </label>
                  <input
                    id={`health-${metric}-date`}
                    className="form-control"
                    type="date"
                    min="1900-01-01"
                    required={!!measurements[metric]}
                    value={measurements[metric]?.measured_on ?? ""}
                    onChange={(e) => setMeasurement(metric, "measured_on", e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-light mt-2"
                    onClick={() => setMeasurements((v) => ({ ...v, [metric]: null }))}
                  >
                    {t("health.clearMeasurement")}
                  </button>
                </fieldset>
              </Col>
            ))}
          </Row>
          <p className="text-muted small">{t("health.decimalHint")}</p>
          {(["conditions", "allergies"] as const).map((kind) => (
            <HealthTaxonomy
              key={kind}
              kind={kind}
              catalog={profile.catalog}
              value={draft[kind]}
              onChange={(value) => setDraft((v) => ({ ...v, [kind]: value }))}
            />
          ))}
          <Row className="g-3 mb-3">
            {lifestyleCodes.map((code) => (
              <Col md={6} key={code}>
                <label className="form-label" htmlFor={`health-${code}`}>
                  {t(`health.${code}`)}
                </label>
                <select
                  id={`health-${code}`}
                  className="form-select"
                  value={draft[code] ?? ""}
                  onChange={(e) => setDraft((v) => ({ ...v, [code]: e.target.value || null }))}
                >
                  <option value="">{t("health.unanswered")}</option>
                  {healthStatuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`health.${s}`)}
                    </option>
                  ))}
                </select>
              </Col>
            ))}
          </Row>
          <label className="form-check my-3">
            <input
              type="checkbox"
              className="form-check-input"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="form-check-label">{t("health.confirm")}</span>
          </label>
        </fieldset>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!changed || !confirmed || write.busy || write.uncertain}
          >
            {t(write.busy ? "users.saving" : "users.save")}
          </button>
          <button type="button" className="btn btn-light" disabled={write.busy} onClick={onCancel}>
            {t("users.cancel")}
          </button>
          {write.uncertain && (
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                void readHealth(new AbortController().signal)
                  .then((fresh) => {
                    if (fresh.owner_id === profile.owner_id) {
                      write.refresh();
                      onRefresh();
                    }
                  })
                  .catch(() => {});
              }}
            >
              {t("adminReservations.refresh")}
            </button>
          )}
        </div>
      </form>
      <RecentPasswordDialog
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        onCancel={write.password.cancel}
        onSubmit={write.password.submit}
        request={write.password.request}
      />
    </>
  );
}

export default function PatientHealth({ ownerId }: { readonly ownerId: string }) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage);
  const read = useClinicalRead("/api/my/health-profile", healthProfile);
  const profile = read.data?.owner_id === ownerId ? read.data : null;
  const [editing, setEditing] = useState(false),
    [saved, setSaved] = useState(false);
  const refresh = () => {
    setEditing(false);
    read.refetch();
  };
  return (
    <Card id="patient-health">
      <CardHeader className="d-flex align-items-center flex-wrap gap-2">
        <h5 className="card-title flex-grow-1 mb-0">{t("health.title")}</h5>
        <button className="btn btn-light" disabled={editing} onClick={refresh}>
          {t("adminReservations.refresh")}
        </button>
        {profile && !editing && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            {t("health.edit")}
          </button>
        )}
      </CardHeader>
      <CardBody>
        <p className="alert alert-info">{t("health.selfReport")}</p>
        {profile?.recorded_at && (
          <p className="text-muted small">
            {t("health.updated")}: {formatProductTimestamp(profile.recorded_at, locale)}
          </p>
        )}
        {saved && <output className="alert alert-success d-block">{t("users.saved")}</output>}
        {read.error || (read.data && !profile) ? (
          <p role="alert" className="alert alert-warning">
            {t("health.unavailable")}
          </p>
        ) : !profile ? (
          <output>{t("adminReservations.loading")}</output>
        ) : (
          <Row>
            <Col lg={8}>
              {editing ? (
                <HealthEditor
                  key={profile.revision}
                  profile={profile}
                  onCancel={() => setEditing(false)}
                  onRefresh={refresh}
                  onSaved={() => {
                    setSaved(true);
                    refresh();
                  }}
                />
              ) : (
                <>
                  <p>{t("health.intro")}</p>
                  <details>
                    <summary>{t("health.history")}</summary>
                    {(["weight", "height"] as const).map((metric) => (
                      <div key={metric} className="mt-3">
                        <h6>{t(`health.${metric}`)}</h6>
                        {profile.history[metric].length === 0 ? (
                          <p>{t("health.noHistory")}</p>
                        ) : (
                          <ul>
                            {profile.history[metric].map((item) => (
                              <li key={item.id}>
                                <bdi>
                                  {formatProductNumber(Number(item.value), locale)}{" "}
                                  {t(`health.${item.unit}`)}
                                </bdi>{" "}
                                — {formatProductDate(item.measured_on, locale)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {profile.history_truncated[metric] && (
                          <p className="text-muted">{t("health.historyLimit")}</p>
                        )}
                      </div>
                    ))}
                  </details>
                </>
              )}
            </Col>
            <Col lg={4}>
              <HealthSummary profile={profile} />
            </Col>
          </Row>
        )}
      </CardBody>
    </Card>
  );
}
