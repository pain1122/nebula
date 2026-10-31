import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

import type { TransportAdapter, TransportRequest, TransportResponse } from "../../../core";
import { classifyWireFailure, TransportError } from "../api/wire";
import { createCheckupinoApi } from "../query/api";
import { isCancelledQueryError } from "../query/baseQuery";
import { createMedicalApi } from "./api";
import type { MedicalRequest } from "./types";

const request: MedicalRequest = {
  public_id: "synthetic-request",
  reservation_public_id: "synthetic-reservation",
  request_type: "document",
  title: "Synthetic PDF",
  instructions: null,
  status: "open",
  attachment_rules: {
    state: "available",
    field: "file",
    revision: "a".repeat(64),
    issued_revision: "b".repeat(64),
    allowed_mime_types: ["application/pdf"],
    max_bytes_by_mime: { "application/pdf": 1048576 },
  },
  due_at: null,
  reviewed_at: null,
  closed_at: null,
  created_at: null,
};

const response = (data: unknown): TransportResponse<unknown> => ({
  data: { success: true, data, message: null },
  headers: {},
  status: 200,
});

const setup = (execute: (request: TransportRequest) => Promise<TransportResponse<unknown>>) => {
  const transport: TransportAdapter = {
    async request<TData>(input: TransportRequest) {
      return (await execute(input)) as TransportResponse<TData>;
    },
  };
  const api = createMedicalApi(createCheckupinoApi(transport));
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (defaults) => defaults().concat(api.middleware),
  });
  return { api, store };
};

describe("medical panel read boundary", () => {
  it("separates patient/doctor caches and reservations while deduplicating matching requests", async () => {
    const execute = vi
      .fn<(input: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockResolvedValue(response([request]));
    const { api, store } = setup(execute);
    const patient = store.dispatch(api.endpoints.patientMedicalRequests.initiate("first"));
    const duplicate = store.dispatch(api.endpoints.patientMedicalRequests.initiate("first"));
    const doctor = store.dispatch(api.endpoints.doctorMedicalRequests.initiate("first"));
    const other = store.dispatch(api.endpoints.patientMedicalRequests.initiate("second"));
    await Promise.all([patient.unwrap(), duplicate.unwrap(), doctor.unwrap(), other.unwrap()]);
    expect(execute.mock.calls.map(([input]) => input.path)).toEqual([
      "/api/reservations/first/medical-requests",
      "/api/doctor/reservations/first/medical-requests",
      "/api/reservations/second/medical-requests",
    ]);
    expect(execute.mock.calls.every(([input]) => input.method === "GET" && !input.body)).toBe(true);
    expect(api.endpoints.patientMedicalRequests.select("first")(store.getState()).data).toEqual([
      request,
    ]);
    patient.unsubscribe();
    duplicate.unsubscribe();
    doctor.unsubscribe();
    other.unsubscribe();
    await vi.waitFor(() =>
      expect(
        api.endpoints.patientMedicalRequests.select("first")(store.getState()).data,
      ).toBeUndefined(),
    );
    store.dispatch(api.util.resetApiState());
  });

  it("keeps doctor drafts on the doctor endpoint and uses the published-outcome endpoint for patients", async () => {
    const draft = {
      public_id: "draft",
      status: "draft",
      body: "<b>plain text</b>",
      body_format: "plain_text",
    };
    const published = { ...draft, public_id: "published", status: "published" };
    const detail = { medical_request: request, files: [], reports: [draft] };
    const outcome = {
      medical_request: { ...request, status: "completed" },
      files: [],
      latest_report: published,
      report_history: [published],
    };
    const execute = vi
      .fn<(input: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response(outcome));
    const { api, store } = setup(execute);
    const scope = { reservationId: "reservation/other", requestId: "request?query" };
    const doctor = store.dispatch(api.endpoints.doctorMedicalDetail.initiate(scope));
    const patient = store.dispatch(api.endpoints.patientMedicalOutcome.initiate(scope));
    await expect(doctor.unwrap()).resolves.toEqual(detail);
    await expect(patient.unwrap()).resolves.toEqual(outcome);
    expect(execute.mock.calls.map(([input]) => input.path)).toEqual([
      "/api/doctor/reservations/reservation%2Fother/medical-requests/request%3Fquery",
      "/api/reservations/reservation%2Fother/medical-requests/request%3Fquery/outcome",
    ]);
    doctor.unsubscribe();
    patient.unsubscribe();
    store.dispatch(api.util.resetApiState());
  });

  it.each([401, 403, 404])(
    "preserves HTTP %s as an error without synthesizing an outcome",
    async (status) => {
      const execute = vi
        .fn<(input: TransportRequest) => Promise<TransportResponse<unknown>>>()
        .mockRejectedValue(new TransportError(classifyWireFailure({ status })));
      const { api, store } = setup(execute);
      const scope = { reservationId: "reservation", requestId: "request" };
      const operation = store.dispatch(api.endpoints.patientMedicalOutcome.initiate(scope));
      await expect(operation.unwrap()).rejects.toMatchObject({ status });
      expect(
        api.endpoints.patientMedicalOutcome.select(scope)(store.getState()).data,
      ).toBeUndefined();
      expect(execute).toHaveBeenCalledTimes(1);
      operation.unsubscribe();
      store.dispatch(api.util.resetApiState());
    },
  );

  it("forwards cancellation and clears medical results with the shared session reset", async () => {
    let observedSignal: AbortSignal | undefined;
    const execute = vi
      .fn<(input: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockResolvedValueOnce(response([request]))
      .mockImplementationOnce((input) => {
        observedSignal = input.signal;
        return new Promise((_resolve, reject) => {
          input.signal?.addEventListener("abort", () =>
            reject(new TransportError(classifyWireFailure({ cancelled: true }))),
          );
        });
      });
    const { api, store } = setup(execute);
    const existing = store.dispatch(api.endpoints.patientMedicalRequests.initiate("reservation"));
    await existing.unwrap();
    const pending = store.dispatch(api.endpoints.doctorMedicalRequests.initiate("reservation"));
    pending.abort();
    expect(isCancelledQueryError((await pending).error)).toBe(true);
    expect(observedSignal?.aborted).toBe(true);
    store.dispatch(api.util.resetApiState());
    expect(
      api.endpoints.patientMedicalRequests.select("reservation")(store.getState()).data,
    ).toBeUndefined();
    expect(
      api.endpoints.doctorMedicalRequests.select("reservation")(store.getState()).data,
    ).toBeUndefined();
    existing.unsubscribe();
    pending.unsubscribe();
  });
});
