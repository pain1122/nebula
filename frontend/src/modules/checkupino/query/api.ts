import { createApi } from "@reduxjs/toolkit/query/react";

import type { ListResult, TransportAdapter } from "../../../core";
import { checkupinoTransport, serializeQuery } from "../api/transport";
import { createTransportBaseQuery } from "./baseQuery";
import type { AdminDirectoryUser } from "../users/directory";
import type { AdminUser } from "../users/editor";
import type { ApiEnvelope } from "../api/types";
import { adaptUploadSetting, type UploadSetting, type UploadSettingKey } from "../uploads/policy";
import {
  adaptAdminUsersList,
  adaptEnvelopePaginatorList,
  adaptModernAdminList,
  adaptPublicNakedList,
  adminDoctorsParameters,
  adminReservationsParameters,
  adminUsersParameters,
  checkupsParameters,
  publicQuestionnairesParameters,
} from "./lists";
import type {
  AdminDoctorsQuery,
  AdminReservationsQuery,
  AdminUsersQuery,
  CheckupsQuery,
  PublicQuestionnairesQuery,
} from "./lists";

export interface IdentifiedListItem extends Readonly<Record<string, unknown>> {
  readonly id: number;
  readonly public_id?: string;
}

const queryCacheKey = (
  endpointName: string,
  query: Readonly<Record<string, boolean | null | number | string | undefined>>,
) => `${endpointName}?${serializeQuery(query)}`;

export const createCheckupinoApi = (transport: TransportAdapter) =>
  createApi({
    baseQuery: createTransportBaseQuery(transport),
    endpoints: (builder) => ({
      uploadSetting: builder.query<UploadSetting, UploadSettingKey>({
        providesTags: (_result, _error, id) => [{ id, type: "UploadSettings" }],
        query: (key) => ({ method: "GET", path: `/api/admin/settings/${key}` }),
        transformResponse: (response: unknown, _meta, key) => adaptUploadSetting(response, key),
      }),
      adminDoctors: builder.query<ListResult<IdentifiedListItem>, AdminDoctorsQuery>({
        providesTags: [{ id: "LIST", type: "AdminDoctors" }],
        query: (filters) => ({
          method: "GET",
          path: "/api/admin/doctors",
          query: adminDoctorsParameters(filters),
        }),
        serializeQueryArgs: ({ endpointName, queryArgs }) =>
          queryCacheKey(endpointName, adminDoctorsParameters(queryArgs)),
        transformResponse: (response) => adaptEnvelopePaginatorList<IdentifiedListItem>(response),
      }),
      adminReservations: builder.query<ListResult<IdentifiedListItem>, AdminReservationsQuery>({
        providesTags: [{ id: "LIST", type: "AdminReservations" }],
        query: (filters) => ({
          method: "GET",
          path: "/api/admin/reservations",
          query: adminReservationsParameters(filters),
        }),
        serializeQueryArgs: ({ endpointName, queryArgs }) =>
          queryCacheKey(endpointName, adminReservationsParameters(queryArgs)),
        transformResponse: (response) => adaptModernAdminList<IdentifiedListItem>(response),
      }),
      adminUsers: builder.query<ListResult<AdminDirectoryUser>, AdminUsersQuery>({
        providesTags: [{ id: "LIST", type: "AdminUsers" }],
        query: (filters) => ({
          method: "GET",
          path: filters.directory === "staff" ? "/api/admin/staff" : "/api/admin/users",
          query: adminUsersParameters(filters),
        }),
        serializeQueryArgs: ({ endpointName, queryArgs }) =>
          queryCacheKey(endpointName, {
            ...adminUsersParameters(queryArgs),
            directory: queryArgs.directory,
          }),
        transformResponse: (response, _meta, filters) => {
          const list = adaptAdminUsersList<AdminDirectoryUser>(response);
          if (filters.directory === "staff" && list.items.some((row) => row.role !== "admin"))
            throw new Error("Non-staff identity returned by staff directory.");
          return list;
        },
      }),
      adminUser: builder.query<AdminUser, number>({
        providesTags: (_result, _error, id) => [{ id, type: "AdminUsers" }],
        query: (id) => ({ method: "GET", path: `/api/admin/users/${id}` }),
        transformResponse: (response: ApiEnvelope<{ readonly user: AdminUser }>) =>
          response.data.user,
      }),
      checkups: builder.query<ListResult<IdentifiedListItem>, CheckupsQuery>({
        providesTags: [{ id: "LIST", type: "Checkups" }],
        query: (filters) => ({
          method: "GET",
          path: "/api/checkups",
          query: checkupsParameters(filters),
        }),
        serializeQueryArgs: ({ endpointName, queryArgs }) =>
          queryCacheKey(endpointName, checkupsParameters(queryArgs)),
        transformResponse: (response) => adaptEnvelopePaginatorList<IdentifiedListItem>(response),
      }),
      publicQuestionnaires: builder.query<
        ListResult<IdentifiedListItem>,
        PublicQuestionnairesQuery
      >({
        providesTags: [{ id: "LIST", type: "PublicQuestionnaires" }],
        query: (filters) => ({
          method: "GET",
          path: "/api/questionnaires",
          query: publicQuestionnairesParameters(filters),
        }),
        serializeQueryArgs: ({ endpointName, queryArgs }) =>
          queryCacheKey(endpointName, publicQuestionnairesParameters(queryArgs)),
        transformResponse: (response) => adaptPublicNakedList<IdentifiedListItem>(response),
      }),
    }),
    reducerPath: "checkupinoApi",
    tagTypes: [
      "AdminDoctors",
      "AdminReservations",
      "AdminUsers",
      "Checkups",
      "PublicQuestionnaires",
      "UploadSettings",
    ],
  });

export const checkupinoApi = createCheckupinoApi(checkupinoTransport);

export const {
  useAdminDoctorsQuery,
  useAdminReservationsQuery,
  useAdminUsersQuery,
  useAdminUserQuery,
  useCheckupsQuery,
  usePublicQuestionnairesQuery,
  useUploadSettingQuery,
} = checkupinoApi;
