export interface ApiEnvelope<TData> {
  readonly data: TData;
  readonly message: string | null;
  readonly meta?: Readonly<Record<string, unknown>> | null;
  readonly success: boolean;
}
