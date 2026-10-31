import { z } from "../forms";
import { imageSnapshotSchema } from "./media";

export const publicationTimezone = "Asia/Tehran" as const;
const localPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;

// Validate the wall-clock fields, without converting through the browser's own timezone.
export const validPublicationInput = (value: string): boolean => {
  if (value === "") return true;
  if (!localPattern.test(value)) return false;
  const date = new Date(value + ":00Z");
  return (
    Number(value.slice(0, 4)) >= 2000 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 16) === value
  );
};

export const publicationSchema = z
  .object({
    local_time: z.string().refine((v) => v !== "" && validPublicationInput(v)),
    timezone: z.literal(publicationTimezone),
    publish_at: z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/),
  })
  .strict()
  .refine((value) => {
    const instant = new Date(value.publish_at);
    if (
      !Number.isFinite(instant.getTime()) ||
      instant.toISOString().slice(0, 19) + "Z" !== value.publish_at
    )
      return false;
    const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      timeZone: publicationTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === value.local_time;
  });

export const presentationSchema = z
  .object({
    publication: publicationSchema.nullable(),
    thumbnail: z
      .object({
        asset: imageSnapshotSchema,
        alt: z.object({ en: z.string().max(255), fa: z.string().max(255) }).strict(),
      })
      .strict()
      .nullable(),
    inline: z
      .array(z.object({ asset: imageSnapshotSchema, language: z.enum(["en", "fa"]) }).strict())
      .max(30),
  })
  .strict();
