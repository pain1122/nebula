import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Label, Modal, ModalBody, ModalHeader } from "reactstrap";

import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import type { MedicalRequest } from "../../modules/checkupino/medical/types";
import { useUploadMedicalFileMutation } from "../../modules/checkupino/medical/writes";
import {
  formatProductNumber,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

interface PatientUploadModalProps {
  readonly reservationId: string;
  readonly medicalRequest: MedicalRequest;
  readonly blocked: boolean;
  readonly onClose: () => void;
  readonly onReceived: (requestId: string) => void;
  readonly onUncertain: (requestId: string) => void;
  readonly checkRequests: () => Promise<readonly MedicalRequest[]>;
}

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const fileLimit = (request: MedicalRequest, mime: string): number | null => {
  const rules = request.attachment_rules;
  if (request.status !== "open" || rules.state !== "available") return null;
  const bytes = rules.max_bytes_by_mime[mime];
  return rules.allowed_mime_types.includes(mime) && Number.isSafeInteger(bytes) && bytes > 0
    ? bytes
    : null;
};

export const PatientUploadModal = ({
  reservationId,
  medicalRequest,
  blocked,
  onClose,
  onReceived,
  onUncertain,
  checkRequests,
}: PatientUploadModalProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [current, setCurrent] = useState(medicalRequest);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [changed, setChanged] = useState(false);
  const [uploadFile, mutation] = useUploadMedicalFileMutation();
  const mounted = useRef(false);
  const submitting = useRef(false);
  const delivery = useRef<ReturnType<typeof uploadFile> | null>(null);
  const busy = checking || mutation.isLoading;
  const limit = fileLimit(
    current,
    file?.type ??
      (current.attachment_rules.state === "available"
        ? (current.attachment_rules.allowed_mime_types[0] ?? "")
        : ""),
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Browser cancellation cannot undo a committed upload. Never replay it.
      delivery.current?.abort();
    };
  }, []);

  const matchesFile = (maximum: number | null) =>
    file !== null &&
    maximum !== null &&
    ["application/pdf", "image/jpeg", "image/png"].includes(file.type) &&
    file.size > 0 &&
    file.size <= maximum &&
    label.length <= 255;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || busy || submitting.current) return;
    if (!file || !matchesFile(limit) || !sameId(current.reservation_public_id, reservationId)) {
      setInvalid(true);
      return;
    }
    submitting.current = true;
    setChecking(true);
    setError(null);
    setInvalid(false);
    setChanged(false);
    let sent = false;
    try {
      const requests = await checkRequests();
      if (!mounted.current) return;
      const fresh = requests.find((item) => sameId(item.public_id, medicalRequest.public_id));
      if (!fresh || requests.some((item) => !sameId(item.reservation_public_id, reservationId))) {
        setInvalid(true);
        return;
      }
      setCurrent(fresh);
      if (
        fresh.attachment_rules.state !== "available" ||
        current.attachment_rules.state !== "available" ||
        fresh.attachment_rules.revision !== current.attachment_rules.revision ||
        fresh.attachment_rules.issued_revision !== current.attachment_rules.issued_revision ||
        !matchesFile(fileLimit(fresh, file.type))
      ) {
        setChanged(true);
        return;
      }
      sent = true;
      delivery.current = uploadFile({
        reservationId,
        requestId: medicalRequest.public_id,
        file,
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      const receipt = await delivery.current.unwrap();
      if (!mounted.current) return;
      if (
        !receipt.public_id ||
        receipt.mime_type !== file.type ||
        receipt.size_bytes !== file.size ||
        receipt.available !== false
      ) {
        onUncertain(medicalRequest.public_id);
        setInvalid(true);
        return;
      }
      onReceived(medicalRequest.public_id);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure);
      if (
        sent &&
        !(
          typeof failure === "object" &&
          failure !== null &&
          "kind" in failure &&
          failure.kind === "validation"
        )
      ) {
        onUncertain(medicalRequest.public_id);
      }
    } finally {
      delivery.current = null;
      submitting.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <Modal isOpen centered backdrop="static" keyboard={!busy} toggle={busy ? undefined : onClose}>
      <ModalHeader toggle={busy ? undefined : onClose} closeAriaLabel={t("medical.close")}>
        {t("medical.uploadFile")}
      </ModalHeader>
      <ModalBody>
        <form onSubmit={(event) => void submit(event)}>
          <p>{current.title}</p>
          {limit !== null ? (
            <p>{t("medical.uploadPdfLimit", { bytes: formatProductNumber(limit, locale) })}</p>
          ) : (
            <p className="alert alert-warning">{t("medical.policyUnavailable")}</p>
          )}
          {Boolean(error) && <ErrorState error={error} locale={locale} />}
          {invalid && (
            <p className="alert alert-danger" role="alert">
              {t("medical.invalidUpload")}
            </p>
          )}
          {changed && (
            <p className="alert alert-warning" role="alert">
              {t("medical.uploadPolicyChanged")}
            </p>
          )}
          {blocked && (
            <p className="alert alert-warning" role="alert">
              {t("medical.uploadUncertain")}
            </p>
          )}
          <div className="mb-3">
            <Label htmlFor="medical-upload-file">{t("medical.chooseFile")}</Label>
            <Input
              id="medical-upload-file"
              type="file"
              accept={
                current.attachment_rules.state === "available"
                  ? current.attachment_rules.allowed_mime_types.join(",")
                  : ""
              }
              required
              disabled={busy || blocked || limit === null}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="mb-3">
            <Label htmlFor="medical-upload-label">{t("medical.fileLabel")}</Label>
            <Input
              id="medical-upload-label"
              value={label}
              maxLength={255}
              disabled={busy || blocked}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <p className="form-text">{t("medical.uploadCheckingNote")}</p>
          {busy && (
            <LoadingState
              locale={locale}
              label={t(mutation.isLoading ? "medical.uploading" : "medical.checkingAccess")}
            />
          )}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button color="light" type="button" disabled={busy} onClick={onClose}>
              {t("medical.close")}
            </Button>
            <Button color="success" type="submit" disabled={busy || blocked || limit === null}>
              {t("medical.sendFile")}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};
