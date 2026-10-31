import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

import type { TransportAdapter, TransportRequest, TransportResponse } from "../../../core";
import { classifyWireFailure, TransportError } from "../api/wire";
import { createCheckupinoApi } from "../query/api";
import { isCancelledQueryError } from "../query/baseQuery";
import { createMedicalApi } from "./api";
import { createMedicalWritesApi } from "./writes";

const response = (data: unknown): TransportResponse<unknown> => ({
  data: { success: true, data, message: null },
  headers: {},
  status: 200,
});
const scope = { reservationId: "R/1", requestId: "M?1" };
const receipt = {
  public_id: "F1",
  label: "Synthetic",
  mime_type: "application/pdf",
  size_bytes: 3,
  available: false,
  created_at: null,
};
const setup = (execute: (request: TransportRequest) => Promise<TransportResponse<unknown>>) => {
  const transport: TransportAdapter = {
    async request<T>(request: TransportRequest) {
      return (await execute(request)) as TransportResponse<T>;
    },
  };
  const api = createMedicalWritesApi(createMedicalApi(createCheckupinoApi(transport)));
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (defaults) => defaults().concat(api.middleware),
  });
  return { api, store };
};

describe("ordinary medical write adapter", () => {
  it("whitelists doctor request/rule inputs without supplying issued policy, ownership or lifecycle facts", async () => {
    const execute = vi
      .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockResolvedValue(response({ public_id: "M1" }));
    const { api, store } = setup(execute);
    const draft = {
      requestType: "document",
      title: "Synthetic request",
      instructions: "Synthetic only",
      attachmentRules: {
        maxBytes: 1048576,
        allowedMimeTypes: ["application/pdf"],
        revision: "forged",
      },
      requested_by: 7,
      status: "completed",
      attachment_policy: { forged: true },
    };
    await store
      .dispatch(
        api.endpoints.createMedicalRequest.initiate({ reservationId: scope.reservationId, draft }),
      )
      .unwrap();
    expect(execute.mock.calls[0][0]).toMatchObject({
      method: "POST",
      path: "/api/doctor/reservations/R%2F1/medical-requests",
      body: {
        request_type: "document",
        title: "Synthetic request",
        instructions: "Synthetic only",
        attachment_rules: { max_bytes: 1048576, allowed_mime_types: ["application/pdf"] },
      },
    });
    expect(Object.keys(execute.mock.calls[0][0].body as object).sort()).toEqual([
      "attachment_rules",
      "instructions",
      "request_type",
      "title",
    ]);
    store.dispatch(api.util.resetApiState());
  });

  it("sends only File/label multipart fields and preserves the quarantined receipt", async () => {
    const execute = vi
      .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockResolvedValue(response(receipt));
    const { api, store } = setup(execute);
    const upload = {
      ...scope,
      file: new File(["pdf"], "synthetic.pdf", { type: "application/pdf" }),
      label: "Synthetic",
      scan_status: "clean",
      path: "forged",
      attachment_policy_revision: "forged",
      uploaded_by: 7,
    };
    await expect(
      store.dispatch(api.endpoints.uploadMedicalFile.initiate(upload)).unwrap(),
    ).resolves.toEqual(receipt);
    const request = execute.mock.calls[0][0];
    expect(request.path).toBe("/api/reservations/R%2F1/medical-requests/M%3F1/files");
    expect(request.body).toBeInstanceOf(FormData);
    const body = request.body as FormData;
    expect([...body.keys()]).toEqual(["file", "label"]);
    expect((body.get("file") as File).name).toBe("synthetic.pdf");
    expect(body.get("label")).toBe("Synthetic");
    store.dispatch(api.util.resetApiState());
  });

  it("uses ordinary review/draft/update/publish methods and omits forged publication facts", async () => {
    const execute = vi
      .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockResolvedValue(response({ public_id: "report" }));
    const { api, store } = setup(execute);
    await store.dispatch(api.endpoints.startMedicalReview.initiate(scope)).unwrap();
    await store
      .dispatch(
        api.endpoints.createMedicalReportDraft.initiate({
          ...scope,
          body: "<b>plain text</b>",
          supersedesReportId: "older",
        }),
      )
      .unwrap();
    const update = {
      ...scope,
      reportId: "report/1",
      body: "Updated plain text",
      supersedesReportId: "forged",
      status: "published",
    };
    await store.dispatch(api.endpoints.updateMedicalReportDraft.initiate(update)).unwrap();
    await store.dispatch(api.endpoints.publishMedicalReport.initiate(update)).unwrap();
    expect(
      execute.mock.calls.map(([request]) => ({
        method: request.method,
        path: request.path,
        body: request.body,
      })),
    ).toEqual([
      {
        method: "POST",
        path: "/api/doctor/reservations/R%2F1/medical-requests/M%3F1/review",
        body: undefined,
      },
      {
        method: "POST",
        path: "/api/doctor/reservations/R%2F1/medical-requests/M%3F1/reports",
        body: { body: "<b>plain text</b>", supersedes_report_id: "older" },
      },
      {
        method: "PUT",
        path: "/api/doctor/reservations/R%2F1/medical-requests/M%3F1/reports/report%2F1",
        body: { body: "Updated plain text" },
      },
      {
        method: "POST",
        path: "/api/doctor/reservations/R%2F1/medical-requests/M%3F1/reports/report%2F1/publish",
        body: undefined,
      },
    ]);
    store.dispatch(api.util.resetApiState());
  });

  it("invalidates only the affected reservation after acknowledged upload, with no automatic POST replay", async () => {
    const execute = vi
      .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockImplementation(async (request) => response(request.method === "GET" ? [] : receipt));
    const { api, store } = setup(execute);
    const first = store.dispatch(api.endpoints.patientMedicalRequests.initiate("R1"));
    const other = store.dispatch(api.endpoints.patientMedicalRequests.initiate("R2"));
    await Promise.all([first.unwrap(), other.unwrap()]);
    await store
      .dispatch(
        api.endpoints.uploadMedicalFile.initiate({
          reservationId: "R1",
          requestId: "M1",
          file: new File(["pdf"], "synthetic.pdf"),
        }),
      )
      .unwrap();
    await vi.waitFor(() =>
      expect(
        execute.mock.calls.filter(
          ([request]) => request.path === "/api/reservations/R1/medical-requests",
        ),
      ).toHaveLength(2),
    );
    expect(
      execute.mock.calls.filter(
        ([request]) => request.path === "/api/reservations/R2/medical-requests",
      ),
    ).toHaveLength(1);
    expect(execute.mock.calls.filter(([request]) => request.method === "POST")).toHaveLength(1);
    first.unsubscribe();
    other.unsubscribe();
    store.dispatch(api.util.resetApiState());
  });

  it.each([422, 503])(
    "preserves rejected/ambiguous HTTP%s without refetching unrelated data or replaying the write",
    async (status) => {
      const execute = vi
        .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
        .mockImplementation(async (request) => {
          if (request.method !== "GET") throw new TransportError(classifyWireFailure({ status }));
          return response([]);
        });
      const { api, store } = setup(execute);
      const list = store.dispatch(api.endpoints.doctorMedicalRequests.initiate("R1"));
      await list.unwrap();
      await expect(
        store
          .dispatch(
            api.endpoints.createMedicalRequest.initiate({
              reservationId: "R1",
              draft: { requestType: "document", title: "Synthetic" },
            }),
          )
          .unwrap(),
      ).rejects.toMatchObject({ status });
      expect(execute).toHaveBeenCalledTimes(2);
      list.unsubscribe();
      store.dispatch(api.util.resetApiState());
    },
  );

  it("propagates upload cancellation without a fabricated receipt or retry", async () => {
    let observed: AbortSignal | undefined;
    const execute = vi
      .fn<(request: TransportRequest) => Promise<TransportResponse<unknown>>>()
      .mockImplementation((request) => {
        observed = request.signal;
        return new Promise((_resolve, reject) =>
          request.signal?.addEventListener("abort", () =>
            reject(new TransportError(classifyWireFailure({ cancelled: true }))),
          ),
        );
      });
    const { api, store } = setup(execute);
    const operation = store.dispatch(
      api.endpoints.uploadMedicalFile.initiate({
        ...scope,
        file: new File(["pdf"], "synthetic.pdf"),
      }),
    );
    operation.abort();
    expect(isCancelledQueryError((await operation).error)).toBe(true);
    expect(observed?.aborted).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    store.dispatch(api.util.resetApiState());
  });
});
