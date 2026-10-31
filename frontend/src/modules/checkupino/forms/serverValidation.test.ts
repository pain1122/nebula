import { describe, expect, it } from "vitest";

import { classifyWireFailure, TransportError } from "../api/wire";
import { firstFieldError, mapServerValidation } from "./serverValidation";

describe("server validation adapter", () => {
  it("maps the API envelope shape without changing dotted backend field names", () => {
    const wire = classifyWireFailure({
      data: {
        code: "validation_failed",
        errors: {
          "answers.0": ["question_set_mismatch"],
          email: ["نشانی ایمیل معتبر نیست."],
          global: ["فرم ارسال نشد."],
          server_owned_field: ["unexpected_state"],
        },
        message: "The request data is invalid.",
        meta: { correlation_id: "request-api" },
      },
      status: 422,
    });

    const result = mapServerValidation(wire, ["email", "answers.0"] as const);

    expect(result).toMatchObject({
      code: "validation_failed",
      correlationId: "request-api",
      fieldErrors: {
        "answers.0": ["question_set_mismatch"],
        email: ["نشانی ایمیل معتبر نیست."],
      },
      globalErrors: ["فرم ارسال نشد."],
      message: "The request data is invalid.",
      unmappedErrors: [{ field: "server_owned_field", messages: ["unexpected_state"] }],
    });
    expect(firstFieldError(result, "answers.0")).toBe("question_set_mismatch");
  });

  it("maps the ordinary JSON web-login 422 shape through TransportError", () => {
    const error = new TransportError(
      classifyWireFailure({
        data: {
          errors: { email: ["These credentials do not match our records."] },
          message: "The given data was invalid.",
        },
        status: 422,
      }),
    );

    expect(mapServerValidation(error, ["email", "password"] as const)).toMatchObject({
      code: null,
      correlationId: null,
      fieldErrors: { email: ["These credentials do not match our records."] },
      globalErrors: [],
      message: "The given data was invalid.",
      unmappedErrors: [],
    });
  });

  it("does not misclassify non-validation failures", () => {
    expect(mapServerValidation(classifyWireFailure({ status: 403 }), ["email"])).toBeNull();
    expect(mapServerValidation(new Error("Client failure"), ["email"])).toBeNull();
  });
});
