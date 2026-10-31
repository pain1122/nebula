import type { ListResult } from "../../../core";
import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { adaptModernAdminList } from "../query/lists";
import {
  serverTableBackendParameters,
  type ServerTableEndpointAdapter,
  type ServerTableQuery,
} from "../table";

export type ScheduleKind = "workplaces" | "rules" | "slots";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const id = integer.min(1);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const timestamp = z.iso.datetime({ offset: true });
const amount = z.string().regex(/^(0|[1-9]\d{0,19})$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
export const validScheduleDate = (value: string) =>
  /^\d{4}-\d\d-\d\d$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const date = z.string().refine(validScheduleDate);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
const zone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
});
const reference = z.object({
  id,
  public_id: publicId,
  title: z.string().max(255),
  is_active: z.boolean(),
  archived: z.boolean(),
});
const workplace = z
  .object({
    id,
    public_id: publicId,
    display_name: z.string().max(255).nullable(),
    is_active: z.boolean(),
    state: z.enum(["active", "inactive", "archived"]),
    archived_at: timestamp.nullable(),
    created_at: timestamp.nullable(),
    updated_at: timestamp.nullable(),
    doctor: z
      .object({
        id,
        public_id: publicId,
        user_public_id: publicId,
        name: z.string().max(255),
        verified: z.boolean(),
        account_active: z.boolean(),
        archived: z.boolean(),
      })
      .nullable(),
    hospital: z
      .object({
        id,
        public_id: publicId,
        name: z.string().max(255),
        timezone: zone,
        is_active: z.boolean(),
        archived: z.boolean(),
      })
      .nullable(),
    counts: z.object({ services: integer, rules: integer, active_rules: integer, slots: integer }),
  })
  .refine(
    (row) =>
      row.state === (row.archived_at ? "archived" : row.is_active ? "active" : "inactive") &&
      row.counts.active_rules <= row.counts.rules,
  );
const offering = reference.extend({
  offering_active: z.boolean(),
  price_override: amount.nullable(),
  currency_override: currency.nullable(),
  base_price: amount,
  base_currency: currency,
});
const rule = z
  .object({
    id,
    public_id: publicId,
    checkup: reference.nullable(),
    weekday: integer.max(6),
    starts_at: time,
    ends_at: time,
    duration_minutes: integer.min(5).max(720),
    is_active: z.boolean(),
    effective_from: date.nullable(),
    effective_until: date.nullable(),
    price_override: amount.nullable(),
    currency_override: currency.nullable(),
    breaks: z.array(z.object({ starts_at: time, ends_at: time })).max(50),
  })
  .refine(
    (row) =>
      row.starts_at < row.ends_at &&
      (!row.effective_from || !row.effective_until || row.effective_from <= row.effective_until) &&
      row.breaks.every(
        (b) => b.starts_at < b.ends_at && b.starts_at >= row.starts_at && b.ends_at <= row.ends_at,
      ),
  );
