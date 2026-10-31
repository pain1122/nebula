import type { ListResult } from "../../../core";
import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import {
  adaptModernAdminList,
  adminReservationsParameters,
  type AdminReservationsQuery,
} from "../query/lists";
import {
  parseServerTableQuery,
  serverTableBackendParameters,
  type ServerTableEndpointAdapter,
  type ServerTableQuery,
} from "../table";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const timestamp = z.iso.datetime({ offset: true });
export const reservationStates = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
] as const;
export const paymentStates = ["unpaid", "paid", "reconciliation", "refunded", "voided"] as const;
export const overrideStates = ["confirmed", "completed", "cancelled", "expired"] as const;
export const reservationActionsSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  generated_at: timestamp,
  can_reschedule: z.boolean(),
  allowed_statuses: z
    .array(z.enum(overrideStates))
    .max(4)
    .refine((values) => new Set(values).size === values.length),
});
const reservationSchema = z.object({
  id,
  public_id: publicId,
  starts_at: timestamp,
  ends_at: timestamp,
  status: z.enum(reservationStates),
  booked_amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  booked_currency: z.string().regex(/^[A-Z]{3}$/),
  doctor_workplace_id: id,
  hospital_name: z.string().nullable(),
  timezone: z.string(),
  hold_expires_at: timestamp.nullable(),
  completed_at: timestamp.nullable(),
  created_at: timestamp.nullable(),
  actions: reservationActionsSchema.nullable().optional().default(null),
  patient: z
    .object({ id, public_id: publicId, name: z.string().nullable(), email: z.string().nullable() })
    .nullable(),
  doctor: z
    .object({
      id,
      public_id: publicId,
      user_id: id,
      name: z.string().nullable(),
      specialty: z.string().nullable(),
    })
    .nullable(),
  checkup: z.object({ id, public_id: publicId, title: z.string() }).nullable(),
  payment: z
    .object({
      id,
      public_id: publicId,
      amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      currency: z.string().regex(/^[A-Z]{3}$/),
      status: z.enum(paymentStates),
      provider: z.string().nullable(),
    })
    .nullable(),
});
export type AdminReservation = z.infer<typeof reservationSchema>;
export type ReservationReadQuery = AdminReservationsQuery & {
  readonly workplaceId?: number;
  readonly period?: "today" | "upcoming";
};

export const adaptAdminReservation = (response: unknown, expectedId: number): AdminReservation => {
  const row = z.object({ data: reservationSchema }).parse(response).data;
  if (row.id !== expectedId || Date.parse(row.ends_at) <= Date.parse(row.starts_at))
    throw new Error("Reservation detail identity or time contract rejected.");
  if (
    ["completed", "cancelled", "expired"].includes(row.status) &&
    row.actions &&
    (row.actions.can_reschedule || row.actions.allowed_statuses.length)
  )
    throw new Error("Terminal reservation action contract rejected.");
  return row;
};
export const adaptAdminReservationList = (response: unknown): ListResult<AdminReservation> => {
  const list = adaptModernAdminList<unknown>(response);
  if (list.page.perPage > 100 || list.items.length > list.page.perPage)
    throw new Error("Reservation page bound rejected.");
  const rows = list.items.map((item) => reservationSchema.parse(item));
  if (
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    new Set(rows.map((row) => row.public_id)).size !== rows.length ||
    rows.some((row) => Date.parse(row.ends_at) <= Date.parse(row.starts_at))
  )
    throw new Error("Reservation list identity or time contract rejected.");
  return { ...list, items: rows };
};
export const adminReservationReads = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    adminReservationPanelList: builder.query<ListResult<AdminReservation>, ReservationReadQuery>({
      keepUnusedDataFor: 0,
      providesTags: [{ type: "AdminReservations", id: "LIST" }],
      query: (filters) => ({
        method: "GET",
        path: "/api/admin/reservations",
        query: {
          ...adminReservationsParameters(filters),
          workplace_id: filters.workplaceId,
          period: filters.period,
        },
      }),
      transformResponse: adaptAdminReservationList,
    }),
    adminReservationPanelDetail: builder.query<AdminReservation, number>({
      keepUnusedDataFor: 0,
      providesTags: (_row, _error, reservationId) => [
        { type: "AdminReservations", id: reservationId },
      ],
      query: (reservationId) => {
        id.parse(reservationId);
        return { method: "GET", path: "/api/admin/reservations/" + reservationId };
      },
      transformResponse: (response: unknown, _meta, reservationId) =>
        adaptAdminReservation(response, reservationId),
    }),
  }),
});
export const { useAdminReservationPanelListQuery, useAdminReservationPanelDetailQuery } =
  adminReservationReads;

