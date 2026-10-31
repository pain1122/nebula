import { useTranslation } from "react-i18next";
import {
  formatProductNumber,
  normalizeNumericInput,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import type { DoctorPractice } from "../../modules/checkupino/profiles/practice";
import {
  appointmentPreview,
  availabilityFromShifts,
  clockMinutes,
  minuteClock,
  newWorkingShift,
  workingDays,
  workingHoursError,
  type WorkingShift,
} from "../../modules/checkupino/profiles/workingHours";

type Workplace = DoctorPractice["workplaces"][number];
export default function WorkingHoursEditor({
  workplace,
  shifts,
  onChange,
}: {
  readonly workplace: Workplace;
  readonly shifts: WorkingShift[];
  readonly onChange: (shifts: WorkingShift[]) => void;
}) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage);
  const number = (value: number) => formatProductNumber(value, locale);
  const error = workingHoursError(
    shifts,
    workplace.services.filter((s) => s.active).map((s) => s.id),
  );
  const patch = (key: string, update: Partial<WorkingShift>) =>
    onChange(shifts.map((shift) => (shift.key === key ? { ...shift, ...update } : shift)));
  const field = (
    label: string,
    id: string,
    value: string | number,
    type: string,
    change: (value: string) => void,
    required = true,
  ) => (
    <div>
      <label className="form-label" htmlFor={id}>
        {t(label)}
      </label>
      <input
        id={id}
        className="form-control"
        type={type}
        dir={type === "time" ? "ltr" : undefined}
        value={value}
        required={required}
        onChange={(event) => change(event.target.value)}
        {...(type === "number"
          ? {
              min: label === "doctorPractice.duration" ? 5 : 0,
              max: label === "doctorPractice.duration" ? 720 : 2147483647,
              step: 1,
            }
          : {})}
      />
    </div>
  );
  const addShift = (day: WorkingShift["day"]) => {
    const last = shifts
      .filter((s) => s.day === day)
      .sort((a, b) => a.end.localeCompare(b.end))
      .at(-1);
    const lastEnd = last ? clockMinutes(last.end) : 0;
    if (last && (!Number.isFinite(lastEnd) || lastEnd > 23 * 60 + 54)) return;
    const start = last ? (lastEnd + 60 <= 23 * 60 ? lastEnd + 60 : lastEnd) : 8 * 60;
    onChange([
      ...shifts,
      newWorkingShift(
        day,
        workplace.services.find((s) => s.active)?.id ?? 0,
        minuteClock(start),
        last ? minuteClock(Math.min(start + 180, 23 * 60 + 59)) : "16:00",
      ),
    ]);
  };
  return (
    <div data-working-hours-editor>
      <p className="alert alert-info">{t("doctorPractice.weeklyNotice")}</p>
      <p className="text-muted">{t("workingHours.intro")}</p>
      <p>
        <bdi>{workplace.timezone}</bdi> — {t("workingHours.timezone")}
      </p>
      {error && (
        <p role="alert" className="alert alert-warning">
          {t("workingHours.error." + error)}
        </p>
      )}
      {workingDays.map((day) => {
        const rows = shifts.filter((s) => s.day === day);
        const sessionCount = rows.reduce((sum, row) => sum + row.sessions.length, 0);
        return (
          <section
            className="card border shadow-none mb-3"
            key={day}
            aria-label={t("doctorPractice.day." + day)}
            data-working-day={day}
          >
            <div className="card-header bg-light d-flex align-items-center justify-content-between gap-2">
              <h3 className="h6 mb-0">{t("doctorPractice.day." + day)}</h3>
              <label className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={rows.length > 0}
                  aria-label={t("workingHours.enableDay", { day: t("doctorPractice.day." + day) })}
                  disabled={!workplace.services.some((s) => s.active)}
                  onChange={(event) =>
                    event.target.checked
                      ? addShift(day)
                      : onChange(shifts.filter((s) => s.day !== day))
                  }
                />
                <span className="form-check-label">
                  {t(rows.length ? "workingHours.open" : "workingHours.closed")}
                </span>
              </label>
            </div>
            {!!rows.length && (
              <div className="card-body">
                {rows.map((shift, index) => {
                  const compiled = availabilityFromShifts([shift])[0]?.windows ?? [];
                  const count = compiled.reduce(
                    (sum, rule) => sum + appointmentPreview(rule).length,
                    0,
                  );
                  const rest = shift.breaks.reduce(
                    (sum, pause) =>
                      sum + Math.max(0, clockMinutes(pause.end) - clockMinutes(pause.start)),
                    0,
                  );
                  const minutes = clockMinutes(shift.end) - clockMinutes(shift.start) - rest;
                  return (
                    <div className="border rounded p-3 mb-3" key={shift.key} data-working-shift>
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                        <h4 className="h6 mb-0">
                          {t("workingHours.shift")} {number(index + 1)}
                        </h4>
                        <button
                          className="btn btn-soft-danger btn-sm"
                          type="button"
                          onClick={() => onChange(shifts.filter((s) => s.key !== shift.key))}
                        >
                          {t("doctorPractice.removeWindow")}
                        </button>
                      </div>
                      <div className="row g-3">
                        <div className="col-sm-6">
                          {field(
                            "workingHours.shiftStart",
                            shift.key + "-start",
                            shift.start,
                            "time",
                            (start) => {
                              patch(shift.key, {
                                start,
                                sessions: shift.sessions.map((s, i) =>
                                  i === 0 ? { ...s, start } : s,
                                ),
                              });
                            },
                          )}
                        </div>
                        <div className="col-sm-6">
                          {field(
                            "workingHours.shiftEnd",
                            shift.key + "-end",
                            shift.end,
                            "time",
                            (end) => {
                              patch(shift.key, {
                                end,
                                sessions: shift.sessions.map((s, i) =>
                                  i === shift.sessions.length - 1 ? { ...s, end } : s,
                                ),
                              });
                            },
                          )}
                        </div>
                      </div>
                      <fieldset className="mt-3">
                        <legend className="h6">{t("doctorPractice.breaks")}</legend>
                        {!shift.breaks.length && (
                          <p className="text-muted small">{t("workingHours.noBreaks")}</p>
                        )}
                        {shift.breaks.map((pause, pauseIndex) => (
                          <div className="row g-2 align-items-end mb-2" key={pauseIndex}>
                            <div className="col-12 col-sm-5">
                              {field(
                                "workingHours.breakStart",
                                shift.key + "-break-start-" + pauseIndex,
                                pause.start,
                                "time",
                                (start) =>
                                  patch(shift.key, {
                                    breaks: shift.breaks.map((p, i) =>
                                      i === pauseIndex ? { ...p, start } : p,
                                    ),
                                  }),
                              )}
                            </div>
                            <div className="col-12 col-sm-5">
                              {field(
                                "workingHours.breakEnd",
                                shift.key + "-break-end-" + pauseIndex,
                                pause.end,
                                "time",
                                (end) =>
                                  patch(shift.key, {
                                    breaks: shift.breaks.map((p, i) =>
                                      i === pauseIndex ? { ...p, end } : p,
                                    ),
                                  }),
                              )}
                            </div>
                            <div className="col-12 col-sm-2">
                              <button
                                type="button"
                                className="btn btn-soft-danger"
                                aria-label={t("doctorPractice.removeBreak")}
                                onClick={() =>
                                  patch(shift.key, {
                                    breaks: shift.breaks.filter((_, i) => i !== pauseIndex),
                                  })
                                }
                              >
                                <i className="ri-close-line" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-soft-info btn-sm"
                          disabled={shift.breaks.length >= 8}
                          onClick={() => {
                            const start = clockMinutes(shift.start),
                              end = clockMinutes(shift.end);
                            const midpoint = Math.floor((start + end) / 2 / 5) * 5;
                            patch(shift.key, {
                              breaks: [
                                ...shift.breaks,
                                {
                                  start: minuteClock(midpoint),
                                  end: minuteClock(Math.min(midpoint + 30, end)),
                                },
                              ],
                            });
                          }}
                        >
                          {t("doctorPractice.addBreak")}
                        </button>
                      </fieldset>
                      <fieldset className="mt-4">
                        <legend className="h6">{t("workingHours.sessions")}</legend>
                        <p className="text-muted small">{t("workingHours.sessionsHint")}</p>
                        {shift.sessions.map((session, si) => (
                          <div
                            className="bg-light rounded p-3 mb-2"
                            key={session.key}
                            data-service-session
                          >
                            <div className="row g-3">
                              <div className="col-sm-7">
                                <label className="form-label" htmlFor={session.key + "-service"}>
                                  {t("booking.checkup")}
                                </label>
                                <select
                                  className="form-select"
                                  id={session.key + "-service"}
                                  value={session.checkup_id}
                                  required
                                  onChange={(event) =>
                                    patch(shift.key, {
                                      sessions: shift.sessions.map((s, i) =>
                                        i === si
                                          ? { ...s, checkup_id: Number(event.target.value) }
                                          : s,
                                      ),
                                    })
                                  }
                                >
                                  <option value="">{t("booking.notSelected")}</option>
                                  {workplace.services
                                    .filter((s) => s.active || s.id === session.checkup_id)
                                    .map((s) => (
                                      <option key={s.id} value={s.id} disabled={!s.active}>
                                        {s.title}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div className="col-sm-5">
                                {field(
                                  "doctorPractice.duration",
                                  session.key + "-duration",
                                  session.duration_minutes,
                                  "number",
                                  (value) =>
                                    patch(shift.key, {
                                      sessions: shift.sessions.map((s, i) =>
                                        i === si
                                          ? {
                                              ...s,
                                              duration_minutes: Number(
                                                normalizeNumericInput(value),
                                              ),
                                            }
                                          : s,
                                      ),
                                    }),
                                )}
                              </div>
                              {shift.sessions.length > 1 && (
                                <>
                                  <div className="col-sm-6">
                                    <label className="form-label">
                                      {t("workingHours.sessionStart")}
                                    </label>
                                    <div className="form-control bg-transparent">
                                      <bdi>{session.start}</bdi>
                                    </div>
                                  </div>
                                  <div className="col-sm-6">
                                    {si < shift.sessions.length - 1 ? (
                                      field(
                                        "workingHours.sessionEnd",
                                        session.key + "-end",
                                        session.end,
                                        "time",
                                        (end) =>
                                          patch(shift.key, {
                                            sessions: shift.sessions.map((s, i) =>
                                              i === si
                                                ? { ...s, end }
                                                : i === si + 1
                                                  ? { ...s, start: end }
                                                  : s,
                                            ),
                                          }),
                                      )
                                    ) : (
                                      <>
                                        <label className="form-label">
                                          {t("workingHours.sessionEnd")}
                                        </label>
                                        <div className="form-control bg-transparent">
                                          <bdi>{session.end}</bdi>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            <details className="mt-3">
                              <summary className="text-primary">
                                {t("workingHours.priceOptions")}
                              </summary>
                              <div className="row g-3 mt-1">
                                <div className="col-sm-6">
                                  {field(
                                    "doctorPractice.overridePrice",
                                    session.key + "-price",
                                    session.price_override ?? "",
                                    "number",
                                    (value) =>
                                      patch(shift.key, {
                                        sessions: shift.sessions.map((s, i) =>
                                          i === si
                                            ? {
                                                ...s,
                                                price_override:
                                                  value === ""
                                                    ? null
                                                    : Number(normalizeNumericInput(value)),
                                                currency_override:
                                                  value === "" ? null : s.currency_override,
                                              }
                                            : s,
                                        ),
                                      }),
                                    false,
                                  )}
                                </div>
                                <div className="col-sm-6">
                                  <label className="form-label" htmlFor={session.key + "-currency"}>
                                    {t("doctorPractice.currency")}
                                  </label>
                                  <input
                                    className="form-control"
                                    id={session.key + "-currency"}
                                    value={session.currency_override ?? ""}
                                    pattern="[A-Z]{3}"
                                    maxLength={3}
                                    onChange={(event) =>
                                      patch(shift.key, {
                                        sessions: shift.sessions.map((s, i) =>
                                          i === si
                                            ? {
                                                ...s,
                                                currency_override:
                                                  event.target.value.toUpperCase() || null,
                                              }
                                            : s,
                                        ),
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </details>
                            {shift.sessions.length > 1 && (
                              <button
                                className="btn btn-soft-danger btn-sm mt-2"
                                type="button"
                                onClick={() => {
                                  const sessions = shift.sessions
                                    .filter((_, i) => i !== si)
                                    .map((s) => ({ ...s }));
                                  if (si === 0) sessions[0]!.start = shift.start;
                                  else sessions[si - 1]!.end = session.end;
                                  patch(shift.key, { sessions });
                                }}
                              >
                                {t("workingHours.removeSession")}
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-soft-primary btn-sm"
                          disabled={
                            sessionCount >= 8 ||
                            clockMinutes(shift.sessions.at(-1)!.end) -
                              clockMinutes(shift.sessions.at(-1)!.start) <
                              10
                          }
                          onClick={() => {
                            const last = shift.sessions.at(-1)!;
                            const boundary = minuteClock(
                              Math.floor(
                                (clockMinutes(last.start) + clockMinutes(last.end)) / 2 / 5,
                              ) * 5,
                            );
                            patch(shift.key, {
                              sessions: [
                                ...shift.sessions.slice(0, -1),
                                { ...last, end: boundary },
                                {
                                  ...last,
                                  key: crypto.randomUUID(),
                                  start: boundary,
                                  checkup_id:
                                    workplace.services.find(
                                      (s) => s.active && s.id !== last.checkup_id,
                                    )?.id ?? last.checkup_id,
                                },
                              ],
                            });
                          }}
                        >
                          {t("workingHours.addSession")}
                        </button>
                      </fieldset>
                      <details className="mt-3">
                        <summary className="text-primary">{t("workingHours.dateOptions")}</summary>
                        <div className="row g-3 mt-1">
                          <div className="col-sm-6">
                            {field(
                              "doctorPractice.effectiveFrom",
                              shift.key + "-from",
                              shift.effective_from ?? "",
                              "date",
                              (value) => patch(shift.key, { effective_from: value || null }),
                              false,
                            )}
                          </div>
                          <div className="col-sm-6">
                            {field(
                              "doctorPractice.effectiveUntil",
                              shift.key + "-until",
                              shift.effective_until ?? "",
                              "date",
                              (value) => patch(shift.key, { effective_until: value || null }),
                              false,
                            )}
                          </div>
                        </div>
                      </details>
                      <div className="alert alert-success mt-3 mb-0" data-shift-preview>
                        <h5 className="h6">{t("workingHours.preview")}</h5>
                        <p className="mb-2">
                          {t("workingHours.totals", {
                            work: number(Number.isFinite(minutes) ? Math.max(0, minutes) : 0),
                            rest: number(Number.isFinite(rest) ? rest : 0),
                            amount: number(count),
                          })}
                        </p>
                        {compiled.map((rule, i) => (
                          <div key={i} className="mb-2">
                            <strong>
                              {workplace.services.find((s) => s.id === rule.checkup_id)?.title}
                            </strong>
                            <div className="d-flex flex-wrap gap-1 mt-1">
                              {appointmentPreview(rule).map((start) => (
                                <bdi className="badge bg-success-subtle text-success" key={start}>
                                  {start}
                                </bdi>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="small mb-0">{t("workingHours.previewHint")}</p>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="btn btn-soft-primary"
                  disabled={sessionCount >= 8}
                  onClick={() => addShift(day)}
                >
                  {t("doctorPractice.addWindow")}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
