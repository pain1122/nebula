import { TransportError, type FieldErrors, type WireError } from "../api/wire";

export interface UnmappedValidationError {
  readonly field: string;
  readonly messages: readonly string[];
}

export interface ServerValidationResult<FieldName extends string> {
  readonly code: string | null;
  readonly correlationId: string | null;
  readonly fieldErrors: Readonly<Partial<Record<FieldName, readonly string[]>>>;
  readonly globalErrors: readonly string[];
  readonly message: string | null;
  readonly source: WireError;
  readonly unmappedErrors: readonly UnmappedValidationError[];
}

const globalErrorFields = new Set(["_error", "base", "form", "global"]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWireError = (value: unknown): value is WireError =>
  isRecord(value) &&
  value.kind === "validation" &&
  isRecord(value.errors) &&
  "correlationId" in value;

const validationWire = (error: unknown): WireError | null => {
  if (error instanceof TransportError) {
    return error.wire.kind === "validation" ? error.wire : null;
  }
  return isWireError(error) ? error : null;
};

const copyMessages = (errors: FieldErrors, field: string) => [...(errors[field] ?? [])];

export const mapServerValidation = <const FieldName extends string>(
  error: unknown,
  knownFields: readonly FieldName[],
): ServerValidationResult<FieldName> | null => {
  const wire = validationWire(error);
  if (!wire) return null;

  const known = new Set<string>(knownFields);
  const fieldErrors: Partial<Record<FieldName, readonly string[]>> = {};
  const globalErrors: string[] = [];
  const unmappedErrors: UnmappedValidationError[] = [];

  for (const field of Object.keys(wire.errors)) {
    const messages = copyMessages(wire.errors, field);
    if (messages.length === 0) continue;

    if (known.has(field)) {
      fieldErrors[field as FieldName] = messages;
    } else if (globalErrorFields.has(field)) {
      globalErrors.push(...messages);
    } else {
      unmappedErrors.push({ field, messages });
    }
  }

  return Object.freeze({
    code: wire.code,
    correlationId: wire.correlationId,
    fieldErrors: Object.freeze(fieldErrors),
    globalErrors: Object.freeze(globalErrors),
    message: wire.message,
    source: wire,
    unmappedErrors: Object.freeze(unmappedErrors),
  });
};

export const firstFieldError = <FieldName extends string>(
  validation: ServerValidationResult<FieldName> | null,
  field: FieldName,
) => validation?.fieldErrors[field]?.[0] ?? null;
