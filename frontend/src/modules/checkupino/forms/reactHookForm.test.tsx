import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { classifyWireFailure } from "../api/wire";
import { normalizeNumericInput } from "../preferences/localization";
import { TextField } from "./Fields";
import { applyServerValidationToForm, fieldErrorMessages, useSchemaForm } from "./reactHookForm";
import { mapServerValidation, type ServerValidationResult } from "./serverValidation";

const schema = z.object({
  email: z.string().email("نشانی ایمیل معتبر نیست."),
  mobile: z
    .string()
    .min(1, "شماره همراه الزامی است.")
    .transform((value) => normalizeNumericInput(value)),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type FormFields = keyof FormInput;

const TestForm = ({ onSubmit }: { readonly onSubmit: (values: FormOutput) => void }) => {
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useSchemaForm(schema, {
    defaultValues: { email: "", mobile: "" },
  });
  const [serverValidation, setServerValidation] =
    useState<ServerValidationResult<FormFields> | null>(null);

  const applyServerFixture = () => {
    const mapped = mapServerValidation(
      classifyWireFailure({
        data: {
          errors: {
            email: ["این ایمیل از طرف سرور پذیرفته نشد."],
            global: ["فرم ارسال نشد."],
            server_owned_field: ["unexpected_state"],
          },
          message: "The given data was invalid.",
        },
        status: 422,
      }),
      ["email", "mobile"] as const,
    );
    if (!mapped) return;

    setServerValidation(applyServerValidationToForm(mapped, ["email", "mobile"], setError));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField
        errorMessages={fieldErrorMessages(errors.email)}
        id="email"
        label="ایمیل"
        type="email"
        {...register("email")}
      />
      <TextField
        errorMessages={fieldErrorMessages(errors.mobile)}
        id="mobile"
        label="شماره همراه"
        normalizeDigits
        {...register("mobile")}
      />
      <button type="submit">ثبت</button>
      <button onClick={applyServerFixture} type="button">
        خطای سرور
      </button>
      {serverValidation?.globalErrors.map((message) => (
        <p key={message}>{message}</p>
      ))}
      {serverValidation?.unmappedErrors.map((entry) => (
        <p key={entry.field}>{`${entry.field}: ${entry.messages.join(", ")}`}</p>
      ))}
    </form>
  );
};

describe("React Hook Form and Zod boundary", () => {
  it("renders Farsi Zod messages and submits typed normalized output", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(values: FormOutput) => void>();
    render(<TestForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "ثبت" }));
    expect(await screen.findByText("نشانی ایمیل معتبر نیست.")).toBeVisible();
    expect(await screen.findByText("شماره همراه الزامی است.")).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: "ایمیل" }), "admin@example.test");
    await user.type(screen.getByRole("textbox", { name: "شماره همراه" }), "۱۲٣");
    await user.click(screen.getByRole("button", { name: "ثبت" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { email: "admin@example.test", mobile: "123" },
      expect.anything(),
    );
  });

  it("applies known server fields while retaining global and unmatched errors", async () => {
    const user = userEvent.setup();
    render(<TestForm onSubmit={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "خطای سرور" }));

    expect(await screen.findByText("این ایمیل از طرف سرور پذیرفته نشد.")).toBeVisible();
    expect(screen.getByText("فرم ارسال نشد.")).toBeVisible();
    expect(screen.getByText("server_owned_field: unexpected_state")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "ایمیل" })).toHaveFocus();
  });
});
