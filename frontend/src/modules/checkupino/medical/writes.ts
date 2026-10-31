import type { ApiEnvelope } from "../api/types";
import { createMedicalApi, medicalApi } from "./api";
import type {
  DoctorMedicalDetail,
  MedicalFile,
  MedicalReport,
  MedicalRequest,
  MedicalRequestScope,
} from "./types";
import type {
  MedicalReportDraft,
  MedicalReportScope,
  MedicalRequestDraft,
  MedicalUpload,
} from "./writeTypes";

const requestsPath = (reservationId: string, doctor = false) =>
  `/api/${doctor ? "doctor/" : ""}reservations/${encodeURIComponent(reservationId)}/medical-requests`;
const detailPath = ({ reservationId, requestId }: MedicalRequestScope, doctor = false) =>
  `${requestsPath(reservationId, doctor)}/${encodeURIComponent(requestId)}`;
const listTags = (reservationId: string) => [
  { type: "MedicalRequests" as const, id: `patient:${reservationId}` },
  { type: "MedicalRequests" as const, id: `doctor:${reservationId}` },
];
const detailTag = ({ reservationId, requestId }: MedicalRequestScope) => ({
  type: "MedicalDetail" as const,
  id: `${reservationId}:${requestId}`,
});
const outcomeTag = ({ reservationId, requestId }: MedicalRequestScope) => ({
  type: "MedicalOutcome" as const,
  id: `${reservationId}:${requestId}`,
});

// Ordinary forms share this session/CSRF/abort boundary and must not automatically
// replay ambiguous writes. Runtime activation remains separately verified.
export const createMedicalWritesApi = (api: ReturnType<typeof createMedicalApi>) =>
  api
    .enhanceEndpoints({
      addTagTypes: ["MedicalRequests", "MedicalDetail", "MedicalOutcome"],
      endpoints: {
        patientMedicalRequests: {
          providesTags: (_result, _error, reservationId) => [listTags(reservationId)[0]],
        },
        doctorMedicalRequests: {
          providesTags: (_result, _error, reservationId) => [listTags(reservationId)[1]],
        },
        doctorMedicalDetail: { providesTags: (_result, _error, scope) => [detailTag(scope)] },
        patientMedicalOutcome: { providesTags: (_result, _error, scope) => [outcomeTag(scope)] },
      },
    })
    .injectEndpoints({
      endpoints: (builder) => ({
        createMedicalRequest: builder.mutation<
          MedicalRequest,
          { readonly reservationId: string; readonly draft: MedicalRequestDraft }
        >({
          query: ({ reservationId, draft }) => ({
            method: "POST",
            path: requestsPath(reservationId, true),
            body: {
              request_type: draft.requestType,
              title: draft.title,
              ...(draft.instructions !== undefined ? { instructions: draft.instructions } : {}),
              ...(draft.dueAt !== undefined ? { due_at: draft.dueAt } : {}),
              ...(draft.attachmentCategories
                ? { attachment_categories: draft.attachmentCategories }
                : {}),
              ...(draft.attachmentRules
                ? {
                    attachment_rules: {
                      ...(draft.attachmentRules.maxBytes !== undefined
                        ? { max_bytes: draft.attachmentRules.maxBytes }
                        : {}),
                      ...(draft.attachmentRules.allowedMimeTypes
                        ? { allowed_mime_types: draft.attachmentRules.allowedMimeTypes }
                        : {}),
                    },
                  }
                : {}),
            },
          }),
          transformResponse: (response: ApiEnvelope<MedicalRequest>) => response.data,
          invalidatesTags: (result, _error, { reservationId }) =>
            result ? listTags(reservationId) : [],
        }),
        uploadMedicalFile: builder.mutation<MedicalFile, MedicalUpload>({
          query: ({ reservationId, requestId, file, label }) => {
            const body = new FormData();
            body.append("file", file);
            if (label !== undefined) body.append("label", label);
            // Policy revisions/scan/storage/ownership fields are prohibited by the server.
            return {
              method: "POST",
              path: `${detailPath({ reservationId, requestId })}/files`,
              body,
            };
          },
          transformResponse: (response: ApiEnvelope<MedicalFile>) => response.data,
          invalidatesTags: (result, _error, scope) =>
            result ? [...listTags(scope.reservationId), detailTag(scope)] : [],
        }),
        startMedicalReview: builder.mutation<
          Pick<DoctorMedicalDetail, "medical_request" | "files">,
          MedicalRequestScope
        >({
          query: (scope) => ({ method: "POST", path: `${detailPath(scope, true)}/review` }),
          transformResponse: (
            response: ApiEnvelope<Pick<DoctorMedicalDetail, "medical_request" | "files">>,
          ) => response.data,
          invalidatesTags: (result, _error, scope) =>
            result ? [...listTags(scope.reservationId), detailTag(scope)] : [],
        }),
        createMedicalReportDraft: builder.mutation<
          MedicalReport,
          MedicalRequestScope & MedicalReportDraft
        >({
          query: (scope) => ({
            method: "POST",
            path: `${detailPath(scope, true)}/reports`,
            body: {
              body: scope.body,
              ...(scope.supersedesReportId !== undefined
                ? { supersedes_report_id: scope.supersedesReportId }
                : {}),
            },
          }),
          transformResponse: (response: ApiEnvelope<MedicalReport>) => response.data,
          invalidatesTags: (result, _error, scope) => (result ? [detailTag(scope)] : []),
        }),
        updateMedicalReportDraft: builder.mutation<
          MedicalReport,
          MedicalReportScope & { readonly body: string }
        >({
          query: (scope) => ({
            method: "PUT",
            path: `${detailPath(scope, true)}/reports/${encodeURIComponent(scope.reportId)}`,
            body: { body: scope.body },
          }),
          transformResponse: (response: ApiEnvelope<MedicalReport>) => response.data,
          invalidatesTags: (result, _error, scope) => (result ? [detailTag(scope)] : []),
        }),
        publishMedicalReport: builder.mutation<MedicalReport, MedicalReportScope>({
          query: (scope) => ({
            method: "POST",
            path: `${detailPath(scope, true)}/reports/${encodeURIComponent(scope.reportId)}/publish`,
          }),
          transformResponse: (response: ApiEnvelope<MedicalReport>) => response.data,
          invalidatesTags: (result, _error, scope) =>
            result ? [...listTags(scope.reservationId), detailTag(scope), outcomeTag(scope)] : [],
        }),
      }),
    });

export const medicalWritesApi = createMedicalWritesApi(medicalApi);
export const {
  useCreateMedicalRequestMutation,
  useUploadMedicalFileMutation,
  useStartMedicalReviewMutation,
  useCreateMedicalReportDraftMutation,
  useUpdateMedicalReportDraftMutation,
  usePublishMedicalReportMutation,
} = medicalWritesApi;
