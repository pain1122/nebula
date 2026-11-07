import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { clinicalRequest } from "../profiles/onboarding";
import { parsePatientArticleCard } from "../patientArticles/api";
import { articleRichHtml } from "../content/articleRichHtml";
import { imageIdFromUrl } from "../content/media";
import { recommendationImageUrl } from "../api/transport";

export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | {
      field: string;
      operator: string;
      value?: string | number | (string | number)[];
      unit?: string;
      max_age_days: number | null;
      max_measurement_gap_days?: number;
    };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().regex(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/);
const person = z.object({ id, name: z.string().max(255) }).strict();
const localized = z.object({ en: z.string().max(2000), fa: z.string().max(2000) }).strict();
const leaf = z
  .object({
    field: z.string().max(32),
    operator: z.string().max(32),
    value: z
      .union([
        z.string().max(100),
        z.number().int(),
        z.array(z.union([z.string().max(100), z.number().int()])).length(2),
      ])
      .optional(),
    unit: z.string().max(10).optional(),
    max_age_days: z.number().int().min(0).max(3650).nullable(),
    max_measurement_gap_days: z.number().int().min(0).max(3650).optional(),
  })
  .strict();
export function parseCondition(value: unknown, depth = 1, count = { value: 0 }): ConditionNode {
  if (
    depth > 4 ||
    ++count.value > 64 ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  )
    throw new Error("Invalid condition.");
  if ("all" in value || "any" in value) {
    const all = "all" in value;
    const groupKey = all ? "all" : "any";
    const children = z
      .object({ [groupKey]: z.array(z.unknown()).min(1).max(8) })
      .strict()
      .parse(value)[groupKey];
    const nodes = children.map((child) => parseCondition(child, depth + 1, count));
    return all ? { all: nodes } : { any: nodes };
  }
  const parsed = leaf.parse(value);
  const numeric = ["age_years", "weight_kg", "height_cm", "bmi"].includes(parsed.field);
  const coded = ["conditions", "allergies"].includes(parsed.field);
  if (
    ![
      "age_years",
      "gender",
      "weight_kg",
      "height_cm",
      "bmi",
      "conditions",
      "allergies",
      "smoking",
      "alcohol",
      "low_activity",
      "stress",
      "family_history",
    ].includes(parsed.field) ||
    !(
      numeric
        ? ["eq", "lt", "lte", "gt", "gte", "between"]
        : coded
          ? ["contains", "reported_none"]
          : ["eq"]
    ).includes(parsed.operator) ||
    (parsed.max_age_days === null && !["age_years", "gender"].includes(parsed.field))
  )
    throw new Error("Invalid condition.");
  if (numeric) {
    const values = parsed.operator === "between" ? parsed.value : [parsed.value];
    if (!Array.isArray(values) || values.length !== (parsed.operator === "between" ? 2 : 1))
      throw new Error("Invalid condition.");
    const quantities = values.map((item) => {
      if (parsed.field === "age_years") {
        if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > 150)
          throw new Error("Invalid condition.");
        return item;
      }
      if (typeof item !== "string" || !/^\d{1,4}(?:\.\d{1,2})?$/.test(item))
        throw new Error("Invalid condition.");
      const scaled = Math.round(Number(item) * 100);
      if (scaled < 1 || scaled > (parsed.field === "height_cm" ? 30000 : 100000))
        throw new Error("Invalid condition.");
      return scaled;
    });
    if (quantities.length === 2 && quantities[0] > quantities[1])
      throw new Error("Invalid condition.");
    if (
      parsed.field !== "age_years" &&
      parsed.unit !==
        ({ weight_kg: "kg", height_cm: "cm", bmi: "kg/m2" } as Record<string, string>)[parsed.field]
    )
      throw new Error("Invalid condition.");
    if (parsed.field === "bmi" && parsed.max_measurement_gap_days === undefined)
      throw new Error("Invalid condition.");
  } else if (coded) {
    if (
      parsed.operator === "reported_none"
        ? parsed.value !== undefined
        : typeof parsed.value !== "string" ||
          !new RegExp(
            `^${parsed.field === "conditions" ? "condition" : "allergy"}\\.[a-z_]+$`,
          ).test(parsed.value)
    )
      throw new Error("Invalid condition.");
  } else if (
    typeof parsed.value !== "string" ||
    !(parsed.field === "gender" ? ["male", "female"] : ["yes", "no"]).includes(parsed.value)
  )
    throw new Error("Invalid condition.");
  return parsed;
}
const definition = z
  .object({
    schema_version: z.literal(1),
    health_catalog_version: z.literal("health-2026-10-22.1"),
    include: z.unknown(),
    exclude: z.unknown().nullable(),
  })
  .strict()
  .transform((value) => {
    const count = { value: 0 };
    return {
      ...value,
      include: parseCondition(value.include, 1, count),
      exclude: value.exclude === null ? null : parseCondition(value.exclude, 1, count),
    };
  });
