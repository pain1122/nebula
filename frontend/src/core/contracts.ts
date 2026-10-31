export type RequestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export interface TransportRequest {
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly method: RequestMethod;
  readonly path: string;
  readonly query?: Readonly<Record<string, boolean | null | number | string | undefined>>;
  readonly signal?: AbortSignal;
}

export interface TransportResponse<TData> {
  readonly data: TData;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly status: number;
}

export interface TransportAdapter {
  request<TData>(request: TransportRequest): Promise<TransportResponse<TData>>;
}

export interface PageMetadata {
  readonly currentPage: number;
  readonly lastPage: number;
  readonly perPage: number;
  readonly total: number;
}

export interface ListResult<TItem> {
  readonly items: readonly TItem[];
  readonly page: PageMetadata;
}

export interface AuthIdentity {
  readonly roles: readonly string[];
}

export type AuthStatus = "authenticated" | "guest" | "loading";

export interface AuthSnapshot<TIdentity extends AuthIdentity = AuthIdentity> {
  readonly identity: TIdentity | null;
  readonly status: AuthStatus;
}

export interface AuthAdapter<TIdentity extends AuthIdentity = AuthIdentity> {
  getSnapshot(): AuthSnapshot<TIdentity>;
  subscribe(listener: () => void): () => void;
}

export type TextDirection = "ltr" | "rtl";

export interface LocalizationAdapter {
  readonly direction: TextDirection;
  readonly locale: string;
  translate(key: string, values?: Readonly<Record<string, unknown>>): string;
}

export interface TokenAdapter {
  resolve(name: string): number | string | undefined;
}
