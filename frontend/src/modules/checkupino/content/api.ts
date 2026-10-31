import { z } from "../forms";
import { checkupinoTransport } from "../api/transport";
import { TransportError } from "../api/wire";
import { seoSchema } from "./seo";
import { presentationSchema } from "./publication";

export const contentId = z
  .string()
  .regex(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/i)
  .transform((v) => v.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const versionNumber = count.min(1).max(4294967295);
const text = z.string().max(80000);
const localized = z.object({ en: text.optional(), fa: text.optional() });
const actor = z.object({ id: contentId, name: z.string().nullable() });
const timestamp = z
  .string()
  .max(64)
  .refine((value) =>
    Number.isFinite(
      Date.parse(
        /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(" ", "T") + "Z" : value,
      ),
    ),
  )
  .nullable();
export const termKinds = ["category", "topic", "tag"] as const;
export const editorialActions = ["submit", "review", "publish", "archive", "copy_version"] as const;
export type EditorialAction = (typeof editorialActions)[number];
export type TermKind = (typeof termKinds)[number];
export const termSchema = z.object({
  id: contentId,
  version_id: contentId,
  kind: z.enum(termKinds),
  slug: z.string().max(160),
  version: versionNumber,
  labels: localized,
  descriptions: localized,
  is_active: z.boolean(),
  parent_id: contentId.nullable(),
  currently_active: z.boolean().optional(),
  actor: actor.optional(),
  recorded_at: timestamp.optional(),
  created_at: timestamp.optional(),
  updated_at: timestamp.optional(),
  is_current: z.boolean().optional(),
});
const healthReference = z.object({
  id: z.string().regex(/^(condition|allergy)\.[a-z_]+$/),
  kind: z.enum(["condition", "allergy"]),
  labels: localized,
});
export const versionSchema = z
  .object({
    id: contentId,
    version: versionNumber,
    schema_version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    presentation: presentationSchema.optional(),
    translations: z.object({
      en: z
        .object({
          title: text,
          summary: text,
          body_html: text.optional(),
          seo: seoSchema.optional(),
        })
        .optional(),
      fa: z
        .object({
          title: text,
          summary: text,
          body_html: text.optional(),
          seo: seoSchema.optional(),
        })
        .optional(),
    }),
    health_catalog_version: z.literal("health-2026-10-22.1"),
    health_references: z.array(healthReference).max(30).optional(),
    source_links: z
      .array(z.object({ url: z.string().max(8192), label: text }))
      .max(20)
      .optional(),
    taxonomy: z.array(termSchema).max(30),
    content_hash: hash,
    publishable_languages: z.array(z.enum(["en", "fa"])).max(2),
    actor,
    recorded_at: timestamp,
  })
  .refine((v) => (v.schema_version === 3) === (v.presentation !== undefined));
export const articleSchema = z.object({
  id: contentId,
  slug: z.string().max(160),
  author: actor,
  working_state: z.enum(["draft", "in_review", "reviewed", "published"]),
  status: z.enum([
    "draft",
    "in_review",
    "reviewed",
    "published",
    "published_with_draft",
    "archived",
  ]),
  has_unpublished_changes: z.boolean(),
  working: versionSchema,
  published: versionSchema.nullable(),
  review: z
    .object({
      version: versionNumber,
      content_hash: hash,
      actor,
      recorded_at: timestamp,
      kind: z.literal("editorial"),
    })
    .nullable(),
  created_at: timestamp,
  updated_at: timestamp,
  archived_at: timestamp,
  scheduling_enabled: z.boolean().optional(),
});
const pagination = z.object({
  current_page: count.min(1).max(10000),
  last_page: count.min(1),
  per_page: count.min(1).max(50),
  total: count,
});
export const eventSchema = z.object({
  id: contentId,
  action: z.enum([
    "admin.article.created",
    "admin.article.draft_saved",
    "admin.article.submitted",
    "admin.article.reviewed",
    "admin.article.published",
    "admin.article.archived",
    "admin.article.version_copied",
  ]),
  actor,
  before: z
    .object({
      version: versionNumber,
      working_state: z.string(),
      published_version: versionNumber.nullable(),
    })
    .nullable(),
  after: z.object({
    version: versionNumber,
    working_state: z.string(),
    published_version: versionNumber.nullable(),
    source_version_id: contentId.optional(),
    archived: z.boolean().optional(),
  }),
  recorded_at: timestamp,
  kind: z.literal("editorial"),
});
export const draftContextSchema = z.object({
  id: contentId.nullable(),
  current: articleSchema.nullable(),
  revision: hash,
  catalog_revision: count,
  can_create: z.boolean(),
  can_update: z.boolean(),
  can_edit_slug: z.boolean(),
  presentation_enabled: z.boolean().optional(),
  composer_enabled: z.boolean().optional(),
  media_enabled: z.boolean().optional(),
  scheduling_available: z.boolean().optional(),
  health_catalog: z.object({
    version: z.literal("health-2026-10-22.1"),
    terms: z.array(healthReference.extend({ active: z.boolean() })).max(100),
  }),
});
export const termContextSchema = z.object({
  id: contentId.nullable(),
  current: termSchema.nullable(),
  revision: hash,
  catalog_revision: count,
  can_create: z.boolean(),
  can_update: z.boolean(),
  can_retire: z.boolean(),
});
export const actionContextSchema = z.object({
  action: z.enum(editorialActions),
  current: articleSchema,
  source: versionSchema.nullable(),
  eligible: z.boolean(),
  blockers: z.array(
    z.enum([
      "archived",
      "source_not_older",
      "no_content_change",
      "wrong_state",
      "already_published",
      "incomplete_translation",
      "inactive_taxonomy_reference",
      "media_unavailable",
      "media_not_released",
      "media_integrity_unavailable",
    ]),
  ),
  review_kind: z.literal("editorial"),
  catalog_revision: count,
  revision: hash,
});
export type Article = z.infer<typeof articleSchema>;
export type ArticleVersion = z.infer<typeof versionSchema>;
export type ArticleTerm = z.infer<typeof termSchema>;
export type ArticleEvent = z.infer<typeof eventSchema>;
export type DraftContext = z.infer<typeof draftContextSchema>;
export type TermContext = z.infer<typeof termContextSchema>;
export type ActionContext = z.infer<typeof actionContextSchema>;
export type Page<T> = { data: T[]; pagination: z.infer<typeof pagination> };
export type ContentQuery = Record<string, string | number | undefined>;
const fullVersion = (v: ArticleVersion) => {
  if (v.health_references === undefined || v.source_links === undefined)
    throw new Error("Incomplete content rejected.");
  for (const lang of ["en", "fa"] as const) {
    const translation = v.translations[lang];
    if (
      translation &&
      ((v.schema_version >= 2 && !translation.seo) || (v.schema_version === 1 && translation.seo))
    )
      throw new Error("Invalid versioned SEO metadata.");
    if (translation && typeof translation.body_html !== "string")
      throw new Error("Missing article body.");
  }
  return v;
};
export const validateArticle = (input: unknown, id?: string, full = false): Article => {
  const a = articleSchema.parse(input);
  const expectedStatus = a.archived_at
    ? "archived"
    : a.published
      ? a.has_unpublished_changes
        ? "published_with_draft"
        : "published"
      : a.working_state;
  if (
    a.status !== expectedStatus ||
    (a.working_state === "reviewed" || a.working_state === "published") !== !!a.review ||
    (a.working_state === "published" && a.published?.id !== a.working.id)
  )
    throw new Error("Invalid editorial state.");
  if (
    (id && a.id !== contentId.parse(id)) ||
    (a.published && a.published.version > a.working.version) ||
    a.has_unpublished_changes !== (!!a.published && a.published.version !== a.working.version) ||
    (a.archived_at !== null) !== (a.status === "archived") ||
    (a.review &&
      (a.review.version !== a.working.version || a.review.content_hash !== a.working.content_hash))
  )
    throw new Error("Contradictory article rejected.");
  if (full) {
    fullVersion(a.working);
    if (a.published) fullVersion(a.published);
  }
  return a;
};
const envelope = (input: unknown) =>
  z.object({ success: z.literal(true), data: z.unknown() }).parse(input).data;
export const readContent = async (
  path: string,
  query: ContentQuery,
  signal: AbortSignal,
): Promise<unknown> => {
  const id = "[0-7][0-9a-hjkmnp-tv-z]{25}";
  if (
    !new RegExp(
      `^/api/admin/(articles|article-taxonomies)(?:/write-context|/${id}(?:/write-context|/action-context|/events|/versions(?:/${id})?)?)?$|^/api/admin/articles/${id}/schedule-context$|^/api/admin/article-media(?:/upload-context|/${id})?$`,
      "i",
    ).test(path)
  )
    throw new Error("Content read scope rejected.");
  return (
    await checkupinoTransport.request<unknown>({
      method: "GET",
      path,
      // Laravel normalizes blank strings to null; optional filters must be absent.
      query: Object.fromEntries(
        Object.entries(query).filter(
          ([, value]) => value !== undefined && (typeof value !== "string" || value.trim() !== ""),
        ),
      ),
      signal,
    })
  ).data;
};
export const parsePage = <T>(
  wire: unknown,
  parse: (v: unknown) => T,
  identity: (value: T) => string = (value) => (value as { id: string }).id,
): Page<T> => {
  const raw = z
    .object({
      success: z.literal(true),
      data: z.array(z.unknown()).max(50),
      meta: z.object({ read_only: z.literal(true), revision: hash, pagination }),
    })
    .parse(wire);
  if (raw.data.length > raw.meta.pagination.per_page || raw.data.length > raw.meta.pagination.total)
    throw new Error("Content page bounds rejected.");
  const data = raw.data.map(parse);
  const ids = data.map(identity);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate content identities.");
  return { data, pagination: raw.meta.pagination };
};
export const parseArticle = (wire: unknown, id: string) =>
  validateArticle(envelope(wire), id, true);
export const parseSavedArticle = (wire: unknown, id?: string) =>
  validateArticle(envelope(wire), id, true);
export const parseTerm = (wire: unknown, id?: string) => {
  const row = termSchema.parse(envelope(wire));
  if (id && row.id !== contentId.parse(id)) throw new Error("Term identity rejected.");
  return row;
};
export const parseVersion = (wire: unknown, id: string) => {
  const value = fullVersion(versionSchema.parse(envelope(wire)));
  if (value.id !== contentId.parse(id)) throw new Error("Version identity rejected.");
  return value;
};
export const parseDraftContext = (wire: unknown, id: string | null): DraftContext => {
  const value = draftContextSchema.parse(envelope(wire));
  if (
    value.id !== (id ? contentId.parse(id) : null) ||
    value.current?.id !== (value.id ?? undefined) ||
    value.can_create !== (id === null)
  )
    throw new Error("Draft context identity rejected.");
  if (value.current) value.current = validateArticle(value.current, id ?? undefined, true);
  return value;
};
export const parseTermContext = (wire: unknown, id: string | null): TermContext => {
  const value = termContextSchema.parse(envelope(wire));
  if (
    value.id !== (id ? contentId.parse(id) : null) ||
    value.current?.id !== (value.id ?? undefined) ||
    value.can_create !== (id === null)
  )
    throw new Error("Taxonomy context rejected.");
  return value;
};
export const parseActionContext = (
  wire: unknown,
  id: string,
  action: EditorialAction,
  source?: string,
): ActionContext => {
  const value = actionContextSchema.parse(envelope(wire));
  value.current = validateArticle(value.current, id, true);
  if (
    value.action !== action ||
    value.eligible !== (value.blockers.length === 0) ||
    value.source?.id !== (source ? contentId.parse(source) : undefined) ||
    (action === "copy_version") !== (value.source !== null)
  )
    throw new Error("Editorial preview rejected.");
  if (value.source) fullVersion(value.source);
  return value;
};
export const conflict = () =>
  new TransportError({
    kind: "http",
    status: 409,
    code: "stale_revision",
    message: null,
    errors: {},
    meta: null,
    correlationId: null,
    retryAfter: null,
  });
export const contentWrite = async (
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  signal: AbortSignal,
) => {
  const id = "[0-7][0-9a-hjkmnp-tv-z]{25}";
  const allowed =
    method === "POST"
      ? new RegExp(
          `^/api/admin/(articles|article-taxonomies)(?:/${id}/actions)?$|^/api/admin/articles/${id}/schedule-actions$|^/api/admin/article-media/${id}/actions$`,
          "i",
        )
      : method === "PUT"
        ? new RegExp(`^/api/admin/(articles|article-taxonomies)/${id}$`, "i")
        : null;
  if (!allowed?.test(path)) throw new Error("Content write scope rejected.");
  return checkupinoTransport.request<unknown>({ method, path, body, signal });
};
export const localizedText = (value: { en?: string; fa?: string }, lang: "en" | "fa") =>
  value[lang] || value[lang === "en" ? "fa" : "en"] || "—";
export const contentDate = (value: string | null) =>
  value
    ? /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
      ? value.replace(" ", "T") + "Z"
      : value
    : null;
