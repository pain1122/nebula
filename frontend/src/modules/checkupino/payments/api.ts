import type { ListResult } from "../../../core";
import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { adaptModernAdminList } from "../query/lists";
import {
  serverTableBackendParameters,
  type ServerTableEndpointAdapter,
  type ServerTableQuery,
} from "../table";

export const paymentStates = ["unpaid", "paid", "reconciliation", "refunded", "voided"] as const;
export const attemptStates = [
  "initiated",
  "succeeded",
  "failed",
  "expired",
  "reconciliation",
  "refunded",
  "voided",
] as const;
export const adjustmentStates = ["pending", "succeeded", "failed", "reconciliation"] as const;
export const reservationStates = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
] as const;
export type PaymentKind = "payments" | "attempts" | "adjustments" | "events";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const id = integer.min(1);
const ulid = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
export const validPaymentId = (value: string) => ulid.safeParse(value).success;
const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,19})$/)
  .refine((value) => /^(0|[1-9]\d{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n);
const currency = z.string().regex(/^[A-Z]{3}$/);
const timestamp = z.iso.datetime({ offset: true });
const provider = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,59}$/)
  .nullable();
const dateValid = (value: string) =>
  /^\d{4}-\d\d-\d\d$/.test(value) &&
  Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const date = z.string().refine(dateValid);
const attempt = z.object({
  public_id: ulid,
  provider,
  status: z.enum(attemptStates),
  amount: money,
  currency,
  binding_consistent: z.boolean(),
  is_canonical: z.boolean(),
  has_failure: z.boolean(),
  initiated_at: timestamp.nullable(),
  expires_at: timestamp.nullable(),
  completed_at: timestamp.nullable(),
});
const payment = z
  .object({
    public_id: ulid,
    amount: money,
    currency,
    status: z.enum(paymentStates),
    provider,
    paid_at: timestamp.nullable(),
    refunded_at: timestamp.nullable(),
    created_at: timestamp.nullable(),
    updated_at: timestamp.nullable(),
    canonical_consistent: z.boolean(),
    canonical_attempt: attempt.nullable(),
    counts: z.object({
      attempts: integer,
      adjustments: integer,
      reconciliation_attempts: integer,
      pending_adjustments: integer,
    }),
    reservation: z.object({
      id,
      public_id: ulid,
      status: z.enum(reservationStates),
      starts_at: timestamp.nullable(),
      ends_at: timestamp.nullable(),
      timezone: z.string().max(100).nullable(),
      booked_amount: money,
      booked_currency: currency,
      workplace_id: id.nullable(),
      checkup_id: id.nullable(),
      checkup_title: z.string().max(255).nullable(),
      hospital_name: z.string().max(255).nullable(),
      patient: z.object({ id, public_id: ulid, name: z.string().max(255) }),
      doctor: z.object({
        id,
        public_id: ulid,
        user_public_id: ulid,
        name: z.string().max(255),
        archived: z.boolean(),
      }),
    }),
  })
  .refine(
    (row) =>
      row.counts.pending_adjustments <= row.counts.adjustments &&
      row.counts.reconciliation_attempts <= row.counts.attempts &&
      (!row.canonical_consistent ||
        (!row.canonical_attempt
          ? !["paid", "refunded", "voided"].includes(row.status)
          : row.canonical_attempt.binding_consistent &&
            row.canonical_attempt.is_canonical &&
            row.canonical_attempt.amount === row.amount &&
            row.canonical_attempt.currency === row.currency)),
  );
