import type { ListResult } from "../../../core";
import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { adaptModernAdminList } from "../query/lists";
import type { ServerTableEndpointAdapter, ServerTableQuery } from "../table";
import { serverTableBackendParameters } from "../table";

export const activityActions = {
  "profile.display_name.updated": "account",
  "admin.profile.display_name.updated": "account",
  "admin.user.created": "account",
  "admin.user.updated": "account",
  "admin.user.account_state.changed": "account",
  "admin.doctor.verification_changed": "doctor",
  "reservation.cancelled": "reservation",
  "reservation.completed": "reservation",
  "reservation.rescheduled": "reservation",
  "admin.reservation.status_overridden": "reservation",
  "doctor.visit_slots.controlled": "schedule",
  "admin.visit_slots.controlled": "schedule",
  "admin.payment.adjustment_requested": "payment",
  "admin.questionnaire.created": "questionnaire",
  "admin.questionnaire.updated": "questionnaire",
  "admin.questionnaire.archived": "questionnaire",
  "admin.questionnaire_submission.archived": "questionnaire",
  "admin.rating_option.created": "catalog",
  "admin.rating_option.updated": "catalog",
  "admin.rating_option.archived": "catalog",
  "admin.checkup.created": "catalog",
  "admin.checkup.updated": "catalog",
  "admin.checkup.archived": "catalog",
  "admin.checkup.category_detached": "catalog",
  "admin.checkup.category_reassigned": "catalog",
  "admin.checkup_category.archived": "catalog",
  "admin.checkup_category.created": "catalog",
  "admin.checkup_category.updated": "catalog",
  "admin.specialty.created": "catalog",
  "admin.specialty.updated": "catalog",
  "admin.specialty.archived": "catalog",
  "settings.marketplace.updated": "settings",
  "reservation_file.uploaded": "medical",
  "reservation_file.scan_recorded": "medical",
  "reservation_file.accessed": "medical",
  "reservation_file.archived": "medical",
  "reservation_medical_file.uploaded": "medical",
  "reservation_medical_file.scan_recorded": "medical",
  "reservation_medical_file.accessed": "medical",
  "reservation_medical_file.archived": "medical",
  "reservation_medical_request.created": "medical",
  "reservation_medical_request.review_started": "medical",
  "reservation_report.draft_saved": "medical",
  "reservation_report.published": "medical",
  "admin.medical_request.created": "medical",
  "admin.medical_request.review_started": "medical",
  "admin.medical_report.draft_saved": "medical",
  "admin.medical_report.published": "medical",
} as const;
export const activityCategories = [
  "account",
  "doctor",
  "reservation",
  "schedule",
  "payment",
  "questionnaire",
  "catalog",
  "settings",
  "medical",
] as const;
export const activityRisks = ["low", "medium", "high", "critical"] as const;
export const activityRoles = ["patient", "doctor", "admin", "root-admin"] as const;
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
export const validActivityDate = (value: string) =>
  /^\d{4}-\d\d-\d\d$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const date = z.string().refine(validActivityDate);
const rowSchema = z
  .object({
    public_id: publicId,
    action: z
      .string()
      .refine((value) => Object.prototype.hasOwnProperty.call(activityActions, value)),
    category: z.enum(activityCategories),
    actor: z.object({
      public_id: publicId.nullable(),
      name: z.string().max(255).nullable(),
      role: z.enum(activityRoles).nullable(),
      identity_available: z.boolean(),
    }),
    subject_public_id: publicId.nullable(),
    risk: z.enum(activityRisks),
    outcome: z.enum(["succeeded", "failed", "denied"]),
    reason_recorded: z.boolean(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .refine(
    (row) =>
      activityActions[row.action as keyof typeof activityActions] === row.category &&
      (row.actor.identity_available
        ? row.actor.public_id !== null
        : row.actor.public_id === null && row.actor.name === null && row.actor.role === null),
  );
export type ActivityRow = z.infer<typeof rowSchema>;
export interface ActivityList extends ListResult<ActivityRow> {
  readonly period: { readonly from: string; readonly to: string; readonly timezone: "Asia/Tehran" };
  readonly generatedAt: string;
}
export const adaptActivityList = (response: unknown): ActivityList => {
  const list = adaptModernAdminList<unknown>(response);
  const meta = z
    .object({
      meta: z.object({
        period: z.object({ from: date, to: date, timezone: z.literal("Asia/Tehran") }),
        generated_at: z.iso.datetime({ offset: true }),
      }),
    })
    .parse(response).meta;
  if (
    list.page.perPage > 100 ||
    list.page.currentPage > 1000 ||
    list.items.length > list.page.perPage ||
    list.items.length > list.page.total ||
    meta.period.to < meta.period.from ||
    Date.parse(meta.period.to) - Date.parse(meta.period.from) > 89 * 86400000
  )
    throw new Error("Activity page or period rejected.");
  const items = list.items.map((item) => rowSchema.parse(item));
  if (new Set(items.map((row) => row.public_id)).size !== items.length)
    throw new Error("Duplicate activity rows rejected.");
  return { ...list, items, period: meta.period, generatedAt: meta.generated_at };
};
const enumValue = (choices: readonly string[]) => (value: string) =>
  choices.includes(value) ? value : undefined;
const dateFilters = Object.fromEntries(
  ["from", "to"].map((parameter) => [
    parameter,
    {
      parameter,
      parse: (value: string) => (validActivityDate(value) ? value : undefined),
    },
  ]),
);
export const activityAdapter = (root: boolean): ServerTableEndpointAdapter<ActivityRow> => ({
  defaultPerPage: 20,
  maxPerPage: 100,
  sortableColumns: {},
  getRowIdentifier: (row) => row.public_id,
  getRouteIdentifier: (row) => row.public_id,
  filters: {
    category: { parameter: "category", parse: enumValue(activityCategories) },
    action: { parameter: "action", parse: enumValue(Object.keys(activityActions)) },
    risk: { parameter: "risk", parse: enumValue(activityRisks) },
    actor_role: {
      parameter: "actor_role",
      parse: enumValue(
        root ? activityRoles : activityRoles.filter((role) => role !== "root-admin"),
      ),
    },
    actor_id: {
      parameter: "actor_id",
      parse: (value) =>
        /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined,
    },
    subject_public_id: {
      parameter: "subject_public_id",
      parse: (value) => value.trim() || undefined,
    },
    ...dateFilters,
    sort_dir: { parameter: "sort_dir", parse: enumValue(["asc", "desc"]) },
  },
});
export const validActivityQuery = (query: ServerTableQuery) => {
  const from = String(query.filters.from ?? ""),
    to = String(query.filters.to ?? "");
  return (
    query.page <= 1000 &&
    (!query.search || publicId.safeParse(query.search).success) &&
    (!query.filters.subject_public_id ||
      publicId.safeParse(query.filters.subject_public_id).success) &&
    ((!from && !to) ||
      (validActivityDate(from) &&
        validActivityDate(to) &&
        to >= from &&
        Date.parse(to) - Date.parse(from) <= 89 * 86400000))
  );
};
export const activityReads = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    adminActivity: builder.query<
      ActivityList,
      { readonly query: ServerTableQuery; readonly root: boolean }
    >({
      keepUnusedDataFor: 0,
      query: ({ query, root }) => {
        if (!validActivityQuery(query)) throw new Error("Invalid activity query.");
        return {
          method: "GET",
          path: "/api/admin/activity",
          query: serverTableBackendParameters(query, activityAdapter(root)),
        };
      },
      transformResponse: adaptActivityList,
    }),
  }),
});
export const { useAdminActivityQuery } = activityReads;
