import { afterEach, describe, expect, it, vi } from "vitest";

import { checkupinoApi } from "../modules/checkupino/query/api";
import { medicalApi } from "../modules/checkupino/medical/api";
import { store } from "../store";

const { auth, listeners } = vi.hoisted(() => ({
  auth: { identity: null as { public_id: string; roles: string[] } | null },
  listeners: new Set<() => void>(),
}));

vi.mock("../modules/checkupino/auth/authority", () => ({
  adminAuthAuthority: {
    getSnapshot: () => auth,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));

const publishIdentity = (identity: typeof auth.identity) => {
  auth.identity = identity;
  for (const listener of listeners) listener();
};

const cachedResult = { items: [], page: { currentPage: 1, lastPage: 1, perPage: 20, total: 0 } };
const seedDirectoryCache = () =>
  store.dispatch(checkupinoApi.util.upsertQueryData("adminUsers", {}, cachedResult));
const cache = () => checkupinoApi.endpoints.adminUsers.select({})(store.getState());

afterEach(() => {
  publishIdentity(null);
  store.dispatch(checkupinoApi.util.resetApiState());
});

describe("session-owned query cache", () => {
  it("clears injected medical results when the patient changes or signs out", async () => {
    publishIdentity({ public_id: "patient-one", roles: ["patient"] });
    await store.dispatch(medicalApi.util.upsertQueryData("patientMedicalRequests", "R1", []));
    expect(medicalApi.endpoints.patientMedicalRequests.select("R1")(store.getState()).data).toEqual(
      [],
    );
    publishIdentity({ public_id: "patient-two", roles: ["patient"] });
    expect(
      medicalApi.endpoints.patientMedicalRequests.select("R1")(store.getState()).isUninitialized,
    ).toBe(true);
    await store.dispatch(medicalApi.util.upsertQueryData("patientMedicalRequests", "R2", []));
    publishIdentity(null);
    expect(
      medicalApi.endpoints.patientMedicalRequests.select("R2")(store.getState()).isUninitialized,
    ).toBe(true);
  });
  it("clears user data on logout and account changes without changing backend authority", async () => {
    publishIdentity({ public_id: "root-example", roles: ["root-admin"] });
    await seedDirectoryCache();
    expect(cache().data).toEqual(cachedResult);
    publishIdentity(null);
    expect(cache().isUninitialized).toBe(true);
    publishIdentity({ public_id: "root-example", roles: ["root-admin"] });
    await seedDirectoryCache();
    publishIdentity({ public_id: "admin-example", roles: ["admin"] });
    expect(cache().isUninitialized).toBe(true);
  });

  it("clears changed roles but retains identical authenticated identity snapshots", async () => {
    publishIdentity({ public_id: "admin-example", roles: ["admin"] });
    await seedDirectoryCache();
    publishIdentity({ public_id: "admin-example", roles: ["admin"] });
    expect(cache().data).toEqual(cachedResult);
    publishIdentity({ public_id: "admin-example", roles: ["root-admin"] });
    expect(cache().isUninitialized).toBe(true);
  });
});
