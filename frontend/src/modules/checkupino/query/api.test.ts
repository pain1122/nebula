import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

import type { TransportAdapter, TransportRequest, TransportResponse } from "../../../core";
import { classifyWireFailure, TransportError } from "../api/wire";
import { createCheckupinoApi } from "./api";
import { isCancelledQueryError } from "./baseQuery";

const page = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
};

const usersResponse = (): TransportResponse<unknown> => ({
  data: {
    data: { users: [{ id: 1, public_id: "01JQUERYUSER00000000000000" }] },
    message: null,
    meta: { pagination: page },
    success: true,
  },
  headers: {},
  status: 200,
});

const deferred = <TValue>() => {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const transportFrom = (
  execute: (request: TransportRequest) => Promise<TransportResponse<unknown>>,
): TransportAdapter => ({
  async request<TData>(request: TransportRequest) {
    return (await execute(request)) as TransportResponse<TData>;
  },
});

const storeFor = (api: ReturnType<typeof createCheckupinoApi>) =>
  configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
    reducer: { [api.reducerPath]: api.reducer },
  });

describe("Checkupino RTK Query boundary", () => {
  it("deduplicates equal active queries and refetches only after explicit invalidation", async () => {
    const firstResponse = deferred<TransportResponse<unknown>>();
    const execute = vi
      .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValue(usersResponse());
    const api = createCheckupinoApi(transportFrom(execute));
    const store = storeFor(api);

    const first = store.dispatch(api.endpoints.adminUsers.initiate({ q: "Ada" }));
    const duplicate = store.dispatch(api.endpoints.adminUsers.initiate({ perPage: 20, q: "Ada" }));

    expect(execute).toHaveBeenCalledTimes(1);
    firstResponse.resolve(usersResponse());
    await expect(first.unwrap()).resolves.toMatchObject({ items: [{ id: 1 }] });
    await expect(duplicate.unwrap()).resolves.toMatchObject({ items: [{ id: 1 }] });

    store.dispatch(api.util.invalidateTags([{ id: "LIST", type: "AdminUsers" }]));
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));

    first.unsubscribe();
    duplicate.unsubscribe();
    store.dispatch(api.util.resetApiState());
  });

  it("forwards RTK cancellation to the transport and classifies abort outcomes", async () => {
    let observedSignal: AbortSignal | undefined;
    const execute = vi.fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>(
      (request) => {
        observedSignal = request.signal;
        return new Promise((_resolve, reject) => {
          request.signal?.addEventListener("abort", () => {
            reject(
              new TransportError(
                classifyWireFailure({ cancelled: true, message: "Request cancelled." }),
              ),
            );
          });
        });
      },
    );
    const api = createCheckupinoApi(transportFrom(execute));
    const store = storeFor(api);
    const operation = store.dispatch(api.endpoints.adminUsers.initiate({ q: "cancel-me" }));

    operation.abort();
    const outcome = await operation;

    expect(observedSignal?.aborted).toBe(true);
    expect(isCancelledQueryError(outcome.error)).toBe(true);
    operation.unsubscribe();
    store.dispatch(api.util.resetApiState());
  });
});
