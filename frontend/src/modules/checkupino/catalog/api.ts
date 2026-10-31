import type { ListResult } from "../../../core";
import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { adaptModernAdminList } from "../query/lists";
import type { ServerTableEndpointAdapter, ServerTableQuery } from "../table";
import { serverTableBackendParameters } from "../table";
import type { ProductLocale } from "../preferences/localization";
import { checkupinoTransport } from "../api/transport";
import { TransportError } from "../api/wire";

export type CatalogKind = "checkups" | "checkup-categories" | "specialties";
export const catalogStates = ["current", "active", "inactive", "archived", "all"] as const;
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identifier = integer.min(1);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const state = z.enum(["active", "inactive", "archived"]);
const timestamp = z.iso.datetime({ offset: true }).nullable();
const common = {
  id: identifier,
  public_id: publicId,
  slug: z.string().max(255),
  is_active: z.boolean(),
  state,
  archived_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
};
const description = z.string().nullable();
const category = z.object({
  id: identifier,
  public_id: publicId,
  name: z.string().max(255),
  slug: z.string().max(255),
  state,
});
const checkup = z.object({
  ...common,
  title: z.string().max(255),
  price: z.string().regex(/^(0|[1-9]\d{0,19})$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  default_duration_minutes: integer.min(5).max(720),
  category: category.nullable(),
  counts: z.object({ reservations: integer, workplace_assignments: integer }),
});
const categoryRecord = z.object({
  ...common,
  name: z.string().max(255),
  counts: z.object({ checkups: integer, active_checkups: integer, archived_checkups: integer }),
});
const specialtyRecord = z.object({
  ...common,
  name: z.string().max(255),
  level: integer.max(32),
  parent: category.nullable(),
  counts: z.object({
    children: integer,
    primary_doctors: integer,
    secondary_associations: integer,
  }),
});
export type CatalogRow =
  | (z.infer<typeof checkup> & { readonly kind: "checkups"; readonly label: string })
  | (z.infer<typeof categoryRecord> & {
      readonly kind: "checkup-categories";
      readonly label: string;
    })
  | (z.infer<typeof specialtyRecord> & { readonly kind: "specialties"; readonly label: string });
export type CatalogDetail = CatalogRow & { readonly description: string | null };
export interface CatalogList extends ListResult<CatalogRow> {
  readonly generatedAt: string;
}

const metadata = z.object({
  success: z.literal(true),
  meta: z.object({ generated_at: z.iso.datetime({ offset: true }) }),
});
const adaptRow = (input: unknown, kind: CatalogKind): CatalogRow => {
  const row: CatalogRow =
    kind === "checkups"
      ? (() => {
          const data = checkup.parse(input);
          return { ...data, kind, label: data.title };
        })()
      : kind === "checkup-categories"
        ? (() => {
            const data = categoryRecord.parse(input);
            return { ...data, kind, label: data.name };
          })()
        : (() => {
            const data = specialtyRecord.parse(input);
            return { ...data, kind, label: data.name };
          })();
  if (
    row.state !== (row.archived_at ? "archived" : row.is_active ? "active" : "inactive") ||
    (row.kind === "checkup-categories" &&
      row.counts.active_checkups + row.counts.archived_checkups > row.counts.checkups)
  )
    throw new Error("Contradictory catalog state/counts rejected.");
  return row;
};
export const adaptCatalogList = (response: unknown, kind: CatalogKind): CatalogList => {
  const wire = adaptModernAdminList<unknown>(response);
  const meta = metadata.parse(response).meta;
  if (
    wire.page.currentPage > 1000 ||
    wire.page.perPage > 100 ||
    wire.items.length > wire.page.perPage ||
    wire.items.length > wire.page.total ||
    !Number.isSafeInteger(wire.page.total)
  )
    throw new Error("Catalog page bounds rejected.");
  const items = wire.items.map((row) => adaptRow(row, kind));
  if (
    new Set(items.map((row) => row.id)).size !== items.length ||
    new Set(items.map((row) => row.public_id)).size !== items.length
  )
    throw new Error("Duplicate catalog rows rejected.");
  return { ...wire, items, generatedAt: meta.generated_at };
};
export const validCatalogId = (id: string) =>
  /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
export const adaptCatalogDetail = (
  response: unknown,
  kind: CatalogKind,
  expectedId: string,
): CatalogDetail => {
  metadata.parse(response);
  const data = z.object({ data: z.object({ description }) }).parse(response).data;
  const row = adaptRow(z.object({ data: z.unknown() }).parse(response).data, kind);
  if (!validCatalogId(expectedId) || row.id !== Number(expectedId))
    throw new Error("Catalog detail identity rejected.");
  return { ...row, description: data.description };
};
export const catalogAdapter = (kind: CatalogKind): ServerTableEndpointAdapter<CatalogRow> => ({
  defaultPerPage: 20,
  maxPerPage: 100,
  getRowIdentifier: (row) => String(row.id),
  getRouteIdentifier: (row) => String(row.id),
  sortableColumns: {
    id: "id",
    label: kind === "checkups" ? "title" : "name",
    slug: "slug",
    created_at: "created_at",
    updated_at: "updated_at",
    ...(kind === "checkups" ? { price: "price" } : {}),
  },
  filters: {
    ...(kind === "specialties"
      ? {
          parent_id: {
            parameter: "parent_id",
            parse: (value: string) => value.trim() || undefined,
          },
          root_only: {
            parameter: "root_only",
            parse: (value: string) => (value === "1" ? 1 : undefined),
          },
        }
      : {}),
    state: {
      parameter: "state",
      parse: (value) =>
        catalogStates.includes(value as (typeof catalogStates)[number]) ? value : undefined,
    },
    ...(kind === "checkups"
      ? {
          category_id: {
            parameter: "category_id",
            parse: (value: string) => value.trim() || undefined,
          },
          uncategorized: {
            parameter: "uncategorized",
            parse: (value: string) => (value === "1" ? 1 : undefined),
          },
          currency: {
            parameter: "currency",
            parse: (value: string) => value.trim().toUpperCase() || undefined,
          },
          min_price: {
            parameter: "min_price",
            parse: (value: string) => value.trim() || undefined,
          },
          max_price: {
            parameter: "max_price",
            parse: (value: string) => value.trim() || undefined,
          },
        }
      : {}),
  },
});
export const validCatalogQuery = (query: ServerTableQuery, kind: CatalogKind) => {
  const f = query.filters;
  const amount = (value: unknown) =>
    value === undefined ||
    (typeof value === "string" &&
      /^(0|[1-9]\d*)$/.test(value) &&
      Number.isSafeInteger(Number(value)));
  return (
    query.page <= 1000 &&
    query.search.length <= 100 &&
    (kind !== "specialties" ||
      ((!f.parent_id || validCatalogId(String(f.parent_id))) && !(f.parent_id && f.root_only))) &&
    (kind !== "checkups" ||
      ((!f.category_id || validCatalogId(String(f.category_id))) &&
        !(f.category_id && f.uncategorized) &&
        (!f.currency || /^[A-Z]{3}$/.test(String(f.currency))) &&
        amount(f.min_price) &&
        amount(f.max_price) &&
        (f.min_price === undefined ||
          f.max_price === undefined ||
          Number(f.min_price) <= Number(f.max_price))))
  );
};
export const formatCatalogPrice = (amount: string, currency: string, locale: ProductLocale) =>
  new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(BigInt(amount)) +
  " " +
  currency;

export const catalogReads = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    adminCatalog: builder.query<
      CatalogList,
      { readonly kind: CatalogKind; readonly query: ServerTableQuery }
    >({
      keepUnusedDataFor: 0,
      query: ({ kind, query }) => {
        if (!validCatalogQuery(query, kind)) throw new Error("Invalid catalog query.");
        return {
          method: "GET",
          path: `/api/admin/${kind}`,
          query: serverTableBackendParameters(query, catalogAdapter(kind)),
        };
      },
      transformResponse: (response: unknown, _meta, args) => adaptCatalogList(response, args.kind),
    }),
    adminCatalogDetail: builder.query<
      CatalogDetail,
      { readonly kind: CatalogKind; readonly id: string }
    >({
      keepUnusedDataFor: 0,
      query: ({ kind, id }) => {
        if (!validCatalogId(id)) throw new Error("Invalid catalog identity.");
        return { method: "GET", path: `/api/admin/${kind}/${id}` };
      },
      transformResponse: (response: unknown, _meta, args) =>
        adaptCatalogDetail(response, args.kind, args.id),
    }),
  }),
});
export const { useAdminCatalogQuery, useAdminCatalogDetailQuery } = catalogReads;

