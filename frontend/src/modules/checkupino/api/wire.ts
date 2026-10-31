export type WireErrorKind =
  | "account-inactive"
  | "cancelled"
  | "csrf"
  | "forbidden"
  | "http"
  | "network"
  | "not-found"
  | "recent-password"
  | "server"
  | "throttled"
  | "unauthenticated"
  | "validation";

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface WireError {
  readonly code: string | null;
  readonly correlationId: string | null;
  readonly errors: FieldErrors;
  readonly kind: WireErrorKind;
  readonly message: string | null;
  readonly meta: Readonly<Record<string, unknown>> | null;
  readonly retryAfter: string | null;
  readonly status: number | null;
}

export interface FailureSnapshot {
  readonly cancelled?: boolean;
  readonly data?: unknown;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly message?: string;
  readonly status?: number;
}

export class TransportError extends Error {
  readonly wire: WireError;

  constructor(wire: WireError) {
    super(wire.message || "Request failed.");
    this.name = "TransportError";
    this.wire = wire;
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown) => (typeof value === "string" ? value : null);

const normalizeFieldErrors = (value: unknown): FieldErrors => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([field, messages]) => {
      if (typeof messages === "string") return [[field, [messages]]];
      if (Array.isArray(messages)) {
        const strings = messages.filter(
          (message): message is string => typeof message === "string",
        );
        return strings.length > 0 ? [[field, strings]] : [];
      }
      return [];
    }),
  );
};

const errorKind = (status: number | null, code: string | null): WireErrorKind => {
  if (status === null) return "network";
  if (status === 401) return "unauthenticated";
  if (status === 403 && code === "account_inactive") return "account-inactive";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 419) return "csrf";
  if (status === 422) return "validation";
  if (status === 423) return "recent-password";
  if (status === 429) return "throttled";
  if (status >= 500) return "server";
  return "http";
};

export const classifyWireFailure = (snapshot: FailureSnapshot): WireError => {
  if (snapshot.cancelled) {
    return Object.freeze({
      code: null,
      correlationId: null,
      errors: {},
      kind: "cancelled",
      message: snapshot.message || null,
      meta: null,
      retryAfter: null,
      status: null,
    });
  }

  const body = isRecord(snapshot.data) ? snapshot.data : {};
  const meta = isRecord(body.meta) ? body.meta : null;
  const status = snapshot.status ?? null;
  const code = optionalString(body.code);
  const correlationId =
    snapshot.headers?.["x-correlation-id"] ||
    optionalString(meta?.correlation_id) ||
    optionalString(meta?.correlationId);

  return Object.freeze({
    code,
    correlationId,
    errors: normalizeFieldErrors(body.errors),
    kind: errorKind(status, code),
    message: optionalString(body.message) || snapshot.message || null,
    meta,
    retryAfter: snapshot.headers?.["retry-after"] || null,
    status,
  });
};