const summary = z.object({
  id,
  slug: z.string().max(160),
  state: z.enum(["draft", "in_review", "reviewed", "rejected", "published", "retired"]),
  working_version: z.number().int().positive(),
  author: person,
  staff: z.boolean(),
  assigned: z.boolean(),
});
export const ruleBoard = z.object({
  items: z.array(summary).max(12),
  pagination: z.object({
    current_page: z.number().int(),
    last_page: z.number().int(),
    total: z.number().int(),
  }),
  designation_candidates: z.array(person).max(20),
  reviewers: z.array(person.extend({ valid_until: z.string() })).max(100),
  grants: z
    .array(
      z.object({
        id,
        reviewer: person,
        scope: z.literal("article"),
        valid_until: z.string(),
        revoked: z.boolean(),
        revoke_revision: hash,
      }),
    )
    .max(100),
  catalog: z.object({
    version: z.literal("health-2026-10-22.1"),
    terms: z
      .array(
        z.object({
          id: z.string(),
          kind: z.enum(["condition", "allergy"]),
          active: z.boolean(),
          labels: localized,
        }),
      )
      .max(100),
  }),
  create_revision: hash.nullable(),
  grant_revision: hash.nullable(),
});
const translation = z
  .object({ title: z.string().max(200), explanation: z.string().max(1000) })
  .strict();
export const ruleDetail = summary.extend({
  working: z.object({
    id,
    version: z.number().int().positive(),
    content_hash: hash,
    recorded_at: z.string(),
    definition,
    translations: z.object({ en: translation, fa: translation }),
    population: localized,
    limitations: localized,
    sources: z
      .array(z.object({ label: z.string().max(200), url: z.string().url().startsWith("https://") }))
      .max(20),
    targets: z
      .array(
        z.object({
          kind: z.literal("article"),
          id,
          version_id: id,
          version: z.number().int().positive(),
          content_hash: hash,
        }),
      )
      .min(1)
      .max(20),
    priority: z.number().int().min(0).max(1000),
  }),
  published_version: z.number().int().nullable(),
  publication_eligible: z.boolean(),
  can_publish: z.boolean(),
  can_review: z.boolean(),
  assigned_reviewer: person.nullable(),
  contexts: z.record(z.string(), hash),
  versions: z
    .array(
      z.object({
        id,
        version: z.number().int().positive(),
        content_hash: hash,
        recorded_at: z.string(),
      }),
    )
    .max(50),
  reviews: z
    .array(
      z.object({
        id,
        version: z.number().int(),
        outcome: z.enum(["approved", "rejected", "withdrawn"]),
        reviewer: person,
        valid_until: z.string(),
        assessment: z.string().max(2000),
        withdrawable: z.boolean(),
        recorded_at: z.string(),
      }),
    )
    .max(50),
  target_previews: z
    .array(
      z.object({
        id,
        version_id: id,
        version: z.number().int().positive(),
        thumbnail: z.object({ id, alt: localized }).nullable(),
        languages: z
          .array(z.enum(["en", "fa"]))
          .min(1)
          .max(2),
        translations: z.record(
          z.string(),
          z.object({ title: z.string(), summary: z.string(), body_html: z.string() }).passthrough(),
        ),
        sources: z.array(
          z.object({
            label: z.string(),
            url: z
              .string()
              .url()
              .refine((value) => {
                const url = new URL(value);
                return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
              }),
          }),
        ),
        images: z.array(z.object({ id, language: z.enum(["en", "fa"]) })).max(62),
      }),
    )
    .max(20),
});
export const mutationReceipt = z.object({ id, applied: z.literal(true) });
export const syntheticPreview = z
  .object({
    rule_version_id: id,
    case: z.enum(["missing", "unknown", "recent", "stale"]),
    outcome: z.enum(["match", "no_match", "excluded", "insufficient_data"]),
  })
  .strict();
