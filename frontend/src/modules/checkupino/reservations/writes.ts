import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";
import {
  adaptAdminReservation,
  reservationActionsSchema,
  overrideStates,
  type AdminReservation,
} from "./admin";

const identifier = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const date = z
  .string()
  .regex(/^\d{4}-\d\d-\d\d$/)
  .refine((value) => {
    const parsed = Date.parse(value + "T00:00:00Z");
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  });
const timestamp = z.iso.datetime({ offset: true });
const rangeSchema = z
  .object({ from: date, to: date, page: z.number().int().min(1).max(1000) })
  .refine(
    (query) =>
      query.to >= query.from && (Date.parse(query.to) - Date.parse(query.from)) / 86400000 < 31,
  );
export type SlotQuery = z.infer<typeof rangeSchema>;
const slotSchema = z.object({
  slot_id: publicId,
  starts_at: timestamp,
  ends_at: timestamp,
  duration_minutes: z.number().int().positive().max(1440),
});
const slotsSchema = z.object({
  reservation_id: identifier,
  actions: reservationActionsSchema,
  booked_amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  booked_currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string(),
  items: z.array(slotSchema).max(100),
  pagination: z.object({
    current_page: z.number().int().min(1).max(1000),
    per_page: z.number().int().min(1).max(100),
    last_page: z.number().int().positive(),
    total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
});
export type ReplacementSlots = z.infer<typeof slotsSchema>;
export type ReservationAction =
  | { readonly kind: "reschedule"; readonly slotId: string }
  | { readonly kind: "override"; readonly status: (typeof overrideStates)[number] };
export class ReservationActionConflict extends Error {
  constructor() {
    super("Reservation action eligibility changed; refresh before continuing.");
  }
}
export const validSlotQuery = (query: SlotQuery) => rangeSchema.safeParse(query).success;
export const initialSlotQuery = (row: AdminReservation): SlotQuery => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: row.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(row.actions?.generated_at ?? row.starts_at));
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  const from = `${part("year")}-${part("month")}-${part("day")}`;
  const to = new Date(Date.parse(from + "T00:00:00Z") + 13 * 86400000).toISOString().slice(0, 10);
  return rangeSchema.parse({ from, to, page: 1 });
};
export const readAdminReservation = async (id: number, signal?: AbortSignal) => {
  identifier.parse(id);
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: `/api/admin/reservations/${id}`,
    signal,
  });
  return adaptAdminReservation(response.data, id);
};
export const adaptReplacementSlots = (
  wire: unknown,
  row: AdminReservation,
  query: SlotQuery,
): ReplacementSlots => {
  const result = z.object({ data: slotsSchema }).parse(wire).data;
  if (
    result.reservation_id !== row.id ||
    result.actions.revision !== row.actions?.revision ||
    !result.actions.can_reschedule ||
    result.booked_amount !== row.booked_amount ||
    result.booked_currency !== row.booked_currency ||
    result.timezone !== row.timezone ||
    result.pagination.current_page !== query.page ||
    result.pagination.per_page !== 20 ||
    result.items.length > result.pagination.per_page ||
    new Set(result.items.map((slot) => slot.slot_id)).size !== result.items.length ||
    result.items.some(
      (slot) =>
        Date.parse(slot.ends_at) <= Date.parse(slot.starts_at) ||
        (Date.parse(slot.ends_at) - Date.parse(slot.starts_at)) / 60000 !== slot.duration_minutes,
    )
  )
    throw new ReservationActionConflict();
  return result;
};
export const readReplacementSlots = async (
  row: AdminReservation,
  query: SlotQuery,
  signal?: AbortSignal,
) => {
  identifier.parse(row.id);
  const valid = rangeSchema.parse(query);
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: `/api/admin/reservations/${row.id}/reschedule-slots`,
    query: { ...valid, per_page: 20 },
    signal,
  });
  return adaptReplacementSlots(response.data, row, valid);
};
export const saveReservationAction = async (
  row: AdminReservation,
  action: ReservationAction,
  reason: string,
  signal?: AbortSignal,
) => {
  if (!row.actions) throw new ReservationActionConflict();
  const shared = {
    reason: z.string().trim().min(1).max(1000).parse(reason),
    expected_revision: row.actions.revision,
  };
  const body =
    action.kind === "reschedule"
      ? { ...shared, slot_id: publicId.parse(action.slotId) }
      : { ...shared, status: z.enum(overrideStates).parse(action.status) };
  const response = await checkupinoTransport.request<unknown>({
    method: "PUT",
    path: `/api/admin/reservations/${row.id}/${action.kind === "reschedule" ? "schedule" : "status"}`,
    body,
    signal,
  });
  const saved = adaptAdminReservation(response.data, row.id);
  if (
    saved.public_id !== row.public_id ||
    saved.booked_amount !== row.booked_amount ||
    saved.booked_currency !== row.booked_currency ||
    !saved.actions ||
    saved.actions.revision === row.actions.revision ||
    (action.kind === "override" && saved.status !== action.status)
  )
    throw new ReservationActionConflict();
  return saved;
};
