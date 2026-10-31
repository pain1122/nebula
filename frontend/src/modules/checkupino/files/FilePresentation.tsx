import type { ChangeEvent } from "react";

import { EmptyState, ErrorState } from "../feedback";
import {
  formatProductNumber,
  formatProductTimestamp,
  type ProductLocale,
} from "../preferences/localization";

export interface SafeFileMetadata {
  readonly available: boolean;
  readonly createdAt: string | null;
  readonly label: string | null;
  readonly mimeType: string;
  readonly publicId: string;
  readonly sizeBytes: number;
}

interface FileCopy {
  readonly available: string;
  readonly choose: string;
  readonly clientHint: string;
  readonly empty: string;
  readonly file: string;
  readonly open: string;
  readonly selected: string;
  readonly size: string;
  readonly sizeWarning: string;
  readonly unavailable: string;
  readonly unknownDate: string;
}

const fileCopy: Readonly<Record<ProductLocale, FileCopy>> = {
  en: {
    available: "Available",
    choose: "Choose a file",
    clientHint: "The browser check is only a hint. The server makes the final acceptance decision.",
    empty: "No file metadata is available.",
    file: "File",
    open: "Open file",
    selected: "Selected file",
    size: "Size",
    sizeWarning: "The selected file is larger than the suggested client limit.",
    unavailable: "Unavailable",
    unknownDate: "Unknown time",
  },
  fa: {
    available: "در دسترس",
    choose: "انتخاب فایل",
    clientHint: "بررسی مرورگر فقط راهنماست و پذیرش نهایی را سرور تعیین می‌کند.",
    empty: "اطلاعات فایلی برای نمایش وجود ندارد.",
    file: "فایل",
    open: "مشاهده فایل",
    selected: "فایل انتخاب‌شده",
    size: "حجم",
    sizeWarning: "حجم فایل انتخاب‌شده از حد پیشنهادی مرورگر بیشتر است.",
    unavailable: "در دسترس نیست",
    unknownDate: "زمان نامشخص",
  },
};

const formatBytes = (bytes: number, locale: ProductLocale) => {
  const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const units = locale === "fa" ? ["بایت", "کیلوبایت", "مگابایت"] : ["B", "KB", "MB"];
  let value = safeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatProductNumber(rounded, locale)} ${units[unitIndex]}`;
};

const safeTimestamp = (value: string | null, locale: ProductLocale, fallback: string) => {
  if (!value) return fallback;
  try {
    return formatProductTimestamp(value, locale);
  } catch {
    return fallback;
  }
};

export interface FileSelectionFieldProps {
  readonly accept?: readonly string[];
  readonly disabled?: boolean;
  readonly id: string;
  readonly label?: string;
  readonly locale?: ProductLocale;
  readonly maxSizeBytesHint?: number;
  readonly name?: string;
  readonly onSelect: (file: File | null) => void;
  readonly selectedFile?: File | null;
}

export const FileSelectionField = ({
  accept = [],
  disabled = false,
  id,
  label,
  locale = "fa",
  maxSizeBytesHint,
  name = "file",
  onSelect,
  selectedFile = null,
}: FileSelectionFieldProps) => {
  const copy = fileCopy[locale];
  const oversized =
    selectedFile !== null && maxSizeBytesHint !== undefined && selectedFile.size > maxSizeBytesHint;
  const onChange = (event: ChangeEvent<HTMLInputElement>) =>
    onSelect(event.currentTarget.files?.[0] ?? null);

  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label ?? copy.choose}
      </label>
      <input
        accept={accept.length > 0 ? accept.join(",") : undefined}
        aria-describedby={`${id}-client-hint`}
        className="form-control"
        disabled={disabled}
        id={id}
        name={name}
        onChange={onChange}
        type="file"
      />
      <p className="form-text mb-1" id={`${id}-client-hint`}>
        {copy.clientHint}
        {maxSizeBytesHint !== undefined ? (
          <>
            {" "}
            {copy.size}: {formatBytes(maxSizeBytesHint, locale)}
          </>
        ) : null}
      </p>
      {selectedFile ? (
        <output className="d-block small" htmlFor={id}>
          <span className="fw-semibold">{copy.selected}: </span>
          <span>{selectedFile.name}</span>
          {" · "}
          <span>{formatBytes(selectedFile.size, locale)}</span>
        </output>
      ) : null}
      {oversized ? (
        <output className="text-warning-emphasis small d-block mb-0">
          {copy.sizeWarning} {copy.clientHint}
        </output>
      ) : null}
    </div>
  );
};

export interface SafeFileListProps {
  readonly error?: unknown;
  readonly files: readonly SafeFileMetadata[];
  readonly locale?: ProductLocale;
  readonly onOpen?: (file: SafeFileMetadata) => void;
  readonly onRetry?: () => void;
}

export const SafeFileList = ({
  error,
  files,
  locale = "fa",
  onOpen,
  onRetry,
}: SafeFileListProps) => {
  const copy = fileCopy[locale];

  if (error) return <ErrorState error={error} locale={locale} onRetry={onRetry} />;
  if (files.length === 0) return <EmptyState description={copy.empty} locale={locale} />;

  return (
    <ul className="list-group" data-safe-file-list="metadata-only">
      {files.map((file) => (
        <li className="list-group-item" key={file.publicId}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="min-w-0">
              <p className="fw-semibold text-break mb-1">{file.label?.trim() || copy.file}</p>
              <p className="small text-muted text-break mb-0">
                {file.mimeType} · {formatBytes(file.sizeBytes, locale)} ·{" "}
                <time dateTime={file.createdAt ?? undefined}>
                  {safeTimestamp(file.createdAt, locale, copy.unknownDate)}
                </time>
              </p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span
                className={`badge bg-${file.available ? "success" : "secondary"}-subtle text-${file.available ? "success" : "secondary"}`}
              >
                {file.available ? copy.available : copy.unavailable}
              </span>
              {file.available && onOpen ? (
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => onOpen(file)}
                  type="button"
                >
                  {copy.open}
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};
