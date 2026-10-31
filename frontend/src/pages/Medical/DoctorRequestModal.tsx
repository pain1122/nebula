import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Label, Modal, ModalBody, ModalHeader } from "reactstrap";

import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import { checkupinoTransport } from "../../modules/checkupino/api/transport";
import { z } from "../../modules/checkupino/forms";
import type { MedicalRequest } from "../../modules/checkupino/medical/types";
import { useCreateMedicalRequestMutation } from "../../modules/checkupino/medical/writes";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

interface DoctorRequestModalProps {
  readonly reservationId: string;
  readonly isOpen: boolean;
  readonly blocked: boolean;
  readonly onClose: () => void;
  readonly onCreated: (request: MedicalRequest) => void;
  readonly onUncertain: () => void;
  readonly checkRequests: () => Promise<readonly MedicalRequest[]>;
}

const optionsSchema = z
  .array(
    z.object({
      key: z.enum(["document", "media", "archive", "multimedia"]),
      available: z.boolean(),
      allowed_mime_types: z.array(z.string()),
    }),
  )
  .length(4);
const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

// The server owns assignment, current policy, issued revisions and audit facts.
export const DoctorRequestModal = ({
  reservationId,
  isOpen,
  blocked,
  onClose,
  onCreated,
  onUncertain,
  checkRequests,
}: DoctorRequestModalProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [categories, setCategories] = useState<string[]>(["document"]);
  const [options, setOptions] = useState<z.infer<typeof optionsSchema>>([]);
  const [optionsFailed, setOptionsFailed] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void checkupinoTransport
      .request({
        method: "GET",
        path: `/api/doctor/reservations/${encodeURIComponent(reservationId)}/attachment-options`,
        signal: controller.signal,
      })
      .then((response) => {
        const body = z.object({ data: optionsSchema }).parse(response.data);
        if (!controller.signal.aborted) {
          setOptions(body.data);
          setCategories((current) =>
            current.filter((key) =>
              body.data.some((option) => option.key === key && option.available),
            ),
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setOptionsFailed(true);
      });
    return () => controller.abort();
  }, [isOpen, reservationId]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [createRequest, mutation] = useCreateMedicalRequestMutation();
  const submitting = useRef(false);
  const mounted = useRef(false);
  const delivery = useRef<ReturnType<typeof createRequest> | null>(null);
  const busy = checking || mutation.isLoading;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Cancelling a browser request cannot undo a server commit. Never replay it.
      delivery.current?.abort();
    };
  }, []);

  const close = () => {
    if (submitting.current) return;
    setTitle("");
    setInstructions("");
    setCategories(["document"]);
    setError(null);
    setInvalid(false);
    mutation.reset();
    onClose();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOpen || blocked || busy || submitting.current) return;
    if (
      !title.trim() ||
      title.trim().length > 255 ||
      instructions.length > 5000 ||
      categories.length === 0 ||
      categories.some(
        (category) => !options.some((option) => option.key === category && option.available),
      )
    ) {
      setInvalid(true);
      return;
    }
    submitting.current = true;
    setChecking(true);
    setError(null);
    setInvalid(false);
    let sent = false;
    try {
      // Recheck access immediately before sending. A failed read never becomes a POST.
      const requests = await checkRequests();
      if (!mounted.current) return;
      if (requests.some((request) => !sameId(request.reservation_public_id, reservationId))) {
        setInvalid(true);
        return;
      }
      sent = true;
      delivery.current = createRequest({
        reservationId,
        draft: {
          requestType: categories.length === 1 ? categories[0] : "attachments",
          title: title.trim(),
          instructions: instructions.trim() || null,
          attachmentCategories: categories,
        },
      });
      const request = await delivery.current.unwrap();
      if (!mounted.current) return;
      if (!request.public_id || !sameId(request.reservation_public_id, reservationId)) {
        onUncertain();
        setInvalid(true);
        return;
      }
      setTitle("");
      setInstructions("");
      setCategories(["document"]);
      onCreated(request);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure);
      // A definite validation refusal is editable; uncertain delivery requires a fresh list.
      if (
        sent &&
        !(
          typeof failure === "object" &&
          failure !== null &&
          "kind" in failure &&
          failure.kind === "validation"
        )
      ) {
        onUncertain();
      }
    } finally {
      delivery.current = null;
      submitting.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={busy ? undefined : close}
      centered
      backdrop="static"
      keyboard={!busy}
    >
      <ModalHeader toggle={busy ? undefined : close} closeAriaLabel={t("medical.close")}>
        {t("medical.newRequest")}
      </ModalHeader>
      <ModalBody>
        <form onSubmit={(event) => void submit(event)}>
          {Boolean(error) && <ErrorState error={error} locale={locale} />}
          {invalid && (
            <p className="alert alert-danger" role="alert">
              {t("medical.invalidRequest")}
            </p>
          )}
          {blocked && (
            <p className="alert alert-warning" role="alert">
              {t("medical.requestUncertain")}
            </p>
          )}
          <div className="mb-3">
            <Label htmlFor="medical-request-title">{t("medical.requestTitle")}</Label>
            <Input
              id="medical-request-title"
              value={title}
              required
              maxLength={255}
              disabled={busy || blocked}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="mb-3">
            <Label htmlFor="medical-request-instructions">{t("medical.instructions")}</Label>
            <Input
              id="medical-request-instructions"
              type="textarea"
              rows={4}
              value={instructions}
              maxLength={5000}
              disabled={busy || blocked}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>
          <fieldset className="mb-3" disabled={busy || blocked}>
            <legend className="fs-14">{t("medical.fileCategories")}</legend>
            <div className="row g-2">
              {options.map((option) => (
                <div className="col-sm-6" key={option.key}>
                  <label
                    className="border rounded p-3 d-flex gap-2 align-items-start h-100"
                    htmlFor={"medical-category-" + option.key}
                  >
                    <Input
                      id={"medical-category-" + option.key}
                      type="checkbox"
                      className="mt-1 flex-shrink-0"
                      checked={categories.includes(option.key)}
                      disabled={!option.available}
                      onChange={(event) =>
                        setCategories((current) =>
                          event.target.checked
                            ? [...current, option.key]
                            : current.filter((key) => key !== option.key),
                        )
                      }
                    />
                    <span>
                      <strong className="d-block">{t("medical.category." + option.key)}</strong>
                      <span className="small text-muted">
                        {t("medical.categoryHint." + option.key)}
                      </span>
                      {!option.available && (
                        <span className="badge bg-warning-subtle text-warning d-block mt-2">
                          {t("medical.categoryUnavailable")}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              ))}
            </div>
            {!options.length && (
              <output className="d-block">
                {t(optionsFailed ? "medical.policyUnavailable" : "medical.checkingAccess")}
              </output>
            )}
            <p className="form-text">{t("medical.categoryPolicy")}</p>
          </fieldset>
          {busy && (
            <LoadingState
              locale={locale}
              label={t(
                checking && !mutation.isLoading
                  ? "medical.checkingAccess"
                  : "medical.savingRequest",
              )}
            />
          )}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button color="light" type="button" disabled={busy} onClick={close}>
              {t("medical.close")}
            </Button>
            <Button color="success" type="submit" disabled={busy || blocked || !options.length}>
              {t("medical.issueRequest")}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};
