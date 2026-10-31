import { EmptyState, ErrorState } from "../feedback";
import { formatProductTimestamp, type ProductLocale } from "../preferences/localization";

export type AuditOutcome = "failed" | "succeeded";

export interface SafeAuditEvent {
  readonly actionLabel: string;
  readonly actorLabel: string | null;
  readonly occurredAt: string;
  readonly outcome: AuditOutcome;
  readonly publicId: string;
  readonly reason: string | null;
}

interface AuditCopy {
  readonly actor: string;
  readonly empty: string;
  readonly failed: string;
  readonly reason: string;
  readonly succeeded: string;
  readonly systemActor: string;
  readonly title: string;
  readonly unknownTime: string;
}

const auditCopy: Readonly<Record<ProductLocale, AuditCopy>> = {
  en: {
    actor: "Actor",
    empty: "No authorized events are available.",
    failed: "Failed",
    reason: "Reason",
    succeeded: "Succeeded",
    systemActor: "System",
    title: "Event history",
    unknownTime: "Unknown time",
  },
  fa: {
    actor: "انجام‌دهنده",
    empty: "رویدادی برای نمایش وجود ندارد.",
    failed: "ناموفق",
    reason: "دلیل",
    succeeded: "موفق",
    systemActor: "سامانه",
    title: "تاریخچه رویدادها",
    unknownTime: "زمان نامشخص",
  },
};

const safeTimestamp = (value: string, locale: ProductLocale, fallback: string) => {
  try {
    return formatProductTimestamp(value, locale);
  } catch {
    return fallback;
  }
};

export interface AuditTimelineProps {
  readonly error?: unknown;
  readonly events: readonly SafeAuditEvent[];
  readonly locale?: ProductLocale;
  readonly onRetry?: () => void;
  readonly title?: string;
}

export const AuditTimeline = ({
  error,
  events,
  locale = "fa",
  onRetry,
  title,
}: AuditTimelineProps) => {
  const copy = auditCopy[locale];

  if (error) return <ErrorState error={error} locale={locale} onRetry={onRetry} />;
  if (events.length === 0) return <EmptyState description={copy.empty} locale={locale} />;

  return (
    <section aria-labelledby="audit-timeline-title" data-audit-timeline="presentation-only">
      <h2 className="h5" id="audit-timeline-title">
        {title ?? copy.title}
      </h2>
      <ol className="list-unstyled mb-0">
        {events.map((event) => {
          const succeeded = event.outcome === "succeeded";
          return (
            <li
              className="position-relative pb-4"
              key={event.publicId}
              style={{
                borderInlineStart: "1px solid var(--bs-border-color)",
                paddingInlineStart: "1.5rem",
              }}
            >
              <span
                aria-hidden="true"
                className={`badge rounded-pill bg-${succeeded ? "success" : "danger"} position-absolute top-0 translate-middle-x`}
                style={{ insetInlineStart: 0 }}
              >
                &nbsp;
              </span>
              <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                <h3 className="h6 mb-1 text-break">{event.actionLabel}</h3>
                <span
                  className={`badge bg-${succeeded ? "success" : "danger"}-subtle text-${succeeded ? "success" : "danger"}`}
                >
                  {succeeded ? copy.succeeded : copy.failed}
                </span>
              </div>
              <p className="small text-muted mb-1">
                <span className="fw-semibold">{copy.actor}: </span>
                <span>{event.actorLabel?.trim() || copy.systemActor}</span>
                {" · "}
                <time dateTime={event.occurredAt}>
                  {safeTimestamp(event.occurredAt, locale, copy.unknownTime)}
                </time>
              </p>
              {event.reason?.trim() ? (
                <p className="mb-0 text-break">
                  <span className="fw-semibold">{copy.reason}: </span>
                  <span>{event.reason}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
