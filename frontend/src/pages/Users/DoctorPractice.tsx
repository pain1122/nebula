import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader, Col, Row } from "reactstrap";
import { adminAuthAuthority } from "../../modules/checkupino/auth/authority";
import {
  isRecentPasswordCancellation,
  recentPasswordCoordinator,
} from "../../modules/checkupino/auth/recentPassword";
import { TransportError } from "../../modules/checkupino/api/wire";
import {
  Dialog,
  RecentPasswordDialog,
  useRecentPasswordDialogPrompt,
} from "../../modules/checkupino/overlays";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  formatProductNumber,
  normalizeNumericInput,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import {
  useDoctorPracticeQuery,
  readPractice,
  savePractice,
  practicePending,
  markPracticePending,
  type DoctorPractice as Practice,
  type PracticeWrite,
} from "../../modules/checkupino/profiles/practice";

import WorkingHoursEditor from "./WorkingHoursEditor";
import DoctorLocationEditor from "./DoctorLocationEditor";
import {
  shiftsFromAvailability,
  availabilityFromShifts,
  workingHoursError,
} from "../../modules/checkupino/profiles/workingHours";

export default function DoctorPractice({ ownerId }: { readonly ownerId: number }) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage);
  const query = useDoctorPracticeQuery(undefined, { refetchOnMountOrArgChange: true });
  const [editing, setEditing] = useState<number | null>(null),
    [uncertain, setUncertain] = useState(() => practicePending(ownerId)),
    [saved, setSaved] = useState(false);
  const [locationEditing, setLocationEditing] = useState<number | null>(null);
  const row =
    !query.error && !query.isFetching && query.currentData?.owner_id === ownerId
      ? query.currentData
      : undefined;
  const refresh = async () => {
    setEditing(null);
    setSaved(false);
    const result = await query.refetch();
    if (!result.error && result.data?.owner_id === ownerId) {
      markPracticePending(ownerId, false);
      setUncertain(false);
    }
  };
  return (
    <section id="doctor-practice" aria-label={t("doctorPractice.title")}>
      <Card>
        <CardHeader className="d-flex align-items-center justify-content-between gap-2">
          <h2 className="h5 mb-0">{t("doctorPractice.title")}</h2>
          <button
            className="btn btn-light btn-sm"
            disabled={query.isFetching}
            onClick={() => void refresh()}
          >
            {t("adminReservations.refresh")}
          </button>
        </CardHeader>
        <CardBody>
          {saved && <output className="alert alert-success d-block">{t("users.saved")}</output>}
          {uncertain && (
            <p role="alert" className="alert alert-warning">
              {t("profileOverview.refreshRequired")}
            </p>
          )}
          {query.isFetching ? (
            <LoadingState locale={locale} />
          ) : query.error ? (
            <ErrorState error={query.error} locale={locale} onRetry={() => void refresh()} />
          ) : !row ? (
            <p role="alert">{t("adminManage.unavailable")}</p>
          ) : (
            <>
              <Row className="g-3">
                <Col md={6}>
                  <h3 className="h6">{t("doctorPractice.specialties")}</h3>
                  <p dir="auto">
                    {row.professional.specialty_ids
                      .map(
                        (id) =>
                          row.specialty_options.find((s) => s.id === id)?.name ??
                          t("doctorPractice.archivedSpecialty"),
                      )
                      .join(" / ") || t("booking.specialtyMissing")}
                  </p>
                  <p>
                    {t("booking.experienceYears", {
                      years: formatProductNumber(row.professional.experience_years, locale),
                    })}
                  </p>
                  <span className="badge bg-info-subtle text-info">
                    {t(row.verified ? "doctorPractice.verified" : "doctorPractice.unverified")}
                  </span>
                </Col>
                <Col md={6}>
                  <h3 className="h6">{t("doctorPractice.bio")}</h3>
                  <p dir="auto" className="text-break" style={{ whiteSpace: "pre-wrap" }}>
                    {row.professional.bio || t("profileOverview.empty")}
                  </p>
                  <p>
                    {t("doctorPractice.baseFee")}:{" "}
                    {formatProductNumber(row.professional.fee, locale)}
                  </p>
                </Col>
              </Row>
              <button
                className="btn btn-primary mt-3"
                disabled={uncertain}
                onClick={() => setEditing(0)}
              >
                {t("doctorPractice.editProfessional")}
              </button>
              <button
                className="btn btn-soft-primary mt-3 ms-2"
                disabled={uncertain}
                onClick={() => setLocationEditing(0)}
              >
                {t("onboarding.addLocation")}
              </button>
            </>
          )}
        </CardBody>
      </Card>
      {row && (
        <Row className="g-3">
          {row.workplaces.map((workplace) => (
            <Col xl={6} key={workplace.id}>
              <Card className="h-100">
                <CardHeader className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <div>
                    <h3 className="h5 mb-1" dir="auto">
                      {workplace.name}
                    </h3>
                    <bdi className="text-muted">{workplace.timezone}</bdi>
                  </div>
                  <button
                    className="btn btn-soft-primary"
                    disabled={!workplace.active || uncertain}
                    onClick={() => setEditing(workplace.id)}
                  >
                    {t("doctorPractice.editDays")}
                  </button>
                </CardHeader>
                <CardBody>
                  {!workplace.active && <p>{t("doctorPractice.inactiveLocation")}</p>}
                  <h4 className="h6">{t("doctorPractice.services")}</h4>
                  <p className="text-muted" dir="auto">
                    {[workplace.city, workplace.address].filter(Boolean).join(" / ")}
                  </p>
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    {workplace.services.map((service) => (
                      <span
                        className={
                          "badge " +
                          (service.active
                            ? "bg-info-subtle text-info"
                            : "bg-secondary-subtle text-secondary")
                        }
                        key={service.id}
                      >
                        {service.title}
                        {service.price !== undefined && (
                          <>
                            {" "}
                            —{" "}
                            <bdi>
                              {formatProductNumber(service.price, locale)} {service.currency}
                            </bdi>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn btn-soft-info btn-sm mb-3"
                    disabled={!workplace.active || uncertain}
                    onClick={() => setLocationEditing(workplace.id)}
                  >
                    {t("onboarding.doctorPrices")}
                  </button>
                  {!workplace.availability.length && (
                    <p className="text-muted">{t("doctorPractice.noDays")}</p>
                  )}
                  {workplace.availability.map((day) => (
                    <div className="border rounded p-3 mb-2" key={day.day}>
                      <h4 className="h6">{t("doctorPractice.day." + day.day)}</h4>
                      {day.windows.map((window, index) => (
                        <div key={index} className="mb-2">
                          <p className="mb-1">
                            <bdi>
                              {window.start} - {window.end}
                            </bdi>
                            {" / "}
                            {workplace.services.find((s) => s.id === window.checkup_id)?.title ??
                              t("adminManage.unavailable")}
                            {" / "}
                            {t("doctorPractice.minutes", {
                              count: window.duration_minutes,
                              amount: formatProductNumber(window.duration_minutes, locale),
                            })}
                          </p>
                          {window.breaks.map((pause, pauseIndex) => (
                            <p className="small text-muted mb-1" key={pauseIndex}>
                              {t("doctorPractice.breaks")}:{" "}
                              <bdi>
                                {pause.start} - {pause.end}
                              </bdi>
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      {row && editing !== null && !uncertain && (
        <PracticeEditor
          key={row.revision + ":" + editing}
          practice={row}
          workplaceId={editing}
          onClose={() => setEditing(null)}
          onUncertain={() => {
            setUncertain(true);
            setEditing(null);
          }}
          onSaved={() => {
            setEditing(null);
            setSaved(true);
            void query.refetch();
          }}
        />
      )}
      {row && locationEditing !== null && (
        <DoctorLocationEditor
          key={row.revision + ":location:" + locationEditing}
          practice={row}
          workplaceId={locationEditing}
          onClose={() => setLocationEditing(null)}
          onRefresh={() => {
            setLocationEditing(null);
            void query.refetch();
          }}
          onSaved={() => {
            setLocationEditing(null);
            setSaved(true);
            void query.refetch();
          }}
        />
      )}
    </section>
  );
}

function PracticeEditor({
  practice,
  workplaceId,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly practice: Practice;
  readonly workplaceId: number;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage),
    password = useRecentPasswordDialogPrompt();
  const workplace = practice.workplaces.find((w) => w.id === workplaceId);
  const [professional, setProfessional] = useState(() => ({
    ...practice.professional,
    specialty_ids: [...practice.professional.specialty_ids],
  }));
  const [shifts, setShifts] = useState(() => shiftsFromAvailability(workplace?.availability ?? []));
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const cancelPassword = password.cancel;
  const handlers = useRef({ onClose, cancelPassword });
  useEffect(() => {
    handlers.current = { onClose, cancelPassword };
  }, [onClose, cancelPassword]);
  useEffect(() => {
    const stop = adminAuthAuthority.subscribe(() => {
      const auth = adminAuthAuthority.getSnapshot();
      if (auth.status !== "authenticated" || auth.identity?.id !== practice.owner_id) {
        operation.current?.abort();
        handlers.current.cancelPassword();
        handlers.current.onClose();
      }
    });
    return () => {
      stop();
      operation.current?.abort();
    };
  }, [practice.owner_id]);
  const payload = (): PracticeWrite =>
    workplaceId === 0
      ? {
          mode: "professional",
          ...professional,
          primary_specialty_id: professional.primary_specialty_id ?? 0,
        }
      : {
          mode: "weekly",
          workplace_id: workplaceId,
          availability: availabilityFromShifts(shifts),
        };
  const valid =
    reason.trim().length > 0 &&
    reason.trim().length <= 1000 &&
    confirmed &&
    (workplaceId === 0 ||
      !workingHoursError(
        shifts,
        workplace?.services.filter((s) => s.active).map((s) => s.id) ?? [],
      )) &&
    (workplaceId !== 0 ||
      (professional.specialty_ids.length > 0 &&
        professional.primary_specialty_id !== null &&
        professional.specialty_ids.includes(professional.primary_specialty_id)));
  const submit = async () => {
    if (!valid || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailure(null);
    let dispatched = false,
      stale = false;
    try {
      await recentPasswordCoordinator.run(
        async () => {
          const fresh = await readPractice(controller.signal);
          if (fresh.owner_id !== practice.owner_id || fresh.revision !== practice.revision) {
            stale = true;
            throw new Error("Practice revision changed");
          }
          controller.signal.throwIfAborted();
          markPracticePending(practice.owner_id, true);
          dispatched = true;
          const saved = await savePractice(
            {
              ...payload(),
              reason: reason.trim(),
              expected_revision: fresh.revision,
              confirmed: true,
            },
            controller.signal,
          );
          if (saved.owner_id !== practice.owner_id || saved.revision === fresh.revision)
            throw new Error("Practice receipt rejected");
        },
        password.prompt,
        { signal: controller.signal },
      );
      markPracticePending(practice.owner_id, false);
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isRecentPasswordCancellation(error)) {
        markPracticePending(practice.owner_id, false);
        return;
      }
      const definite =
        error instanceof TransportError && [403, 404, 409, 422].includes(error.wire.status ?? 0);
      if (definite) markPracticePending(practice.owner_id, false);
      if (stale || (dispatched && !definite)) {
        onUncertain();
        return;
      }
      setFailure(stale ? "adminManage.conflict" : "adminManage.rejected");
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const input = (
    label: string,
    id: string,
    value: string | number,
    type: string,
    onChange: (value: string) => void,
    other: Record<string, string | number | boolean> = {},
  ) => (
    <div>
      <label className="form-label" htmlFor={id}>
        {t(label)}
      </label>
      <input
        id={id}
        className="form-control"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...other}
      />
    </div>
  );
  return (
    <>
      <Dialog
        size={workplaceId === 0 ? undefined : "lg"}
        open={!password.request}
        busy={busy}
        locale={locale}
        title={t(workplaceId === 0 ? "doctorPractice.editProfessional" : "doctorPractice.editDays")}
        onClose={onClose}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          aria-label={t("doctorPractice.title")}
        >
          <fieldset disabled={busy}>
            {workplaceId === 0 ? (
              <div className="row g-3">
                <div className="col-12">
                  <fieldset>
                    <legend className="h6">{t("doctorPractice.specialties")}</legend>
                    {practice.specialty_options.map((option) => (
                      <label className="form-check d-block" key={option.id}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={professional.specialty_ids.includes(option.id)}
                          onChange={(event) =>
                            setProfessional((value) => ({
                              ...value,
                              specialty_ids: event.target.checked
                                ? [...value.specialty_ids, option.id]
                                : value.specialty_ids.filter((id) => id !== option.id),
                            }))
                          }
                        />
                        <span className="form-check-label">{option.name}</span>
                      </label>
                    ))}
                  </fieldset>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="practice-primary">
                    {t("doctorPractice.primary")}
                  </label>
                  <select
                    id="practice-primary"
                    className="form-select"
                    value={professional.primary_specialty_id ?? ""}
                    required
                    onChange={(event) =>
                      setProfessional((value) => ({
                        ...value,
                        primary_specialty_id: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">{t("booking.notSelected")}</option>
                    {practice.specialty_options
                      .filter((s) => professional.specialty_ids.includes(s.id))
                      .map((option) => (
                        <option value={option.id} key={option.id}>
                          {option.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-md-6">
                  {input(
                    "doctorPractice.experience",
                    "practice-experience",
                    professional.experience_years,
                    "number",
                    (value) =>
                      setProfessional((p) => ({
                        ...p,
                        experience_years: Number(normalizeNumericInput(value)),
                      })),
                    { min: 0, max: 80, required: true },
                  )}
                </div>
                <div className="col-md-6">
                  {input(
                    "doctorPractice.baseFee",
                    "practice-fee",
                    professional.fee,
                    "number",
                    (value) =>
                      setProfessional((p) => ({ ...p, fee: Number(normalizeNumericInput(value)) })),
                    { min: 0, max: 2147483647, required: true },
                  )}
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="practice-bio">
                    {t("doctorPractice.bio")}
                  </label>
                  <textarea
                    id="practice-bio"
                    className="form-control"
                    maxLength={5000}
                    rows={4}
                    value={professional.bio}
                    onChange={(event) =>
                      setProfessional((p) => ({ ...p, bio: event.target.value }))
                    }
                  />
                </div>
                <p className="text-muted">{t("doctorPractice.verificationNotice")}</p>
              </div>
            ) : (
              workplace && (
                <WorkingHoursEditor workplace={workplace} shifts={shifts} onChange={setShifts} />
              )
            )}
            <div className="my-3">
              <label className="form-label" htmlFor="practice-reason">
                {t("adminManage.reason")}
              </label>
              <textarea
                id="practice-reason"
                className="form-control"
                required
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <label className="form-check my-3">
              <input
                type="checkbox"
                className="form-check-input"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span className="form-check-label">{t("doctorPractice.confirm")}</span>
            </label>
          </fieldset>
          {failure && (
            <p role="alert" className="alert alert-warning mt-3">
              {t(failure)}
            </p>
          )}
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
              {t(busy ? "users.saving" : "users.save")}
            </button>
            <button className="btn btn-light" type="button" disabled={busy} onClick={onClose}>
              {t("users.cancel")}
            </button>
          </div>
        </form>
      </Dialog>
      <RecentPasswordDialog
        locale={locale}
        request={password.request}
        onCancel={password.cancel}
        onSubmit={password.submit}
      />
    </>
  );
}