export type RuleBoard = z.infer<typeof ruleBoard>;
export type RuleDetail = z.infer<typeof ruleDetail>;
export type RuleContent = Omit<
  RuleDetail["working"],
  "id" | "version" | "content_hash" | "recorded_at" | "targets"
> & { targets: string[] };
export async function ruleRequest<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const segment = "[0-7][0-9a-hjkmnp-tv-z]{25}";
  const pathname = path.split("?")[0];
  const read = new RegExp(
    `^/api/(?:admin|doctor)/recommendation-rules(?:/${segment}(?:/preview)?)?$`,
  );
  const write = new RegExp(
    `^/api/admin/recommendation-rules(?:/${segment}|/reviewer-grants(?:/${segment}/revoke)?|/${segment}/actions)?$|^/api/doctor/recommendation-rules/${segment}/actions$`,
  );
  if (!(method === "GET" ? read : write).test(pathname))
    throw new Error("Recommendation scope rejected.");
  return clinicalRequest(method, path, schema, signal, body);
}
export const personalSuggestions = z
  .object({
    state: z.enum(["unavailable", "insufficient_information", "no_matches", "matched"]),
    items: z
      .array(
        z
          .object({
            article: z.unknown().transform(parsePatientArticleCard),
            explanation: z.string().max(1000),
            explanation_language: z.enum(["en", "fa"]),
            rule_version_id: id,
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
const endpoints = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    personalSuggestions: builder.query<
      z.infer<typeof personalSuggestions>,
      { language: "en" | "fa"; articleId: string }
    >({
      keepUnusedDataFor: 0,
      query: ({ language, articleId }) => ({
        method: "GET",
        path: "/api/my/recommendations",
        query: { language, article_id: id.parse(articleId) },
      }),
      transformResponse: (wire: unknown) =>
        personalSuggestions.parse(
          z.object({ success: z.literal(true), data: z.unknown() }).parse(wire).data,
        ),
    }),
  }),
});
export const { usePersonalSuggestionsQuery } = endpoints;

export function rulePreviewHtml(
  preview: RuleDetail["target_previews"][number],
  language: "en" | "fa",
  ruleId: string,
  version: number,
  doctor: boolean,
): string {
  const images = preview.images
    .filter((image) => image.language === language)
    .map((image) => image.id);
  const template = document.createElement("template");
  template.innerHTML = articleRichHtml(
    preview.translations[language]?.body_html ?? "",
    images,
    true,
  );
  for (const image of template.content.querySelectorAll("img")) {
    const asset = imageIdFromUrl(image.getAttribute("src") ?? "");
    if (!asset || !images.includes(asset)) {
      image.remove();
      continue;
    }
    image.setAttribute(
      "src",
      recommendationImageUrl(ruleId, version, preview.id, asset, language, doctor),
    );
  }
  return template.innerHTML;
}
