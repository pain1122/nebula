import type { ProductLocale } from "../preferences/localization";
import { TransportError, type WireError, type WireErrorKind } from "../api/wire";

export type VisibleFeedbackKind = Exclude<WireErrorKind, "cancelled"> | "unknown";
export type FeedbackTone = "danger" | "info" | "warning";

export interface FeedbackDetail {
  readonly field: string;
  readonly message: string;
}

export interface ErrorFeedbackModel {
  readonly code: string | null;
  readonly correlationId: string | null;
  readonly details: readonly FeedbackDetail[];
  readonly kind: VisibleFeedbackKind;
  readonly message: string;
  readonly retryAfter: string | null;
  readonly source: WireError | null;
  readonly status: number | null;
  readonly title: string;
  readonly tone: FeedbackTone;
}

interface LocalizedErrorCopy {
  readonly message: string;
  readonly title: string;
}

const farsiCopy: Readonly<Record<VisibleFeedbackKind, LocalizedErrorCopy>> = {
  "account-inactive": {
    message: "برای بررسی وضعیت حساب با پشتیبانی تماس بگیرید.",
    title: "حساب کاربری غیرفعال است",
  },
  csrf: {
    message: "صفحه را تازه‌سازی کنید و دوباره تلاش کنید.",
    title: "نشست شما منقضی شده است",
  },
  forbidden: {
    message: "اجازه انجام این عملیات برای حساب شما صادر نشده است.",
    title: "دسترسی مجاز نیست",
  },
  http: {
    message: "سرور نتوانست درخواست را کامل کند.",
    title: "انجام درخواست ناموفق بود",
  },
  network: {
    message: "اتصال اینترنت و در دسترس بودن سرور را بررسی کنید.",
    title: "ارتباط با سرور برقرار نشد",
  },
  "not-found": {
    message: "ممکن است این مورد حذف شده باشد یا نشانی آن تغییر کرده باشد.",
    title: "مورد درخواستی پیدا نشد",
  },
  "recent-password": {
    message: "برای ادامه، رمز عبور خود را دوباره وارد کنید.",
    title: "تأیید دوباره رمز عبور لازم است",
  },
  server: {
    message: "کمی بعد دوباره تلاش کنید.",
    title: "خطایی در سرور رخ داد",
  },
  throttled: {
    message: "کمی صبر کنید و سپس دوباره تلاش کنید.",
    title: "درخواست‌های زیادی ارسال شده است",
  },
  unauthenticated: {
    message: "برای ادامه دوباره وارد حساب کاربری شوید.",
    title: "ورود به حساب لازم است",
  },
  unknown: {
    message: "خطای ناشناخته‌ای رخ داد.",
    title: "انجام عملیات ناموفق بود",
  },
  validation: {
    message: "فیلدهای مشخص‌شده را بررسی کنید.",
    title: "اطلاعات واردشده معتبر نیست",
  },
};

const englishCopy: Readonly<Record<VisibleFeedbackKind, LocalizedErrorCopy>> = {
  "account-inactive": {
    message: "Contact support to review the account status.",
    title: "Account inactive",
  },
  csrf: {
    message: "Refresh the page and try again.",
    title: "Your session has expired",
  },
  forbidden: {
    message: "Your account is not allowed to perform this operation.",
    title: "Access denied",
  },
  http: {
    message: "The server could not complete the request.",
    title: "Request failed",
  },
  network: {
    message: "Check your connection and whether the server is available.",
    title: "Could not reach the server",
  },
  "not-found": {
    message: "The item may have been removed or its address may have changed.",
    title: "Requested item not found",
  },
  "recent-password": {
    message: "Enter your password again to continue.",
    title: "Password confirmation required",
  },
  server: {
    message: "Please try again later.",
    title: "A server error occurred",
  },
  throttled: {
    message: "Wait briefly before trying again.",
    title: "Too many requests",
  },
  unauthenticated: {
    message: "Sign in again to continue.",
    title: "Sign-in required",
  },
  unknown: {
    message: "An unknown error occurred.",
    title: "Operation failed",
  },
  validation: {
    message: "Review the highlighted fields.",
    title: "The submitted information is invalid",
  },
};

const tones: Readonly<Record<VisibleFeedbackKind, FeedbackTone>> = {
  "account-inactive": "warning",
  csrf: "warning",
  forbidden: "warning",
  http: "danger",
  network: "danger",
  "not-found": "info",
  "recent-password": "warning",
  server: "danger",
  throttled: "warning",
  unauthenticated: "warning",
  unknown: "danger",
  validation: "warning",
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isWireError = (value: unknown): value is WireError =>
  isRecord(value) &&
  typeof value.kind === "string" &&
  "errors" in value &&
  "correlationId" in value;

const asWireError = (error: unknown): WireError | null => {
  if (error instanceof TransportError) return error.wire;
  return isWireError(error) ? error : null;
};

const detailsFromWire = (wire: WireError): readonly FeedbackDetail[] =>
  Object.entries(wire.errors).flatMap(([field, messages]) =>
    messages.map((message) => ({ field, message })),
  );

const unknownMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return null;
};

export const errorFeedbackModel = (
  error: unknown,
  locale: ProductLocale = "fa",
): ErrorFeedbackModel | null => {
  const wire = asWireError(error);
  if (wire?.kind === "cancelled") return null;

  const kind: VisibleFeedbackKind = wire?.kind ?? "unknown";
  const copy = locale === "fa" ? farsiCopy[kind] : englishCopy[kind];

  return Object.freeze({
    code: wire?.code ?? null,
    correlationId: wire?.correlationId ?? null,
    details: wire ? detailsFromWire(wire) : [],
    kind,
    message: wire?.message?.trim() || unknownMessage(error) || copy.message,
    retryAfter: wire?.retryAfter ?? null,
    source: wire,
    status: wire?.status ?? null,
    title: copy.title,
    tone: tones[kind],
  });
};