const adjustment = z.object({
  public_id: ulid,
  type: z.enum(["refund", "void"]),
  status: z.enum(adjustmentStates),
  amount: money,
  currency,
  currency_matches_payment: z.boolean(),
  reason_recorded: z.boolean(),
  created_at: timestamp.nullable(),
  updated_at: timestamp.nullable(),
});
const event = z.object({
  public_id: ulid,
  attempt_public_id: ulid,
  provider,
  event_type: z.enum(["payment.succeeded", "payment.failed"]).nullable(),
  signature_verified: z.boolean(),
  received_at: timestamp.nullable(),
  processed_at: timestamp.nullable(),
});
export type PaymentRecord = z.infer<typeof payment>;
export type PaymentRow =
  | (PaymentRecord & { readonly kind: "payments" })
  | (z.infer<typeof attempt> & { readonly kind: "attempts" })
  | (z.infer<typeof adjustment> & { readonly kind: "adjustments" })
  | (z.infer<typeof event> & { readonly kind: "events" });
const meta = z.object({
  success: z.literal(true),
  meta: z.object({
    read_only: z.literal(true),
    adjustments_execute_provider: z.literal(false),
    generated_at: timestamp,
  }),
});
const period = z.object({
  from: date,
  to: date,
  timezone: z.literal("Asia/Tehran"),
  field: z.literal("payment_created_at"),
});
export interface PaymentPage extends ListResult<PaymentRow> {
  readonly generatedAt: string;
  readonly period?: z.infer<typeof period> | null;
}
export const adaptPaymentDetail = (response: unknown, expected: string): PaymentRecord => {
  meta.parse(response);
  const row = payment.parse(z.object({ data: z.unknown() }).parse(response).data);
  if (!validPaymentId(expected) || row.public_id.toLowerCase() !== expected.toLowerCase())
    throw new Error("Payment identity rejected.");
  return row;
};
export const adaptPaymentPage = (
  response: unknown,
  kind: PaymentKind,
  expected?: string,
): PaymentPage => {
  const list = adaptModernAdminList<unknown>(response),
    metadata = meta.parse(response).meta;
  if (
    list.page.currentPage > 1000 ||
    list.page.perPage > 100 ||
    list.items.length > list.page.perPage ||
    list.items.length > list.page.total ||
    !Number.isSafeInteger(list.page.total)
  )
    throw new Error("Payment page bounds rejected.");
  if (kind !== "payments") {
    const parent = z.object({ meta: z.object({ payment_public_id: ulid }) }).parse(response)
      .meta.payment_public_id;
    if (!expected || parent.toLowerCase() !== expected.toLowerCase())
      throw new Error("Payment history binding rejected.");
    if (kind === "adjustments")
      z.object({ meta: z.object({ pending_is_request_only: z.literal(true) }) }).parse(response);
  }
  const items: PaymentRow[] = list.items.map((value) =>
    kind === "payments"
      ? { ...payment.parse(value), kind }
      : kind === "attempts"
        ? { ...attempt.parse(value), kind }
        : kind === "adjustments"
          ? { ...adjustment.parse(value), kind }
          : { ...event.parse(value), kind },
  );
  if (new Set(items.map((row) => row.public_id.toLowerCase())).size !== items.length)
    throw new Error("Duplicate payment history rejected.");
  const interval =
    kind === "payments"
      ? z.object({ meta: z.object({ period: period.nullable() }) }).parse(response).meta.period
      : undefined;
  if (
    interval &&
    (interval.to < interval.from ||
      Date.parse(interval.to) - Date.parse(interval.from) > 89 * 86400000)
  )
    throw new Error("Payment period rejected.");
  return { ...list, items, generatedAt: metadata.generated_at, period: interval };
};
const raw = (parameter: string) => ({
  parameter,
  parse: (value: string) => value.trim() || undefined,
});
export const paymentAdapter = (kind: PaymentKind): ServerTableEndpointAdapter<PaymentRow> => ({
  defaultPerPage: 20,
  maxPerPage: 100,
  getRowIdentifier: (row) => row.public_id,
  getRouteIdentifier: (row) => row.public_id,
  sortableColumns:
    kind === "payments"
      ? { created_at: "created_at", amount: "amount", status: "status", paid_at: "paid_at" }
      : {},
  filters: Object.fromEntries(
    (kind === "payments"
      ? [
          "status",
          "reservation_status",
          "attempt_status",
          "adjustment_status",
          "provider",
          "currency",
          "doctor_id",
          "patient_id",
          "workplace_id",
          "checkup_id",
          "from",
          "to",
        ]
      : kind === "events"
        ? ["signature_verified", "processed"]
        : kind === "adjustments"
          ? ["status", "type"]
          : ["status"]
    ).map((key) => [key, raw(key)]),
  ),
});
export const paymentChoices = (kind: PaymentKind, key: string): readonly string[] | undefined =>
  key === "status"
    ? kind === "payments"
      ? paymentStates
      : kind === "attempts"
        ? attemptStates
        : adjustmentStates
    : key === "reservation_status"
      ? reservationStates
      : key === "attempt_status"
        ? attemptStates
        : key === "adjustment_status"
          ? adjustmentStates
          : key === "type"
            ? ["refund", "void"]
            : key === "signature_verified"
              ? ["1", "0"]
              : key === "processed"
                ? ["yes", "no"]
                : undefined;
