import { describe, expect, it } from "vitest";

import { classifyWireFailure, TransportError, type WireErrorKind } from "../api/wire";
import { errorFeedbackModel } from "./model";

const cases: ReadonlyArray<readonly [WireErrorKind, number | undefined, string | undefined]> = [
  ["account-inactive", 403, "account_inactive"],
  ["csrf", 419, undefined],
  ["forbidden", 403, undefined],
  ["http", 418, undefined],
  ["network", undefined, undefined],
  ["not-found", 404, undefined],
  ["recent-password", 423, undefined],
  ["server", 500, undefined],
  ["throttled", 429, undefined],
  ["unauthenticated", 401, undefined],
  ["validation", 422, undefined],
];

describe("errorFeedbackModel", () => {
  it.each(cases)("presents %s failures in both product locales", (kind, status, code) => {
    const wire = classifyWireFailure({ data: { code }, status });

    const farsi = errorFeedbackModel(wire, "fa");
    const english = errorFeedbackModel(new TransportError(wire), "en");

    expect(wire.kind).toBe(kind);
    expect(farsi).toMatchObject({ kind, source: wire });
    expect(english).toMatchObject({ kind, source: wire });
    expect(farsi?.title).not.toBe(english?.title);
  });

  it("keeps support-relevant server detail without discarding field errors", () => {
    const wire = classifyWireFailure({
      data: {
        code: "validation_failed",
        errors: { email: ["Email is invalid."], global: "Please retry." },
        message: "The submitted payload was rejected.",
        meta: { correlation_id: "body-id", source: "api" },
      },
      headers: { "retry-after": "30", "x-correlation-id": "request-id" },
      status: 422,
    });

    expect(errorFeedbackModel(wire)).toMatchObject({
      code: "validation_failed",
      correlationId: "request-id",
      details: [
        { field: "email", message: "Email is invalid." },
        { field: "global", message: "Please retry." },
      ],
      message: "The submitted payload was rejected.",
      retryAfter: "30",
      source: wire,
      status: 422,
    });
  });

  it("keeps unknown errors visible and treats cancellation as quiet", () => {
    expect(errorFeedbackModel(new Error("Unexpected client failure."), "en")).toMatchObject({
      kind: "unknown",
      message: "Unexpected client failure.",
      title: "Operation failed",
    });
    expect(errorFeedbackModel(classifyWireFailure({ cancelled: true }))).toBeNull();
  });
});
