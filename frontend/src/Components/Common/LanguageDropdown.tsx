import { useEffect, useState } from "react";
import { Dropdown, DropdownItem, DropdownToggle } from "reactstrap";
import DropdownMenu from "./DirectionalDropdownMenu";

//i18n
import i18n, { changeProductLanguage } from "../../i18n";
import languages from "../../common/languages";
import {
  ProductLocale,
  normalizeProductLocale,
} from "../../modules/checkupino/preferences/localization";

const LanguageDropdown = () => {
  // Declare a new state variable, which we'll call "menu"
  const [selectedLang, setSelectedLang] = useState<ProductLocale>(() =>
    normalizeProductLocale(i18n.resolvedLanguage || i18n.language),
  );

  useEffect(() => {
    const handleLanguageChanged = (language: string) => {
      setSelectedLang(normalizeProductLocale(language));
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  const changeLanguageAction = (locale: ProductLocale) => {
    void changeProductLanguage(locale);
  };

  const [isLanguageDropdown, setIsLanguageDropdown] = useState<boolean>(false);
  const toggleLanguageDropdown = () => {
    setIsLanguageDropdown(!isLanguageDropdown);
  };
  return (
    <>
      <Dropdown
        isOpen={isLanguageDropdown}
        toggle={toggleLanguageDropdown}
        className="ms-1 topbar-head-dropdown header-item"
      >
        <DropdownToggle
          aria-label={i18n.t("product.language.choose")}
          className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle"
          tag="button"
        >
          <img src={languages[selectedLang].flag} alt="" height="20" className="rounded" />
        </DropdownToggle>
        <DropdownMenu className="notify-item language py-2">
          {(Object.entries(languages) as [ProductLocale, (typeof languages)[ProductLocale]][]).map(
            ([locale, language]) => (
              <DropdownItem
                key={locale}
                onClick={() => changeLanguageAction(locale)}
                className={`notify-item ${selectedLang === locale ? "active" : "none"}`}
              >
                <img src={language.flag} alt="" className="me-2 rounded" height="18" />
                <span className="align-middle">{language.label}</span>
              </DropdownItem>
            ),
          )}
        </DropdownMenu>
      </Dropdown>
    </>
  );
};

export default LanguageDropdown;
