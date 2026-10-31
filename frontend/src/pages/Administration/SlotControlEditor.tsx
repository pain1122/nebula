import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleDetail, ScheduleRow } from "../../modules/checkupino/schedules/api";
import { validScheduleDate } from "../../modules/checkupino/schedules/api";
import {
  readSlotPreview,
  slotControlPath,
  slotControlWrite,
  verifySlotPreview,
  type SlotPreview,
  type SlotSelection,
} from "../../modules/checkupino/schedules/controls";
import { formatCatalogPrice } from "../../modules/checkupino/catalog/api";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";
import ActionDialog from "./ActionDialog";

export default function SlotControlEditor({
  workplaceId,
  services,
  date,
  initial,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly workplaceId: string;
  readonly services: ScheduleDetail["services"];
  readonly date: string;
  readonly initial?: Extract<ScheduleRow, { kind: "slots" }>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [scope, setScope] = useState<SlotSelection["scope"]>(initial ? "slot" : "day");
  const [service, setService] = useState(String(initial?.checkup?.id ?? services[0]?.id ?? ""));
  const [localDate, setLocalDate] = useState(initial?.starts_at.slice(0, 10) ?? date);
  const [preview, setPreview] = useState<SlotPreview | null>(null);
  const [failure, setFailure] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [changePrice, setChangePrice] = useState(true);
  const [price, setPrice] = useState("");
  const [changeActive, setChangeActive] = useState(false);
  const [active, setActive] = useState(true);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(
      () => {
        setPreview(null);
        setConfirmed(false);
        setFailure(true);
      },
      Math.max(0, preview.preview_expires_at * 1000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [preview]);
  const reset = () => {
    pending.current?.abort();
    pending.current = null;
    setLoading(false);
    setPreview(null);
    setConfirmed(false);
    setFailure(false);
  };
  const selection: SlotSelection = {
    workplace_id: Number(workplaceId),
    checkup_id: Number(service),
    scope,
    date: localDate,
    slot_public_id: scope === "slot" ? (initial?.public_id ?? null) : null,
  };
  const choosePreview = async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setPreview(null);
    setConfirmed(false);
    setFailure(false);
    try {
      const result = await readSlotPreview(selection, controller.signal);
      if (!controller.signal.aborted) setPreview(result);
    } catch {
      if (!controller.signal.aborted) setFailure(true);
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setLoading(false);
      }
    }
  };
  const currencyCount = new Set(
    preview?.items.filter((item) => item.eligible).map((item) => item.currency),
  ).size;
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
      timeZone: preview?.period.timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  const validPrice = /^(0|[1-9]\d{0,15})$/.test(price) && BigInt(price) <= 9007199254740991n;
  const changes = {
    ...(changePrice ? { price } : {}),
    ...(changeActive ? { is_active: active } : {}),
  };
  const hasChange = preview?.items.some(
    (item) =>
      item.eligible &&
      ((changePrice && item.price !== price) || (changeActive && item.is_active !== active)),
  );
  const valid =
    !!preview?.eligible_count &&
    confirmed &&
    !!hasChange &&
    (changePrice || changeActive) &&
    (!changePrice || (validPrice && currencyCount === 1));
  const { slot_public_id } = selection;
  const fields = { checkup_id: selection.checkup_id, scope: selection.scope, date: selection.date };
  return (
    <ActionDialog
      target={{
        title: t("schedule.control.title"),
        method: "PUT",
        path: slotControlPath(workplaceId),
        body: {
          ...fields,
          ...(slot_public_id ? { slot_public_id } : {}),
          ...changes,
          expected_revision: preview?.revision ?? "",
          preview_expires_at: preview?.preview_expires_at ?? 0,
          confirmed,
        },
        verify: async (signal) => {
          if (!preview) throw new Error("Schedule preview unavailable.");
          await verifySlotPreview(preview, signal);
        },
        write: slotControlWrite,
      }}
      valid={valid}
      onClose={onClose}
      onSaved={onSaved}
      onUncertain={onUncertain}
    >
      <p className="text-muted">{t("schedule.control.notice")}</p>
      <div className="mb-3">
        <label className="form-label" htmlFor="slot-control-service">
          {t("schedule.service")}
        </label>
        <select
          id="slot-control-service"
          className="form-select"
          value={service}
          disabled={scope === "slot"}
          onChange={(event) => {
            reset();
            setService(event.target.value);
          }}
        >
          {services.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="slot-control-scope">
          {t("schedule.control.scope")}
        </label>
        <select
          id="slot-control-scope"
          className="form-select"
          value={scope}
          onChange={(event) => {
            reset();
            setScope(event.target.value as SlotSelection["scope"]);
            if (event.target.value === "slot" && initial) {
              setService(String(initial.checkup?.id ?? ""));
              setLocalDate(initial.starts_at.slice(0, 10));
            }
          }}
        >
          {initial ? <option value="slot">{t("schedule.control.slot")}</option> : null}
          <option value="day">{t("schedule.control.day")}</option>
          <option value="week">{t("schedule.control.week")}</option>
        </select>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="slot-control-date">
          {t("schedule.control.date")}
        </label>
        <input
          id="slot-control-date"
          className="form-control"
          type="date"
          dir="ltr"
          value={localDate}
          disabled={scope === "slot"}
          onChange={(event) => {
            reset();
            setLocalDate(event.target.value);
          }}
        />
      </div>
      <button
        type="button"
        className="btn btn-outline-primary mb-3"
        disabled={loading || !validScheduleDate(localDate) || !/^[1-9]\d*$/.test(service)}
        onClick={() => {
          void choosePreview();
        }}
      >
        {t(loading ? "adminManage.loading" : "schedule.control.preview")}
      </button>
      {failure ? (
        <p role="alert" className="alert alert-warning">
          {t("schedule.control.refreshRequired")}
        </p>
      ) : null}
      {preview ? (
        <>
          <p data-slot-preview-summary>
            {t("schedule.control.summary", {
              eligible: preview.eligible_count,
              total: preview.items.length,
            })}{" "}
            <bdi>
              {preview.period.from} – {preview.period.to} ({preview.period.timezone})
            </bdi>
          </p>
          <div className="table-responsive mb-3">
            <table className="table table-bordered align-middle">
              <thead>
                <tr>
                  <th>{t("schedule.occurrence")}</th>
                  <th>{t("catalog.price")}</th>
                  <th>{t("schedule.enabled")}</th>
                  <th>{t("schedule.control.eligibility")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.public_id}>
                    <td aria-label={`${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}`}>
                      <time className="d-block text-nowrap" dateTime={item.starts_at}>
                        <bdi>{formatTime(item.starts_at)}</bdi>
                      </time>
                      <time className="d-block text-nowrap" dateTime={item.ends_at}>
                        <bdi>{formatTime(item.ends_at)}</bdi>
                      </time>
                      <small className="d-block">
                        <bdi>{item.public_id}</bdi>
                      </small>
                    </td>
                    <td>
                      <bdi>{formatCatalogPrice(item.price, item.currency, locale)}</bdi>
                    </td>
                    <td>{t(item.is_active ? "activity.yes" : "activity.no")}</td>
                    <td>
                      {item.eligible
                        ? t("schedule.control.eligible")
                        : item.exclusions
                            .map((reason) => t(`schedule.control.exclusion.${reason}`))
                            .join(" / ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="form-check-label d-block mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={changePrice}
              onChange={(event) => {
                setChangePrice(event.target.checked);
                setConfirmed(false);
              }}
            />{" "}
            {t("schedule.control.changePrice")}
          </label>
          {changePrice ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="slot-control-price">
                {t("schedule.control.newPrice")}
              </label>
              <input
                id="slot-control-price"
                className="form-control"
                dir="ltr"
                inputMode="numeric"
                maxLength={16}
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setConfirmed(false);
                }}
              />
              {currencyCount > 1 ? <p role="alert">{t("schedule.control.mixedCurrency")}</p> : null}
            </div>
          ) : null}
          <label className="form-check-label d-block mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={changeActive}
              onChange={(event) => {
                setChangeActive(event.target.checked);
                setConfirmed(false);
              }}
            />{" "}
            {t("schedule.control.changeActive")}
          </label>
          {changeActive ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="slot-control-active">
                {t("schedule.enabled")}
              </label>
              <select
                id="slot-control-active"
                className="form-select"
                value={String(active)}
                onChange={(event) => {
                  setActive(event.target.value === "true");
                  setConfirmed(false);
                }}
              >
                <option value="true">{t("activity.yes")}</option>
                <option value="false">{t("activity.no")}</option>
              </select>
            </div>
          ) : null}
          <label className="form-check-label d-block mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            {t("schedule.control.confirm")}
          </label>
        </>
      ) : null}
    </ActionDialog>
  );
}