const contextSchema = z.object({
  kind: z.enum(["checkups", "checkup-categories", "specialties"]),
  id: identifier.nullable(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  can_create: z.boolean(),
  can_update: z.boolean(),
  can_archive: z.boolean(),
  limits: z.object({
    name: integer.min(1),
    slug: integer.min(1),
    description: integer.min(1),
    reason: integer.min(1),
    min_duration: integer.min(1),
    max_duration: integer.min(1),
    max_price: z.string().regex(/^\d+$/),
  }),
  generated_at: z.iso.datetime({ offset: true }),
});
export type CatalogContext = z.infer<typeof contextSchema>;
export const readCatalogContext = async (
  kind: CatalogKind,
  id: number | null,
  signal: AbortSignal,
): Promise<CatalogContext> => {
  const response = await checkupinoTransport.request<unknown>({
    method: "GET",
    path: `/api/admin/catalog/${kind}/context${id === null ? "" : "/" + id}`,
    signal,
  });
  const context = contextSchema.parse(z.object({ data: z.unknown() }).parse(response.data).data);
  if (context.kind !== kind || context.id !== id)
    throw new Error("Catalog context identity rejected.");
  return context;
};
export const verifyCatalogContext = async (
  kind: CatalogKind,
  context: CatalogContext,
  operation: "create" | "update" | "archive",
  signal: AbortSignal,
) => {
  const fresh = await readCatalogContext(kind, context.id, signal);
  if (fresh.revision !== context.revision || !fresh[`can_${operation}`])
    throw new TransportError({
      kind: "http",
      status: 409,
      code: "stale_revision",
      message: null,
      errors: {},
      meta: null,
      correlationId: null,
      retryAfter: null,
    });
};
export const catalogWrite = async (
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  signal: AbortSignal,
) => {
  if (!/^\/api\/admin\/(checkups|checkup-categories|specialties)(?:\/[1-9]\d*)?$/.test(path))
    throw new Error("Catalog write scope rejected.");
  return checkupinoTransport.request({ path, method, body, signal });
};
