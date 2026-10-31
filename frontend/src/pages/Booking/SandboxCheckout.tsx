import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "reactstrap";
import {
  useStartSandboxCheckoutMutation,
  useCompleteSandboxCheckoutMutation,
  type PanelReservation,
  type SandboxCheckout as Checkout,
} from "../../modules/checkupino/booking/api";
import { Dialog } from "../../modules/checkupino/overlays";
import { ErrorState } from "../../modules/checkupino/feedback";
import { SelectField } from "../../modules/checkupino/forms";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

interface SandboxCheckoutProps {
  readonly reservation: PanelReservation;
  readonly onClose: () => void;
  readonly onFinished: (checkout: Checkout) => void;
}

const SandboxCheckout = ({ reservation, onClose, onFinished }: SandboxCheckoutProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [outcome, setOutcome] = useState<"success" | "failed">("success");
  const retryKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [start, startState] = useStartSandboxCheckoutMutation();
  const [complete, completeState] = useCompleteSandboxCheckoutMutation();
  const busy = startState.isLoading || completeState.isLoading;
  const holdExpires = checkout?.hold_expires_at ?? reservation.hold_expires_at;
  const begin = async () => {
    if (submitting.current) return;
    submitting.current = true;
    retryKey.current ??= crypto.randomUUID();
    try {
      const result = await start({
        reservationId: reservation.public_id,
        idempotencyKey: retryKey.current,
      }).unwrap();
      if (result.attempt_status !== "initiated") onFinished(result);
      else setCheckout(result);
    } catch {
      // Manual retry retains this checkout identity after an uncertain response.
    } finally {
      submitting.current = false;
    }
  };
  const finish = async () => {
    if (!checkout || submitting.current) return;
    submitting.current = true;
    try {
      onFinished(
        await complete({
          reservationId: reservation.public_id,
          attemptId: checkout.attempt_public_id,
          outcome,
        }).unwrap(),
      );
    } catch {
      // The same attempt has one terminal result; retry cannot change a canonical success.
    } finally {
      submitting.current = false;
    }
  };
  return (
    <Dialog
      open
      busy={busy}
      locale={locale}
      title={t("booking.sandboxTitle")}
      description={t("booking.sandboxNotice")}
      onClose={onClose}
      footer={
        <Button
          color="success"
          disabled={busy || (checkout !== null && !checkout.can_complete)}
          onClick={() => void (checkout ? finish() : begin())}
        >
          {busy
            ? t("booking.saving")
            : t(checkout ? "booking.sandboxConfirm" : "booking.sandboxStart")}
        </Button>
      }
    >
      <p>
        {t("booking.price")}:{" "}
        {formatProductNumber(checkout?.amount ?? reservation.booked_amount, locale)}{" "}
        {checkout?.currency ?? reservation.booked_currency}
      </p>
      <p>
        {t("booking.holdExpires")}:{" "}
        {holdExpires ? formatProductTimestamp(holdExpires, locale) : "—"}
      </p>
      {checkout && (
        <SelectField
          id="sandbox-outcome"
          label={t("booking.sandboxOutcome")}
          locale={locale}
          value={outcome}
          disabled={busy}
          options={[
            { value: "success", label: t("booking.sandboxSuccess") },
            { value: "failed", label: t("booking.sandboxFailure") },
          ]}
          onChange={(event) => setOutcome(event.target.value === "failed" ? "failed" : "success")}
        />
      )}
      {checkout && !checkout.can_complete && (
        <output className="alert alert-warning d-block">{t("booking.sandboxUnavailable")}</output>
      )}
      {(startState.error || completeState.error) && (
        <ErrorState locale={locale} error={startState.error ?? completeState.error} />
      )}
    </Dialog>
  );
};

export default SandboxCheckout;
