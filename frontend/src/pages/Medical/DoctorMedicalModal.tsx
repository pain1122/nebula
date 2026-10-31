import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Label, Modal, ModalBody, ModalHeader } from "reactstrap";

import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import type { DoctorMedicalDetail, MedicalReport } from "../../modules/checkupino/medical/types";
import {
  useCreateMedicalReportDraftMutation,
  usePublishMedicalReportMutation,
  useStartMedicalReviewMutation,
  useUpdateMedicalReportDraftMutation,
} from "../../modules/checkupino/medical/writes";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

export interface DoctorMedicalTarget {
  readonly kind: "review" | "draft" | "edit" | "publish" | "amend";
  readonly detail: DoctorMedicalDetail;
  readonly report?: MedicalReport;
}
interface DoctorMedicalModalProps {
  readonly reservationId: string;
  readonly target: DoctorMedicalTarget;
  readonly blocked: boolean;
  readonly checkDetail: () => Promise<DoctorMedicalDetail>;
  readonly onClose: () => void;
  readonly onUncertain: (requestId: string) => void;
  readonly onSaved: (requestId: string) => void;
}
const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const actionKey = {
  review: "medical.startReview",
  draft: "medical.newDraft",
  edit: "medical.editDraft",
  publish: "medical.publishReport",
  amend: "medical.amendReport",
} as const;

