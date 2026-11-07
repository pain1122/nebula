import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useShellAuth } from "../../Layouts/ShellAuthContext";
import { RecentPasswordDialog } from "../../modules/checkupino/overlays";
import { useClinicalWrite } from "../../modules/checkupino/profiles/useClinicalWrite";

export function RuleAccess({ children }: { readonly children: ReactNode }) {
  const { userProfile } = useShellAuth();
  const { t } = useTranslation();
  const roles = userProfile?.roles ?? [];
  if (!roles.some((role) => ["admin", "root-admin", "doctor"].includes(role)))
    return <p role="alert">{t("adminReservations.denied")}</p>;
  return <div key={`${userProfile?.id}:${[...roles].sort().join("|")}`}>{children}</div>;
}
export function useRuleRole() {
  const { userProfile } = useShellAuth();
  const roles = userProfile?.roles ?? [];
  const staff = roles.some((role) => ["admin", "root-admin"].includes(role));
  return {
    staff,
    doctor: roles.includes("doctor"),
    root: roles.includes("root-admin"),
    prefix: `/api/${staff ? "admin" : "doctor"}/recommendation-rules`,
  };
}
export function WriteStatus({
  write,
  refresh,
}: {
  readonly write: ReturnType<typeof useClinicalWrite>;
  readonly refresh: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {write.failure && <p role="alert">{t(write.failure)}</p>}
      {write.uncertain && (
        <div className="alert alert-warning">
          <p>{t("recommendationRules.uncertain")}</p>
          <button
            type="button"
            className="btn btn-light"
            onClick={() => {
              write.refresh();
              refresh();
            }}
          >
            {t("recommendationRules.reload")}
          </button>
        </div>
      )}
      <RecentPasswordDialog
        locale={i18n.resolvedLanguage === "fa" ? "fa" : "en"}
        request={write.password.request}
        onSubmit={write.password.submit}
        onCancel={write.password.cancel}
      />
    </>
  );
}
