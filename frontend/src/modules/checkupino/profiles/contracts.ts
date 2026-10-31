import { z } from "../forms";

const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const timestamp = z.iso.datetime({ offset: true }).nullable();
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

// Strip unsolicited fields at every boundary as a second line of defence.
export const panelProfileSchema = z.object({
  user: z.object({
    id: z.number().int().positive(),
    public_id: publicId,
    name: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    role: z.enum(["patient", "doctor", "admin", "root-admin"]).nullable(),
    doctor_profile_id: z.number().int().positive().nullable().default(null),
    account_state: z.enum(["active", "closed", "suspended"]).nullable(),
    created_at: timestamp,
  }),
  mode: z.enum(["self", "support"]),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  editable_fields: z.tuple([z.literal("first_name"), z.literal("last_name")]),
  summary: z.object({
    reservations: count,
    upcoming: count,
    completed: count,
    medical_requests: count,
    published_reports: count,
    questionnaire_submissions: count,
  }),
  reservations: z
    .array(
      z.object({
        public_id: publicId,
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "expired"]),
        starts_at: timestamp,
        ends_at: timestamp,
        timezone: z.string(),
      }),
    )
    .max(10),
  requests: z
    .array(
      z.object({
        public_id: publicId,
        status: z.enum(["open", "in_review", "completed", "cancelled"]),
        created_at: timestamp,
        closed_at: timestamp,
      }),
    )
    .max(10),
  reports: z
    .array(
      z.object({
        public_id: publicId,
        status: z.literal("published"),
        published_at: timestamp,
        is_amendment: z.boolean(),
      }),
    )
    .max(10),
  submissions: z
    .array(z.object({ public_id: publicId, status: z.literal("submitted"), created_at: timestamp }))
    .max(10),
  activity: z
    .array(
      z.object({
        public_id: publicId,
        action: z.enum([
          "reservation.cancelled",
          "reservation.completed",
          "reservation.rescheduled",
          "reservation_file.uploaded",
          "reservation_report.published",
          "profile.display_name.updated",
          "admin.profile.display_name.updated",
        ]),
        created_at: timestamp,
      }),
    )
    .max(10),
});

export type PanelProfile = z.infer<typeof panelProfileSchema>;
export const adaptPanelProfile = (wire: unknown): PanelProfile =>
  panelProfileSchema.parse(z.object({ data: z.unknown() }).parse(wire).data);
