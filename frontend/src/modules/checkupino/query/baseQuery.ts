import type { BaseQueryFn } from "@reduxjs/toolkit/query";

import type { TransportAdapter, TransportRequest, TransportResponse } from "../../../core";
import { TransportError } from "../api/wire";
import type { WireError } from "../api/wire";

export interface ClientQueryError {
  readonly kind: "client";
  readonly message: string;
}

export type QueryError = ClientQueryError | WireError;

export const isCancelledQueryError = (value: unknown) => {
  if (typeof value !== "object" || value === null) return false;
  const error = value as Readonly<Record<string, unknown>>;
  return error.kind === "cancelled" || error.name === "AbortError";
};

export const createTransportBaseQuery =
  (
    transport: TransportAdapter,
  ): BaseQueryFn<TransportRequest, unknown, QueryError, object, TransportResponse<unknown>> =>
  async (request, api) => {
    try {
      const response = await transport.request<unknown>({ ...request, signal: api.signal });
      return { data: response.data, meta: response };
    } catch (error: unknown) {
      if (error instanceof TransportError) return { error: error.wire };

      return {
        error: {
          kind: "client",
          message: error instanceof Error ? error.message : "Client request failed.",
        },
      };
    }
  };
