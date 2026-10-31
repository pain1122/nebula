import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";

const count = z.number().int().nonnegative().safe();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.iso.datetime({ offset: true });
const id = z.number().int().positive().safe();
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
export const dashboardStates = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
] as const;
const rank = z.object({
  id,
  public_id: publicId,
  name: z.string().max(1000),
  archived: z.boolean(),
  reservations: count,
});
const schema = z.object({
  success: z.literal(true),
  data: z.object({
    period: z.object({
      from: date,
      through: date,
      starts_at: timestamp,
      ends_at: timestamp,
      timezone: z.literal("Asia/Tehran"),
      days: z.literal(30),
    }),
    reservations: z.object({
      created: count,
      upcoming: count,
      states: z.object({
        pending: count,
        confirmed: count,
        completed: count,
        cancelled: count,
        expired: count,
      }),
    }),
    medical_requests: z.object({
      created: count,
      states: z.object({ open: count, in_review: count, completed: count, cancelled: count }),
    }),
    submissions: z.object({ created: count }),
    accounts: z.object({ patients: count, doctors: count, verified_doctors: count }),
    payments: z.object({
      paid: count,
      inconsistent_paid: count,
      pending_requests: count,
      more_currencies: z.boolean(),
      by_currency: z
        .array(
          z.object({
            currency: z.string().regex(/^[A-Z]{3}$/),
            amount: z.string().regex(/^(?:0|[1-9]\d{0,64})$/),
            payments: count,
          }),
        )
        .max(20),
    }),
    trends: z.object({
      dates: z.array(date).length(30),
      bookings: z.array(count).length(30),
      completions: z.array(count).length(30),
      submissions: z.array(count).length(30),
    }),
    rankings: z.object({ doctors: z.array(rank).max(5), checkups: z.array(rank).max(5) }),
    latest_reservations: z
      .array(
        z.object({
          id,
          public_id: publicId,
          patient: z.string().max(1000),
          doctor: z.string().max(1000),
          checkup: z.string().max(1000),
          status: z.enum(dashboardStates),
          starts_at: timestamp.nullable(),
          created_at: timestamp,
        }),
      )
      .max(5),
    locations: z.object({ available: z.literal(false) }),
    updates: z.object({ available: z.literal(false), reserved: z.literal(true) }),
  }),
  meta: z.object({
    read_only: z.literal(true),
    filters_supported: z.literal(false),
    generated_at: timestamp,
    latest_limit: z.literal(5),
    rank_limit: z.literal(5),
    currency_limit: z.literal(20),
    payment_basis: z.literal("currently_paid_canonical_payments_created_in_period"),
    updates_reserved: z.literal(true),
  }),
});
export type Dashboard = z.infer<typeof schema>;
export const adaptDashboard = (wire: unknown): Dashboard => {
  const result = schema.parse(wire),
    data = result.data;
  if (
    data.trends.dates[0] !== data.period.from ||
    data.trends.dates[29] !== data.period.through ||
    Date.parse(data.period.ends_at) > Date.parse(result.meta.generated_at) ||
    Date.parse(data.period.starts_at) >= Date.parse(data.period.ends_at) ||
    data.reservations.created !==
      Object.values(data.reservations.states).reduce((a, b) => a + b, 0) ||
    data.medical_requests.created !==
      Object.values(data.medical_requests.states).reduce((a, b) => a + b, 0) ||
    data.trends.bookings.reduce((a, b) => a + b, 0) !== data.reservations.created ||
    data.trends.submissions.reduce((a, b) => a + b, 0) !== data.submissions.created ||
    data.accounts.verified_doctors > data.accounts.doctors ||
    new Set(data.payments.by_currency.map((row) => row.currency)).size !==
      data.payments.by_currency.length ||
    (!data.payments.more_currencies &&
      data.payments.by_currency.reduce((a, row) => a + row.payments, 0) !== data.payments.paid)
  )
    throw new Error("Dashboard metrics rejected.");
  for (let i = 1; i < 30; i++)
    if (Date.parse(data.trends.dates[i]!) - Date.parse(data.trends.dates[i - 1]!) !== 86400000)
      throw new Error("Dashboard period rejected.");
  return result;
};
export const readDashboard = async (signal: AbortSignal) => {
  signal.throwIfAborted();
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: "/api/admin/dashboard",
    signal,
  });
  signal.throwIfAborted();
  if (response.status !== 200) throw new Error("Dashboard response rejected.");
  return adaptDashboard(response.data);
};
