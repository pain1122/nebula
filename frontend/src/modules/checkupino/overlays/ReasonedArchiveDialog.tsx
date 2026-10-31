import { useRef, useState, type FormEvent } from "react";

import { ErrorState } from "../feedback";
import { TextareaField } from "../forms";
import type { ProductLocale } from "../preferences/localization";
import { Dialog } from "./Overlay";

export interface ArchiveReasonPayload {
  readonly reason: string;
}

export const archiveReasonPayload = (reason: string): ArchiveReasonPayload => ({ reason });

interface ArchiveCopy {
  readonly action: string;
  readonly cancel: string;
  readonly description: string;
  readonly pending: string;
  readonly reasonError: string;
  readonly reasonHelp: string;
  readonly reasonLabel: string;
  readonly title: string;
}

const archiveCopy: Readonly<Record<ProductLocale, ArchiveCopy>> = {
  en: {
    action: "Archive",
    cancel: "Cancel",
    description: "The record remains in history and will no longer be active.",
    pending: "Archiving…",
    reasonError: "Enter the reason for archiving.",
    reasonHelp: "This reason may be retained in the audit history.",
    reasonLabel: "Archive reason",
    title: "Archive record",
  },
  fa: {
    action: "بایگانی کردن",
    cancel: "انصراف",
    description: "سابقه این رکورد حفظ می‌شود، اما دیگر فعال نخواهد بود.",
    pending: "در حال بایگانی…",
    reasonError: "دلیل بایگانی را وارد کنید.",
    reasonHelp: "این دلیل ممکن است در سابقه ممیزی نگهداری شود.",
    reasonLabel: "دلیل بایگانی",
    title: "بایگانی کردن رکورد",
  },
};

export interface ReasonedArchiveDialogProps {
  readonly locale?: ProductLocale;
  readonly onArchive: (payload: ArchiveReasonPayload) => Promise<void>;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly subject?: string;
}

const OpenReasonedArchiveDialog = ({
  locale = "fa",
  onArchive,
  onClose,
  subject,
}: Omit<ReasonedArchiveDialogProps, "open">) => {
  const copy = archiveCopy[locale];
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setReasonError(copy.reasonError);
      return;
    }

    setReasonError(null);
    setRequestError(null);
    setSubmitting(true);
    try {
      await onArchive(archiveReasonPayload(normalizedReason));
      setSubmitting(false);
      onClose();
    } catch (error: unknown) {
      setRequestError(error);
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      busy={submitting}
      description={subject ? `${copy.description} ${subject}` : copy.description}
      footer={
        <>
          <button className="btn btn-light" disabled={submitting} onClick={onClose} type="button">
            {copy.cancel}
          </button>
          <button
            className="btn btn-warning"
            disabled={submitting}
            form="reasoned-archive-form"
            type="submit"
          >
            {submitting ? copy.pending : copy.action}
          </button>
        </>
      }
      initialFocusRef={reasonRef}
      locale={locale}
      onClose={onClose}
      open
      title={copy.title}
    >
      <form id="reasoned-archive-form" noValidate onSubmit={submit}>
        <TextareaField
          disabled={submitting}
          errorMessages={reasonError ? [reasonError] : []}
          helpText={copy.reasonHelp}
          id="archive-reason"
          label={copy.reasonLabel}
          name="reason"
          onChange={(event) => setReason(event.currentTarget.value)}
          ref={reasonRef}
          required
          rows={4}
          value={reason}
        />
        {requestError ? <ErrorState error={requestError} locale={locale} /> : null}
      </form>
    </Dialog>
  );
};

export const ReasonedArchiveDialog = ({ open, ...props }: ReasonedArchiveDialogProps) =>
  open ? <OpenReasonedArchiveDialog {...props} /> : null;