export const DoctorMedicalModal = ({
  reservationId,
  target,
  blocked,
  checkDetail,
  onClose,
  onUncertain,
  onSaved,
}: DoctorMedicalModalProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const requestId = target.detail.medical_request.public_id;
  const editing = ["draft", "edit", "amend"].includes(target.kind);
  const [body, setBody] = useState(target.report?.body ?? "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [startReview, reviewState] = useStartMedicalReviewMutation();
  const [createDraft, createState] = useCreateMedicalReportDraftMutation();
  const [updateDraft, updateState] = useUpdateMedicalReportDraftMutation();
  const [publish, publishState] = usePublishMedicalReportMutation();
  const mounted = useRef(false);
  const submitting = useRef(false);
  const delivery = useRef<{ abort: () => void } | null>(null);
  const saving =
    reviewState.isLoading ||
    createState.isLoading ||
    updateState.isLoading ||
    publishState.isLoading;
  const busy = checking || saving;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      delivery.current?.abort();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || busy || submitting.current) return;
    if (editing && (!body.trim() || body.trim().length > 20000)) {
      setInvalid(true);
      return;
    }
    submitting.current = true;
    setChecking(true);
    setError(null);
    setInvalid(false);
    let sent = false;
    try {
      const fresh = await checkDetail();
      if (!mounted.current) return;
      const matches =
        sameId(fresh.medical_request.public_id, requestId) &&
        sameId(fresh.medical_request.reservation_public_id, reservationId) &&
        fresh.reports.every(
          (report) =>
            sameId(report.medical_request_public_id, requestId) &&
            report.body_format === "plain_text",
        );
      const stored = fresh.reports.find((report) => report.public_id === target.report?.public_id);
      const unchangedReport =
        stored &&
        target.report &&
        stored.body === target.report.body &&
        stored.status === target.report.status &&
        stored.supersedes_report_public_id === target.report.supersedes_report_public_id;
      const allowed =
        matches &&
        (target.kind === "review"
          ? fresh.medical_request.status === "open" && fresh.files.some((file) => file.available)
          : target.kind === "draft"
            ? fresh.medical_request.status === "in_review" &&
              !fresh.reports.some((report) => report.supersedes_report_public_id === null)
            : target.kind === "amend"
              ? unchangedReport &&
                stored.status === "published" &&
                fresh.medical_request.status === "completed" &&
                !fresh.reports.some(
                  (report) => report.supersedes_report_public_id === stored.public_id,
                )
              : unchangedReport &&
                stored.status === "draft" &&
                ["in_review", "completed"].includes(fresh.medical_request.status));
      if (!allowed) {
        setInvalid(true);
        return;
      }
      const scope = { reservationId, requestId };
      const operation =
        target.kind === "review"
          ? startReview(scope)
          : target.kind === "publish" && stored
            ? publish({ ...scope, reportId: stored.public_id })
            : target.kind === "edit" && stored
              ? updateDraft({ ...scope, reportId: stored.public_id, body: body.trim() })
              : createDraft({
                  ...scope,
                  body: body.trim(),
                  ...(target.kind === "amend" && stored
                    ? { supersedesReportId: stored.public_id }
                    : {}),
                });
      sent = true;
      delivery.current = operation;
      const receipt = await operation.unwrap();
      if (!mounted.current) return;
      const acknowledged =
        target.kind === "review"
          ? "medical_request" in receipt &&
            sameId(receipt.medical_request.public_id, requestId) &&
            sameId(receipt.medical_request.reservation_public_id, reservationId) &&
            receipt.medical_request.status === "in_review"
          : "public_id" in receipt &&
            receipt.public_id &&
            sameId(receipt.medical_request_public_id, requestId) &&
            receipt.body_format === "plain_text" &&
            receipt.status === (target.kind === "publish" ? "published" : "draft") &&
            receipt.body === (target.kind === "publish" ? target.report?.body : body.trim()) &&
            (!["edit", "publish"].includes(target.kind) ||
              receipt.public_id === stored?.public_id) &&
            receipt.supersedes_report_public_id ===
              (target.kind === "amend"
                ? stored?.public_id
                : target.kind === "draft"
                  ? null
                  : stored?.supersedes_report_public_id) &&
            (target.kind !== "publish" || Boolean(receipt.published_at));
      if (!acknowledged) {
        onUncertain(requestId);
        setInvalid(true);
        return;
      }
      onSaved(requestId);
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
      )
        onUncertain(requestId);
    } finally {
      delivery.current = null;
      submitting.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <Modal isOpen centered backdrop="static" keyboard={!busy} toggle={busy ? undefined : onClose}>
      <ModalHeader toggle={busy ? undefined : onClose} closeAriaLabel={t("medical.close")}>
        {t(actionKey[target.kind])}
      </ModalHeader>
      <ModalBody>
        <form onSubmit={(event) => void submit(event)}>
          <p>{target.detail.medical_request.title}</p>
          {Boolean(error) && <ErrorState error={error} locale={locale} />}
          {invalid && (
            <p className="alert alert-warning" role="alert">
              {t("medical.actionChanged")}
            </p>
          )}
          {blocked && (
            <p className="alert alert-warning" role="alert">
              {t("medical.actionUncertain")}
            </p>
          )}
          {target.kind === "review" && <p>{t("medical.reviewConfirm")}</p>}
          {target.kind === "publish" && (
            <>
              <p className="alert alert-warning">{t("medical.publishConfirm")}</p>
              <pre className="text-break">{target.report?.body}</pre>
            </>
          )}
          {editing && (
            <div className="mb-3">
              <Label htmlFor="medical-report-body">{t("medical.reportBody")}</Label>
              <Input
                id="medical-report-body"
                type="textarea"
                rows={8}
                required
                maxLength={20000}
                value={body}
                disabled={busy || blocked}
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="form-text">{t("medical.plainTextReport")}</p>
            </div>
          )}
          {busy && (
            <LoadingState
              locale={locale}
              label={t(saving ? "medical.savingMedicalAction" : "medical.checkingAccess")}
            />
          )}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button color="light" type="button" disabled={busy} onClick={onClose}>
              {t("medical.close")}
            </Button>
            <Button color="success" type="submit" disabled={busy || blocked}>
              {t(
                target.kind === "publish"
                  ? "medical.confirmPublication"
                  : editing
                    ? "medical.saveDraft"
                    : "medical.startReview",
              )}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};
