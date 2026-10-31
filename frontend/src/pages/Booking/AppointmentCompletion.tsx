import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "reactstrap";
import {
  useCompleteAppointmentMutation,
  useDoctorReservationDetailQuery,
} from "../../modules/checkupino/booking/api";
import type { PanelReservation } from "../../modules/checkupino/booking/api";
import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import { Dialog } from "../../modules/checkupino/overlays";
import {
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

interface AppointmentCompletionProps {
  readonly reservation: PanelReservation;
  readonly blocked: boolean;
  readonly onClose: () => void;
  readonly onCompleted: () => void;
  readonly onUncertain: () => void;
}

// Presentation can change independently; the backend owns lifecycle eligibility.
export const AppointmentCompletion = ({
  reservation,
  blocked,
  onClose,
  onCompleted,
  onUncertain,
}: AppointmentCompletionProps) => {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const detail = useDoctorReservationDetailQuery(reservation.id, {
    refetchOnMountOrArgChange: true,
  });
  const [complete, mutation] = useCompleteAppointmentMutation();
  const [checking, setChecking] = useState(false),
    [changed, setChanged] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(false),
    submitting = useRef(false);
  const active = useRef<{ abort(): void } | null>(null);
  const busy = checking || mutation.isLoading || detail.isFetching;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  const matches = (fresh: PanelReservation | undefined) =>
    Boolean(
      fresh &&
      fresh.id === reservation.id &&
      fresh.public_id === reservation.public_id &&
      fresh.can_complete === true &&
      fresh.status === "confirmed" &&
      fresh.payment?.status === "paid" &&
      fresh.starts_at === reservation.starts_at &&
      fresh.ends_at === reservation.ends_at &&
      fresh.booked_amount === reservation.booked_amount &&
      fresh.booked_currency === reservation.booked_currency,
    );
  const submit = async () => {
    if (busy || submitting.current || blocked || !matches(detail.currentData)) return;
    submitting.current = true;
    setChecking(true);
    setChanged(false);
    setError(null);
    let sent = false;
    try {
      const request = detail.refetch();
      active.current = request;
      const fresh = await request.unwrap();
      if (!mounted.current) return;
      if (!matches(fresh)) {
        setChanged(true);
        return;
      }
      sent = true;
      const delivery = complete(reservation.id);
      active.current = delivery;
      const receipt = await delivery.unwrap();
      if (!mounted.current) return;
      if (
        receipt.id !== reservation.id ||
        receipt.public_id !== reservation.public_id ||
        receipt.status !== "completed" ||
        receipt.payment?.status !== "paid" ||
        receipt.booked_amount !== reservation.booked_amount ||
        receipt.booked_currency !== reservation.booked_currency ||
        receipt.starts_at !== reservation.starts_at ||
        receipt.ends_at !== reservation.ends_at
      ) {
        onUncertain();
        return;
      }
      onCompleted();
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
        onUncertain();
    } finally {
      active.current = null;
      submitting.current = false;
      if (mounted.current) setChecking(false);
    }
  };
  return (
    <Dialog
      open
      busy={busy}
      locale={locale}
      title={t("booking.completeAppointment")}
      description={t("booking.completeConfirm")}
      onClose={onClose}
      footer={
        <Button
          color="success"
          disabled={busy || blocked || !matches(detail.currentData)}
          onClick={() => void submit()}
        >
          {t(mutation.isLoading ? "booking.completingAppointment" : "booking.confirmCompletion")}
        </Button>
      }
    >
      <p>{reservation.checkup?.title}</p>
      <p>
        {t("booking.slot")}: {formatProductTimestamp(reservation.starts_at, locale)}
      </p>
      {busy && (
        <LoadingState
          locale={locale}
          label={t(
            mutation.isLoading ? "booking.completingAppointment" : "booking.checkingCompletion",
          )}
        />
      )}
      {Boolean(detail.error || error) && (
        <ErrorState locale={locale} error={error ?? detail.error} />
      )}
      {(changed || (!detail.isFetching && !matches(detail.currentData))) && (
        <p className="alert alert-warning" role="alert">
          {t("booking.completionChanged")}
        </p>
      )}
      {blocked && (
        <p className="alert alert-warning" role="alert">
          {t("booking.completionUncertain")}
        </p>
      )}
    </Dialog>
  );
};
