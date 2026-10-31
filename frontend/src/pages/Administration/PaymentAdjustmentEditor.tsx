import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCatalogPrice } from "../../modules/checkupino/catalog/api";
import {
  normalizeProductLocale,
  formatProductTimestamp,
} from "../../modules/checkupino/preferences/localization";
import type { PaymentRecord } from "../../modules/checkupino/payments/api";
import {
  adjustmentPath,
  adjustmentWriteFor,
  readAdjustmentContext,
  verifyAdjustmentContext,
  validAdjustmentAmount,
  type AdjustmentContext,
} from "../../modules/checkupino/payments/adjustments";
import ActionDialog from "./ActionDialog";

export default function PaymentAdjustmentEditor({
  initial,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly initial: Pick<PaymentRecord, "public_id" | "amount" | "currency">;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [context, setContext] = useState<AdjustmentContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [type, setType] = useState<"refund" | "void">("refund");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { public_id: paymentId, amount: paymentAmount, currency: paymentCurrency } = initial;
  useEffect(() => {
    const controller = new AbortController();
    void readAdjustmentContext(
      { public_id: paymentId, amount: paymentAmount, currency: paymentCurrency },
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setContext(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [paymentId, paymentAmount, paymentCurrency]);
  useEffect(() => {
    if (!context) return;
    const timer = window.setTimeout(
      () => {
        setExpired(true);
        setConfirmed(false);
      },
      Math.max(0, context.expires_at * 1000 - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [context]);
  const valid = !failed && !expired && confirmed && validAdjustmentAmount(amount, context, type);
  return (
    <ActionDialog
      target={{
        title: t("payment.control.title"),
        path: adjustmentPath(initial.public_id),
        method: "POST",
        body: {
          type,
          amount,
          expected_revision: context?.revision ?? "",
          expires_at: context?.expires_at ?? 0,
          confirmed,
        },
        write: context ? adjustmentWriteFor(context) : undefined,
        verify: async (signal) => {
          if (!context || failed || expired) throw new Error("Payment preview unavailable.");
          try {
            await verifyAdjustmentContext(context, signal);
          } catch (error) {
            if (!signal.aborted) setFailed(true);
            throw error;
          }
        },
      }}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <p className="text-muted">{t("payment.requestsNotice")}</p>
      <p>
        <bdi>{initial.public_id}</bdi>
      </p>
      {!context && !failed ? <output>{t("adminManage.loading")}</output> : null}
      {failed ? (
        <p role="alert" className="alert alert-warning">
          {t("payment.control.unavailable")}
        </p>
      ) : null}
      {expired ? (
        <p role="alert" className="alert alert-warning">
          {t("payment.control.expired")}
        </p>
      ) : null}
      {context ? (
        <>
          <dl className="row" data-payment-adjustment-preview>
            <div className="col-sm-6">
              <dt>{t("payment.amount")}</dt>
              <dd>
                <bdi>{formatCatalogPrice(context.amount, context.currency, locale)}</bdi>
              </dd>
            </div>
            <div className="col-sm-6">
              <dt>{t("payment.control.remaining")}</dt>
              <dd>
                <bdi>{formatCatalogPrice(context.remaining_amount, context.currency, locale)}</bdi>
              </dd>
            </div>
            <div className="col-12">
              <dt>{t("payment.control.expires")}</dt>
              <dd>
                <time dateTime={new Date(context.expires_at * 1000).toISOString()}>
                  {formatProductTimestamp(
                    new Date(context.expires_at * 1000).toISOString(),
                    locale,
                  )}
                </time>
              </dd>
            </div>
          </dl>
          {context.blocked ? (
            <p role="alert" className="alert alert-warning">
              {t(`payment.control.blocked.${context.blocked}`)}
            </p>
          ) : null}
        </>
      ) : null}
      <fieldset disabled={!context?.can_request || failed || expired}>
        <label htmlFor="payment-adjustment-type" className="form-label">
          {t("payment.control.type")}
        </label>
        <select
          id="payment-adjustment-type"
          className="form-select mb-3"
          value={type}
          onChange={(event) => {
            const next = event.target.value === "void" ? "void" : "refund";
            setType(next);
            setAmount(next === "void" ? (context?.remaining_amount ?? "") : "");
            setConfirmed(false);
          }}
        >
          <option value="refund">{t("payment.control.refund")}</option>
          <option value="void">{t("payment.control.void")}</option>
        </select>
        <label htmlFor="payment-adjustment-amount" className="form-label">
          {t("payment.control.amount")}
        </label>
        <input
          id="payment-adjustment-amount"
          className="form-control mb-2"
          dir="ltr"
          inputMode="numeric"
          maxLength={19}
          value={amount}
          readOnly={type === "void"}
          onChange={(event) => {
            setAmount(event.target.value);
            setConfirmed(false);
          }}
        />
        <p className="text-muted">
          {t(type === "void" ? "payment.control.voidHint" : "payment.control.amountHint")}
        </p>
        <label className="form-check mb-3">
          <input
            id="payment-adjustment-confirm"
            className="form-check-input"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="form-check-label">{t("payment.control.confirm")}</span>
        </label>
      </fieldset>
    </ActionDialog>
  );
}
