import type { AdminUsersQuery } from "../query/lists";
import type { ServerTableEndpointAdapter, ServerTableQuery } from "../table";

export interface AdminDirectoryUser {
  readonly id: number;
  readonly public_id: string;
  readonly name: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role: "admin" | "doctor" | "patient" | null;
  readonly account_state: "active" | "closed" | "suspended" | null;
  readonly patient_status: "active" | "expired" | "free" | "suspended" | "trial" | null;
  readonly created_at: string | null;
  readonly doctor_profile?: {
    readonly id: number;
    readonly verified: boolean;
    readonly specialty: string | null;
    readonly active_workplaces_count: number;
  } | null;
}

export type DirectoryScope = "doctor" | "patient";
const positiveId = (value: string) =>
  /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
export const scopedDirectoryQuery = (
  query: ServerTableQuery,
  scope?: DirectoryScope,
): ServerTableQuery => (scope ? { ...query, filters: { ...query.filters, role: scope } } : query);

const allowedSorts = {
  created_at: "created_at",
  name: "name",
  patient_status: "patient_status",
  account_state: "account_state",
} as const;

export const createUserDirectoryAdapter = (
  manageAdminIdentities: boolean,
  scope?: DirectoryScope,
): ServerTableEndpointAdapter<AdminDirectoryUser> => ({
  defaultPerPage: 20,
  filters: {
    accountState: {
      parameter: "account_state",
      parse: (value) => (["active", "closed", "suspended"].includes(value) ? value : undefined),
    },
    ...(scope === "doctor"
      ? {
          verification: {
            parameter: "verification",
            parse: (value: string) =>
              ["verified", "unverified", "missing"].includes(value) ? value : undefined,
          },
          specialtyId: { parameter: "specialty_id", parse: positiveId },
          workplaceId: { parameter: "workplace_id", parse: positiveId },
        }
      : {}),
    range: {
      parameter: "range",
      parse: (value) => (["week", "month", "year"].includes(value) ? value : undefined),
    },
    role: {
      parameter: "role",
      parse: (value) =>
        scope ??
        (value === "doctor" || value === "patient" || (manageAdminIdentities && value === "admin")
          ? value
          : undefined),
    },
  },
  getRouteIdentifier: (user) => user.public_id,
  getRowIdentifier: (user) => user.id,
  maxPerPage: 100,
  sortableColumns: allowedSorts,
});

export const userDirectoryRequest = (
  query: ServerTableQuery,
  manageAdminIdentities: boolean,
  staffOnly = false,
): AdminUsersQuery => {
  const role = query.filters.role;
  const range = query.filters.range;
  const column = query.sort?.columnId;
  const sortBy =
    column && Object.prototype.hasOwnProperty.call(allowedSorts, column)
      ? allowedSorts[column as keyof typeof allowedSorts]
      : undefined;
  return {
    ...(staffOnly ? { directory: "staff" as const } : {}),
    page: query.page,
    perPage: query.perPage,
    q: query.search || undefined,
    range: range === "week" || range === "month" || range === "year" ? range : undefined,
    role: staffOnly
      ? "admin"
      : role === "doctor" || role === "patient" || (manageAdminIdentities && role === "admin")
        ? role
        : undefined,
    sortBy,
    sortDirection: sortBy ? query.sort?.direction : undefined,
    accountState:
      query.filters.accountState === "active" ||
      query.filters.accountState === "closed" ||
      query.filters.accountState === "suspended"
        ? query.filters.accountState
        : undefined,
    verification:
      role === "doctor" &&
      ["verified", "unverified", "missing"].includes(String(query.filters.verification))
        ? (query.filters.verification as AdminUsersQuery["verification"])
        : undefined,
    specialtyId:
      role === "doctor" ? positiveId(String(query.filters.specialtyId ?? "")) : undefined,
    workplaceId:
      role === "doctor" ? positiveId(String(query.filters.workplaceId ?? "")) : undefined,
  };
};
