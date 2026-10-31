import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { administrationWrite } from "../../modules/checkupino/administration/api";
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
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";

export interface ActionTarget {
  readonly title: string;
  readonly path: string;
  readonly method: "POST" | "PUT" | "DELETE";
  readonly body: Readonly<Record<string, unknown>>;
  readonly verify: (signal: AbortSignal) => Promise<void>;
  readonly write?: typeof administrationWrite;
}
export default function ActionDialog({
  target,
  children,
  valid = true,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly target: ActionTarget;
  readonly children?: ReactNode;
  readonly valid?: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeProductLocale(i18n.resolvedLanguage);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const password = useRecentPasswordDialogPrompt();
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    const original = adminAuthAuthority.getSnapshot().identity;
    return adminAuthAuthority.subscribe(() => {
      const current = adminAuthAuthority.getSnapshot().identity;
      if (original?.id !== current?.id || original?.roles.join("|") !== current?.roles.join("|")) {
        operation.current?.abort();
        onClose();
      }
    });
  }, [onClose]);
  const submit = async () => {
    if (operation.current || uncertain || !valid || !reason.trim()) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailure(null);
    let dispatched = false;
    try {
      await recentPasswordCoordinator.run(
        async () => {
          await target.verify(controller.signal);
          if (controller.signal.aborted) return;
          dispatched = true;
          await (target.write ?? administrationWrite)(
            target.path,
            target.method,
            { ...target.body, reason: reason.trim() },
            controller.signal,
          );
        },
        password.prompt,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (controller.signal.aborted || isRecentPasswordCancellation(error)) return;
      const ambiguous =
        dispatched &&
        (!(error instanceof TransportError) ||
          ["network", "server", "cancelled"].includes(error.wire.kind));
      setUncertain(ambiguous);
      if (ambiguous) onUncertain?.();
      setFailure(
        ambiguous
          ? "adminManage.uncertain"
          : error instanceof TransportError && error.wire.status === 409
            ? "adminManage.conflict"
            : "adminManage.rejected",
      );
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open={!password.request}
        busy={busy}
        title={target.title}
        locale={locale}
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset disabled={busy || uncertain}>
            {children}
            <label className="form-label d-block" htmlFor="administrative-reason">
              {t("adminManage.reason")}
            </label>
            <textarea
              id="administrative-reason"
              className="form-control mb-3"
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-muted">{t("adminManage.confirmNotice")}</p>
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
              disabled={busy || uncertain || !valid || !reason.trim()}
            >
              {t(busy ? "adminManage.saving" : "adminManage.confirm")}
            </button>
            <button type="button" className="btn btn-light" disabled={busy} onClick={onClose}>
              {t("adminManage.close")}
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
  );
}
