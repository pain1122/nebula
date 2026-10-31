import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldError,
  type FieldPath,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
  type UseFormSetError,
} from "react-hook-form";
import { z } from "zod";

import type { ServerValidationResult } from "./serverValidation";

export { z };

export const useSchemaForm = <Input extends FieldValues, Output extends FieldValues>(
  schema: z.ZodType<Output, Input>,
  options?: Omit<UseFormProps<Input, unknown, Output>, "resolver">,
): UseFormReturn<Input, unknown, Output> =>
  useForm<Input, unknown, Output>({
    ...options,
    resolver: zodResolver(schema),
  });

export const fieldErrorMessages = (error: FieldError | undefined): readonly string[] =>
  typeof error?.message === "string" && error.message ? [error.message] : [];

export const applyServerValidationToForm = <
  Values extends FieldValues,
  const Names extends readonly FieldPath<Values>[],
>(
  validation: ServerValidationResult<Names[number]>,
  knownFields: Names,
  setError: UseFormSetError<Values>,
) => {
  let shouldFocus = true;

  for (const field of knownFields) {
    const message = validation.fieldErrors[field]?.[0];
    if (!message) continue;

    setError(field, { message, type: "server" }, { shouldFocus });
    shouldFocus = false;
  }

  return validation;
};