const slot = z
  .object({
    public_id: publicId,
    starts_at: timestamp,
    ends_at: timestamp,
    duration_minutes: integer.min(1).max(720),
    price: amount,
    currency,
    is_active: z.boolean(),
    checkup: reference.nullable(),
    rule: z.object({ id, public_id: publicId, is_active: z.boolean() }).nullable(),
    binding_consistent: z.boolean(),
    is_future: z.boolean(),
    blocking_reservation: z.boolean(),
    has_reservation_history: z.boolean(),
  })
  .refine(
    (row) =>
      Date.parse(row.ends_at) > Date.parse(row.starts_at) &&
      (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60000 === row.duration_minutes &&
      (!row.binding_consistent || !!row.rule),
  );
export type WorkplaceRow = z.infer<typeof workplace> & { readonly kind: "workplaces" };
export type RuleRow = z.infer<typeof rule> & { readonly kind: "rules" };
export type SlotRow = z.infer<typeof slot> & { readonly kind: "slots" };
export type ScheduleRow = WorkplaceRow | RuleRow | SlotRow;
export type ScheduleDetail = WorkplaceRow & {
  readonly services: readonly z.infer<typeof offering>[];
};
export interface SchedulePage extends ListResult<ScheduleRow> {
  readonly generatedAt: string;
  readonly timezone?: string;
  readonly period?: { readonly from: string; readonly to: string; readonly timezone: string };
}
const metaSchema = z.object({
  success: z.literal(true),
  meta: z.object({ generated_at: timestamp, read_only: z.literal(true) }),
});
export const validWorkplaceId = (value: string) =>
  /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
export const adaptScheduleDetail = (response: unknown, expectedId: string): ScheduleDetail => {
  metaSchema.parse(response);
  const raw = z.object({ data: z.unknown() }).parse(response).data;
  const row = workplace.parse(raw);
  const services = z.object({ services: z.array(offering).max(100) }).parse(raw).services;
  if (
    !validWorkplaceId(expectedId) ||
    row.id !== Number(expectedId) ||
    new Set(services.map((s) => s.id)).size !== services.length ||
    new Set(services.map((s) => s.public_id)).size !== services.length
  )
    throw new Error("Schedule detail binding rejected.");
  return { ...row, kind: "workplaces", services };
};
export const adaptSchedulePage = (response: unknown, kind: ScheduleKind): SchedulePage => {
  const list = adaptModernAdminList<unknown>(response);
  const meta = metaSchema.parse(response).meta;
  if (
    list.page.currentPage > 1000 ||
    list.page.perPage > 100 ||
    list.items.length > list.page.perPage ||
    list.items.length > list.page.total ||
    !Number.isSafeInteger(list.page.total)
  )
    throw new Error("Schedule page bounds rejected.");
  const items: ScheduleRow[] = list.items.map((value) =>
    kind === "workplaces"
      ? { ...workplace.parse(value), kind }
      : kind === "rules"
        ? { ...rule.parse(value), kind }
        : { ...slot.parse(value), kind },
  );
  if (
    new Set(items.map((row) => row.public_id)).size !== items.length ||
    (kind !== "slots" &&
      new Set(items.map((row) => (row.kind !== "slots" ? row.id : row.public_id))).size !==
        items.length)
  )
    throw new Error("Duplicate schedule rows rejected.");
  const extra: Pick<SchedulePage, "period" | "timezone"> =
    kind === "slots"
      ? z
          .object({
            meta: z.object({ period: z.object({ from: date, to: date, timezone: zone }) }),
          })
          .parse(response).meta
      : kind === "rules"
        ? z.object({ meta: z.object({ timezone: zone }) }).parse(response).meta
        : {};
  if (
    extra.period &&
    (extra.period.to < extra.period.from ||
      Date.parse(extra.period.to) - Date.parse(extra.period.from) > 30 * 86400000)
  )
    throw new Error("Schedule period rejected.");
  return { ...list, items, generatedAt: meta.generated_at, ...extra };
};
const rawFilter = (parameter: string) => ({
  parameter,
  parse: (value: string) => value.trim() || undefined,
});
export const scheduleAdapter = (kind: ScheduleKind): ServerTableEndpointAdapter<ScheduleRow> => ({
  defaultPerPage: 20,
  maxPerPage: 100,
  getRowIdentifier: (row) => row.public_id,
  getRouteIdentifier: (row) => (row.kind === "slots" ? row.public_id : row.id),
  sortableColumns:
    kind === "workplaces"
      ? { label: "display_name", created_at: "created_at", updated_at: "updated_at" }
      : {},
  filters: Object.fromEntries(
    (kind === "workplaces"
      ? ["state", "doctor_id", "hospital_id", "checkup_id"]
      : kind === "rules"
        ? ["state", "weekday", "checkup_id"]
        : ["state", "from", "to", "checkup_id", "rule_id", "conflict", "history", "timing"]
    ).map((key) => [key, rawFilter(key)]),
  ),
});
export const validScheduleQuery = (query: ServerTableQuery, kind: ScheduleKind) => {
  const f = query.filters;
  const oneOf = (key: string, values: readonly string[]) =>
    !f[key] || values.includes(String(f[key]));
  if (query.page > 1000 || query.search.length > 100 || (kind !== "workplaces" && !!query.search))
    return false;
  for (const key of ["doctor_id", "hospital_id", "checkup_id", "rule_id"])
    if (f[key] !== undefined && !validWorkplaceId(String(f[key]))) return false;
  if (
    !oneOf(
      "state",
      kind === "workplaces"
        ? ["current", "active", "inactive", "archived", "all"]
        : ["active", "inactive", "all"],
    )
  )
    return false;
  if (kind === "rules" && f.weekday !== undefined && !/^[0-6]$/.test(String(f.weekday)))
    return false;
  if (kind === "slots") {
    const from = String(f.from ?? ""),
      to = String(f.to ?? "");
    if (
      (from || to) &&
      (!validScheduleDate(from) ||
        !validScheduleDate(to) ||
        to < from ||
        Date.parse(to) - Date.parse(from) > 30 * 86400000)
    )
      return false;
    if (
      !oneOf("conflict", ["blocking", "unblocked"]) ||
      !oneOf("history", ["with", "without"]) ||
      !oneOf("timing", ["past", "future", "all"])
    )
      return false;
  }
  return true;
};
export const scheduleReads = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    adminSchedules: builder.query<
      SchedulePage,
      {
        readonly kind: ScheduleKind;
        readonly workplaceId?: string;
        readonly query: ServerTableQuery;
      }
    >({
      keepUnusedDataFor: 0,
      query: ({ kind, workplaceId, query }) => {
        if (
          !validScheduleQuery(query, kind) ||
          (kind !== "workplaces" && !validWorkplaceId(workplaceId ?? ""))
        )
          throw new Error("Invalid schedule query.");
        return {
          method: "GET",
          path:
            kind === "workplaces"
              ? "/api/admin/schedules/workplaces"
              : `/api/admin/schedules/workplaces/${workplaceId}/${kind}`,
          query: serverTableBackendParameters(query, scheduleAdapter(kind)),
        };
      },
      transformResponse: (response: unknown, _meta, args) => {
        const page = adaptSchedulePage(response, args.kind);
        if (
          page.period &&
          args.query.filters.from &&
          (page.period.from !== args.query.filters.from || page.period.to !== args.query.filters.to)
        )
          throw new Error("Schedule requested period rejected.");
        return page;
      },
    }),
    adminScheduleDetail: builder.query<ScheduleDetail, { readonly workplaceId: string }>({
      keepUnusedDataFor: 0,
      query: ({ workplaceId }) => {
        if (!validWorkplaceId(workplaceId)) throw new Error("Invalid workplace identity.");
        return { method: "GET", path: `/api/admin/schedules/workplaces/${workplaceId}` };
      },
      transformResponse: (response: unknown, _meta, args) =>
        adaptScheduleDetail(response, args.workplaceId),
    }),
  }),
});
export const { useAdminSchedulesQuery, useAdminScheduleDetailQuery } = scheduleReads;
