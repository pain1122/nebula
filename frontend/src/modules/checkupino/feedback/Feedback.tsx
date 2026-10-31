import type { ReactNode } from "react";

import type { ProductLocale } from "../preferences/localization";
import { errorFeedbackModel, type FeedbackTone } from "./model";

interface LocalizedFeedbackCopy {
  readonly emptyDescription: string;
  readonly emptyTitle: string;
  readonly errorCode: string;
  readonly httpStatus: string;
  readonly loading: string;
  readonly requestId: string;
  readonly retry: string;
  readonly retryAfter: string;
}

const feedbackCopy: Readonly<Record<ProductLocale, LocalizedFeedbackCopy>> = {
  en: {
    emptyDescription: "No items are available to display.",
    emptyTitle: "Nothing found",
    errorCode: "Error code",
    httpStatus: "HTTP status",
    loading: "Loading…",
    requestId: "Tracking ID",
    retry: "Try again",
    retryAfter: "Suggested retry time",
  },
  fa: {
    emptyDescription: "موردی برای نمایش وجود ندارد.",
    emptyTitle: "نتیجه‌ای پیدا نشد",
    errorCode: "کد خطا",
    httpStatus: "وضعیت HTTP",
    loading: "در حال بارگذاری…",
    requestId: "شناسه پیگیری",
    retry: "تلاش دوباره",
    retryAfter: "زمان پیشنهادی تلاش مجدد",
  },
};

const toneClass: Readonly<Record<FeedbackTone, string>> = {
  danger: "danger",
  info: "info",
  warning: "warning",
};

export interface LoadingStateProps {
  readonly className?: string;
  readonly label?: string;
  readonly locale?: ProductLocale;
}

export const LoadingState = ({ className = "", label, locale = "fa" }: LoadingStateProps) => (
  <output className={`d-flex align-items-center gap-2 ${className}`.trim()}>
    <span aria-hidden="true" className="spinner-border spinner-border-sm" />
    <span>{label ?? feedbackCopy[locale].loading}</span>
  </output>
);

export interface EmptyStateProps {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly description?: string;
  readonly locale?: ProductLocale;
  readonly title?: string;
}

export const EmptyState = ({
  action,
  className = "",
  description,
  locale = "fa",
  title,
}: EmptyStateProps) => {
  const copy = feedbackCopy[locale];

  return (
    <section
      aria-live="polite"
      className={`text-center p-4 ${className}`.trim()}
      data-feedback-state="empty"
    >
      <span aria-hidden="true" className="ri-inbox-2-line fs-2 d-block mb-2" />
      <h2 className="h5 mb-1">{title ?? copy.emptyTitle}</h2>
      <p className="text-muted mb-3">{description ?? copy.emptyDescription}</p>
      {action}
    </section>
  );
};

export interface ErrorStateProps {
  readonly className?: string;
  readonly error: unknown;
  readonly locale?: ProductLocale;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
}

export const ErrorState = ({
  className = "",
  error,
  locale = "fa",
  onRetry,
  retryLabel,
}: ErrorStateProps) => {
  const model = errorFeedbackModel(error, locale);
  if (!model) return null;

  const copy = feedbackCopy[locale];

  return (
    <section
      aria-live="assertive"
      className={`alert alert-${toneClass[model.tone]} ${className}`.trim()}
      data-feedback-kind={model.kind}
      role="alert"
    >
      <div className="d-flex align-items-start gap-2">
        <span aria-hidden="true" className="ri-error-warning-line fs-5 flex-shrink-0" />
        <div className="flex-grow-1">
          <h2 className="h6 alert-heading mb-1">{model.title}</h2>
          <p className="mb-0">{model.message}</p>

          {model.details.length > 0 ? (
            <ul className="mb-0 mt-2 ps-3">
              {model.details.map((detail, index) => (
                <li key={`${detail.field}-${index}`} data-error-field={detail.field}>
                  {detail.field === "global" ? null : (
                    <span className="fw-semibold">{detail.field}: </span>
                  )}
                  {detail.message}
                </li>
              ))}
            </ul>
          ) : null}

          {model.code || model.correlationId || model.status || model.retryAfter ? (
            <dl className="small mb-0 mt-2">
              {model.code ? (
                <div>
                  <dt className="d-inline">{copy.errorCode}: </dt>
                  <dd className="d-inline font-monospace">{model.code}</dd>
                </div>
              ) : null}
              {model.status ? (
                <div>
                  <dt className="d-inline">{copy.httpStatus}: </dt>
                  <dd className="d-inline font-monospace">{model.status}</dd>
                </div>
              ) : null}
              {model.correlationId ? (
                <div>
                  <dt className="d-inline">{copy.requestId}: </dt>
                  <dd className="d-inline font-monospace">{model.correlationId}</dd>
                </div>
              ) : null}
              {model.retryAfter ? (
                <div>
                  <dt className="d-inline">{copy.retryAfter}: </dt>
                  <dd className="d-inline font-monospace">{model.retryAfter}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {onRetry ? (
            <button className="btn btn-sm btn-outline-dark mt-3" onClick={onRetry} type="button">
              {retryLabel ?? copy.retry}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export type StatusTone = "danger" | "info" | "neutral" | "success" | "warning";

const statusClass: Readonly<Record<StatusTone, string>> = {
  danger: "danger",
  info: "info",
  neutral: "secondary",
  success: "success",
  warning: "warning",
};

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: StatusTone;
}

export const StatusBadge = ({ label, tone = "neutral" }: StatusBadgeProps) => (
  <output className={`badge bg-${statusClass[tone]}-subtle text-${statusClass[tone]}`}>
    <span aria-hidden="true" className="me-1">
      ●
    </span>
    {label}
  </output>
);
