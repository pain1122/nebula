import type { ListResult } from "../../../core";
import type { ApiEnvelope } from "../api/types";
import { checkupinoApi } from "../query/api";
import { adaptEnvelopePaginatorList } from "../query/lists";

export interface BookingCheckup {
  readonly id: number;
  readonly title: string;
  readonly description?: string | null;
}
export interface BookingDoctor {
  readonly doctor_profile_id: number;
  readonly doctor_name: string;
  readonly specialty?: string | null;
  readonly experience_years?: number;
  readonly rating?: number | null;
  readonly rating_count?: number;
  readonly photo_url?: null;
  readonly price_ranges?: readonly { currency: string; min: number; max: number }[];
  readonly workplaces: readonly {
    readonly id: number;
    readonly name: string;
    readonly timezone: string;
  }[];
}
export interface BookingSlot {
  readonly slot_id: string;
  readonly start: string;
  readonly end: string;
  readonly price: number;
  readonly currency: string;
}
export interface PanelReservation {
  readonly id: number;
  readonly public_id: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: string;
  readonly booked_amount: number;
  readonly booked_currency: string;
  readonly hold_expires_at: string | null;
  readonly can_sandbox_checkout?: boolean;
  readonly can_complete?: boolean;
  readonly checkup: { readonly title: string } | null;
  readonly doctor?: { readonly name: string } | null;
  readonly patient?: { readonly name: string } | null;
  readonly payment: { readonly status: string } | null;
}

export interface SandboxCheckout {
  readonly reservation_public_id: string;
  readonly reservation_status: string;
  readonly payment_status: string;
  readonly attempt_public_id: string;
  readonly attempt_status: string;
  readonly amount: number;
  readonly currency: string;
  readonly hold_expires_at: string | null;
  readonly can_complete: boolean;
}

export const bookingApi = checkupinoApi
  .enhanceEndpoints({ addTagTypes: ["PatientReservations", "DoctorReservations"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      doctorReservationDetail: builder.query<PanelReservation, number>({
        keepUnusedDataFor: 0,
        query: (id) => ({ method: "GET", path: `/api/doctor/reservations/${id}` }),
        transformResponse: (response: ApiEnvelope<PanelReservation>) => response.data,
      }),
      completeAppointment: builder.mutation<PanelReservation, number>({
        query: (id) => ({ method: "POST", path: `/api/doctor/reservations/${id}/complete` }),
        transformResponse: (response: ApiEnvelope<PanelReservation>) => response.data,
        invalidatesTags: (result, _error, id) =>
          result?.id === id && result.status === "completed"
            ? ["PatientReservations", "DoctorReservations"]
            : [],
      }),
      startSandboxCheckout: builder.mutation<
        SandboxCheckout,
        { readonly reservationId: string; readonly idempotencyKey: string }
      >({
        query: ({ reservationId, idempotencyKey }) => ({
          method: "POST",
          path: `/api/reservations/${reservationId}/sandbox/checkout`,
          idempotencyKey,
        }),
        transformResponse: (response: ApiEnvelope<SandboxCheckout>) => response.data,
      }),
      completeSandboxCheckout: builder.mutation<
        SandboxCheckout,
        {
          readonly reservationId: string;
          readonly attemptId: string;
          readonly outcome: "success" | "failed";
        }
      >({
        query: ({ reservationId, attemptId, outcome }) => ({
          method: "POST",
          path: `/api/reservations/${reservationId}/sandbox/attempts/${attemptId}/complete`,
          body: { outcome },
        }),
        transformResponse: (response: ApiEnvelope<SandboxCheckout>) => response.data,
        invalidatesTags: (result) => (result ? ["PatientReservations", "DoctorReservations"] : []),
      }),
      bookingCheckups: builder.query<
        ListResult<BookingCheckup>,
        number | { page: number; q: string }
      >({
        keepUnusedDataFor: 0,
        query: (selection) => ({
          method: "GET",
          path: "/api/checkups",
          query: typeof selection === "number" ? { page: selection } : selection,
        }),
        transformResponse: (response) => adaptEnvelopePaginatorList<BookingCheckup>(response),
      }),
      bookingDoctors: builder.query<readonly BookingDoctor[], number>({
        query: (id) => ({ method: "GET", path: `/api/checkups/${id}/doctors` }),
        transformResponse: (response: ApiEnvelope<readonly BookingDoctor[]>) => response.data,
      }),
      bookingSlots: builder.query<
        readonly BookingSlot[],
        { readonly doctorId: number; readonly workplaceId: number; readonly checkupId: number }
      >({
        query: ({ doctorId, workplaceId, checkupId }) => ({
          method: "GET",
          path: `/api/doctors/${doctorId}/availability`,
          query: { checkup_id: checkupId, workplace_id: workplaceId },
        }),
        transformResponse: (response: ApiEnvelope<readonly BookingSlot[]>) => response.data,
      }),
      patientReservations: builder.query<ListResult<PanelReservation>, number>({
        providesTags: ["PatientReservations"],
        query: (page) => ({ method: "GET", path: "/api/my/reservations", query: { page } }),
        transformResponse: (response) => adaptEnvelopePaginatorList<PanelReservation>(response),
      }),
      doctorReservations: builder.query<ListResult<PanelReservation>, number>({
        providesTags: ["DoctorReservations"],
        query: (page) => ({ method: "GET", path: "/api/doctor/reservations", query: { page } }),
        transformResponse: (response) => adaptEnvelopePaginatorList<PanelReservation>(response),
      }),
      createBooking: builder.mutation<
        unknown,
        { readonly slotId: string; readonly idempotencyKey: string }
      >({
        invalidatesTags: (result) => (result ? ["PatientReservations"] : []),
        query: ({ slotId, idempotencyKey }) => ({
          body: { slot_id: slotId },
          idempotencyKey,
          method: "POST",
          path: "/api/reservations",
        }),
      }),
    }),
  });

export const {
  useDoctorReservationDetailQuery,
  useCompleteAppointmentMutation,
  useStartSandboxCheckoutMutation,
  useCompleteSandboxCheckoutMutation,
  useBookingCheckupsQuery,
  useBookingDoctorsQuery,
  useBookingSlotsQuery,
  useCreateBookingMutation,
  usePatientReservationsQuery,
  useDoctorReservationsQuery,
} = bookingApi;