const positiveId = (value: string) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : undefined;
const validDate = (value: string) =>
  /^\d{4}-\d\d-\d\d$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
    ? value
    : undefined;
const choice = (values: readonly string[]) => (value: string) =>
  values.includes(value) ? value : undefined;
const fromParameter = "from";
export const adminReservationAdapter: ServerTableEndpointAdapter<AdminReservation> = {
  defaultPerPage: 20,
  maxPerPage: 100,
  getRowIdentifier: (row) => row.id,
  getRouteIdentifier: (row) => row.id,
  sortableColumns: {
    id: "id",
    patient_name: "patient_name",
    doctor_name: "doctor_name",
    checkup_title: "checkup_title",
    starts_at: "starts_at",
    status: "status",
    payment_status: "payment_status",
  },
  filters: {
    doctor_id: { parameter: "doctor_id", parse: positiveId },
    user_id: { parameter: "user_id", parse: positiveId },
    workplace_id: { parameter: "workplace_id", parse: positiveId },
    checkup_id: { parameter: "checkup_id", parse: positiveId },
    status: { parameter: "status", parse: choice(reservationStates) },
    payment_status: { parameter: "payment_status", parse: choice(paymentStates) },
    from: { parameter: fromParameter, parse: validDate },
    to: { parameter: "to", parse: validDate },
    period: { parameter: "period", parse: choice(["today", "upcoming"]) },
  },
};
export const adminReservationRequest = (query: ServerTableQuery): ReservationReadQuery => {
  const parameters = serverTableBackendParameters(query, adminReservationAdapter);
  const canonical = new URLSearchParams(parameters);
  const parseId = (name: string) => positiveId(canonical.get(name) ?? "");
  const parsedStatus = z.enum(reservationStates).safeParse(canonical.get("status"));
  const parsedPayment = z.enum(paymentStates).safeParse(canonical.get("payment_status"));
  const parsedSort = z
    .enum([
      "id",
      "patient_name",
      "doctor_name",
      "checkup_title",
      "starts_at",
      "status",
      "payment_status",
    ])
    .safeParse(canonical.get("sort_by"));
  const parsedPeriod = z.enum(["today", "upcoming"]).safeParse(canonical.get("period"));
  return {
    page: Math.min(query.page, 100000),
    perPage: Math.min(query.perPage, 100),
    q: query.search || undefined,
    doctorId: parseId("doctor_id"),
    userId: parseId("user_id"),
    checkupId: parseId("checkup_id"),
    workplaceId: parseId("workplace_id"),
    status: parsedStatus.success ? parsedStatus.data : undefined,
    paymentStatus: parsedPayment.success ? parsedPayment.data : undefined,
    from: validDate(canonical.get("from") ?? ""),
    to: validDate(canonical.get("to") ?? ""),
    sortBy: parsedSort.success ? parsedSort.data : undefined,
    sortDirection: parsedSort.success ? query.sort?.direction : undefined,
    period: parsedPeriod.success ? parsedPeriod.data : undefined,
  };
};

export const parseAdminReservationQuery = (parameters: URLSearchParams): ServerTableQuery => {
  const query = parseServerTableQuery(parameters, adminReservationAdapter);
  return { ...query, page: Math.min(query.page, 100000) };
};
export const adminReservationQueryIssue = (
  query: ServerTableQuery,
): "searchTooLong" | "dateOrder" | null => {
  if (Array.from(query.search).length > 200) return "searchTooLong";
  const { from, to } = query.filters;
  return typeof from === "string" && typeof to === "string" && from > to ? "dateOrder" : null;
};
