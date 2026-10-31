import {
  forwardRef,
  type ChangeEventHandler,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { normalizeNumericInput, type ProductLocale } from "../preferences/localization";

interface FieldPresentationProps {
  readonly errorMessages?: readonly string[];
  readonly helpText?: ReactNode;
  readonly id: string;
  readonly label: ReactNode;
  readonly locale?: ProductLocale;
  readonly required?: boolean;
}

interface FieldFrameProps extends FieldPresentationProps {
  readonly children: (accessibility: {
    readonly "aria-describedby": string | undefined;
    readonly "aria-invalid": true | undefined;
  }) => ReactNode;
  readonly describedBy?: string;
}

const requiredCopy: Readonly<Record<ProductLocale, string>> = {
  en: "required",
  fa: "الزامی",
};

const FieldFrame = ({
  children,
  describedBy,
  errorMessages = [],
  helpText,
  id,
  label,
  locale = "fa",
  required = false,
}: FieldFrameProps) => {
  const helpId = helpText ? `${id}-help` : null;
  const errorId = errorMessages.length > 0 ? `${id}-error` : null;
  const descriptionIds = [describedBy, helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="mb-3" data-form-field={id}>
      <label className="form-label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-danger">
              {" "}
              *
            </span>
            <span className="visually-hidden"> ({requiredCopy[locale]})</span>
          </>
        ) : null}
      </label>

      {children({
        "aria-describedby": descriptionIds,
        "aria-invalid": errorMessages.length > 0 ? true : undefined,
      })}

      {helpText ? (
        <div className="form-text" id={helpId ?? undefined}>
          {helpText}
        </div>
      ) : null}

      {errorMessages.length > 0 ? (
        <div aria-live="polite" className="invalid-feedback d-block" id={errorId ?? undefined}>
          {errorMessages.map((message, index) => (
            <div key={`${id}-error-${index}`}>{message}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

type NativeTextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "aria-invalid" | "id" | "required" | "type"
>;

export interface TextFieldProps extends NativeTextInputProps, FieldPresentationProps {
  readonly normalizeDigits?: boolean;
  readonly type?: "email" | "password" | "search" | "tel" | "text" | "url";
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      "aria-describedby": describedBy,
      className = "",
      errorMessages,
      helpText,
      id,
      label,
      locale = "fa",
      normalizeDigits = false,
      onChange,
      required = false,
      type = "text",
      ...inputProps
    },
    ref,
  ) => {
    const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
      if (normalizeDigits)
        event.currentTarget.value = normalizeNumericInput(event.currentTarget.value);
      onChange?.(event);
    };

    return (
      <FieldFrame
        describedBy={describedBy}
        errorMessages={errorMessages}
        helpText={helpText}
        id={id}
        label={label}
        locale={locale}
        required={required}
      >
        {(accessibility) => (
          <input
            {...inputProps}
            {...accessibility}
            className={`form-control${errorMessages?.length ? " is-invalid" : ""} ${className}`.trim()}
            id={id}
            inputMode={normalizeDigits ? "numeric" : inputProps.inputMode}
            onChange={handleChange}
            ref={ref}
            required={required}
            type={type}
          />
        )}
      </FieldFrame>
    );
  },
);
TextField.displayName = "TextField";

type NativeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "aria-invalid" | "id" | "required"
>;

export interface TextareaFieldProps extends NativeTextareaProps, FieldPresentationProps {}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  (
    {
      "aria-describedby": describedBy,
      className = "",
      errorMessages,
      helpText,
      id,
      label,
      locale = "fa",
      required = false,
      ...textareaProps
    },
    ref,
  ) => (
    <FieldFrame
      describedBy={describedBy}
      errorMessages={errorMessages}
      helpText={helpText}
      id={id}
      label={label}
      locale={locale}
      required={required}
    >
      {(accessibility) => (
        <textarea
          {...textareaProps}
          {...accessibility}
          className={`form-control${errorMessages?.length ? " is-invalid" : ""} ${className}`.trim()}
          id={id}
          ref={ref}
          required={required}
        />
      )}
    </FieldFrame>
  ),
);
TextareaField.displayName = "TextareaField";

export interface SelectOption {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

type NativeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "aria-invalid" | "children" | "id" | "required"
>;

export interface SelectFieldProps extends NativeSelectProps, FieldPresentationProps {
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
}

const selectPlaceholder: Readonly<Record<ProductLocale, string>> = {
  en: "Select an option",
  fa: "انتخاب کنید",
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      "aria-describedby": describedBy,
      className = "",
      errorMessages,
      helpText,
      id,
      label,
      locale = "fa",
      options,
      placeholder,
      required = false,
      ...selectProps
    },
    ref,
  ) => (
    <FieldFrame
      describedBy={describedBy}
      errorMessages={errorMessages}
      helpText={helpText}
      id={id}
      label={label}
      locale={locale}
      required={required}
    >
      {(accessibility) => (
        <select
          {...selectProps}
          {...accessibility}
          className={`form-select${errorMessages?.length ? " is-invalid" : ""} ${className}`.trim()}
          id={id}
          ref={ref}
          required={required}
        >
          <option value="">{placeholder ?? selectPlaceholder[locale]}</option>
          {options.map((option) => (
            <option disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldFrame>
  ),
);
SelectField.displayName = "SelectField";

type NativeDateProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "aria-invalid" | "id" | "required" | "type"
>;

export interface DateFieldProps extends NativeDateProps, FieldPresentationProps {}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  (
    {
      "aria-describedby": describedBy,
      className = "",
      errorMessages,
      helpText,
      id,
      label,
      locale = "fa",
      required = false,
      ...inputProps
    },
    ref,
  ) => (
    <FieldFrame
      describedBy={describedBy}
      errorMessages={errorMessages}
      helpText={helpText}
      id={id}
      label={label}
      locale={locale}
      required={required}
    >
      {(accessibility) => (
        <input
          {...inputProps}
          {...accessibility}
          className={`form-control${errorMessages?.length ? " is-invalid" : ""} ${className}`.trim()}
          id={id}
          ref={ref}
          required={required}
          type="date"
        />
      )}
    </FieldFrame>
  ),
);
DateField.displayName = "DateField";

type NativeFileProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "aria-invalid" | "id" | "required" | "type" | "value"
>;

export interface FileFieldProps extends NativeFileProps, FieldPresentationProps {}

export const FileField = forwardRef<HTMLInputElement, FileFieldProps>(
  (
    {
      "aria-describedby": describedBy,
      className = "",
      errorMessages,
      helpText,
      id,
      label,
      locale = "fa",
      required = false,
      ...inputProps
    },
    ref,
  ) => (
    <FieldFrame
      describedBy={describedBy}
      errorMessages={errorMessages}
      helpText={helpText}
      id={id}
      label={label}
      locale={locale}
      required={required}
    >
      {(accessibility) => (
        <input
          {...inputProps}
          {...accessibility}
          className={`form-control${errorMessages?.length ? " is-invalid" : ""} ${className}`.trim()}
          id={id}
          ref={ref}
          required={required}
          type="file"
        />
      )}
    </FieldFrame>
  ),
);
FileField.displayName = "FileField";
