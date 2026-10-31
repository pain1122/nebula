import type { ListResult } from "../../../core";
import { adminMedicalFileDownloadUrl, checkupinoTransport } from "../api/transport";
import { z } from "../forms";
import { checkupinoApi } from "../query/api";
import { adaptModernAdminList } from "../query/lists";
import type { ServerTableEndpointAdapter } from "../table";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const publicId = z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/i);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime({ offset: true }).nullable();
const medical = z.object({
  public_id: publicId,
  reservation: z.object({ id, public_id: publicId }),
  patient: z.object({ id, name: z.string().nullable() }),
  doctor: z.object({ id, name: z.string().nullable() }),
  requested_by: z.object({ id, name: z.string().nullable() }),
  title: z.string(),
  instructions: z.string().nullable(),
  request_type: z.string(),
  status: z.enum(["open", "in_review", "completed", "cancelled"]),
  received_count: count,
  awaiting_checks_count: count,
  eligible_count: count,
  published_count: count,
  created_at: timestamp,
  due_at: timestamp,
  reviewed_at: timestamp,
  closed_at: timestamp,
  retention_until: timestamp,
});
const report = z.object({
  public_id: publicId,
  medical_request_public_id: publicId,
  status: z.enum(["draft", "published"]),
  body: z.string(),
  body_format: z.literal("plain_text"),
  author_name: z.string(),
  author_user_id: id,
  can_manage: z.boolean(),
  published_at: timestamp,
  created_at: timestamp,
  supersedes_report_public_id: publicId.nullable(),
});
const file = z.object({
  public_id: publicId,
  label: z.string().nullable(),
  mime_type: z.string(),
  size_bytes: count,
  available: z.literal(true),
  created_at: timestamp,
});
const medicalDetail = z.object({
  medical_request: medical,
  files: z.array(file).max(100),
  reports: z.array(report).max(100),
});
const choice = z.object({
  text: z.string(),
  score: z.number().int(),
  sort_order: z.number().int(),
});
const question = z.object({
  text: z.string(),
  sort_order: z.number().int(),
  choices: z.array(choice).min(1).max(50),
});
const recommendation = z.object({
  min_score: z.number().int(),
  max_score: z.number().int(),
  title: z.string(),
  body_html: z.string().nullable(),
  priority: z.number().int(),
  conditions: z.unknown().nullable(),
});
const definition = z.object({
  id,
  public_id: publicId,
  title: z.string(),
  slug: z.string(),
  status: z.enum(["draft", "published"]),
  version: id,
  cover_image_url: z.string().nullable(),
  content_html: z.string().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
  published_at: timestamp,
  questions_count: count.optional(),
  questions: z.array(question).min(1).max(100).optional(),
  recommendations: z.array(recommendation).max(100).optional(),
});
const submission = z.object({
  public_id: publicId,
  questionnaire_id: id,
  questionnaire_version: id,
  questionnaire: z.object({ public_id: publicId.nullable(), title: z.string(), slug: z.string() }),
  user_id: id.nullable(),
  owner_type: z.enum(["account", "guest"]),
  submitter_name: z.string().nullable(),
  submitter_phone: z.string().nullable(),
  total_score: z.number().int(),
  result_title: z.string().nullable(),
  submitted_at: timestamp,
  retention_until: timestamp,
  answers: z
    .array(
      z.object({
        question_text: z.string().nullable(),
        choice_text: z.string().nullable(),
        score: z.number().int().nullable(),
      }),
    )
    .max(100)
    .optional(),
  result_body_html: z.string().nullable().optional(),
  answers_available: z.boolean().optional(),
});
export type AdminMedicalDetail = z.infer<typeof medicalDetail>;
export type AdminQuestionnaire = z.infer<typeof definition>;
export type AdminSubmission = z.infer<typeof submission>;
export type AdminCollection = "medical-requests" | "questionnaires" | "questionnaire-submissions";
export interface AdminListRow {
  readonly public_id: string;
  readonly identifier: string;
  readonly title: string;
  readonly patient: string | null;
  readonly doctor: string | null;
  readonly state: string | null;
  readonly version: number | null;
  readonly score: number | null;
  readonly created_at: string | null;
  readonly received: number | null;
  readonly checking: number | null;
  readonly eligible: number | null;
}
export const adaptAdminCollection = (
  response: unknown,
  kind: AdminCollection,
): ListResult<AdminListRow> => {
  const list = adaptModernAdminList<unknown>(response);
  if (list.page.perPage > 100 || list.items.length > list.page.perPage)
    throw new Error("Admin page bound rejected.");
  const items = list.items.map((item): AdminListRow => {
    const base = {
      patient: null,
      doctor: null,
      state: null,
      version: null,
      score: null,
      received: null,
      checking: null,
      eligible: null,
    };
    if (kind === "medical-requests") {
      const row = medical.parse(item);
      if (row.awaiting_checks_count > row.received_count || row.eligible_count > row.received_count)
        throw new Error("Medical summary rejected.");
      return {
        ...base,
        public_id: row.public_id,
        identifier: row.public_id,
        title: row.title,
        patient: row.patient.name,
        doctor: row.doctor.name,
        state: row.status,
        created_at: row.created_at,
        received: row.received_count,
        checking: row.awaiting_checks_count,
        eligible: row.eligible_count,
      };
    }
    if (kind === "questionnaires") {
      const row = definition.parse(item);
      return {
        ...base,
        public_id: row.public_id,
        identifier: String(row.id),
        title: row.title,
        state: row.status,
        version: row.version,
        created_at: row.created_at,
      };
    }
    const row = submission.parse(item);
    if ((row.owner_type === "guest") !== (row.user_id === null))
      throw new Error("Submission owner contract rejected.");
    return {
      ...base,
      public_id: row.public_id,
      identifier: row.public_id,
      title: row.questionnaire.title,
      patient: row.submitter_name,
      state: row.owner_type,
      version: row.questionnaire_version,
      score: row.total_score,
      created_at: row.submitted_at,
    };
  });
  if (new Set(items.map((row) => row.public_id)).size !== items.length)
    throw new Error("Duplicate administration rows rejected.");
  return { ...list, items };
};
export const adaptMedicalDetail = (response: unknown, expected: string) => {
  const data = z.object({ data: medicalDetail }).parse(response).data;
  if (
    data.medical_request.public_id !== expected ||
    data.reports.some((row) => row.medical_request_public_id !== expected)
  )
    throw new Error("Medical detail binding rejected.");
  return data;
};
export const adaptQuestionnaire = (response: unknown, expected: number) => {
  const row = z.object({ data: definition }).parse(response).data;
  if (row.id !== expected || !row.questions || !row.recommendations)
    throw new Error("Questionnaire detail binding rejected.");
  return row;
};
export const adaptSubmission = (response: unknown, expected: string) => {
  const row = z.object({ data: submission }).parse(response).data;
  if (
    row.public_id !== expected ||
    !row.answers ||
    typeof row.answers_available !== "boolean" ||
    (!row.answers_available && (row.answers.length > 0 || row.result_body_html != null))
  )
    throw new Error("Submission detail binding rejected.");
  return row;
};
export const adminReads = checkupinoApi.injectEndpoints({
  endpoints: (builder) => ({
    adminCollection: builder.query<
      ListResult<AdminListRow>,
      { kind: AdminCollection; filters: Record<string, string> }
    >({
      keepUnusedDataFor: 0,
      query: ({ kind, filters }) => ({ method: "GET", path: `/api/admin/${kind}`, query: filters }),
      transformResponse: (response: unknown, _meta, args) =>
        adaptAdminCollection(response, args.kind),
    }),
    adminMedical: builder.query<AdminMedicalDetail, string>({
      keepUnusedDataFor: 0,
      query: (value) => ({
        method: "GET",
        path: `/api/admin/medical-requests/${publicId.parse(value)}`,
      }),
      transformResponse: (response: unknown, _meta, value) => adaptMedicalDetail(response, value),
    }),
    adminQuestionnaire: builder.query<AdminQuestionnaire, number>({
      keepUnusedDataFor: 0,
      query: (value) => ({ method: "GET", path: `/api/admin/questionnaires/${id.parse(value)}` }),
      transformResponse: (response: unknown, _meta, value) => adaptQuestionnaire(response, value),
    }),
    adminSubmission: builder.query<AdminSubmission, string>({
      keepUnusedDataFor: 0,
      query: (value) => ({
        method: "GET",
        path: `/api/admin/questionnaire-submissions/by-public-id/${publicId.parse(value)}`,
      }),
      transformResponse: (response: unknown, _meta, value) => adaptSubmission(response, value),
    }),
  }),
});
export const {
  useAdminCollectionQuery,
  useAdminMedicalQuery,
  useAdminQuestionnaireQuery,
  useAdminSubmissionQuery,
} = adminReads;
const positive = (value: string) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? value
    : undefined;
