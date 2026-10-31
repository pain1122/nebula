import { LAYOUT_MODE_TYPES } from "../../Components/constants/layout";
import { normalizeColorPreference } from "../../core";
import { useResolvedColorMode } from "../../modules/checkupino/preferences/useResolvedColorMode";

interface LightDarkProps {
  readonly layoutMode: string;
  readonly onChangeLayoutMode: (mode: string) => void;
}

const LightDark = ({ layoutMode, onChangeLayoutMode }: LightDarkProps) => {
  const { t } = useTranslation();
  const preference = normalizeColorPreference(layoutMode);
  const resolvedMode = useResolvedColorMode(preference);
  const nextMode =
    resolvedMode === LAYOUT_MODE_TYPES.DARKMODE
      ? LAYOUT_MODE_TYPES.LIGHTMODE
      : LAYOUT_MODE_TYPES.DARKMODE;

  return (
    <div className="header-item d-none d-sm-flex">
      <button
        aria-label={
          resolvedMode === "dark" ? t("product.shell.enableLight") : t("product.shell.enableDark")
        }
        className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle light-dark-mode"
        onClick={() => onChangeLayoutMode(nextMode)}
        type="button"
      >
        <i
          aria-hidden="true"
          className={resolvedMode === "dark" ? "bx bx-sun fs-22" : "bx bx-moon fs-22"}
        />
      </button>
    </div>
  );
};

export default LightDark;
import { useTranslation } from "react-i18next";
