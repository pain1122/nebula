import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TransportError } from "../../modules/checkupino/api/wire";
import { adminAuthAuthority } from "../../modules/checkupino/auth/authority";
import {
  isRecentPasswordCancellation,
  recentPasswordCoordinator,
} from "../../modules/checkupino/auth/recentPassword";
import {
  RecentPasswordDialog,
  Dialog,
  useRecentPasswordDialogPrompt,
} from "../../modules/checkupino/overlays";
import { normalizeProductLocale } from "../../modules/checkupino/preferences/localization";
import { readProfile, saveProfileName } from "../../modules/checkupino/profiles/api";
import type { PanelProfile } from "../../modules/checkupino/profiles/contracts";

export default function ProfileNameForm({
  profile,
  target,
  onClose,
  onSaved,
  onUncertain,
}: {
  readonly profile: PanelProfile;
  readonly target: string | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onUncertain: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [first, setFirst] = useState(profile.user.first_name ?? "");
  const [last, setLast] = useState(profile.user.last_name ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
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
  const valid =
    first.trim().length > 0 &&
    first.length <= 100 &&
    last.trim().length > 0 &&
    last.length <= 100 &&
    reason.trim().length > 0 &&
    reason.length <= 1000 &&
    (first.trim() !== profile.user.first_name || last.trim() !== profile.user.last_name);
  const submit = async () => {
    if (!valid || blocked || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setFailure(null);
    let dispatched = false;
    let stale = false;
    try {
      await recentPasswordCoordinator.run(
        async () => {
          const fresh = await readProfile(target, controller.signal);
          if (fresh.user.id !== profile.user.id || fresh.revision !== profile.revision) {
            stale = true;
            throw new Error("The profile revision changed.");
          }
          if (controller.signal.aborted) return;
          dispatched = true;
          await saveProfileName(
            target,
            {
              first_name: first.trim(),
              last_name: last.trim(),
              reason: reason.trim(),
              expected_revision: fresh.revision,
            },
            controller.signal,
          );
        },
        password.prompt,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (controller.signal.aborted || isRecentPasswordCancellation(error)) return;
      const uncertain =
        dispatched &&
        !stale &&
        (!(error instanceof TransportError) ||
          ["network", "server", "cancelled"].includes(error.wire.kind));
      const conflict = stale || (error instanceof TransportError && error.wire.status === 409);
      setBlocked(uncertain || conflict);
      if (uncertain || conflict) onUncertain();
      setFailure(
        uncertain
          ? "adminManage.uncertain"
          : conflict
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
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        title={t("profileOverview.editName")}
        onClose={onClose}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          aria-label={t("profileOverview.editName")}
        >
          <fieldset disabled={busy || blocked}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="profile-first-name">
                  {t("users.field.first_name")}
                </label>
                <input
                  id="profile-first-name"
                  className="form-control"
                  required
                  maxLength={100}
                  value={first}
                  onChange={(event) => setFirst(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="profile-last-name">
                  {t("users.field.last_name")}
                </label>
                <input
                  id="profile-last-name"
                  className="form-control"
                  required
                  maxLength={100}
                  value={last}
                  onChange={(event) => setLast(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="profile-edit-reason">
                  {t("adminManage.reason")}
                </label>
                <textarea
                  id="profile-edit-reason"
                  className="form-control"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            </div>
            <p className="text-muted mt-3">{t("profileOverview.nameOnly")}</p>
          </fieldset>
          {failure ? (
            <p role="alert" className="alert alert-warning mt-3">
              {t(failure)}
            </p>
          ) : null}
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button className="btn btn-primary" type="submit" disabled={busy || blocked || !valid}>
              {t(busy ? "users.saving" : "users.save")}
            </button>
            <button className="btn btn-light" type="button" disabled={busy} onClick={onClose}>
              {t("users.cancel")}
            </button>
          </div>
        </form>
      </Dialog>
      <RecentPasswordDialog
        locale={normalizeProductLocale(i18n.resolvedLanguage)}
        request={password.request}
        onCancel={password.cancel}
        onSubmit={password.submit}
      />
    </>
  );
}
