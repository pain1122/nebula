import type { ListResult, PageMetadata } from "../../../core";

export class ListContractError extends Error {
  constructor(message: string) {
    super(`Invalid list response: ${message}`);
    this.name = "ListContractError";
  }
}

type WireRecord = Readonly<Record<string, unknown>>;

interface WirePagination {
  readonly current_page: number;
  readonly last_page: number;
  readonly per_page: number;
  readonly total: number;
}

interface WirePaginator<TItem> extends WirePagination {
  readonly data: readonly TItem[];
}

const isRecord = (value: unknown): value is WireRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const record = (value: unknown, location: string) => {
  if (!isRecord(value)) throw new ListContractError(`${location} must be an object.`);
  return value;
};

const items = <TItem>(value: unknown, location: string) => {
  if (!Array.isArray(value)) throw new ListContractError(`${location} must be an array.`);
  return Object.freeze([...value]) as readonly TItem[];
};

const integer = (value: unknown, location: string, minimum: number) => {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new ListContractError(
      `${location} must be an integer greater than or equal to ${minimum}.`,
    );
  }
  return value as number;
};

const page = (value: unknown, location: string): PageMetadata => {
  const pagination = record(value, location);
  return Object.freeze({
    currentPage: integer(pagination.current_page, `${location}.current_page`, 1),
    lastPage: integer(pagination.last_page, `${location}.last_page`, 1),
    perPage: integer(pagination.per_page, `${location}.per_page`, 1),
    total: integer(pagination.total, `${location}.total`, 0),
  });
};

const result = <TItem>(listItems: readonly TItem[], metadata: PageMetadata): ListResult<TItem> =>
  Object.freeze({ items: listItems, page: metadata });

const envelope = (value: unknown) => record(value, "response");

const paginator = <TItem>(value: unknown, location: string): ListResult<TItem> => {
  const wire = record(value, location) as unknown as WirePaginator<TItem>;
  return result(items<TItem>(wire.data, `${location}.data`), page(wire, location));
};

export const adaptAdminUsersList = <TItem = WireRecord>(value: unknown): ListResult<TItem> => {
  const wire = envelope(value);
  const data = record(wire.data, "response.data");
  const meta = record(wire.meta, "response.meta");
  return result(
    items<TItem>(data.users, "response.data.users"),
    page(meta.pagination, "response.meta.pagination"),
  );
};

export const adaptModernAdminList = <TItem = WireRecord>(value: unknown): ListResult<TItem> => {
  const wire = envelope(value);
  const meta = record(wire.meta, "response.meta");
  return result(
    items<TItem>(wire.data, "response.data"),
    page(meta.pagination, "response.meta.pagination"),
  );
};

export const adaptEnvelopePaginatorList = <TItem = WireRecord>(value: unknown): ListResult<TItem> =>
  paginator<TItem>(envelope(value).data, "response.data");

export const adaptPublicNakedList = <TItem = WireRecord>(value: unknown): ListResult<TItem> => {
  const wire = record(value, "response");
  return result(items<TItem>(wire.data, "response.data"), page(wire.meta, "response.meta"));
};

export const adaptRawPaginatorList = <TItem = WireRecord>(value: unknown): ListResult<TItem> =>
  paginator<TItem>(value, "response");

export type SortDirection = "asc" | "desc";

type QueryParameters = Readonly<Record<string, boolean | number | string | undefined>>;

const cappedPerPage = (value: number | undefined, fallback: number) =>
  Math.max(1, Math.min(Math.trunc(value ?? fallback), 100));

export interface AdminUsersQuery {
  readonly directory?: "staff";
  readonly accountState?: "active" | "closed" | "suspended";
  readonly verification?: "verified" | "unverified" | "missing";
  readonly specialtyId?: number;
  readonly workplaceId?: number;
  readonly page?: number;
  readonly perPage?: number;
  readonly q?: string;
  readonly range?: "all" | "month" | "week" | "year";
  readonly role?: "admin" | "doctor" | "patient";
  readonly sortBy?:
    | "account_state"
    | "created_at"
    | "email"
    | "first_name"
    | "id"
    | "last_name"
    | "name"
    | "patient_status"
    | "phone";
  readonly sortDirection?: SortDirection;
}

