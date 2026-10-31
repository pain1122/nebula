import { describe, expect, it, vi } from "vitest";

import type { HttpExecutionRequest, HttpExecutionResponse, HttpExecutor } from "./transport";
import {
  checkupinoTransport,
  createTransport,
  medicalFileDownloadUrl,
  serializeQuery,
} from "./transport";
import { TransportError, classifyWireFailure } from "./wire";

class RecordingExecutor implements HttpExecutor {
  lastRequest: HttpExecutionRequest | null = null;

  constructor(
    private readonly response: HttpExecutionResponse = {
      data: { ok: true },
      headers: { "x-correlation-id": "correlation-1" },
      status: 200,
    },
  ) {}

  async execute(request: HttpExecutionRequest) {
    this.lastRequest = request;
    return this.response;
  }
}

describe("Checkupino transport", () => {
  it.each([true, false])(
    "keeps medical download role %s on the configured origin and encodes each public identifier",
    (doctor) => {
      expect(
        medicalFileDownloadUrl({
          reservationId: "R/1",
          requestId: "M?1",
          fileId: "https://example.test/#file",
          doctor,
        }),
      ).toBe(
        `http://127.0.0.1:8080/api/${doctor ? "doctor/" : ""}reservations/R%2F1/medical-requests/M%3F1/files/https%3A%2F%2Fexample.test%2F%23file/download`,
      );
    },
  );
  it.each(["", ".", ".."])(
    "refuses unsafe public identifier %s before producing a download URL",
    (fileId) => {
      expect(() =>
        medicalFileDownloadUrl({ reservationId: "R1", requestId: "M1", fileId }),
      ).toThrow(TypeError);
    },
  );
  it("keeps GETs credentialed without preflight headers and preserves CSRF on every write", async () => {
    const requests: RecordingXhr[] = [];
    class RecordingXhr {
      headers: Record<string, string> = {};
      onloadend: (() => void) | null = null;
      responseText = '{"ok":true}';
      status = 200;
      statusText = "OK";
      withCredentials = false;

      open() {
        requests.push(this);
      }

      setRequestHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      }

      getAllResponseHeaders() {
        return "Content-Type: application/json\r\n";
      }

      send() {
        this.onloadend?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", RecordingXhr);
    document.cookie = "XSRF-TOKEN=transport-fixture; path=/";
    try {
      await checkupinoTransport.request({ method: "GET", path: "/api/items" });
      expect(requests[0].withCredentials).toBe(true);
      expect(requests[0].headers.accept).toBe("application/json");
      expect(requests[0].headers).not.toHaveProperty("x-requested-with");
      expect(requests[0].headers).not.toHaveProperty("x-xsrf-token");

      for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
        await checkupinoTransport.request({ method, path: "/api/items" });
        const request = requests.at(-1)!;
        expect(request.withCredentials).toBe(true);
        expect(request.headers["x-requested-with"]).toBe("XMLHttpRequest");
        expect(request.headers["x-xsrf-token"]).toBe("transport-fixture");
      }
      await checkupinoTransport.request({
        method: "POST",
        path: "/api/reservations",
        idempotencyKey: "booking-retry-key",
      });
      expect(requests.at(-1)!.headers["idempotency-key"]).toBe("booking-retry-key");
      expect(requests.at(-1)!.headers["x-xsrf-token"]).toBe("transport-fixture");
    } finally {
      document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
      vi.unstubAllGlobals();
    }
  });

  it("serializes supported query values deterministically and safely", () => {
    expect(
      serializeQuery({
        active: true,
        empty: null,
        omitted: undefined,
        page: 2,
        search: "نام و نام خانوادگی",
      }),
    ).toBe(
      "active=true&empty=&page=2&search=%D9%86%D8%A7%D9%85+%D9%88+%D9%86%D8%A7%D9%85+%D8%AE%D8%A7%D9%86%D9%88%D8%A7%D8%AF%DA%AF%DB%8C",
    );
  });

  it("passes normalized paths, query, body, and AbortSignal to one executor", async () => {
    const executor = new RecordingExecutor();
    const transport = createTransport(executor);
    const controller = new AbortController();

    const response = await transport.request<{ ok: boolean }>({
      body: { name: "fixture" },
      method: "POST",
      path: "api/items",
      query: { page: 1 },
      signal: controller.signal,
    });

    expect(executor.lastRequest).toEqual({
      body: { name: "fixture" },
      method: "POST",
      path: "/api/items",
      query: "page=1",
      signal: controller.signal,
    });
    expect(response.data).toEqual({ ok: true });
  });

  it("does not parse a 204 response body", async () => {
    const transport = createTransport(
      new RecordingExecutor({ data: "unexpected-body", headers: {}, status: 204 }),
    );

    const response = await transport.request<void>({ method: "DELETE", path: "/api/items/1" });

    expect(response.status).toBe(204);
    expect(response.data).toBeUndefined();
  });

  it("rejects absolute request URLs", async () => {
    const transport = createTransport(new RecordingExecutor());

    await expect(
      transport.request({ method: "GET", path: "https://unreviewed.example/api" }),
    ).rejects.toThrowError(/must be relative/);
  });
});

describe("wire error classification", () => {
  it.each([
    [401, undefined, "unauthenticated"],
    [403, undefined, "forbidden"],
    [403, "account_inactive", "account-inactive"],
    [404, undefined, "not-found"],
    [419, undefined, "csrf"],
    [422, undefined, "validation"],
    [423, undefined, "recent-password"],
    [429, undefined, "throttled"],
    [500, undefined, "server"],
  ] as const)("classifies HTTP %s with code %s", (status, code, kind) => {
    expect(classifyWireFailure({ data: { code }, status }).kind).toBe(kind);
  });

  it("preserves fields, metadata, retry timing, and best-effort correlation", () => {
    const wire = classifyWireFailure({
      data: {
        code: "validation_failed",
        errors: { email: ["Invalid email."], global: "Try again." },
        message: "Validation failed.",
        meta: { correlation_id: "body-correlation", source: "api" },
      },
      headers: { "retry-after": "30", "x-correlation-id": "header-correlation" },
      status: 422,
    });

    expect(wire).toMatchObject({
      code: "validation_failed",
      correlationId: "header-correlation",
      errors: { email: ["Invalid email."], global: ["Try again."] },
      kind: "validation",
      message: "Validation failed.",
      retryAfter: "30",
      status: 422,
    });
    expect(wire.meta).toEqual({ correlation_id: "body-correlation", source: "api" });
  });

  it("distinguishes cancellation from transport failure", () => {
    expect(classifyWireFailure({ cancelled: true }).kind).toBe("cancelled");
    expect(classifyWireFailure({ message: "Network Error" }).kind).toBe("network");
  });

  it("exposes a stable Error wrapper", () => {
    const error = new TransportError(classifyWireFailure({ status: 403 }));

    expect(error.name).toBe("TransportError");
    expect(error.wire.kind).toBe("forbidden");
  });
});
