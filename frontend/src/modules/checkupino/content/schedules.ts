import { z } from "../forms";
import { articleSchema, contentId, validateArticle, contentDate } from "./api";
import { publicationTimezone } from "./publication";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const stamp = z
  .string()
  .max(64)
  .refine((v) => Number.isFinite(Date.parse(contentDate(v) ?? "")));
export const scheduleSchema = z
  .object({
    id: contentId,
    article_id: contentId,
    version: z.number().int().min(1).max(4294967295),
    content_hash: hash,
    publish_at: stamp,
    timezone: z.literal(publicationTimezone),
    status: z.enum(["armed", "cancelled", "blocked", "published"]),
    revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    blocker: z.string().max(64).nullable(),
    finished_at: stamp.nullable(),
    actor: z.object({ id: contentId, name: z.string().nullable() }),
  })
  .refine(
    (v) =>
      (v.status === "armed") === (v.finished_at === null) &&
      (v.status === "armed" || v.status === "published" ? v.blocker === null : !!v.blocker),
  );
const contextSchema = z.object({
  action: z.enum(["arm", "cancel"]),
  current: articleSchema,
  schedule: scheduleSchema.nullable(),
  eligible: z.boolean(),
  blockers: z
    .array(
      z.enum([
        "archived",
        "wrong_state",
        "already_published",
        "incomplete_translation",
        "inactive_taxonomy_reference",
        "media_unavailable",
        "media_not_released",
        "media_integrity_unavailable",
        "publisher_unavailable",
        "already_armed",
        "reviewer_authority_revoked",
        "invalid_publication_time",
        "not_armed",
      ]),
    )
    .max(20),
  timezone: z.literal(publicationTimezone),
  runner_available: z.boolean(),
  revision: hash,
});
const unwrap = (wire: unknown) =>
  z.object({ success: z.literal(true), data: z.unknown() }).parse(wire).data;
export const parseScheduleContext = (wire: unknown, id: string, action: "arm" | "cancel") => {
  const value = contextSchema.parse(unwrap(wire));
  value.current = validateArticle(value.current, id, true);
  if (
    value.action !== action ||
    value.eligible !== (value.blockers.length === 0) ||
    (value.schedule &&
      (value.schedule.article_id !== contentId.parse(id) ||
        value.schedule.version > value.current.working.version)) ||
    (value.eligible &&
      action === "arm" &&
      (!value.runner_available || value.current.working_state !== "reviewed")) ||
    (value.eligible && action === "cancel" && value.schedule?.status !== "armed")
  )
    throw new Error("Invalid article schedule context.");
  return value;
};
export const parseScheduleResult = (wire: unknown, id: string) => {
  const value = z.object({ schedule: scheduleSchema }).parse(unwrap(wire));
  if (value.schedule.article_id !== contentId.parse(id))
    throw new Error("Schedule ownership rejected.");
  return value.schedule;
};
