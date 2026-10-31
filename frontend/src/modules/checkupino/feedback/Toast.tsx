import { ToastContainer, toast, type Id, type ToastPosition } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import type { ProductLocale } from "../preferences/localization";
import { errorFeedbackModel, type FeedbackTone } from "./model";

export type ToastTone = FeedbackTone | "success";

export interface FeedbackToastInput {
  readonly locale?: ProductLocale;
  readonly message?: string;
  readonly title?: string;
  readonly toastId?: Id;
  readonly tone?: ToastTone;
}

const defaultToastCopy: Readonly<
  Record<ProductLocale, Readonly<Record<ToastTone, { message: string; title: string }>>>
> = {
  en: {
    danger: { message: "The operation could not be completed.", title: "Operation failed" },
    info: { message: "New information is available.", title: "Notice" },
    success: { message: "The operation completed successfully.", title: "Completed" },
    warning: { message: "Review this notice before continuing.", title: "Attention" },
  },
  fa: {
    danger: { message: "عملیات موردنظر انجام نشد.", title: "انجام عملیات ناموفق بود" },
    info: { message: "اطلاعات جدیدی در دسترس است.", title: "اطلاع‌رسانی" },
    success: { message: "عملیات با موفقیت انجام شد.", title: "عملیات موفق" },
    warning: { message: "پیش از ادامه این پیام را بررسی کنید.", title: "توجه" },
  },
};

const positionForLocale = (locale: ProductLocale): ToastPosition =>
  locale === "fa" ? "top-left" : "top-right";

const toastType: Readonly<Record<ToastTone, "error" | "info" | "success" | "warning">> = {
  danger: "error",
  info: "info",
  success: "success",
  warning: "warning",
};

const ToastContent = ({ message, title }: { readonly message: string; readonly title: string }) => (
  <div>
    <strong className="d-block">{title}</strong>
    <span>{message}</span>
  </div>
);

export const notifyFeedbackToast = ({
  locale = "fa",
  message,
  title,
  toastId,
  tone = "info",
}: FeedbackToastInput): Id => {
  const copy = defaultToastCopy[locale][tone];

  return toast(<ToastContent message={message ?? copy.message} title={title ?? copy.title} />, {
    position: positionForLocale(locale),
    role: tone === "danger" ? "alert" : "status",
    rtl: locale === "fa",
    toastId,
    type: toastType[tone],
  });
};

export const notifyErrorToast = (error: unknown, locale: ProductLocale = "fa"): Id | null => {
  const model = errorFeedbackModel(error, locale);
  if (!model) return null;

  const supportReference = model.correlationId
    ? locale === "fa"
      ? `شناسه پیگیری: ${model.correlationId}`
      : `Tracking ID: ${model.correlationId}`
    : null;

  return notifyFeedbackToast({
    locale,
    message: supportReference ? `${model.message} — ${supportReference}` : model.message,
    title: model.title,
    toastId: model.correlationId ?? undefined,
    tone: model.tone,
  });
};

export interface FeedbackToastViewportProps {
  readonly locale?: ProductLocale;
}

export const FeedbackToastViewport = ({ locale = "fa" }: FeedbackToastViewportProps) => (
  <ToastContainer
    autoClose={5000}
    closeOnClick
    draggable="touch"
    limit={3}
    newestOnTop
    pauseOnFocusLoss
    pauseOnHover
    position={positionForLocale(locale)}
    rtl={locale === "fa"}
    theme="colored"
  />
);