export const validPaymentQuery = (query: ServerTableQuery, kind: PaymentKind): boolean => {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 1000 ||
    !Number.isInteger(query.perPage) ||
    query.perPage < 1 ||
    query.perPage > 100 ||
    query.search.length > 100 ||
    (kind !== "payments" && !!query.search)
  )
    return false;
  for (const [key, value] of Object.entries(query.filters)) {
    if (!Object.keys(paymentAdapter(kind).filters ?? {}).includes(key)) return false;
    const text = String(value ?? ""),
      choices = paymentChoices(kind, key);
    if (choices && !choices.includes(text)) return false;
    if (
      ["doctor_id", "patient_id", "workplace_id", "checkup_id"].includes(key) &&
      (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)))
    )
      return false;
    if (
      (key === "currency" && !/^[A-Z]{3}$/.test(text)) ||
      (key === "provider" && !/^[a-z][a-z0-9_-]{0,59}$/.test(text))
    )
      return false;
  }
  const from = String(query.filters.from ?? ""),
    to = String(query.filters.to ?? "");
  return (
    !(from || to) ||
    (dateValid(from) &&
      dateValid(to) &&
      to >= from &&
      Date.parse(to) - Date.parse(from) <= 89 * 86400000)
  );
};
export const paymentReads = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    adminPayments: builder.query<
      PaymentPage,
      { readonly kind: PaymentKind; readonly paymentId?: string; readonly query: ServerTableQuery }
    >({
      keepUnusedDataFor: 0,
      query: ({ kind, paymentId, query }) => {
        if (
          !validPaymentQuery(query, kind) ||
          (kind !== "payments" && !validPaymentId(paymentId ?? ""))
        )
          throw new Error("Invalid payment query.");
        return {
          method: "GET",
          path:
            kind === "payments"
              ? "/api/admin/payments"
              : `/api/admin/payments/${paymentId}/${kind}`,
          query: serverTableBackendParameters(query, paymentAdapter(kind)),
        };
      },
      transformResponse: (response: unknown, _meta, args) => {
        const page = adaptPaymentPage(response, args.kind, args.paymentId);
        if (
          args.query.filters.from &&
          (!page.period ||
            page.period.from !== args.query.filters.from ||
            page.period.to !== args.query.filters.to)
        )
          throw new Error("Payment requested period rejected.");
        return page;
      },
    }),
    adminPaymentDetail: builder.query<PaymentRecord, { readonly paymentId: string }>({
      keepUnusedDataFor: 0,
      query: ({ paymentId }) => {
        if (!validPaymentId(paymentId)) throw new Error("Invalid payment identity.");
        return { method: "GET", path: `/api/admin/payments/${paymentId}` };
      },
      transformResponse: (response: unknown, _meta, args) =>
        adaptPaymentDetail(response, args.paymentId),
    }),
  }),
});
export const { useAdminPaymentsQuery, useAdminPaymentDetailQuery } = paymentReads;
