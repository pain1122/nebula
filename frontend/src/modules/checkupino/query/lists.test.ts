import { describe, expect, it } from "vitest";

import { serializeQuery } from "../api/transport";
import {
  ListContractError,
  adaptAdminUsersList,
  adaptEnvelopePaginatorList,
  adaptModernAdminList,
  adaptPublicNakedList,
  adaptRawPaginatorList,
  adminDoctorsParameters,
  adminReservationsParameters,
  adminUsersParameters,
  checkupsParameters,
  publicQuestionnairesParameters,
} from "./lists";

const pagination = {
  current_page: 2,
  last_page: 4,
  per_page: 20,
  total: 75,
};

const normalizedPage = {
  currentPage: 2,
  lastPage: 4,
  perPage: 20,
  total: 75,
};

const queryEntries = (query: Readonly<Record<string, boolean | number | string | undefined>>) =>
  Object.fromEntries(new URLSearchParams(serializeQuery(query)));

describe("Checkupino list response adapters", () => {
  it("adapts the admin users data.users plus meta.pagination shape", () => {
    expect(
      adaptAdminUsersList<{ id: number }>({
        data: { users: [{ id: 10 }] },
        message: null,
        meta: { api_version: "1", pagination },
        success: true,
      }),
    ).toEqual({ items: [{ id: 10 }], page: normalizedPage });
  });

  it("adapts a modern admin data array plus meta.pagination shape", () => {
    expect(
      adaptModernAdminList<{ id: number }>({
        data: [{ id: 20 }],
        message: "Admin reservations list.",
        meta: { pagination },
        success: true,
      }),
    ).toEqual({ items: [{ id: 20 }], page: normalizedPage });
  });

  it("adapts a Laravel paginator nested inside an API envelope", () => {
    expect(
      adaptEnvelopePaginatorList<{ id: number }>({
        data: { data: [{ id: 30 }], ...pagination },
        message: "Doctors list.",
        meta: { api_version: "1" },
        success: true,
      }),
    ).toEqual({ items: [{ id: 30 }], page: normalizedPage });
  });

  it("adapts the public naked data and pagination body", () => {
    expect(adaptPublicNakedList<{ id: number }>({ data: [{ id: 40 }], meta: pagination })).toEqual({
      items: [{ id: 40 }],
      page: normalizedPage,
    });
  });

  it("adapts a raw compatibility paginator without inventing an envelope", () => {
    expect(adaptRawPaginatorList<{ id: number }>({ data: [{ id: 50 }], ...pagination })).toEqual({
      items: [{ id: 50 }],
      page: normalizedPage,
    });
  });

  it("rejects malformed shapes at the endpoint adapter boundary", () => {
    expect(() => adaptAdminUsersList({ data: [], meta: { pagination } })).toThrowError(
      ListContractError,
    );
    expect(() =>
      adaptModernAdminList({ data: [], meta: { pagination: { ...pagination, total: -1 } } }),
    ).toThrowError(/total/);
  });
});

describe("endpoint-specific list parameters", () => {
  it("uses only the admin-user allowlist and caps per_page", () => {
    expect(
      queryEntries(
        adminUsersParameters({
          page: 3,
          perPage: 500,
          q: "Ada",
          range: "month",
          role: "doctor",
          sortBy: "created_at",
          sortDirection: "asc",
        }),
      ),
    ).toEqual({
      page: "3",
      per_page: "100",
      q: "Ada",
      range: "month",
      role: "doctor",
      sort_by: "created_at",
      sort_dir: "asc",
    });
  });

  it("maps admin-reservation filters without leaking camelCase parameters", () => {
    expect(
      queryEntries(
        adminReservationsParameters({
          checkupId: 7,
          doctorId: 8,
          paymentStatus: "paid",
          sortBy: "patient_name",
          sortDirection: "desc",
          status: "confirmed",
          userId: 9,
        }),
      ),
    ).toEqual({
      checkup_id: "7",
      doctor_id: "8",
      payment_status: "paid",
      per_page: "20",
      sort_by: "patient_name",
      sort_dir: "desc",
      status: "confirmed",
      user_id: "9",
    });
  });

  it("does not emit unsupported per_page parameters for fixed-size endpoints", () => {
    expect(queryEntries(adminDoctorsParameters({ verified: false }))).toEqual({
      verified: "false",
    });
    expect(queryEntries(publicQuestionnairesParameters({ page: 2 }))).toEqual({ page: "2" });
    expect(queryEntries(checkupsParameters({ minPrice: 1000 }))).toEqual({ min_price: "1000" });
  });
});
