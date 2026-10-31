import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { TransportError } from "../../modules/checkupino/api/wire";
import { adminAuthAuthority } from "../../modules/checkupino/auth/authority";
import {
  isRecentPasswordCancellation,
  recentPasswordCoordinator,
} from "../../modules/checkupino/auth/recentPassword";
import {
  Dialog,
  RecentPasswordDialog,
  useRecentPasswordDialogPrompt,
} from "../../modules/checkupino/overlays";
import {
  formatProductNumber,
  formatProductTimestamp,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";
import type { AdminReservation } from "../../modules/checkupino/reservations/admin";
import {
  initialSlotQuery,
  validSlotQuery,
  readAdminReservation,
  readReplacementSlots,
  saveReservationAction,
  ReservationActionConflict,
  type ReplacementSlots,
  type ReservationAction,
} from "../../modules/checkupino/reservations/writes";

export default function AdminReservationActions({
  row,
  blocked,
  onUncertain,
  onSaved,
  onDialogChange,
}: {
  readonly row: AdminReservation;
  readonly blocked: boolean;
  readonly onUncertain: () => void;
  readonly onSaved: () => void;
  readonly onDialogChange: (open: boolean) => void;
}) {
  const { capabilities, userProfile } = useShellAuth();
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [mode, setMode] = useState<ReservationAction["kind"] | null>(null);
  const [query, setQuery] = useState(() => initialSlotQuery(row));
  const [slots, setSlots] = useState<ReplacementSlots | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slotId, setSlotId] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);
  const delivered = useRef(false);
  const readOperation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const password = useRecentPasswordDialogPrompt();
  const close = useCallback(() => {
    if (delivered.current) onUncertain();
    operation.current?.abort();
    operation.current = null;
    readOperation.current?.abort();
    setMode(null);
    setBusy(false);
    setSlots(null);
    setSlotId("");
    setStatus("");
    setReason("");
    setConfirmed(false);
  }, [onUncertain]);
  useEffect(() => {
    onDialogChange(mode !== null);
    return () => onDialogChange(false);
  }, [mode, onDialogChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
      readOperation.current?.abort();
    };
  }, []);
  useEffect(() => {
    const original = adminAuthAuthority.getSnapshot().identity;
    const roles = original?.roles.join("|");
    return adminAuthAuthority.subscribe(() => {
      const current = adminAuthAuthority.getSnapshot().identity;
      if (original?.id !== current?.id || roles !== current?.roles.join("|")) close();
    });
  }, [close]);
  useEffect(() => {
    if (mode !== "reschedule" || blocked || !validSlotQuery(query)) return undefined;
    const controller = new AbortController();
    readOperation.current = controller;
    void readReplacementSlots(row, query, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSlots(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const conflict =
          error instanceof ReservationActionConflict ||
          (error instanceof TransportError && error.wire.status === 409);
        if (conflict) onUncertain();
        setFailure(conflict ? "adminManage.conflict" : "reservationActions.slotsFailed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setReading(false);
      });
    return () => controller.abort();
  }, [mode, query, row, blocked, onUncertain]);

  const changeQuery = (next: typeof query) => {
    setSlots(null);
    setSlotId("");
    setConfirmed(false);
    setQuery(next);
    setReading(validSlotQuery(next));
    setFailure(validSlotQuery(next) ? null : "reservationActions.invalidRange");
  };

  const actions = row.actions;
  const allowed = !!userProfile && capabilities.accessAdminPanel;
  const selectedSlot = slots?.items.find((item) => item.slot_id === slotId);
  const selectedStatus = actions?.allowed_statuses.find((value) => value === status);
  const valid =
    confirmed &&
    reason.trim().length > 0 &&
    reason.length <= 1000 &&
    (mode === "reschedule"
      ? !!selectedSlot && !reading && actions?.can_reschedule
      : capabilities.overrideReservationStatus && !!selectedStatus);
  const submit = async () => {
    if (!allowed || !valid || blocked || operation.current || !actions || !mode) return;
    const action: ReservationAction =
      mode === "reschedule" ? { kind: mode, slotId } : { kind: mode, status: selectedStatus! };
    const expectedSlot = selectedSlot;
    const controller = new AbortController();
    operation.current = controller;
    delivered.current = false;
    setBusy(true);
    setFailure(null);
    try {
      await recentPasswordCoordinator.run(
        async () => {
          const fresh = await readAdminReservation(row.id, controller.signal);
          if (controller.signal.aborted) return;
          if (fresh.public_id !== row.public_id || fresh.actions?.revision !== actions.revision)
            throw new ReservationActionConflict();
          if (action.kind === "reschedule") {
            if (!fresh.actions.can_reschedule || !expectedSlot)
              throw new ReservationActionConflict();
            const available = await readReplacementSlots(fresh, query, controller.signal);
            if (controller.signal.aborted) return;
            const chosen = available.items.find((item) => item.slot_id === action.slotId);
            if (
              !chosen ||
              chosen.starts_at !== expectedSlot.starts_at ||
              chosen.ends_at !== expectedSlot.ends_at
            )
              throw new ReservationActionConflict();
          } else if (
            !fresh.actions.allowed_statuses.includes(action.status) ||
            !capabilities.overrideReservationStatus
          )
            throw new ReservationActionConflict();
          if (controller.signal.aborted) return;
          delivered.current = true;
          try {
            const result = await saveReservationAction(fresh, action, reason, controller.signal);
            if (
              action.kind === "reschedule" &&
              expectedSlot &&
              (Date.parse(result.starts_at) !== Date.parse(expectedSlot.starts_at) ||
                Date.parse(result.ends_at) !== Date.parse(expectedSlot.ends_at))
            )
              throw new Error("Saved schedule does not match the selected slot.");
          } catch (error: unknown) {
            if (error instanceof TransportError && error.wire.status === 423)
              delivered.current = false;
            throw error;
          }
        },
        password.prompt,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        delivered.current = false;
        close();
        onSaved();
      }
    } catch (error: unknown) {
      if (controller.signal.aborted || isRecentPasswordCancellation(error)) return;
      const ambiguous =
        delivered.current &&
        (!(error instanceof TransportError) ||
          ["network", "server", "cancelled"].includes(error.wire.kind));
      const conflict =
        (!delivered.current && error instanceof ReservationActionConflict) ||
        (error instanceof TransportError && error.wire.status === 409);
      if (ambiguous || conflict) onUncertain();
      delivered.current = false;
      setFailure(
        ambiguous
          ? "adminManage.uncertain"
          : conflict
            ? "adminManage.conflict"
            : "adminManage.rejected",
      );
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  };
  const open = (value: ReservationAction["kind"]) => {
    setFailure(null);
    setMode(value);
    changeQuery(initialSlotQuery(row));
  };
  return (
    <div data-reservation-actions>
      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!allowed || blocked || !actions?.can_reschedule}
          onClick={() => open("reschedule")}
        >
          {t("reservationActions.reschedule")}
        </button>
        {capabilities.overrideReservationStatus ? (
          <button
            type="button"
            className="btn btn-warning"
            disabled={!allowed || blocked || !actions?.allowed_statuses.length}
            onClick={() => open("override")}
          >
            {t("reservationActions.override")}
          </button>
        ) : null}
      </div>
      <p className="text-muted mt-2 mb-0">
        {t(
          blocked
            ? "adminManage.uncertain"
            : !actions
              ? "reservationActions.metadataUnavailable"
              : !actions.can_reschedule && !actions.allowed_statuses.length
                ? "reservationActions.unavailable"
                : "reservationActions.safeguards",
        )}
      </p>
      {mode ? (
        <>
          <Dialog
            open={!password.request}
            title={t(
              mode === "reschedule"
                ? "reservationActions.reschedule"
                : "reservationActions.override",
            )}
            locale={locale}
            busy={busy}
            onClose={close}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <fieldset disabled={busy || blocked}>
                {mode === "reschedule" ? (
                  <>
                    <p>
                      {t("reservationActions.keepMoney", {
                        amount: formatProductNumber(row.booked_amount, locale),
                        currency: row.booked_currency,
                      })}
                    </p>
                    <div className="row g-3 mb-3">
                      <div className="col-sm-6">
                        <label className="form-label" htmlFor="reschedule-from">
                          {t("reservationActions.from")}
                        </label>
                        <input
                          id="reschedule-from"
                          type="date"
                          className="form-control"
                          value={query.from}
                          onChange={(event) =>
                            changeQuery({ ...query, from: event.target.value, page: 1 })
                          }
                        />
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label" htmlFor="reschedule-to">
                          {t("reservationActions.to")}
                        </label>
                        <input
                          id="reschedule-to"
                          type="date"
                          className="form-control"
                          value={query.to}
                          onChange={(event) =>
                            changeQuery({ ...query, to: event.target.value, page: 1 })
                          }
                        />
                      </div>
                    </div>
                    <label className="form-label" htmlFor="reschedule-slot">
                      {t("reservationActions.slot")}
                    </label>
                    <select
                      id="reschedule-slot"
                      className="form-select mb-3"
                      value={slotId}
                      disabled={reading || !slots}
                      onChange={(event) => {
                        setSlotId(event.target.value);
                        setConfirmed(false);
                      }}
                    >
                      <option value="">
                        {t(
                          reading
                            ? "reservationActions.loadingSlots"
                            : "reservationActions.chooseSlot",
                        )}
                      </option>
                      {slots?.items.map((slot) => (
                        <option key={slot.slot_id} value={slot.slot_id}>
                          {formatProductTimestamp(slot.starts_at, locale)} —{" "}
                          {formatProductTimestamp(slot.ends_at, locale)}
                        </option>
                      ))}
                    </select>
                    {slots && slots.items.length === 0 ? (
                      <p>{t("reservationActions.noSlots")}</p>
                    ) : null}
                    {slots ? (
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                        <button
                          className="btn btn-light"
                          type="button"
                          disabled={reading || query.page <= 1}
                          onClick={() => changeQuery({ ...query, page: query.page - 1 })}
                        >
                          {t("reservationActions.previous")}
                        </button>
                        <span>
                          {t("reservationActions.page", {
                            page: formatProductNumber(query.page, locale),
                            total: formatProductNumber(slots.pagination.last_page, locale),
                          })}
                        </span>
                        <button
                          className="btn btn-light"
                          type="button"
                          disabled={
                            reading ||
                            query.page >= slots.pagination.last_page ||
                            query.page >= 1000
                          }
                          onClick={() => changeQuery({ ...query, page: query.page + 1 })}
                        >
                          {t("reservationActions.next")}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-muted">{t("reservationActions.rootNotice")}</p>
                    <label className="form-label" htmlFor="reservation-override-state">
                      {t("adminReservations.status")}
                    </label>
                    <select
                      id="reservation-override-state"
                      className="form-select mb-3"
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setConfirmed(false);
                      }}
                    >
                      <option value="">{t("reservationActions.chooseState")}</option>
                      {actions?.allowed_statuses.map((value) => (
                        <option key={value} value={value}>
                          {t(`adminReservations.state.${value}`)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label className="form-label" htmlFor="reservation-action-reason">
                  {t("adminManage.reason")}
                </label>
                <textarea
                  id="reservation-action-reason"
                  className="form-control mb-3"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="form-check mb-3">
                  <input
                    id="reservation-action-confirm"
                    type="checkbox"
                    className="form-check-input"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="reservation-action-confirm">
                    {t("reservationActions.confirm")}
                  </label>
                </div>
              </fieldset>
              {failure ? (
                <p role="alert" className="alert alert-warning mt-3">
                  {t(failure)}
                </p>
              ) : null}
              <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || blocked || !valid}
                >
                  {t(busy ? "adminManage.saving" : "adminManage.confirm")}
                </button>
                <button type="button" className="btn btn-light" onClick={close}>
                  {t(busy ? "reservationActions.stop" : "adminManage.close")}
                </button>
              </div>
            </form>
          </Dialog>
          <RecentPasswordDialog
            locale={locale}
            request={password.request}
            onCancel={password.cancel}
            onSubmit={password.submit}
          />
        </>
      ) : null}
    </div>
  );
}