export const adminUsersParameters = (query: AdminUsersQuery = {}): QueryParameters => ({
  account_state: query.accountState,
  verification: query.role === "doctor" ? query.verification : undefined,
  specialty_id: query.role === "doctor" ? query.specialtyId : undefined,
  workplace_id: query.role === "doctor" ? query.workplaceId : undefined,
  page: query.page,
  per_page: cappedPerPage(query.perPage, 20),
  q: query.q,
  range: query.range,
  role: query.role,
  sort_by: query.sortBy,
  sort_dir: query.sortDirection,
});

export interface AdminReservationsQuery {
  readonly checkupId?: number;
  readonly doctorId?: number;
  readonly from?: string;
  readonly page?: number;
  readonly paymentStatus?: "paid" | "reconciliation" | "refunded" | "unpaid" | "voided";
  readonly perPage?: number;
  readonly q?: string;
  readonly sortBy?:
    | "checkup_title"
    | "created_at"
    | "doctor_name"
    | "ends_at"
    | "id"
    | "patient_name"
    | "payment_status"
    | "starts_at"
    | "status";
  readonly sortDirection?: SortDirection;
  readonly status?: "cancelled" | "completed" | "confirmed" | "expired" | "pending";
  readonly to?: string;
  readonly userId?: number;
}

export const adminReservationsParameters = (
  query: AdminReservationsQuery = {},
): QueryParameters => ({
  checkup_id: query.checkupId,
  doctor_id: query.doctorId,
  from: query.from,
  page: query.page,
  payment_status: query.paymentStatus,
  per_page: cappedPerPage(query.perPage, 20),
  q: query.q,
  sort_by: query.sortBy,
  sort_dir: query.sortDirection,
  status: query.status,
  to: query.to,
  user_id: query.userId,
});

export interface AdminDoctorsQuery {
  readonly maxFee?: number;
  readonly minExperience?: number;
  readonly minFee?: number;
  readonly page?: number;
  readonly q?: string;
  readonly sortBy?:
    "created_at" | "experience_years" | "fee" | "id" | "name" | "specialty" | "verified";
  readonly sortDirection?: SortDirection;
  readonly specialtyId?: number;
  readonly verified?: boolean;
}

export const adminDoctorsParameters = (query: AdminDoctorsQuery = {}): QueryParameters => ({
  max_fee: query.maxFee,
  min_experience: query.minExperience,
  min_fee: query.minFee,
  page: query.page,
  q: query.q,
  sort_by: query.sortBy,
  sort_dir: query.sortDirection,
  specialty_id: query.specialtyId,
  verified: query.verified,
});

export interface PublicQuestionnairesQuery {
  readonly page?: number;
  readonly q?: string;
  readonly sortBy?: "id" | "questions_count" | "slug" | "title" | "updated_at";
  readonly sortDirection?: SortDirection;
}

export const publicQuestionnairesParameters = (
  query: PublicQuestionnairesQuery = {},
): QueryParameters => ({
  page: query.page,
  q: query.q,
  sort_by: query.sortBy,
  sort_dir: query.sortDirection,
});

export interface CheckupsQuery {
  readonly categoryId?: number;
  readonly maxPrice?: number;
  readonly minPrice?: number;
  readonly page?: number;
  readonly q?: string;
  readonly sortBy?: "category_id" | "created_at" | "price" | "title";
  readonly sortDirection?: SortDirection;
}

export const checkupsParameters = (query: CheckupsQuery = {}): QueryParameters => ({
  category_id: query.categoryId,
  max_price: query.maxPrice,
  min_price: query.minPrice,
  page: query.page,
  q: query.q,
  sort_by: query.sortBy,
  sort_dir: query.sortDirection,
});
