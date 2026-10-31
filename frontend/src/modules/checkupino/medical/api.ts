import type { ApiEnvelope } from "../api/types";
import { checkupinoApi, createCheckupinoApi } from "../query/api";
import type {
  DoctorMedicalDetail,
  MedicalRequest,
  MedicalRequestScope,
  PatientMedicalOutcome,
} from "./types";

const requestsPath = (reservationId: string, doctor = false) =>
  `/api/${doctor ? "doctor/" : ""}reservations/${encodeURIComponent(reservationId)}/medical-requests`;

// Extend the session-owned API so identity/role changes clear medical data too.
// Do not retain unused medical responses across panel navigation.
export const createMedicalApi = (api: ReturnType<typeof createCheckupinoApi>) =>
  api.injectEndpoints({
    endpoints: (builder) => ({
      patientMedicalRequests: builder.query<readonly MedicalRequest[], string>({
        keepUnusedDataFor: 0,
        query: (reservationId) => ({ method: "GET", path: requestsPath(reservationId) }),
        transformResponse: (response: ApiEnvelope<readonly MedicalRequest[]>) => response.data,
      }),
      doctorMedicalRequests: builder.query<readonly MedicalRequest[], string>({
        keepUnusedDataFor: 0,
        query: (reservationId) => ({ method: "GET", path: requestsPath(reservationId, true) }),
        transformResponse: (response: ApiEnvelope<readonly MedicalRequest[]>) => response.data,
      }),
      doctorMedicalDetail: builder.query<DoctorMedicalDetail, MedicalRequestScope>({
        keepUnusedDataFor: 0,
        query: ({ reservationId, requestId }) => ({
          method: "GET",
          path: `${requestsPath(reservationId, true)}/${encodeURIComponent(requestId)}`,
        }),
        transformResponse: (response: ApiEnvelope<DoctorMedicalDetail>) => response.data,
      }),
      patientMedicalOutcome: builder.query<PatientMedicalOutcome, MedicalRequestScope>({
        keepUnusedDataFor: 0,
        query: ({ reservationId, requestId }) => ({
          method: "GET",
          path: `${requestsPath(reservationId)}/${encodeURIComponent(requestId)}/outcome`,
        }),
        transformResponse: (response: ApiEnvelope<PatientMedicalOutcome>) => response.data,
      }),
    }),
  });

export const medicalApi = createMedicalApi(checkupinoApi);

export const {
  usePatientMedicalRequestsQuery,
  useDoctorMedicalRequestsQuery,
  useDoctorMedicalDetailQuery,
  usePatientMedicalOutcomeQuery,
} = medicalApi;
