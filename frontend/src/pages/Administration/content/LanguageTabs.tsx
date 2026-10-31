import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Nav, NavItem } from "reactstrap";

export default function LanguageTabs({
  id,
  active,
  onChange,
  disabled = false,
}: {
  readonly id: string;
  readonly active: "en" | "fa";
  readonly onChange: (language: "en" | "fa") => void;
  readonly disabled?: boolean;
}) {
  const { t } = useTranslation();
  const buttons = useRef<Partial<Record<"en" | "fa", HTMLButtonElement>>>({});
  return (
    <Nav
      className="nav-tabs-custom card-header-tabs border-bottom-0"
      role="tablist"
      aria-label={t("content.contentLanguage")}
    >
      {(["en", "fa"] as const).map((language) => (
        <NavItem key={language}>
          <button
            type="button"
            role="tab"
            id={`${id}-tab-${language}`}
            aria-controls={`${id}-pane-${language}`}
            aria-selected={active === language}
            tabIndex={active === language ? 0 : -1}
            className={active === language ? "nav-link active" : "nav-link"}
            disabled={disabled}
            ref={(element: HTMLButtonElement | null) => {
              if (element) buttons.current[language] = element;
            }}
            onClick={() => onChange(language)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "en"
                  : event.key === "End"
                    ? "fa"
                    : language === "en"
                      ? "fa"
                      : "en";
              // With two tabs either horizontal arrow moves to the other language in LTR and RTL.
              onChange(next);
              buttons.current[next]?.focus();
            }}
          >
            <span
              className={language === "en" ? "ri-english-input me-1" : "ri-translate-2 me-1"}
              aria-hidden="true"
            />
            {t(`content.language.${language}`)}
          </button>
        </NavItem>
      ))}
    </Nav>
  );
}
