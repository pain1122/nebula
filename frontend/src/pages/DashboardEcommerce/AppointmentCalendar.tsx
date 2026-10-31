import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader } from "reactstrap";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import BootstrapTheme from "@fullcalendar/bootstrap";
import faLocale from "@fullcalendar/core/locales/fa";
import "./appointment-calendar.css";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import {
  normalizeProductLocale,
  formatProductTimestamp,
} from "../../modules/checkupino/preferences/localization";
import {
  readAppointmentCalendar,
  tehranCalendarTime,
  type AppointmentCalendar as CalendarData,
  type CalendarRange,
} from "../../modules/checkupino/dashboard/calendar";

export default function AppointmentCalendar({
  now,
  doctorOwnerId,
}: {
  readonly now: string;
  readonly doctorOwnerId?: number;
}) {
  const { t, i18n } = useTranslation(),
    locale = normalizeProductLocale(i18n.resolvedLanguage),
    navigate = useNavigate();
  const [range, setRange] = useState<CalendarRange | null>(null),
    [snapshot, setSnapshot] = useState<CalendarData | null>(null),
    [error, setError] = useState<unknown>(null),
    [version, setVersion] = useState(0),
    [title, setTitle] = useState("");
  const calendar = useRef<FullCalendar>(null);
  useEffect(() => {
    if (!range) return;
    const controller = new AbortController();
    void readAppointmentCalendar(range, controller.signal, doctorOwnerId)
      .then((value) => {
        if (!controller.signal.aborted) setSnapshot(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      });
    return () => controller.abort();
  }, [range, version, doctorOwnerId]);
  const current =
    snapshot &&
    (!doctorOwnerId || snapshot.data.owner_id === doctorOwnerId) &&
    snapshot.data.from === range?.from &&
    snapshot.data.until === range.until
      ? snapshot
      : null;
  return (
    <Card data-dashboard-section="appointments">
      <CardHeader className="align-items-center d-flex">
        <h2 className="card-title mb-0 flex-grow-1">{t("dashboard.calendar")}</h2>
        <Link
          to={doctorOwnerId ? "/doctor/reservations" : "/reservations"}
          className="btn btn-soft-info btn-sm"
        >
          {t("dashboard.viewAll")}
        </Link>
      </CardHeader>
      <CardBody>
        <p className="text-muted">
          {t(doctorOwnerId ? "doctorPractice.calendarHint" : "dashboard.calendarHint")}
        </p>
        <div
          className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3"
          data-calendar-toolbar
        >
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-soft-primary"
              aria-label={t("dashboard.calendarPrev")}
              onClick={() => calendar.current?.getApi().prev()}
            >
              <i className={locale === "fa" ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line"} />
            </button>
            <button
              type="button"
              className="btn btn-soft-primary"
              aria-label={t("dashboard.calendarNext")}
              onClick={() => calendar.current?.getApi().next()}
            >
              <i className={locale === "fa" ? "ri-arrow-left-s-line" : "ri-arrow-right-s-line"} />
            </button>
            <button
              type="button"
              className="btn btn-soft-primary"
              onClick={() => calendar.current?.getApi().today()}
            >
              {t("dashboard.calendarToday")}
            </button>
          </div>
          <h3 className="h6 mb-0" aria-live="polite">
            {title}
          </h3>
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-soft-primary"
              onClick={() => calendar.current?.getApi().changeView("dayGridMonth")}
            >
              {t("dashboard.calendarMonth")}
            </button>
            <button
              type="button"
              className="btn btn-soft-primary"
              onClick={() => calendar.current?.getApi().changeView("listWeek")}
            >
              {t("dashboard.calendarWeek")}
            </button>
          </div>
        </div>
        {error ? (
          <ErrorState
            error={error}
            locale={locale}
            onRetry={() => {
              setSnapshot(null);
              setError(null);
              setVersion((value) => value + 1);
            }}
          />
        ) : !current ? (
          <LoadingState locale={locale} />
        ) : (
          <>
            <p className="text-muted small" data-calendar-generated>
              {t("dashboard.updated")}:{" "}
              <time dateTime={current.meta.generated_at}>
                {formatProductTimestamp(current.meta.generated_at, locale)}
              </time>
            </p>
            {!current.data.appointments.length ? (
              <p className="text-muted">{t("dashboard.calendarEmpty")}</p>
            ) : null}
            {current.data.has_more ? (
              <output className="text-warning d-block">{t("dashboard.calendarLimit")}</output>
            ) : null}
          </>
        )}
        <div
          className="table-responsive checkupino-appointment-calendar"
          style={{ "--fc-today-bg-color": "var(--vz-tertiary-bg)" } as CSSProperties}
        >
          <FullCalendar
            ref={calendar}
            plugins={[BootstrapTheme, dayGridPlugin, listPlugin]}
            themeSystem="bootstrap"
            initialView="dayGridMonth"
            initialDate={tehranCalendarTime(now)}
            now={tehranCalendarTime(now)}
            locale={locale === "fa" ? { ...faLocale, code: "fa-IR-u-ca-gregory" } : "en"}
            direction={locale === "fa" ? "rtl" : "ltr"}
            timeZone="UTC"
            firstDay={locale === "fa" ? 6 : 0}
            dayHeaderContent={(day) =>
              locale === "fa" ? (
                <>
                  <span className="d-sm-none" aria-hidden="true" title={day.text}>
                    {new Intl.DateTimeFormat("fa-IR", {
                      weekday: "narrow",
                      timeZone: "UTC",
                    }).format(day.date)}
                  </span>
                  <span className="visually-hidden d-sm-none">{day.text}</span>
                  <span className="d-none d-sm-inline">{day.text}</span>
                </>
              ) : (
                day.text
              )
            }
            height="auto"
            fixedWeekCount={false}
            dayMaxEvents={3}
            dayCellContent={(day) => (
              <span className="d-flex flex-column align-items-center">
                <span>{day.dayNumberText}</span>
                {day.isToday ? (
                  <small className="text-secondary fw-medium" data-calendar-today>
                    {t("dashboard.calendarToday")}
                  </small>
                ) : null}
              </span>
            )}
            headerToolbar={false}
            editable={false}
            selectable={false}
            droppable={false}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            events={
              error
                ? []
                : (current?.data.appointments ?? []).map((row) => ({
                    id: String(row.id),
                    start: tehranCalendarTime(row.starts_at),
                    end: tehranCalendarTime(row.ends_at),
                    title: `${row.patient} · ${row.doctor} · ${row.checkup} · ${t(`booking.state.${row.status}`)}`,
                    classNames: [
                      row.status === "confirmed"
                        ? "bg-success"
                        : row.status === "completed"
                          ? "bg-primary"
                          : row.status === "pending"
                            ? "bg-warning"
                            : "bg-secondary",
                    ],
                    url: doctorOwnerId
                      ? `/panel/doctor/reservations/${row.public_id}/medical`
                      : `/panel/reservations/${row.id}`,
                    publicId: row.public_id,
                    textClass: row.status === "pending" ? "text-dark" : "text-white",
                  }))
            }
            eventContent={(info) => (
              <span
                className={`d-block ${info.view.type === "listWeek" ? "text-wrap text-break" : "text-truncate"} ${String(info.event.extendedProps.textClass)}`}
                title={`${info.timeText} ${info.event.title}`}
              >
                <span className="fw-semibold">{info.timeText} </span>
                {info.event.title}
              </span>
            )}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              void navigate(
                doctorOwnerId
                  ? `/doctor/reservations/${info.event.extendedProps.publicId}/medical`
                  : `/reservations/${info.event.id}`,
              );
            }}
            datesSet={(info) => {
              setTitle(info.view.title);
              const next = { from: info.startStr.slice(0, 10), until: info.endStr.slice(0, 10) };
              if (range?.from !== next.from || range.until !== next.until) {
                setSnapshot(null);
                setError(null);
                setRange(next);
              }
            }}
          />
        </div>
      </CardBody>
    </Card>
  );
}