const date = (value: string) =>
  /^\d{4}-\d\d-\d\d$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
    ? value
    : undefined;
export const collectionAdapter = (
  kind: AdminCollection,
): ServerTableEndpointAdapter<AdminListRow> => ({
  defaultPerPage: 20,
  maxPerPage: 100,
  getRowIdentifier: (row) => row.public_id,
  getRouteIdentifier: (row) => row.identifier,
  sortableColumns:
    kind === "questionnaire-submissions"
      ? { created_at: "created_at", score: "total_score" }
      : { title: "title", state: "status", created_at: "created_at" },
  filters: Object.fromEntries([
    ...["from", "to"].map((key) => [key, { parameter: key, parse: date }] as const),
    ...(kind === "medical-requests"
      ? ["doctor_id", "user_id", "reservation_id"]
      : kind === "questionnaires"
        ? ["author_id", "version"]
        : ["questionnaire_id", "user_id", "version"]
    ).map((key) => [key, { parameter: key, parse: positive }] as const),
    ...(kind === "questionnaire-submissions"
      ? ["score_min", "score_max"].map(
          (key) =>
            [
              key,
              {
                parameter: key,
                parse: (value: string) =>
                  /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? value : undefined,
              },
            ] as const,
        )
      : []),
    ...(kind === "questionnaire-submissions"
      ? [["owner_type", ["account", "guest"]]]
      : [
          [
            "status",
            kind === "medical-requests"
              ? ["open", "in_review", "completed", "cancelled"]
              : ["draft", "published"],
          ],
          ...(kind === "medical-requests"
            ? [
                [
                  "stage",
                  [
                    "awaiting_upload",
                    "awaiting_checks",
                    "ready",
                    "in_review",
                    "published",
                    "attention",
                  ],
                ],
              ]
            : []),
        ]
    ).map(([key, values]) => [
      String(key),
      {
        parameter: String(key),
        parse: (value: string) => (values.includes(value) ? value : undefined),
      },
    ]),
  ]),
});
export const validPublicId = (value: string) => publicId.safeParse(value).success;
export const validNumericId = (value: string) => positive(value) !== undefined;
export const adminMedicalDownloadUrl = (requestId: string, fileId: string) =>
  adminMedicalFileDownloadUrl(publicId.parse(requestId), publicId.parse(fileId));

/** Writes stay outside Redux; the caller coordinates identity confirmation and uncertainty. */
export const administrationWrite = async (
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  signal: AbortSignal,
) => {
  if (
    !/^\/api\/admin\/(medical-requests|questionnaires|questionnaire-submissions)(?:\/|$)/.test(path)
  )
    throw new Error("Administrative write scope rejected.");
  return checkupinoTransport.request({ path, method, body, signal });
};
export const questionnairePayload = (row: AdminQuestionnaire) => ({
  title: row.title,
  slug: row.slug,
  status: row.status,
  content_html: row.content_html,
  cover_image_url: row.cover_image_url,
  questions:
    row.questions?.map((q) => ({
      text: q.text,
      sort_order: q.sort_order,
      choices: q.choices.map((c) => ({ text: c.text, score: c.score, sort_order: c.sort_order })),
    })) ?? [],
  recommendations:
    row.recommendations?.map((r) => ({
      min_score: r.min_score,
      max_score: r.max_score,
      title: r.title,
      body_html: r.body_html,
      priority: r.priority,
      conditions: null,
    })) ?? [],
});
