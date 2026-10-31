import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";
import { dashboardStates } from "./api";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value,
  );
const timestamp = z.iso.datetime({ offset: true });
export const calendarRange = z.object({ from: date, until: date }).refine(({ from, until }) => {
  const days = (Date.parse(until) - Date.parse(from)) / 86400000;
  return days >= 1 && days <= 42;
});
export type CalendarRange = z.infer<typeof calendarRange>;
const schema = z.object({
  success: z.literal(true),
  data: z.object({
    owner_id: z.number().int().positive().optional(),
    scope: z.literal("doctor_confirmed").optional(),
    from: date,
    until: date,
    timezone: z.literal("Asia/Tehran"),
    limit: z.literal(200),
    has_more: z.boolean(),
    appointments: z
      .array(
        z.object({
          id: z.number().int().positive().safe(),
          public_id: z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i),
          patient: z.string().max(1000),
          doctor: z.string().max(1000),
          checkup: z.string().max(1000),
          status: z.enum(dashboardStates),
          starts_at: timestamp,
          ends_at: timestamp,
        }),
      )
      .max(200),
  }),
  meta: z.object({ read_only: z.literal(true), generated_at: timestamp }),
});
export type AppointmentCalendar = z.infer<typeof schema>;

// FullCalendar's installed plugins have no named-zone engine. Supply Tehran wall
// times on its UTC display clock; browser-local offsets must never move a booking.
export const tehranCalendarTime = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
};
export const adaptAppointmentCalendar = (
  wire: unknown,
  range: CalendarRange,
): AppointmentCalendar => {
  calendarRange.parse(range);
  const result = schema.parse(wire),
    data = result.data;
  const start = Date.parse(range.from + "T00:00:00Z"),
    end = Date.parse(range.until + "T00:00:00Z");
  if (
    data.from !== range.from ||
    data.until !== range.until ||
    new Set(data.appointments.map((row) => row.id)).size !== data.appointments.length ||
    new Set(data.appointments.map((row) => row.public_id)).size !== data.appointments.length ||
    (data.has_more && data.appointments.length !== 200) ||
    data.appointments.some(
      (row) =>
        Date.parse(row.starts_at) >= Date.parse(row.ends_at) ||
        Date.parse(tehranCalendarTime(row.starts_at) + "Z") >= end ||
        Date.parse(tehranCalendarTime(row.ends_at) + "Z") <= start,
    )
  )
    throw new Error("Appointment calendar range or identity rejected.");
  return result;
};
export const readAppointmentCalendar = async (
  range: CalendarRange,
  signal: AbortSignal,
  doctorOwnerId?: number,
) => {
  calendarRange.parse(range);
  signal.throwIfAborted();
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: doctorOwnerId
      ? "/api/doctor/dashboard/appointments"
      : "/api/admin/dashboard/appointments",
    query: range,
    signal,
  });
  signal.throwIfAborted();
  if (response.status !== 200) throw new Error("Appointment calendar response rejected.");
  const result = adaptAppointmentCalendar(response.data, range);
  if (
    doctorOwnerId &&
    (result.data.owner_id !== doctorOwnerId ||
      result.data.scope !== "doctor_confirmed" ||
      result.data.appointments.some((row) => row.status !== "confirmed"))
  )
    throw new Error("Doctor calendar ownership or finalized state rejected.");
  return result;
};
