import { describe, expect, it, vi } from "vitest";

import { classifyWireFailure, TransportError } from "../api/wire";
import { AdminAccessDeniedError, AdminAuthAuthority } from "./authority";
import type { SessionAuthGateway } from "./gateway";
import type { AuthUser, RoleName } from "./types";

const user = (roles: readonly RoleName[] = ["admin"]): AuthUser => ({
  doctor_profile: null,
  email: "admin@example.test",
  id: 1,
  name: "Admin",
  public_id: "01JTESTAUTHORITY000000000000",
  roles,
});

const deferred = <TValue>() => {
  let resolve!: (value: TValue) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const gateway = (overrides: Partial<SessionAuthGateway> = {}): SessionAuthGateway => ({
  currentUser: async () => user(),
  login: async () => user(),
  logout: async () => undefined,
  ...overrides,
});

const transportError = (status: number, code?: string) =>
  new TransportError(classifyWireFailure({ data: code ? { code } : undefined, status }));

describe("admin auth authority", () => {
  it("deduplicates bootstrap and publishes one shared authenticated snapshot", async () => {
    const currentUser = deferred<AuthUser>();
    const currentUserCall = vi.fn<() => Promise<AuthUser>>(() => currentUser.promise);
    const authority = new AdminAuthAuthority(gateway({ currentUser: currentUserCall }));
    const listener = vi.fn<() => void>();
    authority.subscribe(listener);

    const first = authority.bootstrap();
    const second = authority.bootstrap();
    currentUser.resolve(user(["root-admin"]));

    await expect(first).resolves.toMatchObject({ status: "authenticated" });
    await expect(second).resolves.toBe(authority.getSnapshot());
    expect(currentUserCall).toHaveBeenCalledTimes(1);
    expect(authority.getSnapshot().identity?.roles).toEqual(["root-admin"]);
    expect(listener).toHaveBeenCalled();
  });

  it("treats an unauthenticated bootstrap as a normal silent guest state", async () => {
    const unauthenticated = transportError(401);
    const authority = new AdminAuthAuthority(
      gateway({ currentUser: async () => Promise.reject(unauthenticated) }),
    );

    await expect(authority.bootstrap()).resolves.toMatchObject({
      denial: null,
      error: null,
      identity: null,
      status: "guest",
    });
  });

  it.each([401, 503])(
    "waits for pending session bootstrap before login, including a %s bootstrap failure",
    async (status) => {
      const currentUser = deferred<AuthUser>();
      const loginCall = vi.fn<SessionAuthGateway["login"]>(async () => user());
      const authority = new AdminAuthAuthority(
        gateway({ currentUser: () => currentUser.promise, login: loginCall }),
      );
      const bootstrap = authority.bootstrap();
      const credentials = { email: "admin@example.test", password: "secret" };
      const login = authority.login(credentials);

      await Promise.resolve();
      expect(loginCall).not.toHaveBeenCalled();

      currentUser.reject(transportError(status));
      await bootstrap;
      await expect(login).resolves.toEqual(user());
      expect(loginCall).toHaveBeenCalledExactlyOnceWith(credentials);
      expect(authority.getSnapshot()).toMatchObject({
        error: null,
        identity: user(),
        status: "authenticated",
      });
    },
  );

  it("clears trusted identity before logout completes", async () => {
    const pendingLogout = deferred<void>();
    const authority = new AdminAuthAuthority(gateway({ logout: () => pendingLogout.promise }));
    await authority.login({ email: "admin@example.test", password: "secret" });

    const logout = authority.logout();

    expect(authority.getSnapshot()).toMatchObject({ identity: null, status: "guest" });
    pendingLogout.resolve();
    await expect(logout).resolves.toBeUndefined();
  });

  it("keeps trust cleared when logout fails", async () => {
    const failure = new Error("Network Error");
    const authority = new AdminAuthAuthority(
      gateway({ logout: async () => Promise.reject(failure) }),
    );
    await authority.login({ email: "admin@example.test", password: "secret" });

    await expect(authority.logout()).rejects.toBe(failure);
    expect(authority.getSnapshot()).toMatchObject({
      error: failure,
      identity: null,
      status: "guest",
    });
  });

  it("invalidates on 401 and explicit inactive errors but not ordinary 403", async () => {
    const authority = new AdminAuthAuthority(gateway());
    await authority.login({ email: "admin@example.test", password: "secret" });

    authority.observeError(transportError(403));
    expect(authority.getSnapshot().status).toBe("authenticated");

    const inactive = transportError(403, "account_inactive");
    authority.observeError(inactive);
    expect(authority.getSnapshot()).toMatchObject({
      error: inactive,
      identity: null,
      status: "guest",
    });

    await authority.login({ email: "admin@example.test", password: "secret" });
    authority.observeError(transportError(401));
    expect(authority.getSnapshot()).toMatchObject({
      error: null,
      identity: null,
      status: "guest",
    });
  });

  it("logs out an identity with no supported panel role and exposes an explicit denial", async () => {
    const logout = vi.fn<() => Promise<void>>(async () => undefined);
    const authority = new AdminAuthAuthority(gateway({ login: async () => user([]), logout }));

    await expect(
      authority.login({ email: "doctor@example.test", password: "secret" }),
    ).rejects.toBeInstanceOf(AdminAccessDeniedError);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(authority.getSnapshot()).toMatchObject({
      denial: "non-admin",
      identity: null,
      status: "guest",
    });
  });

  it("settles bootstrap as guest when a pre-existing session has no panel role", async () => {
    const logout = vi.fn<() => Promise<void>>(async () => undefined);
    const authority = new AdminAuthAuthority(
      gateway({ currentUser: async () => user([]), logout }),
    );

    await expect(authority.bootstrap()).resolves.toMatchObject({
      denial: "non-admin",
      status: "guest",
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("retains one safe internal redirect intent and consumes it once", () => {
    const authority = new AdminAuthAuthority(gateway());

    authority.rememberRedirectIntent("https://untrusted.example/path");
    authority.rememberRedirectIntent("//untrusted.example/path");
    authority.rememberRedirectIntent("/login");
    expect(authority.consumeRedirectIntent()).toBe("/");

    authority.rememberRedirectIntent("/profile?tab=security#sessions");
    expect(authority.consumeRedirectIntent()).toBe("/profile?tab=security#sessions");
    expect(authority.consumeRedirectIntent()).toBe("/");
  });

  it.each([
    ["patient", "/"],
    ["doctor", "/"],
    ["admin", "/"],
    ["root-admin", "/"],
  ] as const)("accepts %s sessions and chooses their panel landing", async (role, landing) => {
    const logout = vi.fn<() => Promise<void>>(async () => undefined);
    const authority = new AdminAuthAuthority(
      gateway({ currentUser: async () => user([role]), login: async () => user([role]), logout }),
    );
    await expect(authority.bootstrap()).resolves.toMatchObject({
      status: "authenticated",
      identity: { roles: [role] },
    });
    await expect(
      authority.login({ email: "actor@example.test", password: "secret" }),
    ).resolves.toMatchObject({ roles: [role] });
    expect(authority.consumeRedirectIntent()).toBe(landing);
    expect(logout).not.toHaveBeenCalled();
  });
});
