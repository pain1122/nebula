import type { AuthSnapshot } from "../../../core";
import { subscribeTransportErrors } from "../api/transport";
import type { WireError } from "../api/wire";
import { TransportError } from "../api/wire";
import { sessionAuthGateway } from "./gateway";
import type { SessionAuthGateway } from "./gateway";
import type { AuthUser, LoginCredentials } from "./types";
import { hasPanelRole, panelLandingFor } from "./panel";

export type AdminAccessDenial = "non-admin" | null;

export interface AdminAuthSnapshot extends AuthSnapshot<AuthUser> {
  readonly denial: AdminAccessDenial;
  readonly error: Error | null;
}

export class AdminAccessDeniedError extends Error {
  constructor() {
    super("This account does not have access to the panel.");
    this.name = "AdminAccessDeniedError";
  }
}

const loadingSnapshot = (): AdminAuthSnapshot =>
  Object.freeze({ denial: null, error: null, identity: null, status: "loading" });

const wireError = (error: unknown): WireError | null =>
  error instanceof TransportError ? error.wire : null;

const shouldInvalidate = (error: unknown) => {
  const wire = wireError(error);
  return wire?.kind === "unauthenticated" || wire?.kind === "account-inactive";
};

const validRedirectIntent = (value: string) =>
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !/^[a-z][a-z\d+.-]*:/i.test(value) &&
  !["/login", "/logout"].includes(value.split(/[?#]/, 1)[0]);

export class AdminAuthAuthority {
  private bootstrapRequest: Promise<AdminAuthSnapshot> | null = null;
  private listeners = new Set<() => void>();
  private redirectIntent: string | null = null;
  private snapshot: AdminAuthSnapshot = loadingSnapshot();

  constructor(private readonly gateway: SessionAuthGateway) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(snapshot: AdminAuthSnapshot) {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of this.listeners) listener();
  }

  private authenticated(user: AuthUser) {
    this.publish({ denial: null, error: null, identity: user, status: "authenticated" });
    return this.snapshot;
  }

  private guest(error: Error | null = null, denial: AdminAccessDenial = null) {
    this.publish({ denial, error, identity: null, status: "guest" });
    return this.snapshot;
  }

  private async rejectNonAdmin(user: AuthUser): Promise<never> {
    if (hasPanelRole(user)) {
      throw new TypeError("rejectNonAdmin received a supported panel identity.");
    }

    const denial = new AdminAccessDeniedError();
    this.guest(denial, "non-admin");
    try {
      await this.gateway.logout();
    } catch {
      // Trust is already cleared. Preserve the explicit access-denied outcome.
    }
    throw denial;
  }

  bootstrap = (force = false) => {
    if (this.bootstrapRequest) return this.bootstrapRequest;
    if (!force && this.snapshot.status !== "loading") return Promise.resolve(this.snapshot);

    this.publish({ ...this.snapshot, error: null, status: "loading" });
    this.bootstrapRequest = this.gateway
      .currentUser()
      .then((user) => (hasPanelRole(user) ? this.authenticated(user) : this.rejectNonAdmin(user)))
      .catch((error: unknown) => {
        if (error instanceof AdminAccessDeniedError) return this.snapshot;
        if (wireError(error)?.kind === "unauthenticated") return this.guest();
        return this.guest(error instanceof Error ? error : new Error("Authentication failed."));
      })
      .finally(() => {
        this.bootstrapRequest = null;
      });

    return this.bootstrapRequest;
  };

  login = async (credentials: LoginCredentials) => {
    // Finish the session probe before CSRF/login can rotate its cookies or identity.
    if (this.bootstrapRequest) await this.bootstrapRequest;
    this.publish({ denial: null, error: null, identity: null, status: "loading" });
    try {
      const user = await this.gateway.login(credentials);
      if (!hasPanelRole(user)) return this.rejectNonAdmin(user);
      this.authenticated(user);
      return user;
    } catch (error: unknown) {
      if (!(error instanceof AdminAccessDeniedError)) {
        this.guest(error instanceof Error ? error : new Error("Authentication failed."));
      }
      throw error;
    }
  };

  logout = async () => {
    this.guest();
    try {
      await this.gateway.logout();
    } catch (error: unknown) {
      this.guest(error instanceof Error ? error : new Error("Logout failed."));
      throw error;
    }
  };

  observeError = (error: unknown) => {
    if (!shouldInvalidate(error)) return;

    const displayError = wireError(error)?.kind === "unauthenticated" ? null : error;
    this.guest(
      displayError instanceof Error
        ? displayError
        : displayError
          ? new Error("Authentication expired.")
          : null,
    );
  };

  rememberRedirectIntent = (value: string) => {
    if (validRedirectIntent(value)) this.redirectIntent = value;
  };

  consumeRedirectIntent = (
    fallback = this.snapshot.identity ? panelLandingFor(this.snapshot.identity) : "/",
  ) => {
    const intent = this.redirectIntent;
    this.redirectIntent = null;
    return intent || fallback;
  };
}

export const adminAuthAuthority = new AdminAuthAuthority(sessionAuthGateway);

subscribeTransportErrors((error) => adminAuthAuthority.observeError(error));
