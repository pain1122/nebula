import type { TransportAdapter } from "../../../core";
import type { ApiEnvelope } from "../api/types";
import { checkupinoTransport } from "../api/transport";
import type { WireError } from "../api/wire";
import { TransportError } from "../api/wire";

export interface RecentPasswordConfirmation {
  readonly confirmedAt: string;
  readonly expiresAt: string;
}

export interface RecentPasswordPromptRequest {
  readonly requirement: WireError;
  readonly signal?: AbortSignal;
}

export interface RecentPasswordPrompt {
  requestPassword(request: RecentPasswordPromptRequest): Promise<string | null>;
}

export interface RecentPasswordGateway {
  confirm(password: string, signal?: AbortSignal): Promise<RecentPasswordConfirmation>;
}

export interface RecentPasswordRunOptions {
  readonly signal?: AbortSignal;
}

export class RecentPasswordCancelledError extends Error {
  constructor() {
    super("Recent password confirmation was cancelled.");
    this.name = "RecentPasswordCancelledError";
  }
}

const recentPasswordRequirement = (error: unknown): WireError | null => {
  if (error instanceof TransportError) {
    return error.wire.kind === "recent-password" ? error.wire : null;
  }
  if (typeof error !== "object" || error === null) return null;

  const candidate = error as Readonly<Record<string, unknown>>;
  return candidate.kind === "recent-password" ? (error as WireError) : null;
};

const assertNotCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new RecentPasswordCancelledError();
};

export const createRecentPasswordGateway = (
  transport: TransportAdapter,
): RecentPasswordGateway => ({
  async confirm(password, signal) {
    const response = await transport.request<
      ApiEnvelope<{ readonly confirmed_at: string; readonly expires_at: string }>
    >({
      body: { password },
      method: "POST",
      path: "/api/auth/confirm-password",
      signal,
    });

    return Object.freeze({
      confirmedAt: response.data.data.confirmed_at,
      expiresAt: response.data.data.expires_at,
    });
  },
});

export class RecentPasswordCoordinator {
  constructor(private readonly gateway: RecentPasswordGateway) {}

  async run<TValue>(
    operation: () => Promise<TValue>,
    prompt: RecentPasswordPrompt,
    options: RecentPasswordRunOptions = {},
  ): Promise<TValue> {
    try {
      return await operation();
    } catch (error: unknown) {
      const requirement = recentPasswordRequirement(error);
      if (!requirement) throw error;

      assertNotCancelled(options.signal);
      const password = await prompt.requestPassword({ requirement, signal: options.signal });
      assertNotCancelled(options.signal);
      if (password === null) throw new RecentPasswordCancelledError();

      await this.gateway.confirm(password, options.signal);
      assertNotCancelled(options.signal);
      return operation();
    }
  }
}

export const recentPasswordGateway = createRecentPasswordGateway(checkupinoTransport);
export const recentPasswordCoordinator = new RecentPasswordCoordinator(recentPasswordGateway);

export const isRecentPasswordCancellation = (error: unknown) =>
  error instanceof RecentPasswordCancelledError;
