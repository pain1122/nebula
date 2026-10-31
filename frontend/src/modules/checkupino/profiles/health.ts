import { z } from "../forms";
import { clinicalRequest } from "./onboarding";
import { normalizeNumericInput } from "../preferences/localization";

export const healthStatuses = ["yes", "no", "unknown", "declined"] as const;
export const lifestyleCodes = [
  "smoking",
  "alcohol",
  "low_activity",
  "stress",
  "family_history",
] as const;
const status = z.enum(healthStatuses);
const selection = z.object({ status, codes: z.array(z.string()).max(30) }).strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const facts = z
  .object({
    birth_date: date.nullable().optional(),
    gender: z.enum(["male", "female"]).nullable().optional(),
    conditions: selection.nullable().optional(),
    allergies: selection.nullable().optional(),
    smoking: status.nullable().optional(),
    alcohol: status.nullable().optional(),
    low_activity: status.nullable().optional(),
    stress: status.nullable().optional(),
    family_history: status.nullable().optional(),
  })
  .strict();
const observation = z
  .object({
    id: z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i),
    metric: z.enum(["weight", "height"]),
    value: z.string().regex(/^\d+\.\d{2}$/),
    unit: z.enum(["kg", "cm"]),
    measured_on: date,
    recorded_at: z.string(),
    source: z.literal("self_report"),
  })
  .strict();
export const healthProfile = z
  .object({
    owner_id: z.string(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    schema_version: z.literal(1),
    version: z.number().int().nonnegative(),
    recorded_at: z.string().nullable(),
    catalog: z
      .object({
        version: z.string(),
        terms: z
          .array(
            z
              .object({
                id: z.string(),
                kind: z.enum(["condition", "allergy"]),
                active: z.boolean(),
                labels: z.object({ en: z.string(), fa: z.string() }).strict(),
              })
              .strict(),
          )
          .max(500),
      })
      .strict(),
    facts,
    provenance: z.record(
      z.string(),
      z
        .object({
          value: z.union([z.string(), selection, z.null()]),
          source: z.literal("self_report"),
          asserted_at: z.string(),
        })
        .strict(),
    ),
    measurements: z
      .object({ weight: observation.optional(), height: observation.optional() })
      .strict(),
    age: z.number().int().nonnegative().nullable(),
    bmi: z.number().positive().nullable(),
    history: z
      .object({ weight: z.array(observation).max(20), height: z.array(observation).max(20) })
      .strict(),
    history_truncated: z.object({ weight: z.boolean(), height: z.boolean() }).strict(),
  })
  .strict();
export type HealthProfile = z.infer<typeof healthProfile>;
export type HealthFacts = z.infer<typeof facts>;
export type HealthSelection = z.infer<typeof selection>;
export type HealthMetric = "weight" | "height";
export type MeasurementDraft = { value: string; measured_on: string } | null;
export const readHealth = (signal: AbortSignal) =>
  clinicalRequest("GET", "/api/my/health-profile", healthProfile, signal);

/** Send only intentional edits. Never refresh an unchanged measurement's assertion time. */
export function healthChanges(
  profile: HealthProfile,
  draft: HealthFacts,
  measurements: Record<HealthMetric, MeasurementDraft>,
) {
  const changes: HealthFacts = {};
  for (const key of Object.keys(draft) as (keyof HealthFacts)[]) {
    if (JSON.stringify(draft[key] ?? null) !== JSON.stringify(profile.facts[key] ?? null))
      Object.assign(changes, { [key]: draft[key] ?? null });
  }
  const changedMeasurements: Partial<Record<HealthMetric, MeasurementDraft>> = {};
  for (const metric of ["weight", "height"] as const) {
    const item = measurements[metric],
      previous = profile.measurements[metric];
    if (!item) {
      if (previous) changedMeasurements[metric] = null;
      continue;
    }
    const value = normalizeNumericInput(item.value);
    // Canonical decimal string comparison without allowing exponent/grouped/negative notation.
    const match = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(value);
    const canonical = match ? `${Number(match[1])}.${(match[2] ?? "").padEnd(2, "0")}` : value;
    if (canonical !== previous?.value || item.measured_on !== previous?.measured_on)
      changedMeasurements[metric] = { value, measured_on: normalizeNumericInput(item.measured_on) };
  }
  return { changes, measurements: changedMeasurements };
}
